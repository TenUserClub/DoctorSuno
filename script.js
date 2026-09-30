const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// === Mobile Menu Toggle ===
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');
const setMenu = (open) => {
  hamburger.classList.toggle('active', open);
  hamburger.setAttribute('aria-expanded', String(open));
  mobileMenu.classList.toggle('open', open);
};
hamburger.addEventListener('click', () => setMenu(!mobileMenu.classList.contains('open')));
mobileMenu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));

// === Navbar border once the page leaves the top ===
const navbar = document.getElementById('navbar');
new IntersectionObserver(([entry]) => {
  navbar.classList.toggle('scrolled', !entry.isIntersecting);
}).observe(document.getElementById('top-sentinel'));

// === Reveal on scroll ===
if (!reduceMotion) {
  document.documentElement.classList.add('reveal');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));
}

// === Counter animation for stats ===
const counters = document.querySelectorAll('.stat-number[data-target]');
if (reduceMotion) {
  counters.forEach(el => { el.textContent = parseInt(el.dataset.target).toLocaleString(); });
} else {
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseInt(el.dataset.target);
      const start = performance.now();
      const animate = (now) => {
        const progress = Math.min((now - start) / 1600, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.floor(target * eased).toLocaleString();
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
      counterObserver.unobserve(el);
    });
  }, { threshold: 0.5 });
  counters.forEach(el => counterObserver.observe(el));
}

// === Smooth scroll for anchor links, offset by the sticky nav ===
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const href = this.getAttribute('href');
    if (href === '#') return;
    const target = document.querySelector(href);
    if (target) {
      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - 72;
      window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  });
});

