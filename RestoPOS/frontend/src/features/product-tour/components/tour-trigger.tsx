"use client";

import { CircleHelp } from "lucide-react";
import { cn } from "@/lib/cn";
import { useProductTour } from "../hooks/use-product-tour";

/**
 * Header Help trigger — starts the product tour on click. The `data-tour`
 * attribute doubles as the stable target for the tour's own "help" step.
 * Hover/focus shows a tooltip; keyboard users get the same affordance.
 */
export function TourTrigger({
  tourId = "onboarding",
  label = "راهنمای برنامه",
  placement = "top",
  className,
  iconClassName,
  "aria-label": ariaLabel,
}: {
  tourId?: string;
  label?: string;
  /** Where the tooltip appears relative to the icon. */
  placement?: "top" | "bottom";
  className?: string;
  iconClassName?: string;
  "aria-label"?: string;
}) {
  const { startTour } = useProductTour();

  return (
    <span className="group relative inline-flex shrink-0" data-tour="tour-trigger">
      <button
        type="button"
        aria-label={ariaLabel ?? label}
        title={label}
        onClick={() => startTour(tourId, "manual")}
        className={cn(
          "flex items-center justify-center rounded-xl text-muted-foreground outline-none transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
          className ?? "size-9",
        )}
      >
        <CircleHelp
          aria-hidden
          strokeWidth={1.9}
          className={cn("size-4", iconClassName)}
        />
      </button>

      {/* Tooltip (hover + keyboard focus) */}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute start-1/2 z-50 -translate-x-1/2 rounded-lg border border-border bg-popover px-2.5 py-1 text-xs font-medium whitespace-nowrap text-foreground opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100",
          placement === "top" ? "bottom-full mb-2" : "top-full mt-2",
        )}
      >
        {label}
      </span>
    </span>
  );
}
