using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace RestoPOS.Infrastructure.Identity;

/// <summary>
/// Keeps the configured Identity policy for regular accounts. Only accounts
/// created or reset through staff management use the simpler six-character rule.
/// </summary>
public sealed class StaffAwarePasswordValidator(IOptions<IdentityOptions> identityOptions)
    : IPasswordValidator<ApplicationUser>
{
    public Task<IdentityResult> ValidateAsync(
        UserManager<ApplicationUser> manager,
        ApplicationUser user,
        string? password)
    {
        var policy = identityOptions.Value.Password;
        var minimumLength = user.UseStaffPasswordPolicy ? 6 : policy.RequiredLength;
        var value = password ?? string.Empty;
        var errors = new List<IdentityError>();

        if (value.Length < minimumLength)
            errors.Add(manager.ErrorDescriber.PasswordTooShort(minimumLength));

        if (value.Distinct().Count() < policy.RequiredUniqueChars)
            errors.Add(manager.ErrorDescriber.PasswordRequiresUniqueChars(policy.RequiredUniqueChars));

        if (!user.UseStaffPasswordPolicy)
        {
            if (policy.RequireDigit && !value.Any(char.IsDigit))
                errors.Add(manager.ErrorDescriber.PasswordRequiresDigit());
            if (policy.RequireLowercase && !value.Any(char.IsLower))
                errors.Add(manager.ErrorDescriber.PasswordRequiresLower());
            if (policy.RequireUppercase && !value.Any(char.IsUpper))
                errors.Add(manager.ErrorDescriber.PasswordRequiresUpper());
            if (policy.RequireNonAlphanumeric && !value.Any(c => !char.IsLetterOrDigit(c)))
                errors.Add(manager.ErrorDescriber.PasswordRequiresNonAlphanumeric());
        }

        return Task.FromResult(errors.Count == 0 ? IdentityResult.Success : IdentityResult.Failed(errors.ToArray()));
    }
}
