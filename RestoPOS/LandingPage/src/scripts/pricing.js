/** Ported verbatim from the reference static build. */
export function init(reduced) {
  // ============ PRICING TOGGLE ============
  const toggleBtns = Array.from(document.querySelectorAll(".toggle__btn"));
  toggleBtns.forEach((b) => {
    b.addEventListener("click", () => {
      toggleBtns.forEach((other) => {
        const active = other === b;
        other.classList.toggle("is-active", active);
        other.setAttribute("aria-selected", active ? "true" : "false");
      });
    });
  });
}
