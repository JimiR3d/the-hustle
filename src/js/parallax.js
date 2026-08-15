import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

export function initParallax() {
  gsap.registerPlugin(ScrollTrigger);

  const parallaxContainer = document.getElementById('intro-parallax-section');
  const triggerElement = document.querySelector('[data-parallax-layers]');

  if (!parallaxContainer || !triggerElement) return null;

  // Initialize Lenis Smooth Scrolling
  const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    orientation: 'vertical',
  });

  const lenisTicker = (time) => {
    lenis.raf(time * 1000);
  };
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(lenisTicker);
  gsap.ticker.lagSmoothing(0);

  const visibilityObserver = new IntersectionObserver(([entry]) => {
    const introIsVisible = Boolean(entry?.isIntersecting);
    document.body.classList.toggle('arena-performance-mode', !introIsVisible);
  }, { threshold: 0.01 });
  visibilityObserver.observe(parallaxContainer);

  // Parallax multi-depth timeline
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: parallaxContainer,
      start: 'top top',
      end: 'bottom top',
      scrub: 0.6,
      pin: false,
    },
  });

  // Environmental Parallax Layer depths (Sky = slowest, Buildings = medium, Ground = fastest foreground)
  tl.to('[data-parallax-layer="sky"]', { yPercent: 12, ease: 'none' }, 0)
    .to('[data-parallax-layer="buildings"]', { yPercent: -18, ease: 'none' }, 0)
    .to('[data-parallax-layer="ground"]', { yPercent: -38, ease: 'none' }, 0);

  // Scroll to Arena button click (Cinematic, smooth 3.0s auto-scroll showcasing parallax layers)
  const scrollIndicator = document.getElementById('scroll-to-arena-btn');
  if (scrollIndicator) {
    scrollIndicator.addEventListener('click', () => {
      const arenaSection = document.getElementById('main-arena-section');
      if (arenaSection) {
        lenis.start();
        lenis.scrollTo(arenaSection, {
          offset: 0,
          duration: 3.0,
          easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
        });
      }
    });
  }

  const scrollToTopButton = document.getElementById('scroll-to-top-btn');
  if (scrollToTopButton) {
    scrollToTopButton.addEventListener('click', () => {
      lenis.start();
      lenis.scrollTo(0, {
        duration: 2.4,
        easing: (t) => 1 - Math.pow(1 - t, 4),
      });
    });
  }

  return {
    lenis,
    destroy() {
      document.body.classList.remove('arena-performance-mode');
      visibilityObserver.disconnect();
      gsap.ticker.remove(lenisTicker);
      ScrollTrigger.getAll().forEach((st) => st.kill());
      gsap.killTweensOf(triggerElement);
      lenis.destroy();
    },
  };
}
