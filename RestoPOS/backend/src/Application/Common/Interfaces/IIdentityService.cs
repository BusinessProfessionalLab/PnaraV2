namespace RestoPOS.Application.Common.Interfaces;

public sealed record AuthResult(
    bool Succeeded,
    Guid UserId,
    string UserName,
    string FullName,
    string AccessToken,
    string RefreshToken,
    DateTime ExpiresAt,
    IReadOnlyList<string> Roles,
    IReadOnlyList<string> Permissions,
    string? Error);

public sealed record StaffRecord(
    Guid Id,
    string UserName,
    string FullName,
    string? Email,
    string? PhoneNumber,
    string? PersonnelCode,
    bool IsActive,
    IReadOnlyList<string> Roles);

public interface IIdentityService
{
    Task<AuthResult> LoginAsync(string userName, string password, CancellationToken cancellationToken = default);
    Task<AuthResult> RefreshAsync(string refreshToken, CancellationToken cancellationToken = default);
    Task<Guid> CreateStaffAsync(string userName, string password, string fullName, string? email, string? phone, string? personnelCode, IEnumerable<string> roles, CancellationToken cancellationToken = default);
    Task AssignRolesAsync(Guid userId, IEnumerable<string> roles, CancellationToken cancellationToken = default);
    Task<Guid> CreateRoleAsync(string name, string? description, IEnumerable<string> permissionCodes, CancellationToken cancellationToken = default);
    Task UpdateRolePermissionsAsync(Guid roleId, IEnumerable<string> permissionCodes, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<StaffRecord>> ListStaffAsync(CancellationToken cancellationToken = default);
    Task SetActiveAsync(Guid userId, bool isActive, CancellationToken cancellationToken = default);
    Task<string?> GetStaffDisplayNameAsync(Guid userId, CancellationToken cancellationToken = default);
}
