"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";

/**
 * easeOut — cubic-bezier(0.16, 1, 0.3, 1): starts fast, settles softly, the
 * same decelerating feel iOS uses for sheets and route pushes.
 */
const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * Smooth, native-feeling route transition — new content slides up from the
 * bottom with ease-out.
 *
 * Two granularities:
 * - `mode="segment"` keys on the first path segment (/pos, /admin, /kds,
 *   /login) — used once at the app root so whole-screen switches animate,
 *   while navigation *inside* a segment (e.g. admin sub-pages) does not
 *   remount the shells that live in that segment's layout.
 * - `mode="path"` keys on the full pathname — used by segment `template.tsx`
 *   files, which Next remounts on every navigation below that segment, so
 *   the inner page area (inside the persistent shell) animates per page.
 *
 * Why the outer shell: the rise is done by a transform on an *inner* layer
 * while an untransformed `overflow: clip` shell sits between it and the
 * document. Without that, the few-pixel bottom overflow during the slide
 * would make the body scrollbar appear/disappear on viewport-exact screens
 * (POS is `h-dvh`) — the visible "layout shift" when switching pages.
 * `overflow: clip` (not `hidden`) does not create a scroll container, so
 * sticky headers/sidebars inside the page keep working, and once the
 * animation ends the wrapper carries no transform at all (dialogs that
 * portal to <body> are unaffected either way).
 */
export function RouteView({
  mode = "segment",
  children,
}: {
  mode?: "segment" | "path";
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const key = mode === "segment" ? (pathname.split("/")[1] ?? "") : pathname;

  return (
    <div style={{ overflow: "clip" }}>
      <motion.div
        key={key}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: EASE_OUT }}
      >
        {children}
      </motion.div>
    </div>
  );
}
