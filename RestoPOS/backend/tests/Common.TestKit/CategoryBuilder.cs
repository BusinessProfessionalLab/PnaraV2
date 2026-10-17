using RestoPOS.Domain.Entities;

namespace RestoPOS.Common.TestKit;

public sealed class CategoryBuilder
{
    private string _name = "Coffee";
    private string? _nameEn = "Coffee";
    private int _displayPriority;
    private bool _isDeleted;
    private bool _isVisible = true;
    private Guid? _parentId;

    public CategoryBuilder Named(string name)
    {
        _name = name;
        return this;
    }

    public CategoryBuilder WithEnglishName(string? name)
    {
        _nameEn = name;
        return this;
    }

    public CategoryBuilder WithPriority(int priority)
    {
        _displayPriority = priority;
        return this;
    }

    public CategoryBuilder WithParent(Guid? parentId)
    {
        _parentId = parentId;
        return this;
    }

    public CategoryBuilder SoftDeleted()
    {
        _isDeleted = true;
        return this;
    }

    public CategoryBuilder Hidden()
    {
        _isVisible = false;
        return this;
    }

    public Category Build() => new()
    {
        Name = _name,
        NameEn = _nameEn,
        DisplayPriority = _displayPriority,
        IsVisible = _isVisible,
        ParentId = _parentId,
        IsDeleted = _isDeleted,
        DeletedAt = _isDeleted ? DateTime.UtcNow : null
    };
}
