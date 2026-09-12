using FluentValidation;
using MediatR;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Domain.Exceptions;

namespace RestoPOS.Application.Features.Auth;

public sealed class LoginCommandValidator : AbstractValidator<LoginCommand>
{
    public LoginCommandValidator()
    {
        RuleFor(x => x.UserName).NotEmpty();
        RuleFor(x => x.Password).NotEmpty();
    }
}

public sealed class LoginCommandHandler(IIdentityService identity) : IRequestHandler<LoginCommand, AuthResponse>
{
    public async Task<AuthResponse> Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        var result = await identity.LoginAsync(request.UserName, request.Password, cancellationToken);
        if (!result.Succeeded)
            throw new ForbiddenException(result.Error ?? "ورود ناموفق.");

        return Map(result);
    }

    internal static AuthResponse Map(AuthResult result) => new(
        result.AccessToken,
        result.RefreshToken,
        result.ExpiresAt,
        result.UserId,
        result.UserName,
        result.FullName,
        result.Roles,
        result.Permissions);
}

public sealed class RefreshTokenCommandHandler(IIdentityService identity) : IRequestHandler<RefreshTokenCommand, AuthResponse>
{
    public async Task<AuthResponse> Handle(RefreshTokenCommand request, CancellationToken cancellationToken)
    {
        var result = await identity.RefreshAsync(request.RefreshToken, cancellationToken);
        if (!result.Succeeded)
            throw new ForbiddenException(result.Error ?? "توکن نامعتبر است.");
        return LoginCommandHandler.Map(result);
    }
}

public sealed class CreateStaffCommandValidator : AbstractValidator<CreateStaffCommand>
{
    public CreateStaffCommandValidator()
    {
        RuleFor(x => x.UserName).NotEmpty().MinimumLength(3);
        RuleFor(x => x.Password).NotEmpty().MinimumLength(8);
        RuleFor(x => x.FullName).NotEmpty();
    }
}

public sealed class CreateStaffCommandHandler(IIdentityService identity) : IRequestHandler<CreateStaffCommand, Guid>
{
    public Task<Guid> Handle(CreateStaffCommand request, CancellationToken cancellationToken) =>
        identity.CreateStaffAsync(request.UserName, request.Password, request.FullName, request.Email, request.PhoneNumber, request.PersonnelCode, request.Roles, cancellationToken);
}

public sealed class AssignRolesCommandHandler(IIdentityService identity) : IRequestHandler<AssignRolesCommand>
{
    public Task Handle(AssignRolesCommand request, CancellationToken cancellationToken) =>
        identity.AssignRolesAsync(request.StaffId, request.Roles, cancellationToken);
}

public sealed class CreateRoleCommandHandler(IIdentityService identity) : IRequestHandler<CreateRoleCommand, Guid>
{
    public Task<Guid> Handle(CreateRoleCommand request, CancellationToken cancellationToken) =>
        identity.CreateRoleAsync(request.Name, request.Description, request.Permissions, cancellationToken);
}

public sealed class UpdateRolePermissionsCommandHandler(IIdentityService identity) : IRequestHandler<UpdateRolePermissionsCommand>
{
    public Task Handle(UpdateRolePermissionsCommand request, CancellationToken cancellationToken) =>
        identity.UpdateRolePermissionsAsync(request.RoleId, request.Permissions, cancellationToken);
}

public sealed class GetStaffListQueryHandler(IIdentityService identity) : IRequestHandler<GetStaffListQuery, IReadOnlyList<StaffDto>>
{
    public async Task<IReadOnlyList<StaffDto>> Handle(GetStaffListQuery request, CancellationToken cancellationToken)
    {
        var staff = await identity.ListStaffAsync(cancellationToken);
        return staff.Select(s => new StaffDto(s.Id, s.UserName, s.FullName, s.Email, s.PhoneNumber, s.PersonnelCode, s.IsActive, s.Roles)).ToList();
    }
}

public sealed class GetStaffByIdQueryHandler(IIdentityService identity) : IRequestHandler<GetStaffByIdQuery, StaffDto>
{
    public async Task<StaffDto> Handle(GetStaffByIdQuery request, CancellationToken cancellationToken)
    {
        var staff = await identity.GetStaffByIdAsync(request.StaffId, cancellationToken)
                    ?? throw new NotFoundException("Staff", request.StaffId);
        return new StaffDto(staff.Id, staff.UserName, staff.FullName, staff.Email, staff.PhoneNumber, staff.PersonnelCode, staff.IsActive, staff.Roles);
    }
}

public sealed class UpdateStaffCommandValidator : AbstractValidator<UpdateStaffCommand>
{
    public UpdateStaffCommandValidator() => RuleFor(x => x.FullName).NotEmpty();
}

public sealed class UpdateStaffCommandHandler(IIdentityService identity) : IRequestHandler<UpdateStaffCommand>
{
    public Task Handle(UpdateStaffCommand request, CancellationToken cancellationToken) =>
        identity.UpdateStaffAsync(request.StaffId, request.FullName, request.Email, request.PhoneNumber, request.PersonnelCode, request.IsActive, cancellationToken);
}

public sealed class DeactivateStaffCommandHandler(IIdentityService identity) : IRequestHandler<DeactivateStaffCommand>
{
    public Task Handle(DeactivateStaffCommand request, CancellationToken cancellationToken) =>
        identity.SetActiveAsync(request.StaffId, false, cancellationToken);
}

public sealed class ChangePasswordCommandValidator : AbstractValidator<ChangePasswordCommand>
{
    public ChangePasswordCommandValidator() => RuleFor(x => x.NewPassword).NotEmpty().MinimumLength(8);
}

public sealed class ChangePasswordCommandHandler(IIdentityService identity) : IRequestHandler<ChangePasswordCommand>
{
    public Task Handle(ChangePasswordCommand request, CancellationToken cancellationToken) =>
        identity.ChangePasswordAsync(request.StaffId, request.NewPassword, cancellationToken);
}

public sealed class ListRolesQueryHandler(IIdentityService identity) : IRequestHandler<ListRolesQuery, IReadOnlyList<RoleDto>>
{
    public async Task<IReadOnlyList<RoleDto>> Handle(ListRolesQuery request, CancellationToken cancellationToken)
    {
        var roles = await identity.ListRolesAsync(cancellationToken);
        return roles.Select(r => new RoleDto(r.Id, r.Name, r.Description, r.Permissions)).ToList();
    }
}

public sealed class GetPermissionCatalogQueryHandler(IIdentityService identity)
    : IRequestHandler<GetPermissionCatalogQuery, IReadOnlyList<PermissionCatalogDto>>
{
    public Task<IReadOnlyList<PermissionCatalogDto>> Handle(GetPermissionCatalogQuery request, CancellationToken cancellationToken)
    {
        var catalog = identity.GetPermissionsCatalog()
            .Select(p => new PermissionCatalogDto(p.Code, p.DisplayNameFa, p.Module))
            .ToList();
        return Task.FromResult<IReadOnlyList<PermissionCatalogDto>>(catalog);
    }
}
