using RestoPOS.Domain.Common;

namespace RestoPOS.Domain.Entities;

public class Category : BaseEntity, ISoftDeletable
{
    public string Name { get; set; } = default!;
    public string? NameEn { get; set; }
    public int DisplayPriority { get; set; }
    public decimal DiscountPercent { get; set; }
    public bool IsVisible { get; set; } = true;
    public bool IsSystem { get; set; }
    public string? IconUrl { get; set; }
    public string? ImageUrl { get; set; }
    public Guid? ParentId { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }

    public Category? Parent { get; set; }
    public ICollection<Category> Children { get; set; } = [];
    public ICollection<MenuItem> MenuItems { get; set; } = [];
}
