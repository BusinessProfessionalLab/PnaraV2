/** Ported verbatim from the reference static build. */
export function init(reduced) {
  // ============ TESTIMONIAL MARQUEE: duplicate track for seamless loop ============
  const track = document.getElementById("track");
  if (track) {
    const originals = Array.from(track.children);
    originals.forEach((node) => {
      // Parsed straight into the track rather than cloned: a detached clone
      // would fetch its lazy avatar at once.
      track.insertAdjacentHTML("beforeend", node.outerHTML);
      const clone = track.lastElementChild;
      clone.setAttribute("aria-hidden", "true");
      // Hidden from assistive tech, so its links must not take focus either.
      clone.inert = true;
      // The duplicate exists only to close the loop; demote its headings so
      // the document outline matches the source, which has one set.
      clone.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach((h) => {
        const span = document.createElement("span");
        span.className = h.className;
        span.innerHTML = h.innerHTML;
        h.replaceWith(span);
      });
    });
  }
}
