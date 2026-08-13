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

  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);

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

  // Layer depths
  tl.to('[data-parallax-layer="sky"]', { yPercent: 18, ease: 'none' }, 0)
    .to('[data-parallax-layer="buildings"]', { yPercent: 32, ease: 'none' }, 0)
    .to('[data-parallax-layer="ground"]', { yPercent: 42, ease: 'none' }, 0)
    .to('[data-parallax-layer="piggy"]', { yPercent: 58, ease: 'none' }, 0)
    .to('[data-parallax-layer="logo"]', { yPercent: 68, ease: 'none' }, 0)
    .to('[data-parallax-layer="hosts"]', { yPercent: 82, ease: 'none' }, 0)
    .to('[data-parallax-layer="sign"]', { yPercent: 82, ease: 'none' }, 0)
    .to('[data-parallax-layer="sponsors"]', { yPercent: 88, ease: 'none' }, 0)
    .to('.parallax__fade', { opacity: 0.95, ease: 'power2.in' }, 0.2);

  // Scroll to Arena button click
  const scrollIndicator = document.getElementById('scroll-to-arena-btn');
  if (scrollIndicator) {
    scrollIndicator.addEventListener('click', () => {
      const arenaSection = document.getElementById('main-arena-section');
      if (arenaSection) {
        lenis.scrollTo(arenaSection, { offset: 0, duration: 1.4 });
      }
    });
  }

  return {
    lenis,
    destroy() {
      ScrollTrigger.getAll().forEach((st) => st.kill());
      gsap.killTweensOf(triggerElement);
      lenis.destroy();
    },
  };
}
