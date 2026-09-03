/**
 * Product Tour — public facade.
 *
 * Everything outside this feature talks only to what is exported here:
 *   - <TourHost /> once in the root providers (first-login offer + resume)
 *   - <TourTrigger /> in headers (manual replay)
 *   - useProductTour() for imperative control
 *
 * Driver.js is intentionally internal to this feature.
 */

export { TourTrigger } from "./components/tour-trigger";
export { TourHost } from "./components/tour-host";
export { WelcomeDialog } from "./components/welcome-dialog";
export { useProductTour } from "./hooks/use-product-tour";
export type { ProductTourApi } from "./hooks/use-product-tour";
export { tourRegistry } from "./registry";
export type { TourDefinition, TourStep, TourStatus } from "./types";
