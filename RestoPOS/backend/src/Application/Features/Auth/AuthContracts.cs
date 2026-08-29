using RestoPOS.Domain.Enums;

namespace RestoPOS.Application.Features.Auth;

public sealed record LoginCommand(string UserName, string Password) : MediatR.IRequest<AuthResponse>;
public sealed record RefreshTokenCommand(string RefreshToken) : MediatR.IRequest<AuthResponse>;

public sealed record AuthResponse(
    string AccessToken,
    string RefreshToken,
    DateTime ExpiresAt,
    Guid UserId,
    string UserName,
    string FullName,
    IReadOnlyList<string> Roles,
    IReadOnlyList<string> Permissions);

public sealed record CreateStaffCommand(
    string UserName,
    string Password,
    string FullName,
    string? Email,
    string? PhoneNumber,
    string? PersonnelCode,
    IReadOnlyList<string> Roles) : MediatR.IRequest<Guid>;

public sealed record AssignRolesCommand(Guid StaffId, IReadOnlyList<string> Roles) : MediatR.IRequest;

public sealed record CreateRoleCommand(string Name, string? Description, IReadOnlyList<string> Permissions) : MediatR.IRequest<Guid>;

public sealed record UpdateRolePermissionsCommand(Guid RoleId, IReadOnlyList<string> Permissions) : MediatR.IRequest;

public sealed record GetStaffListQuery : MediatR.IRequest<IReadOnlyList<StaffDto>>;

public sealed record StaffDto(
    Guid Id,
    string UserName,
    string FullName,
    string? Email,
    string? PhoneNumber,
    string? PersonnelCode,
    bool IsActive,
    IReadOnlyList<string> Roles);
