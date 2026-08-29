namespace RestoPOS.Application.Common.Interfaces;

public interface IOrderNumberGenerator
{
    Task<string> NextAsync(CancellationToken cancellationToken = default);
}
