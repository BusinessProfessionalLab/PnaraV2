using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Domain.Common;
using RestoPOS.Infrastructure.Identity;
using RestoPOS.Infrastructure.Customers;
using RestoPOS.Infrastructure.Orders;
using RestoPOS.Infrastructure.Persistence;
using RestoPOS.Infrastructure.Pos;
using RestoPOS.Infrastructure.Printing;

namespace RestoPOS.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("PostgreSql")
                               ?? throw new InvalidOperationException("Connection string 'PostgreSql' is missing.");

        services.AddDbContext<ApplicationDbContext>(options =>
            options.UseNpgsql(connectionString, postgres =>
            {
                postgres.MigrationsAssembly(typeof(ApplicationDbContext).Assembly.FullName);
                postgres.EnableRetryOnFailure();
            }));

        services.AddScoped<IApplicationDbContext>(sp => sp.GetRequiredService<ApplicationDbContext>());
        services.AddScoped(typeof(IRepository<>), typeof(EfRepository<>));
        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped<IDomainEventDispatcher, MediatRDomainEventDispatcher>();
        services.AddScoped<IIdentityService, IdentityService>();
        services.AddScoped<IPosDeviceService, LocalPcPosDeviceService>();
        services.AddScoped<IEscPosDispatcher, EscPosThermalDispatcher>();
        services.AddScoped<IOrderNumberGenerator, OrderNumberGenerator>();
        services.AddSingleton<IDateTimeProvider, SystemDateTimeProvider>();
        services.AddHttpClient<ILoyaltySmsProvider, HttpLoyaltySmsProvider>();
        services.AddHostedService<LoyaltySmsDispatcher>();

        services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName));

        services.AddIdentityCore<ApplicationUser>(options =>
            {
                options.User.RequireUniqueEmail = false;
                options.Password.RequiredLength = 8;
                options.Password.RequireNonAlphanumeric = false;
            })
            .AddRoles<ApplicationRole>()
            .AddEntityFrameworkStores<ApplicationDbContext>()
            .AddDefaultTokenProviders();

        services.RemoveAll<IPasswordValidator<ApplicationUser>>();
        services.AddScoped<IPasswordValidator<ApplicationUser>, StaffAwarePasswordValidator>();

        return services;
    }
}
