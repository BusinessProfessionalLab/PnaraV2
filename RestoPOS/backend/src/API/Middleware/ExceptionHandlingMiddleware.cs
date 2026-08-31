using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using FluentValidation;
using RestoPOS.Domain.Exceptions;

namespace RestoPOS.API.Middleware;

public sealed class ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
{
    public async Task Invoke(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception ex)
        {
            await WriteAsync(context, ex);
        }
    }

    private async Task WriteAsync(HttpContext context, Exception exception)
    {
        var (status, title, detail) = exception switch
        {
            DbUpdateConcurrencyException concurrency => (
                HttpStatusCode.Conflict,
                "OrderConcurrencyConflict",
                DescribeConcurrency(concurrency)
            ),
            ValidationException validationException => (HttpStatusCode.BadRequest, "ValidationFailed", validationException.Message),
            NotFoundException notFound => (HttpStatusCode.NotFound, "NotFound", notFound.Message),
            ForbiddenException forbidden => (HttpStatusCode.Forbidden, "Forbidden", forbidden.Message),
            ConflictException conflict => (HttpStatusCode.Conflict, "Conflict", conflict.Message),
            DomainException domain => (HttpStatusCode.UnprocessableEntity, "BusinessRule", domain.Message),
            _ => (HttpStatusCode.InternalServerError, "ServerError", exception.Message)
        };

        if (exception is DbUpdateConcurrencyException concurrencyException)
        {
            var entities = string.Join(", ", concurrencyException.Entries.Select(e =>
                $"{e.Metadata.ClrType.Name}:{e.Properties.FirstOrDefault(p => p.Metadata.IsPrimaryKey())?.CurrentValue}"));
            logger.LogWarning(exception, "EF concurrency conflict. Entries: {Entries}", entities);
        }
        else if (status == HttpStatusCode.InternalServerError)
            logger.LogError(exception, "Unhandled exception");
        else
            logger.LogWarning(exception, "Handled domain exception {Title}", title);

        context.Response.ContentType = "application/json";
        context.Response.StatusCode = (int)status;

        object errors = exception is ValidationException validation
            ? validation.Errors.Select(e => new { e.PropertyName, e.ErrorMessage })
            : new[] { new { PropertyName = "", ErrorMessage = exception.Message } };

        var payload = new { title, status = (int)status, detail, errors };
        await context.Response.WriteAsync(JsonSerializer.Serialize(payload));
    }

    private static string DescribeConcurrency(DbUpdateConcurrencyException exception)
    {
        var entities = string.Join(", ", exception.Entries.Select(e => e.Metadata.ClrType.Name));
        return string.IsNullOrWhiteSpace(entities)
            ? "رکورد توسط درخواست دیگری تغییر یا حذف شده است. لطفاً اطلاعات سفارش را تازه‌سازی کنید."
            : $"رکورد {entities} توسط درخواست دیگری تغییر یا حذف شده است. لطفاً اطلاعات سفارش را تازه‌سازی کنید.";
    }
}
