using RestoPOS.Domain.Common;

namespace RestoPOS.Domain.Entities;

public class AuditLog : BaseEntity
{
    public string EntityName { get; set; } = default!;
    public string EntityId { get; set; } = default!;
    public string Action { get; set; } = default!;
    public string? OldValues { get; set; }
    public string? NewValues { get; set; }
    public Guid? StaffId { get; set; }
    public DateTime OccurredAt { get; set; }
    public string? IpAddress { get; set; }
}
