using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RestoPOS.Application.Features.Customers;
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

    [HttpGet("{phone}")]
    public Task<CustomerDto> ByPhone(string phone, CancellationToken ct) =>
        sender.Send(new GetCustomerByPhoneQuery(phone), ct);
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
