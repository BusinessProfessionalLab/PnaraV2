using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Application.Features.Orders;
using RestoPOS.Domain.Entities;
using RestoPOS.Domain.Enums;
using RestoPOS.Domain.Exceptions;

namespace RestoPOS.Application.Features.Payments;

public sealed record InitiatePosPaymentCommand(Guid OrderId, Guid DeviceId) : IRequest<PaymentDto>;
public sealed record PollPosPaymentQuery(Guid PaymentId) : IRequest<PaymentDto>;
public sealed record ConfirmCashPaymentCommand(Guid OrderId, decimal Amount) : IRequest<OrderDto>;
public sealed record RecordCardToCardCommand(Guid OrderId, decimal Amount, string ReferenceNumber) : IRequest<OrderDto>;
public sealed record RecordOnlineGatewayCommand(Guid OrderId, decimal Amount, string ReferenceNumber) : IRequest<OrderDto>;
public sealed record VoidPaymentCommand(Guid PaymentId, string? Reason) : IRequest<PaymentDto>;
public sealed record RefundPaymentCommand(Guid PaymentId, decimal Amount, string? Reason, bool VoidOrder = false) : IRequest<PaymentDto>;
public sealed record ListPaymentsByOrderQuery(Guid OrderId) : IRequest<IReadOnlyList<PaymentDto>>;

public sealed class ConfirmCashPaymentCommandValidator : AbstractValidator<ConfirmCashPaymentCommand>
{
    public ConfirmCashPaymentCommandValidator() => RuleFor(x => x.Amount).GreaterThan(0);
}

public sealed class RefundPaymentCommandValidator : AbstractValidator<RefundPaymentCommand>
{
    public RefundPaymentCommandValidator()
    {
        RuleFor(x => x.PaymentId).NotEmpty();
        RuleFor(x => x.Amount).GreaterThan(0);
    }
}

public sealed class InitiatePosPaymentCommandHandler(
    IApplicationDbContext db,
    IPosDeviceService pos,
    IOrderKitchenNotifier notifier,
    IEscPosDispatcher printer) : IRequestHandler<InitiatePosPaymentCommand, PaymentDto>
{
    public async Task<PaymentDto> Handle(InitiatePosPaymentCommand request, CancellationToken cancellationToken)
    {
        var order = await OrderLoader.Load(db, request.OrderId, cancellationToken);
        if (order.Status is OrderStatus.Draft or OrderStatus.Cancelled)
            throw new DomainException("سفارش پیش‌نویس یا لغو‌شده قابل پرداخت کارتخوان نیست.");

        order.Recalculate();
        var device = await db.PosDevices.FirstOrDefaultAsync(d => d.Id == request.DeviceId && d.IsActive, cancellationToken)
                     ?? throw new NotFoundException(nameof(PosDevice), request.DeviceId);

        var payment = new Payment
        {
            OrderId = order.Id,
            Channel = PaymentChannel.LocalPC_POS,
            Amount = order.GrandTotal,
            Status = PaymentStatus.Pending,
            Psp = device.Psp,
            PosDeviceId = device.Id,
            TerminalId = device.TerminalId
        };
        db.Payments.Add(payment);
        await db.SaveChangesAsync(cancellationToken);

        var result = await pos.InitiateAsync(new PosChargeRequest(device.Id, order.GrandTotal, order.OrderNumber, payment.Id), cancellationToken);
        if (result.Accepted && result.Status is PaymentStatus.Settled or PaymentStatus.Authorized)
        {
            payment.MarkSettled(result.TraceNumber, result.Rrn, result.ReferenceNumber, result.CardMask);
            order.MarkPaid();
            await db.SaveChangesAsync(cancellationToken);
            await FinalizeAsync(db, notifier, printer, order, cancellationToken);
        }
        else if (!result.Accepted)
        {
            payment.MarkFailed(result.ErrorMessage ?? "تراکنش کارتخوان ناموفق.");
            await db.SaveChangesAsync(cancellationToken);
        }

        return new PaymentDto(payment.Id, payment.Channel, payment.Status, payment.Amount, payment.TraceNumber, payment.Rrn, payment.PaidAt);
    }

    internal static async Task FinalizeAsync(IApplicationDbContext db, IOrderKitchenNotifier notifier, IEscPosDispatcher printer, Order order, CancellationToken ct)
    {
        var settings = await db.StoreSettings.AsNoTracking().FirstAsync(ct);
        await notifier.OrderChangedAsync(order, ct);
        await printer.PrintCustomerReceiptAsync(order, settings, ct);
    }
}

public sealed class PollPosPaymentQueryHandler(
    IApplicationDbContext db,
    IPosDeviceService pos,
    IOrderKitchenNotifier notifier,
    IEscPosDispatcher printer) : IRequestHandler<PollPosPaymentQuery, PaymentDto>
{
    public async Task<PaymentDto> Handle(PollPosPaymentQuery request, CancellationToken cancellationToken)
    {
        var payment = await db.Payments.Include(p => p.Order).ThenInclude(o => o.Items).ThenInclude(i => i.Modifiers)
            .FirstOrDefaultAsync(p => p.Id == request.PaymentId, cancellationToken)
            ?? throw new NotFoundException(nameof(Payment), request.PaymentId);

        if (payment.Status is PaymentStatus.Settled or PaymentStatus.Failed)
            return new PaymentDto(payment.Id, payment.Channel, payment.Status, payment.Amount, payment.TraceNumber, payment.Rrn, payment.PaidAt);

        var result = await pos.PollAsync(payment.Id, cancellationToken);
        if (result.Status == PaymentStatus.Settled)
        {
            payment.MarkSettled(result.TraceNumber, result.Rrn, result.ReferenceNumber, result.CardMask);
            payment.Order.MarkPaid();
            await db.SaveChangesAsync(cancellationToken);
            await InitiatePosPaymentCommandHandler.FinalizeAsync(db, notifier, printer, payment.Order, cancellationToken);
        }
        else if (result.Status == PaymentStatus.Failed)
        {
            payment.MarkFailed(result.ErrorMessage ?? "عدم تأیید کارتخوان.");
            await db.SaveChangesAsync(cancellationToken);
        }

        return new PaymentDto(payment.Id, payment.Channel, payment.Status, payment.Amount, payment.TraceNumber, payment.Rrn, payment.PaidAt);
    }
}

public sealed class ConfirmCashPaymentCommandHandler(
    IApplicationDbContext db,
    IOrderKitchenNotifier notifier,
    IEscPosDispatcher printer) : IRequestHandler<ConfirmCashPaymentCommand, OrderDto>
{
    public async Task<OrderDto> Handle(ConfirmCashPaymentCommand request, CancellationToken cancellationToken)
    {
        var order = await OrderLoader.Load(db, request.OrderId, cancellationToken);
        if (order.Status is OrderStatus.Draft)
            order.Submit();

        var payment = new Payment
        {
            OrderId = order.Id,
            Channel = PaymentChannel.Cash,
            Amount = request.Amount,
            Status = PaymentStatus.Settled,
            PaidAt = DateTime.UtcNow
        };
        db.Payments.Add(payment);
        order.MarkPaid();
        await db.SaveChangesAsync(cancellationToken);
        await InitiatePosPaymentCommandHandler.FinalizeAsync(db, notifier, printer, order, cancellationToken);
        return OrderMapping.ToDto(order);
    }
}

public sealed class RecordCardToCardCommandHandler(
    IApplicationDbContext db,
    IOrderKitchenNotifier notifier,
    IEscPosDispatcher printer) : IRequestHandler<RecordCardToCardCommand, OrderDto>
{
    public async Task<OrderDto> Handle(RecordCardToCardCommand request, CancellationToken cancellationToken)
    {
        var order = await OrderLoader.Load(db, request.OrderId, cancellationToken);
        var payment = new Payment
        {
            OrderId = order.Id,
            Channel = PaymentChannel.CardToCard,
            Amount = request.Amount,
            Status = PaymentStatus.Settled,
            ReferenceNumber = request.ReferenceNumber,
            PaidAt = DateTime.UtcNow
        };
        db.Payments.Add(payment);
        order.MarkPaid();
        await db.SaveChangesAsync(cancellationToken);
        await InitiatePosPaymentCommandHandler.FinalizeAsync(db, notifier, printer, order, cancellationToken);
        return OrderMapping.ToDto(order);
    }
}

public sealed class RecordOnlineGatewayCommandHandler(
    IApplicationDbContext db,
    IOrderKitchenNotifier notifier,
    IEscPosDispatcher printer) : IRequestHandler<RecordOnlineGatewayCommand, OrderDto>
{
    public async Task<OrderDto> Handle(RecordOnlineGatewayCommand request, CancellationToken cancellationToken)
    {
        var order = await OrderLoader.Load(db, request.OrderId, cancellationToken);
        var payment = new Payment
        {
            OrderId = order.Id,
            Channel = PaymentChannel.OnlineGateway,
            Amount = request.Amount,
            Status = PaymentStatus.Settled,
            ReferenceNumber = request.ReferenceNumber,
            PaidAt = DateTime.UtcNow
        };
        db.Payments.Add(payment);
        order.MarkPaid();
        await db.SaveChangesAsync(cancellationToken);
        await InitiatePosPaymentCommandHandler.FinalizeAsync(db, notifier, printer, order, cancellationToken);
        return OrderMapping.ToDto(order);
    }
}

public sealed class VoidPaymentCommandHandler(IApplicationDbContext db) : IRequestHandler<VoidPaymentCommand, PaymentDto>
{
    public async Task<PaymentDto> Handle(VoidPaymentCommand request, CancellationToken cancellationToken)
    {
        PaymentDto? result = null;
        await db.ExecuteResilientTransactionAsync(async ct =>
        {
            var payment = await db.Payments.Include(p => p.Order)
                .FirstOrDefaultAsync(p => p.Id == request.PaymentId, ct)
                ?? throw new NotFoundException(nameof(Payment), request.PaymentId);

            payment.MarkVoided(request.Reason);
            payment.Notes = request.Reason;
            result = new PaymentDto(payment.Id, payment.Channel, payment.Status, payment.Amount, payment.TraceNumber, payment.Rrn, payment.PaidAt);
        }, cancellationToken);
        return result!;
    }
}

public sealed class RefundPaymentCommandHandler(IApplicationDbContext db) : IRequestHandler<RefundPaymentCommand, PaymentDto>
{
    public async Task<PaymentDto> Handle(RefundPaymentCommand request, CancellationToken cancellationToken)
    {
        PaymentDto? result = null;
        await db.ExecuteResilientTransactionAsync(async ct =>
        {
            var payment = await db.Payments.Include(p => p.Order)
                .FirstOrDefaultAsync(p => p.Id == request.PaymentId, ct)
                ?? throw new NotFoundException(nameof(Payment), request.PaymentId);

            var refund = payment.CreateRefund(request.Amount, request.Reason);
            db.Payments.Add(refund);

            var settledTotal = await db.Payments
                .Where(p => p.OrderId == payment.OrderId && p.Status == PaymentStatus.Settled)
                .SumAsync(p => (decimal?)p.Amount, ct) ?? 0;
            // include the new refund that is not yet saved in query — adjust manually
            var netAfter = settledTotal + refund.Amount;
            if (request.VoidOrder || netAfter <= 0)
                payment.Order.VoidAfterRefund();

            result = new PaymentDto(refund.Id, refund.Channel, refund.Status, refund.Amount, refund.TraceNumber, refund.Rrn, refund.PaidAt);
        }, cancellationToken);
        return result!;
    }
}

public sealed class ListPaymentsByOrderQueryHandler(IApplicationDbContext db)
    : IRequestHandler<ListPaymentsByOrderQuery, IReadOnlyList<PaymentDto>>
{
    public async Task<IReadOnlyList<PaymentDto>> Handle(ListPaymentsByOrderQuery request, CancellationToken cancellationToken)
    {
        if (!await db.Orders.AnyAsync(o => o.Id == request.OrderId, cancellationToken))
            throw new NotFoundException(nameof(Order), request.OrderId);

        return await db.Payments.AsNoTracking()
            .Where(p => p.OrderId == request.OrderId)
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new PaymentDto(p.Id, p.Channel, p.Status, p.Amount, p.TraceNumber, p.Rrn, p.PaidAt))
            .ToListAsync(cancellationToken);
    }
}
