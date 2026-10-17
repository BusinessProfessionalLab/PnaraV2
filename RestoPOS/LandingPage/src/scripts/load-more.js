/**
 * Load More — drives the Framer component's Default / Loading / Hidden
 * variants over the blog grid. Reveals one row at a time, shows the spinner
 * during the reveal, then removes itself once every card is visible.
 */
export function init(reduced) {
  const btn = document.querySelector('[data-load-more]');
  if (!btn) return;
  const cards = Array.from(document.querySelectorAll('[data-card]'));
  const STEP = 3;

  const remaining = () => cards.filter((c) => c.hidden);

  /** Framer keeps the control visible while a next page might exist. With
   *  every card already rendered there is nothing left to fetch, so the first
   *  press resolves to the component's Hidden variant. */
  const sync = () => {
    if (!remaining().length && btn.dataset.pressed === 'true') {
      btn.classList.remove('is-loading');
      btn.classList.add('is-hidden');
    }
  };

  btn.addEventListener('click', () => {
    if (btn.classList.contains('is-loading')) return;
    btn.dataset.pressed = 'true';
    btn.classList.add('is-loading');
    btn.setAttribute('aria-busy', 'true');

    const reveal = () => {
      remaining().slice(0, STEP).forEach((c) => { c.hidden = false; });
      btn.classList.remove('is-loading');
      btn.setAttribute('aria-busy', 'false');
      sync();
    };

    if (reduced) reveal();
    else window.setTimeout(reveal, 420);
  });

  sync();
}
