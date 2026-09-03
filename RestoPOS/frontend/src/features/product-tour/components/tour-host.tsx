"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { tourManager } from "../manager";
import { clearTourProgress, getTourState, setTourStatus } from "../storage";
import { useProductTour } from "../hooks/use-product-tour";
import { WelcomeDialog } from "./welcome-dialog";

/** Routes where onboarding offers/resumes make sense. */
const ACTIVE_TOUR_IDS = ["onboarding", "register"] as const;

function isEligibleRoute(path: string) {
  return path !== "/login" && !path.startsWith("/kds");
}

/**
 * Mounted once inside the root providers. Responsibilities:
 *  1. First-login offer — shown once per user/version when no tour state
 *     exists yet; starting or skipping persists the decision.
 *  2. Resume — after an accidental refresh mid-tour, continues from the
 *     persisted step when the route matches (no restart from step 1).
 *  3. Safety — if the user leaves the route mid-tour (browser back/forward),
 *     the overlay is torn down instead of dangling.
 */
export function TourHost() {
  const pathname = usePathname();
  const userId = useAuthStore((state) => state.session?.userId ?? null);
  const api = useProductTour();
  const [offerOpen, setOfferOpen] = useState(false);
  const handledUserRef = useRef<string | null>(null);
  const offerShownForUser = useRef(false);

  // First-login offer + refresh-resume (per user).
  useEffect(() => {
    if (!userId || !isEligibleRoute(pathname)) return;
    if (handledUserRef.current === userId) return;
    handledUserRef.current = userId;

    for (const tourId of ACTIVE_TOUR_IDS) {
      const state = getTourState(userId, tourId);
      if (state?.status === "in_progress") {
        if (
          state.route === pathname &&
          typeof state.step === "number" &&
          state.step >= 0
        ) {
          // Resume after a refresh — give the freshly rendered page a paint
          // before the overlay appears.
          const frame = requestAnimationFrame(() => {
            requestAnimationFrame(() => api.resume(tourId, state.step as number));
          });
          return () => cancelAnimationFrame(frame);
        }
        // In-progress record from another route/session: drop it, the user
        // evidently moved on — the offer may show instead.
        clearTourProgress(userId, tourId);
      }
    }

    if (!offerShownForUser.current) {
      offerShownForUser.current = true;
      setOfferOpen(true);
    }
  }, [userId, pathname, api]);

  // Watchdog: leaving the current route externally ends the running tour
  // instead of leaving a broken overlay behind.
  useEffect(() => {
    if (!userId) return;
    tourManager.onPathnameChange(pathname);
  }, [pathname, userId]);

  function handleStart() {
    setOfferOpen(false);
    api.startTour("onboarding", "auto");
  }

  function handleDismiss() {
    setOfferOpen(false);
    if (userId) {
      // Declined — don't nag again on this tour version; the help button in
      // the header always stays available for a manual replay.
      setTourStatus(userId, "onboarding", "skipped");
    }
  }

  return (
    <WelcomeDialog
      open={offerOpen}
      onStart={handleStart}
      onDismiss={handleDismiss}
    />
  );
}
