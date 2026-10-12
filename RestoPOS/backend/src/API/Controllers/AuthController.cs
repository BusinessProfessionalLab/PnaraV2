using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RestoPOS.Application.Features.Auth;
using RestoPOS.API.Licensing;

namespace RestoPOS.API.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(ISender sender, OfflineLicenseService license, IWebHostEnvironment environment) : ControllerBase
{
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResponse>> Login(LoginCommand command, CancellationToken ct)
    {
        if (environment.IsProduction() && license.Validate() is null)
            return StatusCode(StatusCodes.Status403Forbidden, new { title = "LicenseExpired", detail = "لایسنس این نرم‌افزار معتبر نیست یا مدت اعتبار آن به پایان رسیده است." });
        return Ok(await sender.Send(command, ct));
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResponse>> Refresh(RefreshTokenCommand command, CancellationToken ct) =>
        Ok(await sender.Send(command, ct));
}
