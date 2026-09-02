namespace RestoPOS.Domain.Entities;

public class MenuItemAddon
{
    public Guid MenuItemId { get; set; }
    public Guid AddonMenuItemId { get; set; }

    public MenuItem MenuItem { get; set; } = default!;
    public MenuItem AddonMenuItem { get; set; } = default!;
}
