/**
 * Pricing comparison table, phone variant. Mirrors the Framer Compare-table
 * component: below 810px one plan column shows at a time, switched through
 * the picker (Menu item pricing). The swap fades on the default spring.
 */
export function init(reduced) {
  const root = document.querySelector('[data-ctable]');
  if (!root) return;
  const pick = root.querySelector('[data-ctable-pick]');
  const menu = root.querySelector('[data-ctable-menu]');
  const current = root.querySelector('[data-ctable-current]');
  const options = Array.from(root.querySelectorAll('[data-ctable-option]'));
  const table = root.querySelector('.ctable__table');

  const close = () => {
    root.classList.remove('is-picking');
    pick.setAttribute('aria-expanded', 'false');
  };

  pick.addEventListener('click', () => {
    const open = root.classList.toggle('is-picking');
    pick.setAttribute('aria-expanded', String(open));
  });

  options.forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = btn.getAttribute('data-ctable-option');
      root.setAttribute('data-plan', i);
      current.textContent = btn.textContent;
      options.forEach((o) => o.classList.toggle('is-active', o === btn));
      close();
      if (!reduced && table.animate) {
        table.animate(
          { opacity: [0.3, 1], transform: ['translateY(4px)', 'translateY(0)'] },
          { duration: 400, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
        );
      }
    });
  });

  document.addEventListener('click', (e) => {
    if (!root.contains(e.target)) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && root.classList.contains('is-picking')) { close(); pick.focus(); }
  });
}
