namespace RestoPOS.Application.Common.Models;

public sealed class Result
{
    public bool Succeeded { get; init; }
    public string[] Errors { get; init; } = [];

    public static Result Success() => new() { Succeeded = true };
    public static Result Failure(params string[] errors) => new() { Succeeded = false, Errors = errors };
}

public sealed class Result<T>
{
    public bool Succeeded { get; init; }
    public T? Value { get; init; }
    public string[] Errors { get; init; } = [];

    public static Result<T> Success(T value) => new() { Succeeded = true, Value = value };
    public static Result<T> Failure(params string[] errors) => new() { Succeeded = false, Errors = errors };
}

public sealed class PaginatedList<T>
{
    public IReadOnlyList<T> Items { get; init; } = [];
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalCount { get; init; }
    public int TotalPages => (int)Math.Ceiling(TotalCount / (double)PageSize);
}
