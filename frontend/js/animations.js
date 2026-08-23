// animations.js — GSAP timelines + ScrollTrigger.
//
// The hero entrance self-triggers on load, since the hero is static content
// with no dependency on app state. animateFilePreviewIn() and
// animateResultsIn() are exposed for upload.js/main.js to call later — not
// wired in or self-triggered here.
//
// The ambient CSS loops in animations.css (blobs, waveform, CTA glow,
// scroll cue) already guard themselves with an @media prefers-reduced-motion
// block, so that's not duplicated here — only the GSAP-driven entrances
// below need their own check, since GSAP tweens aren't CSS and don't get
// skipped by a CSS media query.

gsap.registerPlugin(ScrollTrigger);

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function animateHeroEntrance() {
  const words = document.querySelectorAll('.hero__headline .word');
  const subhead = document.querySelector('.hero__subhead');
  const tl = gsap.timeline();

  if (prefersReducedMotion()) {
    tl.from(words, { opacity: 0, duration: 0.5 })
      .from(subhead, { opacity: 0, duration: 0.5 });
  } else {
    tl.from(words, { y: 24, opacity: 0, duration: 0.6, stagger: 0.08, ease: 'power3.out' })
      .from(subhead, { y: 12, opacity: 0, duration: 0.5, ease: 'power2.out' }, '-=0.15');
  }

  return tl;
}

function animateFilePreviewIn() {
  const card = document.getElementById('file-preview');

  if (prefersReducedMotion()) {
    return gsap.from(card, { opacity: 0, duration: 0.35 });
  }
  return gsap.from(card, { y: 16, opacity: 0, duration: 0.4, ease: 'power2.out' });
}

function animateResultsIn() {
  const resultsEl = document.getElementById('results');
  const transcriptPanel = resultsEl.querySelector('.transcript-panel');
  const gridPanels = resultsEl.querySelectorAll('.results-grid > .panel');
  const reduced = prefersReducedMotion();

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: resultsEl,
      start: 'top 80%',
      once: true,
    },
  });

  if (reduced) {
    tl.from([transcriptPanel, ...gridPanels], { opacity: 0, duration: 0.4 });
  } else {
    tl.from(transcriptPanel, { y: 24, opacity: 0, duration: 0.5, ease: 'power2.out' })
      .from(gridPanels, { y: 24, opacity: 0, duration: 0.5, stagger: 0.1, ease: 'power2.out' }, '-=0.2');
  }

  return tl;
}

document.addEventListener('DOMContentLoaded', animateHeroEntrance);
