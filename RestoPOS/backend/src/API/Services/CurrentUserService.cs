using System.Security.Claims;
using RestoPOS.Application.Common.Interfaces;

namespace RestoPOS.API.Services;

public sealed class CurrentUserService(IHttpContextAccessor accessor) : ICurrentUserService
{
    public Guid? UserId =>
        Guid.TryParse(accessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

    public string? UserName => accessor.HttpContext?.User.Identity?.Name;

    public IReadOnlyCollection<string> Permissions =>
        accessor.HttpContext?.User.FindAll("permission").Select(c => c.Value).ToList() ?? [];

    public bool IsAuthenticated => accessor.HttpContext?.User.Identity?.IsAuthenticated == true;

    public string? IpAddress => accessor.HttpContext?.Connection.RemoteIpAddress?.ToString();
}
