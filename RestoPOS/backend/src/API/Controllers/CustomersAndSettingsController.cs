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
    [HttpGet("loyalty/overview")]
    public Task<LoyaltyOverviewDto> LoyaltyOverview(CancellationToken ct) =>
        sender.Send(new LoyaltyOverviewQuery(), ct);

    [HttpPost("online-registration")]
    [AllowAnonymous]
    public Task<CustomerDto> RegisterOnline(RegisterOnlineCustomerCommand command, CancellationToken ct) =>
        sender.Send(command, ct);

    [HttpGet]
    public Task<IReadOnlyList<CustomerDto>> Search([FromQuery] string? term, CancellationToken ct) =>
        sender.Send(new SearchCustomersQuery(term), ct);

    [HttpGet("paged")]
    public Task<PaginatedList<CustomerDto>> Paged(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? term = null,
        [FromQuery] bool? marketingConsent = null,
        [FromQuery] string? tier = null,
        CancellationToken ct = default) =>
        sender.Send(new GetCustomersPagedQuery(page, pageSize, term, marketingConsent, tier), ct);

    [HttpGet("by-id/{id:guid}")]
    public Task<CustomerDto> ById(Guid id, CancellationToken ct) =>
        sender.Send(new GetCustomerByIdQuery(id), ct);

    [HttpGet("{id:guid}/wallet")]
    public Task<CustomerWalletBalanceDto> Wallet(Guid id, CancellationToken ct) =>
        sender.Send(new GetCustomerWalletBalanceQuery(id), ct);

    [HttpGet("{id:guid}/loyalty/portal-preview")]
    public Task<CustomerPortalPreviewDto> LoyaltyPortalPreview(Guid id, CancellationToken ct) =>
        sender.Send(new GetCustomerPortalPreviewQuery(id), ct);

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

    [HttpGet("{id:guid}/loyalty/transactions")]
    public Task<PaginatedList<LoyaltyPointTransactionDto>> LoyaltyHistory(
        Guid id,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default) =>
        sender.Send(new GetCustomerPointHistoryQuery(id, page, pageSize), ct);

    [HttpGet("loyalty/settings")]
    public Task<LoyaltyProgramSettingsDto> LoyaltySettings(CancellationToken ct) =>
        sender.Send(new GetLoyaltyProgramSettingsQuery(), ct);

    [HttpPut("loyalty/settings")]
    [Authorize(Policy = Permissions.CustomersManage)]
    public Task<LoyaltyProgramSettingsDto> UpdateLoyaltySettings(UpdateLoyaltyProgramSettingsCommand command, CancellationToken ct) =>
        sender.Send(command, ct);

    [HttpGet("loyalty/rewards")]
    public Task<IReadOnlyList<LoyaltyRewardDto>> LoyaltyRewards([FromQuery] bool includeInactive = false, CancellationToken ct = default) =>
        sender.Send(new GetLoyaltyRewardsQuery(includeInactive), ct);

    [HttpPost("loyalty/rewards")]
    [Authorize(Policy = Permissions.CustomersManage)]
    public Task<LoyaltyRewardDto> CreateLoyaltyReward(CreateLoyaltyRewardCommand command, CancellationToken ct) =>
        sender.Send(command, ct);

    [HttpPut("loyalty/rewards/{id:guid}")]
    [Authorize(Policy = Permissions.CustomersManage)]
    public Task<LoyaltyRewardDto> UpdateLoyaltyReward(Guid id, UpdateLoyaltyRewardCommand command, CancellationToken ct) =>
        sender.Send(command with { Id = id }, ct);

    [HttpDelete("loyalty/rewards/{id:guid}")]
    [Authorize(Policy = Permissions.CustomersManage)]
    public async Task<IActionResult> DeactivateLoyaltyReward(Guid id, CancellationToken ct)
    {
        await sender.Send(new DeactivateLoyaltyRewardCommand(id), ct);
        return NoContent();
    }

    [HttpPost("{customerId:guid}/loyalty/rewards/{rewardId:guid}/redeem")]
    [Authorize(Policy = Permissions.CustomersManage)]
    public Task<RedeemedLoyaltyRewardDto> RedeemLoyaltyReward(Guid customerId, Guid rewardId, CancellationToken ct) =>
        sender.Send(new RedeemLoyaltyRewardCommand(customerId, rewardId), ct);

    [HttpGet("loyalty/campaigns")]
    public Task<PaginatedList<LoyaltyCampaignDto>> LoyaltyCampaigns([FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default) =>
        sender.Send(new GetLoyaltyCampaignsQuery(page, pageSize), ct);

    [HttpPost("loyalty/campaigns")]
    [Authorize(Policy = Permissions.CustomersManage)]
    public Task<LoyaltyCampaignDto> QueueLoyaltyCampaign(QueueLoyaltyCampaignCommand command, CancellationToken ct) =>
        sender.Send(command, ct);
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
