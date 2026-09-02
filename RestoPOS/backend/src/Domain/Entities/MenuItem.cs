using RestoPOS.Domain.Common;
using RestoPOS.Domain.Enums;

namespace RestoPOS.Domain.Entities;

public class MenuItem : BaseEntity, ISoftDeletable
{
    public string Title { get; set; } = default!;
    public string? NameEn { get; set; }
    public string? Description { get; set; }
    public decimal BasePrice { get; set; }
    public bool TaxInclusive { get; set; }
    public string? ImageUrl { get; set; }
    public int DisplayPriority { get; set; }
    public decimal DiscountPercent { get; set; }
    public Guid CategoryId { get; set; }
    public bool IsActive { get; set; } = true;
    public TicketStation TicketStation { get; set; } = TicketStation.Kitchen;
    public int PrepTimeMinutes { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public Category Category { get; set; } = default!;
    public ICollection<MenuItemModifier> Modifiers { get; set; } = [];
    public ICollection<MenuItemAddon> Addons { get; set; } = [];
    public ICollection<MenuItemAddon> UsedAsAddonFor { get; set; } = [];
    public Recipe? Recipe { get; set; }
}
