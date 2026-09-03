using RestoPOS.Domain.Common;
using RestoPOS.Domain.Enums;

namespace RestoPOS.Domain.Entities;

/// <summary>
/// A reusable add-on. It is intentionally independent from a menu item.
/// Products are connected through MenuItemAddon.
/// </summary>
public class Addon : BaseEntity, ISoftDeletable
{
    public string Name { get; set; } = default!;
    public decimal ExtraPrice { get; set; }
    public bool IsActive { get; set; } = true;
    public TicketStation TicketStation { get; set; } = TicketStation.Bar;
    public int DisplayPriority { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public ICollection<MenuItemAddon> MenuItems { get; set; } = [];
    public Recipe? Recipe { get; set; }
}
