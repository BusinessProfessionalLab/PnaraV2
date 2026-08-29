using System.Net.Sockets;
using System.Text;
using Microsoft.Extensions.Logging;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Domain.Entities;
using RestoPOS.Domain.Enums;
using RestoPOS.Domain.Services;

namespace RestoPOS.Infrastructure.Printing;

/// <summary>
/// ESC/POS thermal dispatcher. Sends customer receipts and barista/kitchen prep tickets
/// to a LAN printer (port 9100) and always mirrors a UTF-8 ticket file for diagnostics.
/// </summary>
public sealed class EscPosThermalDispatcher(ILogger<EscPosThermalDispatcher> logger) : IEscPosDispatcher
{
    public Task PrintCustomerReceiptAsync(Order order, StoreSettings settings, CancellationToken cancellationToken = default) =>
        DispatchAsync(BuildCustomer(order, settings), settings, $"receipt-{order.OrderNumber}", cancellationToken);

    public Task PrintPrepTicketAsync(Order order, TicketStation station, StoreSettings settings, CancellationToken cancellationToken = default)
    {
        var items = station == TicketStation.Bar ? order.BarTicketItems() : order.KitchenTicketItems();
        var payload = BuildPrep(order, settings, station, items);
        return DispatchAsync(payload, settings, $"prep-{station}-{order.OrderNumber}", cancellationToken);
    }

    private async Task DispatchAsync(byte[] payload, StoreSettings settings, string fileStem, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory("tickets");
        await File.WriteAllBytesAsync(Path.Combine("tickets", $"{fileStem}.bin"), payload, cancellationToken);
        await File.WriteAllTextAsync(Path.Combine("tickets", $"{fileStem}.txt"), Encoding.UTF8.GetString(payload.Where(b => b >= 32 || b is 10 or 13).ToArray()), cancellationToken);

        if (string.IsNullOrWhiteSpace(settings.ThermalPrinterHost))
        {
            logger.LogInformation("Thermal printer host is empty; ticket stored at tickets/{File}.txt", fileStem);
            return;
        }

        try
        {
            using var client = new TcpClient();
            await client.ConnectAsync(settings.ThermalPrinterHost, settings.ThermalPrinterPort, cancellationToken);
            await using var stream = client.GetStream();
            await stream.WriteAsync(payload, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "ESC/POS dispatch to {Host}:{Port} failed; file fallback kept.", settings.ThermalPrinterHost, settings.ThermalPrinterPort);
        }
    }

    private static byte[] BuildCustomer(Order order, StoreSettings settings)
    {
        var sb = new StringBuilder();
        sb.Append('\x1b').Append('@');
        sb.AppendLine(settings.StoreName);
        if (!string.IsNullOrWhiteSpace(settings.ReceiptHeader))
            sb.AppendLine(settings.ReceiptHeader);
        sb.AppendLine($"فاکتور {order.OrderNumber}");
        sb.AppendLine(PersianDateTime.ToShamsiDateTime(order.CreatedAt));
        sb.AppendLine($"نوع: {order.OrderType}  میز: {order.TableNumber ?? "-"}");
        sb.AppendLine("------------------------------");
        foreach (var item in order.Items)
        {
            sb.AppendLine($"{item.Quantity} x {item.Title}  {item.LineTotal:N0}");
            foreach (var modifier in item.Modifiers)
                sb.AppendLine($"   + {modifier.Name}");
        }
        sb.AppendLine("------------------------------");
        sb.AppendLine($"جمع جزء: {order.Subtotal:N0}");
        sb.AppendLine($"افزودنی: {order.ModifiersTotal:N0}");
        sb.AppendLine($"تخفیف: {order.DiscountAmount:N0}");
        sb.AppendLine($"ارزش افزوده ({order.TaxRate:P0}): {order.TaxAmount:N0}");
        sb.AppendLine($"قابل پرداخت: {order.GrandTotal:N0} ریال");
        if (!string.IsNullOrWhiteSpace(settings.ReceiptFooter))
            sb.AppendLine(settings.ReceiptFooter);
        sb.AppendLine("ToastIran POS — Pnara");
        sb.Append('\x1d').Append('V').Append((char)0);
        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    private static byte[] BuildPrep(Order order, StoreSettings settings, TicketStation station, IEnumerable<OrderItem> items)
    {
        var title = station == TicketStation.Bar ? "فیش باریستا" : "فیش آشپزخانه";
        var sb = new StringBuilder();
        sb.Append('\x1b').Append('@');
        sb.AppendLine($"*** {title} ***");
        sb.AppendLine(settings.StoreName);
        sb.AppendLine($"#{order.OrderNumber}  {order.OrderType}  میز {order.TableNumber ?? "-"}");
        sb.AppendLine(PersianDateTime.ToShamsiDateTime(order.SubmittedAt ?? order.CreatedAt));
        sb.AppendLine("------------------------------");
        foreach (var item in items)
        {
            sb.AppendLine($"{item.Quantity} x {item.Title}");
            foreach (var modifier in item.Modifiers)
                sb.AppendLine($"   + {modifier.Name}");
            if (!string.IsNullOrWhiteSpace(item.Notes))
                sb.AppendLine($"   یادداشت: {item.Notes}");
        }
        sb.Append('\x1d').Append('V').Append((char)0);
        return Encoding.UTF8.GetBytes(sb.ToString());
    }
}
