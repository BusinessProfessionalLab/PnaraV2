using RestoPOS.Domain.Common;

namespace RestoPOS.Domain.Entities;

public class Permission : BaseEntity
{
    public string Code { get; set; } = default!;
    public string DisplayNameFa { get; set; } = default!;
    public string Module { get; set; } = default!;

    public ICollection<RolePermission> RolePermissions { get; set; } = [];
}
