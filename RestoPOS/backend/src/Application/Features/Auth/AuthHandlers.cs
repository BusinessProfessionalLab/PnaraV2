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
