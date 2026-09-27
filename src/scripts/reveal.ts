// Marks `.reveal` elements with `.is-in` the first time they enter the
// viewport, so the CSS in base.css can play their entrance once. Diagrams use
// the same class to start drawing. Anything already on screen at load is
// marked straight away, and a browser without IntersectionObserver gets
// everything at once rather than hidden content.

const targets = document.querySelectorAll<HTMLElement>('.reveal');

if (!('IntersectionObserver' in window)) {
  targets.forEach((el) => el.classList.add('is-in'));
} else {
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.05 },
  );
  targets.forEach((el) => io.observe(el));
}
