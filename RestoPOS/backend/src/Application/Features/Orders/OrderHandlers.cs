using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Domain.Entities;
using RestoPOS.Domain.Enums;
using RestoPOS.Domain.Exceptions;
using RestoPOS.Domain.ValueObjects;

namespace RestoPOS.Application.Features.Orders;

internal static class OrderLoader
{
    public static async Task<Order> Load(IApplicationDbContext db, Guid id, CancellationToken ct) =>
        await db.Orders
            .Include(o => o.Items).ThenInclude(i => i.Modifiers)
            .Include(o => o.Payments)
            .FirstOrDefaultAsync(o => o.Id == id, ct)
        ?? throw new NotFoundException(nameof(Order), id);

    public static async Task EnsureCustomerAsync(IApplicationDbContext db, Order order, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(order.CustomerPhone))
            return;

        var customer = await db.Customers.FirstOrDefaultAsync(c => c.PhoneNumber == order.CustomerPhone, ct);
        if (customer is null)
        {
            customer = Customer.Create(order.CustomerPhone, null);
            db.Customers.Add(customer);
            await db.SaveChangesAsync(ct);
        }

        order.CustomerId = customer.Id;
        customer.LastVisitAt = DateTime.UtcNow;
    }
}

public sealed class CreateDraftOrderCommandHandler(
    IApplicationDbContext db,
    ICurrentUserService current,
    IOrderNumberGenerator numbers) : IRequestHandler<CreateDraftOrderCommand, OrderDto>
{
    public async Task<OrderDto> Handle(CreateDraftOrderCommand request, CancellationToken cancellationToken)
    {
        var cashierId = current.UserId ?? throw new ForbiddenException();
        var settings = await db.StoreSettings.AsNoTracking().FirstAsync(cancellationToken);
        var shift = await db.CashierShifts.FirstOrDefaultAsync(s => s.StaffId == cashierId && s.Status == ShiftStatus.Open, cancellationToken);

        string? phone = null;
        if (!string.IsNullOrWhiteSpace(request.CustomerPhone))
            phone = new PhoneNumber(request.CustomerPhone).Value;

        var order = Order.CreateDraft(await numbers.NextAsync(cancellationToken), request.OrderType, cashierId, shift?.Id, settings.VatRate, request.TableNumber, phone);
        order.Notes = request.Notes;
        order.DiningTableId = request.DiningTableId;
        if (request.DiningTableId is Guid tableId)
        {
            var table = await db.DiningTables.FirstOrDefaultAsync(t => t.Id == tableId, cancellationToken)
                        ?? throw new NotFoundException(nameof(DiningTable), tableId);
            order.TableNumber ??= table.Code;
        }
        db.Orders.Add(order);
        await db.SaveChangesAsync(cancellationToken);
        return OrderMapping.ToDto(order);
    }
}

public sealed class AddOrderItemCommandValidator : AbstractValidator<AddOrderItemCommand>
{
    public AddOrderItemCommandValidator()
    {
        RuleFor(x => x.OrderId).NotEmpty();
        RuleFor(x => x.MenuItemId).NotEmpty();
        RuleFor(x => x.Quantity).GreaterThan(0);
    }
}

public sealed class AddOrderItemCommandHandler(IApplicationDbContext db) : IRequestHandler<AddOrderItemCommand, OrderDto>
{
    public async Task<OrderDto> Handle(AddOrderItemCommand request, CancellationToken cancellationToken)
    {
        var order = await OrderLoader.Load(db, request.OrderId, cancellationToken);
        var menuItem = await db.MenuItems.Include(m => m.Modifiers)
            .FirstOrDefaultAsync(m => m.Id == request.MenuItemId, cancellationToken)
            ?? throw new NotFoundException(nameof(MenuItem), request.MenuItemId);

        var line = order.AddItem(menuItem, request.Quantity, request.Notes);
        foreach (var modifierReq in request.Modifiers ?? [])
        {
            var modifier = menuItem.Modifiers.FirstOrDefault(m => m.Id == modifierReq.MenuItemModifierId)
                           ?? throw new NotFoundException(nameof(MenuItemModifier), modifierReq.MenuItemModifierId);
            line.AddModifier(modifier, modifierReq.Quantity);
        }

        order.Recalculate();
        await db.SaveChangesAsync(cancellationToken);
        return OrderMapping.ToDto(order);
    }
}

public sealed class RemoveOrderItemCommandHandler(IApplicationDbContext db) : IRequestHandler<RemoveOrderItemCommand, OrderDto>
{
    public async Task<OrderDto> Handle(RemoveOrderItemCommand request, CancellationToken cancellationToken)
    {
        var order = await OrderLoader.Load(db, request.OrderId, cancellationToken);
        order.RemoveItem(request.OrderItemId);
        order.Recalculate();
        await db.SaveChangesAsync(cancellationToken);
        return OrderMapping.ToDto(order);
    }
}

public sealed class ApplyDiscountCommandHandler(IApplicationDbContext db) : IRequestHandler<ApplyDiscountCommand, OrderDto>
{
    public async Task<OrderDto> Handle(ApplyDiscountCommand request, CancellationToken cancellationToken)
    {
        var order = await OrderLoader.Load(db, request.OrderId, cancellationToken);
        order.ApplyDiscount(request.Percent, request.Amount);
        order.Recalculate();
        await db.SaveChangesAsync(cancellationToken);
        return OrderMapping.ToDto(order);
    }
}

public sealed class SubmitOrderCommandHandler(
    IApplicationDbContext db,
    IOrderKitchenNotifier notifier,
    IEscPosDispatcher printer) : IRequestHandler<SubmitOrderCommand, OrderDto>
{
    public async Task<OrderDto> Handle(SubmitOrderCommand request, CancellationToken cancellationToken)
    {
        var order = await OrderLoader.Load(db, request.OrderId, cancellationToken);
        await OrderLoader.EnsureCustomerAsync(db, order, cancellationToken);
        order.Submit();
        await db.SaveChangesAsync(cancellationToken);

        var settings = await db.StoreSettings.AsNoTracking().FirstAsync(cancellationToken);
        await notifier.OrderChangedAsync(order, cancellationToken);
        if (order.KitchenTicketItems().Any())
            await printer.PrintPrepTicketAsync(order, TicketStation.Kitchen, settings, cancellationToken);
        if (order.BarTicketItems().Any())
            await printer.PrintPrepTicketAsync(order, TicketStation.Bar, settings, cancellationToken);

        return OrderMapping.ToDto(order);
    }
}

public sealed class UpdateOrderStatusCommandHandler(IApplicationDbContext db, IOrderKitchenNotifier notifier)
    : IRequestHandler<UpdateOrderStatusCommand, OrderDto>
{
    public async Task<OrderDto> Handle(UpdateOrderStatusCommand request, CancellationToken cancellationToken)
    {
        var order = await OrderLoader.Load(db, request.OrderId, cancellationToken);
        switch (request.Status)
        {
            case OrderStatus.InPreparation:
                order.StartPreparation();
                break;
            case OrderStatus.Ready:
                order.MarkReady();
                break;
            default:
                throw new DomainException("این انتقال وضعیت از این نقطهٔ پایانی پشتیبانی نمی‌شود.");
        }

        await db.SaveChangesAsync(cancellationToken);
        await notifier.OrderChangedAsync(order, cancellationToken);
        return OrderMapping.ToDto(order);
    }
}

public sealed class CancelDraftOrderCommandHandler(IApplicationDbContext db) : IRequestHandler<CancelDraftOrderCommand>
{
    public async Task Handle(CancelDraftOrderCommand request, CancellationToken cancellationToken)
    {
        var order = await OrderLoader.Load(db, request.OrderId, cancellationToken);
        if (order.Status != OrderStatus.Draft)
            throw new DomainException("فقط پیش‌نویس را می‌توان بدون ردپا حذف کرد.");

        db.Orders.Remove(order);
        await db.SaveChangesAsync(cancellationToken);
    }
}

public sealed class CancelOrderCommandHandler(IApplicationDbContext db, IOrderKitchenNotifier notifier)
    : IRequestHandler<CancelOrderCommand, OrderDto>
{
    public async Task<OrderDto> Handle(CancelOrderCommand request, CancellationToken cancellationToken)
    {
        var order = await OrderLoader.Load(db, request.OrderId, cancellationToken);
        order.Cancel(request.Reason, reverseInventory: true);
        await db.SaveChangesAsync(cancellationToken);
        await notifier.OrderChangedAsync(order, cancellationToken);
        return OrderMapping.ToDto(order);
    }
}

public sealed class GetOrderByIdQueryHandler(IApplicationDbContext db) : IRequestHandler<GetOrderByIdQuery, OrderDto>
{
    public async Task<OrderDto> Handle(GetOrderByIdQuery request, CancellationToken cancellationToken)
    {
        var order = await OrderLoader.Load(db, request.Id, cancellationToken);
        return OrderMapping.ToDto(order);
    }
}

public sealed class GetActiveOrdersQueryHandler(IApplicationDbContext db) : IRequestHandler<GetActiveOrdersQuery, IReadOnlyList<OrderDto>>
{
    public async Task<IReadOnlyList<OrderDto>> Handle(GetActiveOrdersQuery request, CancellationToken cancellationToken)
    {
        var active = new[] { OrderStatus.Submitted, OrderStatus.InPreparation, OrderStatus.Ready, OrderStatus.Draft };
        var orders = await db.Orders
            .Include(o => o.Items).ThenInclude(i => i.Modifiers)
            .Include(o => o.Payments)
            .Where(o => active.Contains(o.Status))
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync(cancellationToken);
        return orders.Select(OrderMapping.ToDto).ToList();
    }
}

public sealed class ApplyServiceChargeCommandHandler(IApplicationDbContext db) : IRequestHandler<ApplyServiceChargeCommand, OrderDto>
{
    public async Task<OrderDto> Handle(ApplyServiceChargeCommand request, CancellationToken cancellationToken)
    {
        var order = await OrderLoader.Load(db, request.OrderId, cancellationToken);
        order.ApplyServiceCharge(request.Amount);
        order.Recalculate();
        await db.SaveChangesAsync(cancellationToken);
        return OrderMapping.ToDto(order);
    }
}

public sealed class UpdateOrderNotesCommandHandler(IApplicationDbContext db) : IRequestHandler<UpdateOrderNotesCommand, OrderDto>
{
    public async Task<OrderDto> Handle(UpdateOrderNotesCommand request, CancellationToken cancellationToken)
    {
        var order = await OrderLoader.Load(db, request.OrderId, cancellationToken);
        order.UpdateNotes(request.Notes);
        await db.SaveChangesAsync(cancellationToken);
        return OrderMapping.ToDto(order);
    }
}

public sealed class SplitBillCommandValidator : AbstractValidator<SplitBillCommand>
{
    public SplitBillCommandValidator()
    {
        RuleFor(x => x.OrderId).NotEmpty();
        RuleFor(x => x.OrderItemIds).NotEmpty().WithMessage("حداقل یک آیتم برای تفکیک صورتحساب لازم است.");
    }
}

public sealed class SplitBillCommandHandler(
    IApplicationDbContext db,
    ICurrentUserService current,
    IOrderNumberGenerator numbers) : IRequestHandler<SplitBillCommand, OrderDto>
{
    public async Task<OrderDto> Handle(SplitBillCommand request, CancellationToken cancellationToken)
    {
        OrderDto? result = null;
        await db.ExecuteResilientTransactionAsync(async ct =>
        {
            var source = await OrderLoader.Load(db, request.OrderId, ct);
            if (source.Status is not (OrderStatus.Draft or OrderStatus.Submitted or OrderStatus.InPreparation or OrderStatus.Ready))
                throw new DomainException("فقط سفارش باز قابل تفکیک صورتحساب است.");

            var moveIds = request.OrderItemIds.ToHashSet();
            var moving = source.Items.Where(i => moveIds.Contains(i.Id)).ToList();
            if (moving.Count != moveIds.Count)
                throw new DomainException("یک یا چند آیتم برای تفکیک یافت نشد.");
            if (moving.Count == source.Items.Count)
                throw new DomainException("نمی‌توان تمام آیتم‌ها را به سفارش جدید منتقل کرد.");

            var cashierId = current.UserId ?? throw new ForbiddenException();
            var settings = await db.StoreSettings.AsNoTracking().FirstAsync(ct);
            var shift = await db.CashierShifts.FirstOrDefaultAsync(s => s.StaffId == cashierId && s.Status == ShiftStatus.Open, ct);

            var split = Order.CreateDraft(
                await numbers.NextAsync(ct),
                source.OrderType,
                cashierId,
                shift?.Id ?? source.ShiftId,
                settings.VatRate,
                source.TableNumber,
                source.CustomerPhone);
            split.DiningTableId = source.DiningTableId;
            split.CustomerId = source.CustomerId;
            split.Notes = $"تفکیک از سفارش {source.OrderNumber}";

            foreach (var item in moving)
            {
                source.Items.Remove(item);
                item.OrderId = split.Id;
                split.Items.Add(item);
            }

            source.Recalculate();
            split.Recalculate();
            db.Orders.Add(split);
            result = OrderMapping.ToDto(split);
        }, cancellationToken);

        return result!;
    }
}

public sealed class MergeBillsCommandHandler(IApplicationDbContext db) : IRequestHandler<MergeBillsCommand, OrderDto>
{
    public async Task<OrderDto> Handle(MergeBillsCommand request, CancellationToken cancellationToken)
    {
        OrderDto? result = null;
        await db.ExecuteResilientTransactionAsync(async ct =>
        {
            if (request.SourceOrderId == request.TargetOrderId)
                throw new DomainException("سفارش مبدأ و مقصد نمی‌توانند یکسان باشند.");

            var source = await OrderLoader.Load(db, request.SourceOrderId, ct);
            var target = await OrderLoader.Load(db, request.TargetOrderId, ct);

            if (source.Status is OrderStatus.Paid or OrderStatus.Cancelled)
                throw new DomainException("سفارش مبدأ قابل ادغام نیست.");
            if (target.Status is not (OrderStatus.Draft or OrderStatus.Submitted or OrderStatus.InPreparation or OrderStatus.Ready))
                throw new DomainException("سفارش مقصد باید باز باشد.");
            if (source.Payments.Any(p => p.Status == PaymentStatus.Settled))
                throw new DomainException("سفارش مبدأ دارای پرداخت تسویه‌شده است.");

            var items = source.Items.ToList();
            foreach (var item in items)
            {
                source.Items.Remove(item);
                item.OrderId = target.Id;
                target.Items.Add(item);
            }

            source.MergedIntoOrderId = target.Id;
            source.Cancel("ادغام با سفارش " + target.OrderNumber, reverseInventory: false);
            target.Recalculate();
            result = OrderMapping.ToDto(target);
        }, cancellationToken);

        return result!;
    }
}

public sealed class GetOrderHistoryQueryHandler(IApplicationDbContext db)
    : IRequestHandler<GetOrderHistoryQuery, RestoPOS.Application.Common.Models.PaginatedList<OrderDto>>
{
    public async Task<RestoPOS.Application.Common.Models.PaginatedList<OrderDto>> Handle(
        GetOrderHistoryQuery request, CancellationToken cancellationToken)
    {
        var query = db.Orders
            .Include(o => o.Items).ThenInclude(i => i.Modifiers)
            .Include(o => o.Payments)
            .AsQueryable();

        if (request.FromUtc is not null)
            query = query.Where(o => o.CreatedAt >= request.FromUtc);
        if (request.ToUtc is not null)
            query = query.Where(o => o.CreatedAt <= request.ToUtc);
        if (request.Status is not null)
            query = query.Where(o => o.Status == request.Status);

        var total = await query.CountAsync(cancellationToken);
        var orders = await query.OrderByDescending(o => o.CreatedAt)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync(cancellationToken);

        return new RestoPOS.Application.Common.Models.PaginatedList<OrderDto>
        {
            Items = orders.Select(OrderMapping.ToDto).ToList(),
            Page = request.Page,
            PageSize = request.PageSize,
            TotalCount = total
        };
    }
}

