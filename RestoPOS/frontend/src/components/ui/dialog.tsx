"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogOverlay({ className, ...props }: DialogPrimitive.DialogOverlayProps) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        "animate-overlay fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-[2px]",
        className,
      )}
      {...props}
    />
  );
}

export function DialogContent({
  className,
  children,
  wide,
  ...props
}: DialogPrimitive.DialogContentProps & { wide?: boolean }) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          // Phones (<640px): bottom sheet that slides up and hugs the viewport.
          // Larger screens: centered modal with the same rounded language.
          "animate-sheet fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-xl outline-none sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:right-auto sm:w-[min(94vw,28rem)] sm:max-h-[92dvh] sm:rounded-2xl sm:-translate-x-1/2 sm:-translate-y-1/2",
          wide && "sm:w-[min(94vw,64rem)]",
          "pb-safe sm:pb-0",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className="absolute end-3 top-3 rounded-full p-1.5 text-muted-foreground outline-none transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 sm:end-4 sm:top-4"
          aria-label="بستن"
        >
          <X className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col gap-1 border-b border-border/70 px-5 pb-4 pt-4 sm:px-6 sm:pt-5",
        className,
      )}
      {...props}
    />
  );
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mt-auto flex shrink-0 flex-col-reverse gap-2 border-t border-border/70 px-5 py-3.5 sm:flex-row sm:justify-end sm:px-6 sm:py-4",
        className,
      )}
      {...props}
    />
  );
}

export function DialogTitle({ className, ...props }: DialogPrimitive.DialogTitleProps) {
  return (
    <DialogPrimitive.Title
      className={cn("text-base font-bold tracking-tight", className)}
      {...props}
    />
  );
}

export function DialogDescription({ className, ...props }: DialogPrimitive.DialogDescriptionProps) {
  return (
    <DialogPrimitive.Description
      className={cn("text-[13px] leading-5 text-muted-foreground", className)}
      {...props}
    />
  );
}

/** Scrollable body region between header and footer. */
export function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-h-0 overflow-y-auto px-5 py-4 sm:px-6", className)} {...props} />;
}
