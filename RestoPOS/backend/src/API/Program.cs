using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using RestoPOS.API.Authorization;
using RestoPOS.API.Hubs;
using RestoPOS.API.Middleware;
using RestoPOS.API.Services;
using RestoPOS.Application;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Infrastructure;
using RestoPOS.Infrastructure.Identity;
using RestoPOS.Infrastructure.Persistence;
using Serilog;

var migrateAndSeed = args.Contains("--migrate-and-seed", StringComparer.OrdinalIgnoreCase);
var hostArgs = args.Where(arg => !string.Equals(arg, "--migrate-and-seed", StringComparison.OrdinalIgnoreCase)).ToArray();
var productionDataDirectory = Environment.GetEnvironmentVariable("PNARA_DATA_DIRECTORY")
    ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "Pnara");
var dataDirectory = Environment.GetEnvironmentVariable("PNARA_DATA_DIRECTORY")
    ?? (Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") == "Production"
        ? productionDataDirectory
        : Path.Combine(AppContext.BaseDirectory, "data"));
var logDirectory = Path.Combine(dataDirectory, "logs");
Directory.CreateDirectory(logDirectory);
Directory.CreateDirectory(Path.Combine(dataDirectory, "tickets"));

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(hostArgs);
    if (builder.Environment.IsProduction())
    {
        builder.Configuration.AddJsonFile(
            Path.Combine(productionDataDirectory, "appsettings.Production.json"),
            optional: true,
            reloadOnChange: false);
    }

    builder.Host.UseWindowsService(options => options.ServiceName = "CafeApiService");

    builder.Host.UseSerilog((ctx, _, cfg) =>
        cfg.ReadFrom.Configuration(ctx.Configuration)
            .Enrich.FromLogContext()
            .WriteTo.Console()
            .WriteTo.File(Path.Combine(logDirectory, "pnara-.log"), rollingInterval: RollingInterval.Day));

    var urls = builder.Configuration["Urls"];
    if (!string.IsNullOrWhiteSpace(urls))
        builder.WebHost.UseUrls(urls);

    builder.Services.AddApplication();
    builder.Services.AddInfrastructure(builder.Configuration);
    builder.Services.AddHttpContextAccessor();
    builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();
    builder.Services.AddScoped<IOrderKitchenNotifier, SignalROrderKitchenNotifier>();
    builder.Services.AddControllers().AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    });
    builder.Services.AddSignalR();
    builder.Services.AddPermissionPolicies();

    var jwt = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>()
              ?? throw new InvalidOperationException("Jwt configuration is missing.");
    var jwtKey = jwt.Key;
    if (builder.Environment.IsEnvironment("Testing") && string.IsNullOrWhiteSpace(jwtKey))
        jwtKey = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32));
    if (Encoding.UTF8.GetByteCount(jwtKey ?? string.Empty) < 32)
        throw new InvalidOperationException("Jwt:Key must contain at least 32 bytes. Configure a development user-secret or the protected production configuration.");

    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = jwt.Issuer,
                ValidAudience = jwt.Audience,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey!)),
                ClockSkew = TimeSpan.FromMinutes(1)
            };
            options.Events = new JwtBearerEvents
            {
                OnMessageReceived = context =>
                {
                    var accessToken = context.Request.Query["access_token"];
                    if (!string.IsNullOrEmpty(accessToken) && context.HttpContext.Request.Path.StartsWithSegments("/hubs"))
                        context.Token = accessToken;
                    return Task.CompletedTask;
                }
            };
        });

    if (builder.Environment.IsDevelopment())
    {
        builder.Services.AddCors(options =>
            options.AddPolicy("spa", policy =>
                policy.WithOrigins("http://localhost:3000", "http://127.0.0.1:3000")
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials()));
    }

    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen(options =>
    {
        options.SwaggerDoc("v1", new OpenApiInfo
        {
            Title = "Pnara API",
            Version = "v1",
            Description = "Pnara — Restaurant & Cafe POS / WMS for the Iranian market"
        });
        options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
        {
            Name = "Authorization",
            Type = SecuritySchemeType.Http,
            Scheme = "bearer",
            BearerFormat = "JWT",
            In = ParameterLocation.Header,
            Description = "JWT Bearer token"
        });
        options.AddSecurityRequirement(new OpenApiSecurityRequirement
        {
            {
                new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } },
                Array.Empty<string>()
            }
        });
    });

    var app = builder.Build();

    app.UseMiddleware<ExceptionHandlingMiddleware>();
    app.UseSerilogRequestLogging();
    if (app.Environment.IsDevelopment())
    {
        app.UseSwagger();
        app.UseSwaggerUI();
        app.UseCors("spa");
    }

    app.UseDefaultFiles();
    app.UseStaticFiles();
    app.UseAuthentication();
    app.UseAuthorization();
    app.MapControllers();
    app.MapHub<OrderKitchenHub>("/hubs/kitchen");
    app.MapGet("/health", HealthAsync);
    app.MapGet("/api/health", HealthAsync);

    if (!app.Environment.IsEnvironment("Testing"))
    {
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<ApplicationRole>>();
        var seedLogger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("Seed");
        var bootstrapPassword = app.Configuration["BootstrapAdmin:Password"];
        if (migrateAndSeed)
        {
            await ApplicationDbContextSeed.SeedAsync(db, userManager, roleManager, seedLogger, bootstrapPassword, applyMigrations: true);
        }
        else
        {
            if (app.Environment.IsProduction())
            {
                var pendingMigrations = await db.Database.GetPendingMigrationsAsync();
                if (pendingMigrations.Any())
                    throw new InvalidOperationException("The database needs an upgrade. Run the Cafe installer to back up and apply migrations before starting the service.");
            }

            await ApplicationDbContextSeed.SeedAsync(
                db,
                userManager,
                roleManager,
                seedLogger,
                bootstrapPassword,
                applyMigrations: app.Environment.IsDevelopment());
        }
    }

    if (!migrateAndSeed)
        await app.RunAsync();
}
catch (Exception ex) when (ex is not HostAbortedException)
{
    Log.Fatal(ex, "Pnara terminated unexpectedly");
    throw;
}
finally
{
    await Log.CloseAndFlushAsync();
}

static async Task<IResult> HealthAsync(
    ApplicationDbContext db,
    IWebHostEnvironment environment,
    ILogger<Program> logger,
    CancellationToken cancellationToken)
{
    if (environment.IsEnvironment("Testing"))
        return Results.Ok(new { product = "Pnara", vendor = "Pnara", status = "ok" });

    try
    {
        if (await db.Database.CanConnectAsync(cancellationToken))
            return Results.Ok(new { product = "Pnara", vendor = "Pnara", status = "ok" });
    }
    catch (Exception ex)
    {
        logger.LogWarning(ex, "Health check could not connect to the database.");
    }

    return Results.Json(
        new { product = "Pnara", vendor = "Pnara", status = "unavailable", component = "database" },
        statusCode: StatusCodes.Status503ServiceUnavailable);
}

public partial class Program;
