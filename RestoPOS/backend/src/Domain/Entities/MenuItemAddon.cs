namespace RestoPOS.Domain.Entities;

public class MenuItemAddon
{
    public Guid MenuItemId { get; set; }
    public Guid AddonId { get; set; }

    public MenuItem MenuItem { get; set; } = default!;
    public Addon Addon { get; set; } = default!;
}
