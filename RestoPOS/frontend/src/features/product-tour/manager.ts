import { driver, type Driver } from "driver.js";
import type { DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import "./tour-theme.css";
import { tourRegistry } from "./registry";
import { getTourStatus, setTourStatus } from "./storage";
import type { TourDefinition, TourMode, TourStep } from "./types";

/*
 * Tour manager.
 *
 * Driver.js is deliberately isolated inside this module: the rest of the app
 * talks to the small API in ./index (start/stop/isCompleted). The manager is
 * route-aware — steps are grouped into route segments, the app router moves
 * between segments, and each segment waits for its target to exist before
 * handing control to Driver.js. A stale or missing step element degrades to a
 * centered popover instead of breaking the tour.
 */

type Context = { userId: string | null; navigate?: (route: string) => void };

type Run = { steps: TourStep[]; route: string; start: number };

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function pickVisible(selector: string): Element | null {
  const nodes = Array.from(document.querySelectorAll(selector));
  for (const node of nodes) {
    const style = getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") continue;
    const rect = node.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return node;
  }
  return null;
}

/** Resolve a step's target — only *visible* elements are highlighted, so a
 * step whose target lives on a different viewport (or inside a closed
 * drawer) degrades to a centered popover instead of a broken highlight. */
function resolveSelector(step: TourStep): string | null {
  const selectors = step.element
    ? Array.isArray(step.element)
      ? step.element
      : [step.element]
    : [];
  for (const selector of selectors) {
    if (pickVisible(selector)) return selector;
  }
  return null;
}

/** Contiguous steps sharing one route. */
function buildRuns(steps: TourStep[]): Run[] {
  const runs: Run[] = [];
  let current: Run | null = null;
  steps.forEach((step, index) => {
    const route = step.route ?? current?.route;
    if (!route) {
      // Centered steps before any route context — attach to the first run.
      if (runs.length === 0) {
        current = { steps: [], route: "/pos", start: 0 };
        runs.push(current);
      }
      current!.steps.push(step);
      return;
    }
    if (!current || current.route !== route) {
      current = { steps: [], route, start: index };
      runs.push(current);
    }
    current.steps.push(step);
  });
  return runs;
}

class ProductTourManager {
  private context: Context = { userId: null };
  private active: {
    def: TourDefinition;
    global: number;
    mode: TourMode;
  } | null = null;
  private driverInstance: Driver | null = null;
  private token = 0;
  private expectedRoute: string | null = null;
  private runRoute: string | null = null;

  setContext(context: Context) {
    this.context = context;
  }

  get isActive() {
    return this.active !== null;
  }

  isCompleted(tourId: string) {
    return getTourStatus(this.context.userId, tourId) === "completed";
  }

  start(
    tourId: string,
    options: { mode?: TourMode; resumeFrom?: number } = {},
  ) {
    const definition = tourRegistry[tourId];
    if (!definition || typeof window === "undefined") return;

    // Restarting replaces whatever is running.
    const token = ++this.token;
    this.teardownDriver();
    this.active = null;
    this.expectedRoute = null;
    this.runRoute = null;

    const from = Math.max(
      0,
      Math.min(definition.steps.length - 1, options.resumeFrom ?? 0),
    );
    this.active = { def: definition, global: from, mode: options.mode ?? "manual" };
    this.persistProgress();
    void this.runFrom(token, from);
  }

  /** Stop and record the run (completion or a skip depending on prior state). */
  stop() {
    if (this.active) {
      const completed = this.isCompleted(this.active.def.id);
      this.finish(completed);
    } else {
      this.teardownDriver();
    }
  }

  /** Called by the host when the URL changes (e.g. user used browser back). */
  onPathnameChange(path: string) {
    if (!this.active) return;
    if (this.expectedRoute === path) return;
    if (this.runRoute === path) return;
    this.finish(false);
  }

  private finish(completed: boolean) {
    const active = this.active;
    this.active = null;
    this.expectedRoute = null;
    this.runRoute = null;
    this.teardownDriver();
    if (!active) return;
    const prior = getTourStatus(this.context.userId, active.def.id);
    const status = completed
      ? "completed"
      : prior === "completed"
        ? "completed"
        : "skipped";
    setTourStatus(this.context.userId, active.def.id, status);
  }

  private persistProgress() {
    const active = this.active;
    if (!active || !this.context.userId) return;
    setTourStatus(this.context.userId, active.def.id, "in_progress", {
      step: active.global,
      route:
        typeof window !== "undefined" ? window.location.pathname : undefined,
    });
  }

  private teardownDriver() {
    const instance = this.driverInstance;
    this.driverInstance = null;
    if (instance) {
      try {
        instance.destroy();
      } catch {
        /* driver teardown is best-effort */
      }
    }
  }

  private async ensureRoute(
    token: number,
    route: string,
  ): Promise<boolean> {
    if (window.location.pathname === route) return true;
    if (!this.context.navigate) return false;
    this.expectedRoute = route;
    this.teardownDriver();
    try {
      this.context.navigate(route);
    } catch (error) {
      console.warn("[product-tour] navigation failed", error);
      this.expectedRoute = null;
      return false;
    }
    const arrived = await this.waitUntil(
      token,
      () => window.location.pathname === route,
      12_000,
    );
    if (token !== this.token) return false;
    this.expectedRoute = null;
    return arrived;
  }

  private waitUntil(
    token: number,
    test: () => boolean,
    timeoutMs: number,
    intervalMs = 100,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const startedAt = Date.now();
      const tick = () => {
        if (token !== this.token) return resolve(false);
        if (test()) return resolve(true);
        if (Date.now() - startedAt > timeoutMs) return resolve(false);
        window.setTimeout(tick, intervalMs);
      };
      tick();
    });
  }

  private async runFrom(token: number, fromIndex: number) {
    const active = this.active;
    if (!active || token !== this.token) return;
    if (fromIndex >= active.def.steps.length) {
      this.finish(true);
      return;
    }

    const runs = buildRuns(active.def.steps);
    const run =
      runs.find(
        (candidate) =>
          fromIndex >= candidate.start &&
          fromIndex < candidate.start + candidate.steps.length,
      ) ?? runs[runs.length - 1];
    if (!run) {
      this.finish(false);
      return;
    }

    const finalRun = runs[runs.length - 1] === run;
    const localStart = fromIndex - run.start;
    this.runRoute = run.route;

    if (!(await this.ensureRoute(token, run.route))) {
      this.finish(false);
      return;
    }

    // Give the first target a moment to exist (route just rendered).
    const firstSelector = resolveSelector(active.def.steps[fromIndex]);
    if (firstSelector) {
      await this.waitUntil(
        token,
        () => Boolean(pickVisible(firstSelector)),
        8_000,
      );
      if (token !== this.token) return;
    }

    const steps: DriveStep[] = run.steps.map((step) => {
      const selector = resolveSelector(step);
      return {
        ...(selector ? { element: selector } : {}),
        popover: {
          title: step.title,
          description: step.description,
          side: step.side ?? "bottom",
        },
      };
    });

    const instance = driver({
      animate: !prefersReducedMotion(),
      duration: 220,
      smoothScroll: !prefersReducedMotion(),
      overlayColor: "rgb(2 6 23)",
      overlayOpacity: 0.5,
      allowClose: true,
      allowScroll: true,
      stagePadding: 8,
      stageRadius: 12,
      popoverClass: "ti-tour-popover",
      popoverOffset: 14,
      showProgress: true,
      progressText: "",
      nextBtnText: "بعدی",
      prevBtnText: "قبلی",
      doneBtnText: finalRun ? "متوجه شدم" : "ادامه",
      steps,
      onPopoverRender: (popover, options) => {
        const localIndex = options.index ?? instance.getActiveIndex() ?? 0;
        const globalIndex = run.start + localIndex;
        popover.progress.textContent = `مرحله ${globalIndex + 1} از ${active.def.steps.length}`;
      },
      onHighlighted: (_element, _step, options) => {
        if (!this.active || token !== this.token) return;
        const localIndex = options.index ?? instance.getActiveIndex() ?? 0;
        this.active.global = run.start + localIndex;
        this.persistProgress();
      },
      onDoneClick: () => {
        if (token !== this.token) return;
        if (finalRun) {
          this.finish(true);
          return;
        }
        this.teardownDriver();
        const nextGlobal = run.start + run.steps.length;
        if (this.active) this.active.global = nextGlobal;
        this.persistProgress();
        void this.runFrom(token, nextGlobal);
      },
      onCloseClick: () => {
        if (token !== this.token) return;
        this.finish(false);
      },
      // Finalizer for closings driver.js handles itself (Escape / backdrop).
      onDestroyed: () => {
        if (this.driverInstance) this.finish(false);
      },
    });

    if (token !== this.token) return;
    this.driverInstance = instance;
    try {
      instance.drive(localStart);
    } catch (error) {
      console.warn("[product-tour] failed to start segment", error);
      this.finish(false);
    }
  }
}

export const tourManager = new ProductTourManager();
