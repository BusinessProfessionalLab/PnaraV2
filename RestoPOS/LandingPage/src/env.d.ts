/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface Window {
	darkMode: boolean;
	stickyHeaderFuncionality: () => void;
	evaluateHeaderPosition: () => void;
	applyMenuItemClasses: () => void;
	openMobileMenu: () => void;
	closeMobileMenu: () => void;
}
