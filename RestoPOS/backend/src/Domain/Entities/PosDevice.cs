using RestoPOS.Domain.Common;
using RestoPOS.Domain.Enums;

namespace RestoPOS.Domain.Entities;

public class PosDevice : BaseEntity, ISoftDeletable
{
    public string Name { get; set; } = default!;
    public PosProtocol Protocol { get; set; }
    public IranianPsp Psp { get; set; }
    public string? IpAddress { get; set; }
    public int? Port { get; set; }
    public string? ComPort { get; set; }
    public int? BaudRate { get; set; }
    public string TerminalId { get; set; } = default!;
    public string MerchantId { get; set; } = default!;
    public bool IsActive { get; set; } = true;
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }
}
