/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare module "aos" {
	const AOS: {
		init: (options?: Record<string, unknown>) => void;
	};

	export default AOS;
}

interface Window {
	/**
	 * Set by AnimatedText.astro once the `motion` bundle has run. The inline
	 * watchdog in Layout.astro reads it and force-reveals any heading still
	 * hidden, so a failed animation chunk can never leave copy invisible.
	 */
	__animatedTextReady?: boolean;
	darkMode: boolean;
	stickyHeaderFuncionality: () => void;
	evaluateHeaderPosition: () => void;
	applyMenuItemClasses: () => void;
	openMobileMenu: () => void;
	closeMobileMenu: () => void;
}
