/**
 * Media below the first screen waits until its section is near the viewport,
 * so the hero is not competing with it for the connection on load.
 *
 * Images in hidden tabs, closed cards and moving rows are marked
 * loading="lazy"; left alone, the browser would fetch them only once they show,
 * which is mid-interaction. Here they all load together as the section
 * approaches, so a tab switch or a hover never waits on the network.
 *
 * The two painted CSS backgrounds (the How-it-works panel, the plan cards) are
 * held back by a rule in global.css until their element gets .is-near.
 */
export function init() {
  const near = (el, run) => {
    if (!('IntersectionObserver' in window)) return run();
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); run(); }
    }, { rootMargin: '1200px 0px' });
    io.observe(el);
  };

  document.querySelectorAll('#why-cards, #delegation, .marquee, .int-marquee').forEach((el) => {
    near(el, () => el.querySelectorAll('img[loading="lazy"]').forEach((img) => { img.loading = 'eager'; }));
  });
  document.querySelectorAll('#hiw-panel, #plans').forEach((el) => {
    near(el, () => el.classList.add('is-near'));
  });
}
