using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Domain.Common;
using RestoPOS.Domain.Entities;
using RestoPOS.Domain.Exceptions;
using RestoPOS.Infrastructure.Identity;
using RestoPOS.Infrastructure.Persistence;

namespace RestoPOS.Infrastructure.Identity;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";
    public string Issuer { get; set; } = "ToastIranPOS";
    public string Audience { get; set; } = "ToastIranPOS";
    public string Key { get; set; } = default!;
    public int ExpiryMinutes { get; set; } = 480;
    public int RefreshExpiryDays { get; set; } = 14;
}

public sealed class IdentityService(
    UserManager<ApplicationUser> users,
    RoleManager<ApplicationRole> roles,
    ApplicationDbContext db,
    IOptions<JwtOptions> jwtOptions) : IIdentityService
{
    public async Task<AuthResult> LoginAsync(string userName, string password, CancellationToken cancellationToken = default)
    {
        var user = await users.FindByNameAsync(userName);
        if (user is null || !user.IsActive || !await users.CheckPasswordAsync(user, password))
            return Fail("نام کاربری یا رمز عبور نادرست است.");

        user.LastLoginAt = DateTime.UtcNow;
        return await IssueAsync(user, cancellationToken);
    }

    public async Task<AuthResult> RefreshAsync(string refreshToken, CancellationToken cancellationToken = default)
    {
        var user = await users.Users.FirstOrDefaultAsync(u => u.RefreshToken == refreshToken, cancellationToken);
        if (user is null || user.RefreshTokenExpiry is null || user.RefreshTokenExpiry < DateTime.UtcNow || !user.IsActive)
            return Fail("رفرش‌توکن نامعتبر یا منقضی است.");

        return await IssueAsync(user, cancellationToken);
    }

    public async Task<Guid> CreateStaffAsync(string userName, string password, string fullName, string? email, string? phone, string? personnelCode, IEnumerable<string> roleNames, CancellationToken cancellationToken = default)
    {
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = userName,
            Email = email,
            PhoneNumber = phone,
            FullName = fullName,
            PersonnelCode = personnelCode,
            IsActive = true
        };
        var created = await users.CreateAsync(user, password);
        if (!created.Succeeded)
            throw new DomainException(string.Join(" | ", created.Errors.Select(e => e.Description)));

        if (roleNames.Any())
        {
            var assign = await users.AddToRolesAsync(user, roleNames);
            if (!assign.Succeeded)
                throw new DomainException(string.Join(" | ", assign.Errors.Select(e => e.Description)));
        }

        return user.Id;
    }

    public async Task AssignRolesAsync(Guid userId, IEnumerable<string> roleNames, CancellationToken cancellationToken = default)
    {
        var user = await users.FindByIdAsync(userId.ToString()) ?? throw new NotFoundException("Staff", userId);
        var current = await users.GetRolesAsync(user);
        await users.RemoveFromRolesAsync(user, current);
        await users.AddToRolesAsync(user, roleNames);
    }

    public async Task<Guid> CreateRoleAsync(string name, string? description, IEnumerable<string> permissionCodes, CancellationToken cancellationToken = default)
    {
        var role = new ApplicationRole { Id = Guid.NewGuid(), Name = name, Description = description };
        var result = await roles.CreateAsync(role);
        if (!result.Succeeded)
            throw new DomainException(string.Join(" | ", result.Errors.Select(e => e.Description)));

        await SyncPermissionsAsync(role.Id, permissionCodes, cancellationToken);
        return role.Id;
    }

    public async Task UpdateRolePermissionsAsync(Guid roleId, IEnumerable<string> permissionCodes, CancellationToken cancellationToken = default)
    {
        if (await roles.FindByIdAsync(roleId.ToString()) is null)
            throw new NotFoundException("Role", roleId);
        await SyncPermissionsAsync(roleId, permissionCodes, cancellationToken);
    }

    public async Task<IReadOnlyList<StaffRecord>> ListStaffAsync(CancellationToken cancellationToken = default)
    {
        var list = await users.Users.AsNoTracking().OrderBy(u => u.FullName).ToListAsync(cancellationToken);
        var result = new List<StaffRecord>();
        foreach (var user in list)
        {
            var userRoles = await users.GetRolesAsync(user);
            result.Add(new StaffRecord(user.Id, user.UserName ?? "", user.FullName, user.Email, user.PhoneNumber, user.PersonnelCode, user.IsActive, userRoles.ToList()));
        }
        return result;
    }

    public async Task SetActiveAsync(Guid userId, bool isActive, CancellationToken cancellationToken = default)
    {
        var user = await users.FindByIdAsync(userId.ToString()) ?? throw new NotFoundException("Staff", userId);
        user.IsActive = isActive;
        await users.UpdateAsync(user);
    }

    public async Task<string?> GetStaffDisplayNameAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await users.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        return user?.FullName;
    }

    private async Task SyncPermissionsAsync(Guid roleId, IEnumerable<string> permissionCodes, CancellationToken cancellationToken)
    {
        var existing = db.RolePermissions.Where(rp => rp.RoleId == roleId);
        db.RolePermissions.RemoveRange(existing);

        var codes = permissionCodes.Distinct().ToList();
        var permissions = await db.Permissions.Where(p => codes.Contains(p.Code)).ToListAsync(cancellationToken);
        foreach (var permission in permissions)
            db.RolePermissions.Add(new RolePermission { RoleId = roleId, PermissionId = permission.Id });

        await db.SaveChangesAsync(cancellationToken);
    }

    private async Task<AuthResult> IssueAsync(ApplicationUser user, CancellationToken cancellationToken)
    {
        var userRoles = await users.GetRolesAsync(user);
        var roleIds = await roles.Roles.Where(r => userRoles.Contains(r.Name!)).Select(r => r.Id).ToListAsync(cancellationToken);
        var permissions = await db.RolePermissions
            .Where(rp => roleIds.Contains(rp.RoleId))
            .Select(rp => rp.Permission.Code)
            .Distinct()
            .ToListAsync(cancellationToken);

        var options = jwtOptions.Value;
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(options.Key));
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.UniqueName, user.UserName ?? user.FullName),
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.FullName)
        };
        claims.AddRange(userRoles.Select(r => new Claim(ClaimTypes.Role, r)));
        claims.AddRange(permissions.Select(p => new Claim("permission", p)));

        var expires = DateTime.UtcNow.AddMinutes(options.ExpiryMinutes);
        var token = new JwtSecurityToken(options.Issuer, options.Audience, claims, expires: expires, signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
        var access = new JwtSecurityTokenHandler().WriteToken(token);

        user.RefreshToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
        user.RefreshTokenExpiry = DateTime.UtcNow.AddDays(options.RefreshExpiryDays);
        await users.UpdateAsync(user);

        return new AuthResult(true, user.Id, user.UserName ?? "", user.FullName, access, user.RefreshToken, expires, userRoles.ToList(), permissions, null);
    }

    private static AuthResult Fail(string error) =>
        new(false, Guid.Empty, "", "", "", "", DateTime.MinValue, [], [], error);
}
