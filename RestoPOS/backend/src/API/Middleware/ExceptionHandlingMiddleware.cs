using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using FluentValidation;
using RestoPOS.Domain.Exceptions;

namespace RestoPOS.API.Middleware;

public sealed class ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
{
    public async Task Invoke(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception ex)
        {
            await WriteAsync(context, ex);
        }
    }

    private async Task WriteAsync(HttpContext context, Exception exception)
    {
        var (status, title, detail) = exception switch
        {
            DbUpdateConcurrencyException => (
                HttpStatusCode.Conflict,
                "OrderConcurrencyConflict",
                "سبد سفارش در حالت فعلی همگام‌سازی ندارد. لطفاً دوباره تلاش کنید."
            ),
            ValidationException validationException => (HttpStatusCode.BadRequest, "ValidationFailed", validationException.Message),
            NotFoundException notFound => (HttpStatusCode.NotFound, "NotFound", notFound.Message),
            ForbiddenException forbidden => (HttpStatusCode.Forbidden, "Forbidden", forbidden.Message),
            ConflictException conflict => (HttpStatusCode.Conflict, "Conflict", conflict.Message),
            DomainException domain => (HttpStatusCode.UnprocessableEntity, "BusinessRule", domain.Message),
            _ => (HttpStatusCode.InternalServerError, "ServerError", exception.Message)
        };

        if (status == HttpStatusCode.InternalServerError)
            logger.LogError(exception, "Unhandled exception");
        else
            logger.LogWarning(exception, "Handled domain exception {Title}", title);

        context.Response.ContentType = "application/json";
        context.Response.StatusCode = (int)status;

        object errors = exception is ValidationException validation
            ? validation.Errors.Select(e => new { e.PropertyName, e.ErrorMessage })
            : new[] { new { PropertyName = "", ErrorMessage = exception.Message } };

        var payload = new { title, status = (int)status, detail, errors };
        await context.Response.WriteAsync(JsonSerializer.Serialize(payload));
    }
}
