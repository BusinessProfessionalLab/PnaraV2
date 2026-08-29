using Microsoft.EntityFrameworkCore;
using RestoPOS.Application.Common.Interfaces;
using RestoPOS.Domain.Common;

namespace RestoPOS.Infrastructure.Persistence;

public sealed class EfRepository<T>(ApplicationDbContext db) : IRepository<T> where T : BaseEntity
{
    public Task<T?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        db.Set<T>().FirstOrDefaultAsync(e => e.Id == id, cancellationToken);

    public Task<List<T>> ListAsync(CancellationToken cancellationToken = default) =>
        db.Set<T>().ToListAsync(cancellationToken);

    public async Task AddAsync(T entity, CancellationToken cancellationToken = default)
    {
        await db.Set<T>().AddAsync(entity, cancellationToken);
    }

    public void Update(T entity) => db.Set<T>().Update(entity);

    public void Remove(T entity) => db.Set<T>().Remove(entity);
}

public sealed class UnitOfWork(ApplicationDbContext db, IServiceProvider services) : IUnitOfWork
{
    public IRepository<T> Repository<T>() where T : BaseEntity =>
        (IRepository<T>)services.GetService(typeof(IRepository<T>))!;

    public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) =>
        db.SaveChangesAsync(cancellationToken);
}
