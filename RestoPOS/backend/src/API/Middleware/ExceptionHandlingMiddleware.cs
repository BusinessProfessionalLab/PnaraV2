using System.Net;
using System.Text.Json;
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
        var (status, title) = exception switch
        {
            ValidationException => (HttpStatusCode.BadRequest, "ValidationFailed"),
            NotFoundException => (HttpStatusCode.NotFound, "NotFound"),
            ForbiddenException => (HttpStatusCode.Forbidden, "Forbidden"),
            ConflictException => (HttpStatusCode.Conflict, "Conflict"),
            DomainException => (HttpStatusCode.UnprocessableEntity, "BusinessRule"),
            _ => (HttpStatusCode.InternalServerError, "ServerError")
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

        var payload = new { title, status = (int)status, detail = exception.Message, errors };
        await context.Response.WriteAsync(JsonSerializer.Serialize(payload));
    }
}
