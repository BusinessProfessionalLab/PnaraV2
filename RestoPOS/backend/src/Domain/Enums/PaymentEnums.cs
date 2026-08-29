namespace RestoPOS.Domain.Enums;

public enum PaymentChannel
{
    Cash = 0,
    LocalPC_POS = 1,
    CardToCard = 2,
    OnlineGateway = 3
}

public enum PaymentStatus
{
    Pending = 0,
    Authorized = 1,
    Settled = 2,
    Failed = 3,
    Cancelled = 4
}

public enum IranianPsp
{
    Unknown = 0,
    AsanPardakht = 1,
    SamanKish = 2,
    BehpardakhtMellat = 3
}

public enum PosProtocol
{
    Lan = 0,
    Com = 1,
    Serial = 2
}
