using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Infrastructure.Persistence;

namespace RestoPOS.Infrastructure.Customers;

public sealed class LoyaltySmsDispatcher(
    IServiceScopeFactory scopeFactory,
    ILogger<LoyaltySmsDispatcher> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(15));
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await DispatchBatchAsync(stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception exception) { logger.LogError(exception, "Loyalty SMS queue dispatch failed."); }

            try { await timer.WaitForNextTickAsync(stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
        }
    }

    private async Task DispatchBatchAsync(CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var provider = scope.ServiceProvider.GetRequiredService<ILoyaltySmsProvider>();
        var now = DateTime.UtcNow;
        var settings = await db.StoreSettings.AsNoTracking().FirstOrDefaultAsync(cancellationToken);
        if (settings is null || !settings.LoyaltySmsEnabled || IsQuietHour(settings.SmsQuietHoursStart, settings.SmsQuietHoursEnd))
            return;

        var messages = await db.LoyaltySmsMessages
            .Include(x => x.Customer)
            .Include(x => x.Campaign)
            .Where(x => ((x.Status == "Queued" && (x.NextAttemptAtUtc == null || x.NextAttemptAtUtc <= now)) ||
                         (x.Status == "Failed" && x.AttemptCount < 5 && x.NextAttemptAtUtc <= now))
                        && (x.Campaign.ScheduledAtUtc == null || x.Campaign.ScheduledAtUtc <= now))
            .OrderBy(x => x.Campaign.QueuedAtUtc)
            .ThenBy(x => x.CreatedAt)
            .Take(25)
            .ToListAsync(cancellationToken);

        foreach (var message in messages)
        {
            if (!message.IsTransactional && !message.Customer.MarketingConsent)
            {
                message.Status = "Suppressed";
                continue;
            }

            try
            {
                message.AttemptCount++;
                message.ProviderMessageId = await provider.SendAsync(message.PhoneNumber, message.Body, cancellationToken);
                message.SentAtUtc = DateTime.UtcNow;
                message.Status = "Sent";
                message.LastError = null;
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                message.LastError = exception.Message[..Math.Min(exception.Message.Length, 1000)];
                message.Status = message.AttemptCount >= 5 ? "Dead" : "Failed";
                message.NextAttemptAtUtc = DateTime.UtcNow.AddMinutes(Math.Min(360, Math.Pow(2, message.AttemptCount)));
                logger.LogWarning(exception, "SMS delivery attempt {Attempt} failed for message {MessageId}.", message.AttemptCount, message.Id);
            }
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    private static bool IsQuietHour(string startText, string endText)
    {
        if (!TimeOnly.TryParse(startText, out var start) || !TimeOnly.TryParse(endText, out var end)) return false;
        var localTime = TimeOnly.FromDateTime(DateTime.Now);
        return start <= end ? localTime >= start && localTime < end : localTime >= start || localTime < end;
    }
}
