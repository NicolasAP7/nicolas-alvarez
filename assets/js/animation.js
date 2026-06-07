const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (!prefersReducedMotion) {
  const revealItems = [
    ...document.querySelectorAll(".home-hero__content, .page-hero__inner, .section"),
    ...document.querySelectorAll(".cue-category, .language-block, .embed-card, .video-shell, .studio-grid figure, .gallery-grid img")
  ];

  revealItems.forEach((item) => item.classList.add("reveal"));

  document.querySelectorAll(".cue-grid, .embed-grid, .video-grid, .studio-grid, .gallery-grid").forEach((group) => {
    Array.from(group.children).forEach((item, index) => {
      item.style.setProperty("--reveal-delay", `${Math.min(index * 70, 420)}ms`);
    });
  });

  document.documentElement.classList.add("has-reveal");

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    {
      rootMargin: "0px 0px -12% 0px",
      threshold: 0.12
    }
  );

  revealItems.forEach((item) => revealObserver.observe(item));
}
