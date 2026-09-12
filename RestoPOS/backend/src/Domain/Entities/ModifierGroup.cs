using RestoPOS.Domain.Common;
using RestoPOS.Domain.Exceptions;

namespace RestoPOS.Domain.Entities;

/// <summary>Modifier group (add-ons/sides) attached to a menu item — Toast-style min/max selection.</summary>
public class ModifierGroup : BaseEntity, ISoftDeletable
{
    public Guid MenuItemId { get; set; }
    public string Name { get; set; } = default!;
    public int MinSelections { get; set; }
    public int MaxSelections { get; set; } = 1;
    public bool IsRequired { get; set; }
    public int DisplayPriority { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public MenuItem MenuItem { get; set; } = default!;
    public ICollection<MenuItemModifier> Options { get; set; } = [];

    public void EnsureValid()
    {
        if (string.IsNullOrWhiteSpace(Name))
            throw new DomainException("نام گروه افزودنی الزامی است.");
        if (MinSelections < 0)
            throw new DomainException("حداقل انتخاب نمی‌تواند منفی باشد.");
        if (MaxSelections < MinSelections)
            throw new DomainException("حداکثر انتخاب باید بزرگ‌تر یا مساوی حداقل باشد.");
    }
}
