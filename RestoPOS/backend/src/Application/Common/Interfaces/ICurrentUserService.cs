namespace RestoPOS.Application.Common.Interfaces;

public interface ICurrentUserService
{
    Guid? UserId { get; }
    string? UserName { get; }
    IReadOnlyCollection<string> Permissions { get; }
    bool IsAuthenticated { get; }
    string? IpAddress { get; }
}

public interface IDateTimeProvider
{
    DateTime UtcNow { get; }
}
