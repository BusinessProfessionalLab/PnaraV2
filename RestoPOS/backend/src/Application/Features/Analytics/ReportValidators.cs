using FluentValidation;
using RestoPOS.Domain.Enums;

namespace RestoPOS.Application.Features.Analytics;

public sealed class GetDashboardSummaryQueryValidator : AbstractValidator<GetDashboardSummaryQuery>
{
    public GetDashboardSummaryQueryValidator()
    {
        RuleFor(x => x.Preset).IsInEnum();
        RuleFor(x => x).Must(HaveCustomBounds).WithMessage("برای CustomRange باید fromUtc و toUtc ارسال شوند.");
    }

    private static bool HaveCustomBounds(GetDashboardSummaryQuery q) =>
        q.Preset != TimePeriodPreset.CustomRange || (q.FromUtc is not null && q.ToUtc is not null);
}

public sealed class GetSalesTimelineQueryValidator : AbstractValidator<GetSalesTimelineQuery>
{
    public GetSalesTimelineQueryValidator()
    {
        RuleFor(x => x.Preset).IsInEnum();
        RuleFor(x => x.Interval).IsInEnum();
        RuleFor(x => x).Must(q => q.Preset != TimePeriodPreset.CustomRange || (q.FromUtc is not null && q.ToUtc is not null))
            .WithMessage("برای CustomRange باید fromUtc و toUtc ارسال شوند.");
    }
}

public sealed class GetPeakHoursHeatmapQueryValidator : AbstractValidator<GetPeakHoursHeatmapQuery>
{
    public GetPeakHoursHeatmapQueryValidator()
    {
        RuleFor(x => x.Preset).IsInEnum();
        RuleFor(x => x).Must(q => q.Preset != TimePeriodPreset.CustomRange || (q.FromUtc is not null && q.ToUtc is not null))
            .WithMessage("برای CustomRange باید fromUtc و toUtc ارسال شوند.");
    }
}

public sealed class GetPaymentBreakdownQueryValidator : AbstractValidator<GetPaymentBreakdownQuery>
{
    public GetPaymentBreakdownQueryValidator()
    {
        RuleFor(x => x.Preset).IsInEnum();
        RuleFor(x => x).Must(q => q.Preset != TimePeriodPreset.CustomRange || (q.FromUtc is not null && q.ToUtc is not null))
            .WithMessage("برای CustomRange باید fromUtc و toUtc ارسال شوند.");
    }
}

public sealed class GetTerminalReportsQueryValidator : AbstractValidator<GetTerminalReportsQuery>
{
    public GetTerminalReportsQueryValidator()
    {
        RuleFor(x => x.Preset).IsInEnum();
        RuleFor(x => x).Must(q => q.Preset != TimePeriodPreset.CustomRange || (q.FromUtc is not null && q.ToUtc is not null))
            .WithMessage("برای CustomRange باید fromUtc و toUtc ارسال شوند.");
    }
}

public sealed class GetMenuItemPerformanceQueryValidator : AbstractValidator<GetMenuItemPerformanceQuery>
{
    public GetMenuItemPerformanceQueryValidator()
    {
        RuleFor(x => x.Preset).IsInEnum();
        RuleFor(x => x.TopCount).InclusiveBetween(1, 100);
        RuleFor(x => x).Must(q => q.Preset != TimePeriodPreset.CustomRange || (q.FromUtc is not null && q.ToUtc is not null))
            .WithMessage("برای CustomRange باید fromUtc و toUtc ارسال شوند.");
    }
}

public sealed class GetCategorySalesQueryValidator : AbstractValidator<GetCategorySalesQuery>
{
    public GetCategorySalesQueryValidator()
    {
        RuleFor(x => x.Preset).IsInEnum();
        RuleFor(x => x).Must(q => q.Preset != TimePeriodPreset.CustomRange || (q.FromUtc is not null && q.ToUtc is not null))
            .WithMessage("برای CustomRange باید fromUtc و toUtc ارسال شوند.");
    }
}

public sealed class GetShiftSummaryReportsQueryValidator : AbstractValidator<GetShiftSummaryReportsQuery>
{
    public GetShiftSummaryReportsQueryValidator()
    {
        RuleFor(x => x.Preset).IsInEnum();
        RuleFor(x => x).Must(q => q.Preset != TimePeriodPreset.CustomRange || (q.FromUtc is not null && q.ToUtc is not null))
            .WithMessage("برای CustomRange باید fromUtc و toUtc ارسال شوند.");
    }
}

public sealed class GetProfitMarginReportQueryValidator : AbstractValidator<GetProfitMarginReportQuery>
{
    public GetProfitMarginReportQueryValidator()
    {
        RuleFor(x => x.Preset).IsInEnum();
        RuleFor(x => x).Must(q => q.Preset != TimePeriodPreset.CustomRange || (q.FromUtc is not null && q.ToUtc is not null))
            .WithMessage("برای CustomRange باید fromUtc و toUtc ارسال شوند.");
    }
}
