using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using RestoPOS.Domain.Common;

namespace RestoPOS.API.Hubs;

[Authorize(Policy = Permissions.KitchenDisplay)]
public sealed class OrderKitchenHub : Hub
{
    public Task JoinStation(string station)
    {
        var group = station.Equals("bar", StringComparison.OrdinalIgnoreCase) ? "bar" : "kitchen";
        return Groups.AddToGroupAsync(Context.ConnectionId, group);
    }

    public Task LeaveStation(string station)
    {
        var group = station.Equals("bar", StringComparison.OrdinalIgnoreCase) ? "bar" : "kitchen";
        return Groups.RemoveFromGroupAsync(Context.ConnectionId, group);
    }
}
