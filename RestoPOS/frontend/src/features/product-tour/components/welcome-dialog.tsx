"use client";

import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Non-blocking offer shown to new users before the onboarding tour starts —
 * the user chooses to start or skip; the tour never starts uninvited.
 */
export function WelcomeDialog({
  open,
  onStart,
  onDismiss,
}: {
  open: boolean;
  onStart: () => void;
  onDismiss: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onDismiss()}>
      <DialogContent className="w-[min(94vw,26rem)]">
        <DialogHeader>
          <div className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <Sparkles className="size-5" strokeWidth={1.9} aria-hidden />
          </div>
          <DialogTitle>به برنامه خوش آمدید 👋</DialogTitle>
          <DialogDescription>
            یک آموزش کوتاه داریم که در چند قدم، ثبت سفارش در صندوق و مدیریت
            فروشگاه را نشانتان می‌دهد. اختیار با شماست:
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-2.5 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onDismiss}>
            <X className="size-4" aria-hidden />
            فعلاً نه
          </Button>
          <Button onClick={onStart}>
            <Sparkles className="size-4" aria-hidden />
            شروع آموزش
          </Button>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
