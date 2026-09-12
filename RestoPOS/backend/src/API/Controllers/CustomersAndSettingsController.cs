using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RestoPOS.Application.Common.Models;
using RestoPOS.Application.Features.Customers;
using RestoPOS.Application.Features.Orders;
using RestoPOS.Application.Features.Settings;
using RestoPOS.Domain.Common;

namespace RestoPOS.API.Controllers;

[ApiController]
[Route("api/customers")]
[Authorize(Policy = Permissions.CustomersView)]
public sealed class CustomersController(ISender sender) : ControllerBase
{
    [HttpGet]
    public Task<IReadOnlyList<CustomerDto>> Search([FromQuery] string? term, CancellationToken ct) =>
        sender.Send(new SearchCustomersQuery(term), ct);

    [HttpGet("paged")]
    public Task<PaginatedList<CustomerDto>> Paged(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? term = null,
        CancellationToken ct = default) =>
        sender.Send(new GetCustomersPagedQuery(page, pageSize, term), ct);

    [HttpGet("by-id/{id:guid}")]
    public Task<CustomerDto> ById(Guid id, CancellationToken ct) =>
        sender.Send(new GetCustomerByIdQuery(id), ct);

    [HttpGet("{phone}")]
    public Task<CustomerDto> ByPhone(string phone, CancellationToken ct) =>
        sender.Send(new GetCustomerByPhoneQuery(phone), ct);

    [HttpPost]
    [Authorize(Policy = Permissions.CustomersManage)]
    public Task<CustomerDto> Create(CreateCustomerCommand command, CancellationToken ct) =>
        sender.Send(command, ct);

    [HttpPut("{id:guid}")]
    [Authorize(Policy = Permissions.CustomersManage)]
    public Task<CustomerDto> Update(Guid id, UpdateCustomerCommand command, CancellationToken ct) =>
        sender.Send(command with { Id = id }, ct);

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = Permissions.CustomersManage)]
    public async Task<IActionResult> SoftDelete(Guid id, CancellationToken ct)
    {
        await sender.Send(new SoftDeleteCustomerCommand(id), ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/loyalty")]
    [Authorize(Policy = Permissions.CustomersManage)]
    public Task<CustomerDto> AdjustLoyalty(Guid id, AdjustLoyaltyPointsCommand command, CancellationToken ct) =>
        sender.Send(command with { CustomerId = id }, ct);

    [HttpGet("{id:guid}/orders")]
    public Task<PaginatedList<OrderDto>> OrderHistory(
        Guid id,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default) =>
        sender.Send(new GetCustomerOrderHistoryQuery(id, page, pageSize), ct);
}

[ApiController]
[Route("api/settings")]
[Authorize]
public sealed class SettingsController(ISender sender) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = Permissions.SettingsView)]
    public Task<StoreSettingsDto> Get(CancellationToken ct) =>
        sender.Send(new GetStoreSettingsQuery(), ct);

    [HttpPut]
    [Authorize(Policy = Permissions.SettingsUpdate)]
    public Task<StoreSettingsDto> Update(UpdateStoreSettingsCommand command, CancellationToken ct) =>
        sender.Send(command, ct);
}
