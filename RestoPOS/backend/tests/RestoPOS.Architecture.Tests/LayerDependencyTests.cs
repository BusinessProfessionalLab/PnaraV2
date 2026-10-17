using FluentAssertions;
using NetArchTest.Rules;
using RestoPOS.Domain.Common;

namespace RestoPOS.Architecture.Tests;

public sealed class LayerDependencyTests
{
    [Fact]
    public void Application_does_not_depend_on_API_or_Infrastructure()
    {
        var result = Types.InAssembly(typeof(RestoPOS.Application.DependencyInjection).Assembly)
            .ShouldNot()
            .HaveDependencyOnAny("RestoPOS.API", "RestoPOS.Infrastructure")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(string.Join(Environment.NewLine, result.FailingTypeNames ?? []));
    }

    [Fact]
    public void Domain_does_not_depend_on_EF_Core_or_ASP_NET()
    {
        var result = Types.InAssembly(typeof(BaseEntity).Assembly)
            .ShouldNot()
            .HaveDependencyOnAny("Microsoft.EntityFrameworkCore", "Microsoft.AspNetCore")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(string.Join(Environment.NewLine, result.FailingTypeNames ?? []));
    }

    [Fact]
    public void Infrastructure_depends_on_Application_abstractions_not_API()
    {
        var result = Types.InAssembly(typeof(RestoPOS.Infrastructure.DependencyInjection).Assembly)
            .ShouldNot()
            .HaveDependencyOn("RestoPOS.API")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(string.Join(Environment.NewLine, result.FailingTypeNames ?? []));
    }

    [Fact]
    public void Controllers_do_not_depend_directly_on_Infrastructure()
    {
        var result = Types.InAssembly(typeof(Program).Assembly)
            .That()
            .ResideInNamespace("RestoPOS.API.Controllers")
            .ShouldNot()
            .HaveDependencyOn("RestoPOS.Infrastructure")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(string.Join(Environment.NewLine, result.FailingTypeNames ?? []));
    }
}
