using RestoPOS.Domain.Common;
using RestoPOS.Domain.Enums;

namespace RestoPOS.Domain.Entities;

public class MenuItemModifier : BaseEntity, ISoftDeletable
{
    public Guid MenuItemId { get; set; }
    public string Name { get; set; } = default!;
    public decimal ExtraPrice { get; set; }
    public bool IsActive { get; set; } = true;
    public TicketStation TicketStation { get; set; } = TicketStation.Bar;
    public int DisplayPriority { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public MenuItem MenuItem { get; set; } = default!;
    public Recipe? Recipe { get; set; }
}
