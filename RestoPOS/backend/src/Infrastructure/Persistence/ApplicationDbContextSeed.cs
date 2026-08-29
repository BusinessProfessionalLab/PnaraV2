using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using RestoPOS.Domain.Common;
using RestoPOS.Domain.Entities;
using RestoPOS.Domain.Enums;
using RestoPOS.Infrastructure.Identity;
using RestoPOS.Infrastructure.Persistence;

namespace RestoPOS.Infrastructure.Persistence;

public static class ApplicationDbContextSeed
{
    public static async Task SeedAsync(
        ApplicationDbContext db,
        UserManager<ApplicationUser> users,
        RoleManager<ApplicationRole> roles,
        ILogger logger)
    {
        await db.Database.MigrateAsync();

        foreach (var (code, name, module) in Permissions.Catalog)
        {
            if (!await db.Permissions.AnyAsync(p => p.Code == code))
                db.Permissions.Add(new Permission { Code = code, DisplayNameFa = name, Module = module });
        }
        await db.SaveChangesAsync();

        var adminRole = await EnsureRole(roles, "SuperAdmin", "مالک سیستم", true);
        var managerRole = await EnsureRole(roles, "Manager", "مدیر فروشگاه", true);
        var cashierRole = await EnsureRole(roles, "Cashier", "صندوقدار", true);
        var kitchenRole = await EnsureRole(roles, "Kitchen", "آشپزخانه / بار", true);

        await AssignAllPermissions(db, adminRole.Id);
        await AssignPermissions(db, managerRole.Id, Permissions.Catalog.Select(c => c.Code).Where(c => c is not Permissions.StaffManage));
        await AssignPermissions(db, cashierRole.Id,
        [
            Permissions.OrdersCreate, Permissions.OrdersSubmit, Permissions.OrdersCancelDraft, Permissions.OrdersView,
            Permissions.PaymentsSettle, Permissions.CustomersView, Permissions.ShiftsManage, Permissions.SettingsView
        ]);
        await AssignPermissions(db, kitchenRole.Id, [Permissions.KitchenDisplay, Permissions.OrdersView, Permissions.OrdersUpdateStatus]);

        if (await users.FindByNameAsync("admin") is null)
        {
            var admin = new ApplicationUser
            {
                Id = Guid.NewGuid(),
                UserName = "admin",
                Email = "admin@toastiran.local",
                FullName = "مدیر سیستم",
                PersonnelCode = "0001",
                IsActive = true
            };
            var result = await users.CreateAsync(admin, "Admin@12345");
            if (!result.Succeeded)
                logger.LogError("Failed to seed admin: {Errors}", string.Join(",", result.Errors.Select(e => e.Description)));
            else
                await users.AddToRoleAsync(admin, "SuperAdmin");
        }

        if (!await db.StoreSettings.AnyAsync())
        {
            db.StoreSettings.Add(new StoreSettings
            {
                StoreName = "کافه پنارا",
                ReceiptHeader = "نوش جان — Pnara Cafe",
                ReceiptFooter = "شماره مالیاتی نمونه | بازگشت کالا طبق سیاست فروشگاه",
                TaxIdentificationNumber = "14000000000",
                VatRate = 0.10m,
                PrimaryColor = "#C41E3A",
                SecondaryColor = "#1F2937"
            });
        }

        if (!await db.PosDevices.AnyAsync())
        {
            db.PosDevices.Add(new PosDevice
            {
                Name = "کارتخوان صندوق ۱",
                Protocol = PosProtocol.Lan,
                Psp = IranianPsp.SamanKish,
                IpAddress = "192.168.1.50",
                Port = 1362,
                TerminalId = "TERM0001",
                MerchantId = "MERCH0001",
                IsActive = true
            });
        }

        if (!await db.Categories.AnyAsync())
        {
            var coffee = new Category { Name = "قهوه", NameEn = "Coffee", DisplayPriority = 1, IconUrl = "icons/coffee.svg", IsVisible = true };
            var bakery = new Category { Name = "نان و کیک", NameEn = "Bakery", DisplayPriority = 2, IconUrl = "icons/bakery.svg", IsVisible = true };
            db.Categories.AddRange(coffee, bakery);

            var beans = new InventoryItem { Name = "دانه اسپرسو", Sku = "INV-BEAN-001", UnitOfMeasure = UnitOfMeasure.Gr, ReorderPoint = 1000, SafetyStock = 500, CostPrice = 4500, AverageCost = 4500 };
            var milk = new InventoryItem { Name = "شیر پرچرب", Sku = "INV-MILK-001", UnitOfMeasure = UnitOfMeasure.Ml, ReorderPoint = 5000, SafetyStock = 2000, CostPrice = 80, AverageCost = 80 };
            beans.ApplyInbound(10000, 4500, null, "موجودی اول دوره", "OPENING");
            milk.ApplyInbound(20000, 80, null, "موجودی اول دوره", "OPENING");
            db.InventoryItems.AddRange(beans, milk);

            var latte = new MenuItem
            {
                Title = "لاته",
                Description = "اسپرسو، شیر بخار داده",
                BasePrice = 180000,
                TaxInclusive = false,
                Category = coffee,
                DisplayPriority = 1,
                TicketStation = TicketStation.Bar,
                PrepTimeMinutes = 4,
                IsActive = true
            };
            latte.Modifiers.Add(new MenuItemModifier { Name = "شیر جو دوسر", ExtraPrice = 25000, TicketStation = TicketStation.Bar, DisplayPriority = 1 });
            latte.Modifiers.Add(new MenuItemModifier { Name = "شات اضافه", ExtraPrice = 30000, TicketStation = TicketStation.Bar, DisplayPriority = 2 });
            latte.Recipe = new Recipe
            {
                Name = "BOM لاته",
                Lines =
                [
                    new RecipeLine { InventoryItem = beans, Quantity = 18, Unit = UnitOfMeasure.Gr },
                    new RecipeLine { InventoryItem = milk, Quantity = 180, Unit = UnitOfMeasure.Ml }
                ]
            };
            db.MenuItems.Add(latte);
        }

        await db.SaveChangesAsync();
        logger.LogInformation("ToastIran POS seed completed.");
    }

    private static async Task<ApplicationRole> EnsureRole(RoleManager<ApplicationRole> roles, string name, string description, bool system)
    {
        var role = await roles.FindByNameAsync(name);
        if (role is not null)
            return role;
        role = new ApplicationRole { Id = Guid.NewGuid(), Name = name, Description = description, IsSystemRole = system };
        await roles.CreateAsync(role);
        return role;
    }

    private static async Task AssignAllPermissions(ApplicationDbContext db, Guid roleId) =>
        await AssignPermissions(db, roleId, Permissions.Catalog.Select(c => c.Code));

    private static async Task AssignPermissions(ApplicationDbContext db, Guid roleId, IEnumerable<string> codes)
    {
        var existing = await db.RolePermissions.Where(rp => rp.RoleId == roleId).Select(rp => rp.Permission.Code).ToListAsync();
        var permissions = await db.Permissions.Where(p => codes.Contains(p.Code)).ToListAsync();
        foreach (var permission in permissions.Where(p => !existing.Contains(p.Code)))
            db.RolePermissions.Add(new RolePermission { RoleId = roleId, PermissionId = permission.Id });
        await db.SaveChangesAsync();
    }
}
