namespace RestoPOS.Domain.Exceptions;

public class DomainException : Exception
{
    public DomainException(string message) : base(message) { }
    public DomainException(string message, Exception inner) : base(message, inner) { }
}

public class NotFoundException : DomainException
{
    public NotFoundException(string name, object key)
        : base($"موجودیت «{name}» با شناسه «{key}» یافت نشد.") { }

    public NotFoundException(string message) : base(message) { }
}

public class ConflictException : DomainException
{
    public ConflictException(string message) : base(message) { }
}

public class ForbiddenException : DomainException
{
    public ForbiddenException(string message = "دسترسی غیرمجاز.") : base(message) { }
}
