"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { tourManager } from "../manager";
import type { TourMode } from "../types";

/**
 * Public tour API for the rest of the application. Components never touch
 * Driver.js — they ask this hook to start/stop tours by id.
 */
export interface ProductTourApi {
  /** Start a registered tour (manual replay or onboarding). */
  startTour: (tourId: string, mode?: TourMode) => void;
  /** Resume an in-progress tour at a stored step (auto mode). */
  resume: (tourId: string, fromStep: number) => void;
  /** Stop the running tour immediately. */
  stop: () => void;
  isActive: () => boolean;
  isCompleted: (tourId: string) => boolean;
}

export function useProductTour(): ProductTourApi {
  const router = useRouter();
  const userId = useAuthStore((state) => state.session?.userId ?? null);

  return useMemo<ProductTourApi>(
    () => {
      const withContext = <TArgs extends unknown[], TResult>(
        run: (...args: TArgs) => TResult,
      ) =>
        (...args: TArgs): TResult => {
          tourManager.setContext({
            userId,
            navigate: (route) => {
              void router.push(route);
            },
          });
          return run(...args);
        };

      return {
        startTour: withContext((tourId: string, mode: TourMode = "manual") =>
          tourManager.start(tourId, { mode }),
        ),
        resume: withContext((tourId: string, fromStep: number) =>
          tourManager.start(tourId, { mode: "auto", resumeFrom: fromStep }),
        ),
        stop: withContext(() => tourManager.stop()),
        isActive: () => tourManager.isActive,
        isCompleted: (tourId) => tourManager.isCompleted(tourId),
      };
    },
    // Context is pushed into the manager at call time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, router],
  );
}
