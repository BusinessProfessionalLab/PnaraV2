using RestoPOS.Domain.Common;
using RestoPOS.Domain.Exceptions;

namespace RestoPOS.Domain.Entities;

/// <summary>
/// Bill of Materials (BOM) linking a sellable item or modifier to warehouse SKUs.
/// </summary>
public class Recipe : BaseEntity, ISoftDeletable
{
    public Guid? MenuItemId { get; set; }
    public Guid? MenuItemModifierId { get; set; }
    public string Name { get; set; } = default!;
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public MenuItem? MenuItem { get; set; }
    public MenuItemModifier? MenuItemModifier { get; set; }
    public ICollection<RecipeLine> Lines { get; set; } = [];

    public void ReplaceLines(IEnumerable<RecipeLine> lines)
    {
        if (MenuItemId is null && MenuItemModifierId is null)
            throw new DomainException("رسپی باید به آیتم منو یا افزودنی متصل باشد.");

        Lines.Clear();
        foreach (var line in lines)
            Lines.Add(line);
    }
}
