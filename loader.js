/* loader-intro.final.js
   Ultra-refined loader controller (GSAP + SplitType optional)
   - Uses CSS (.loader.animate / .dissolving / .is-hidden) for buttery visuals
   - Adds .page-blur to main during handoff
   - Waits for fonts.ready (with timeout) for crisp hero text
   - Exposes window.__loader.run / skip / done
*/

(function () {
  'use strict';

  const $ = (sel, ctx = document) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from((ctx || document).querySelectorAll(sel));
  const prefersReduced = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const cfg = {
    charDuration: 0.78,      // seconds (used only to estimate fallback timing)
    charStagger: 0.036,      // seconds
    holdAfter: 0.32,         // seconds before exit
    exitDuration: 0.82,      // seconds for loader exit
    safetyMs: 9000,          // force-skip after this ms
    fontWaitMs: 800,         // max wait for document.fonts.ready
    pageBlurClass: 'page-blur' // class toggled on <main> during handoff
  };

  let safetyTimer = null;
  let glowHandler = null;
  let splitInstance = null;
  let completed = false;
  let isRunning = false;

  // ---------------------------
  // Utilities
  // ---------------------------
  function noop() {}
  function isTouchDevice() {
    return ('ontouchstart' in window) || navigator.maxTouchPoints > 1;
  }
  function safe(fn) {
    try { return fn(); } catch (e) { console.warn('loader.safe:', e); }
  }
  function waitForFonts(timeout = cfg.fontWaitMs) {
    if (!document.fonts || !document.fonts.ready) return Promise.resolve();
    // race fonts.ready with timeout so loader never hangs waiting on fonts
    return Promise.race([
      document.fonts.ready,
      new Promise(resolve => setTimeout(resolve, timeout))
    ]);
  }

  // ---------------------------
  // Build character spans (SplitType preferred)
  // ---------------------------
  function buildChars(nameWrap) {
    if (!nameWrap) return [];

    // Prefer SplitType if present (keeps semantic & performance)
    if (typeof SplitType !== 'undefined') {
      try {
        splitInstance = new SplitType(nameWrap, { types: 'chars', charClass: 'char' });
        const chars = Array.from(nameWrap.querySelectorAll('.char'));
        chars.forEach((c, i) => c.style.setProperty('--i', i));
        return chars;
      } catch (err) {
        // fallback to manual split
        splitInstance = null;
        console.warn('SplitType failed — falling back to manual split.', err);
      }
    }

    // Manual split (preserve spaces)
    const text = (nameWrap.textContent || '').replace(/\s+/g, ' ').trim();
    nameWrap.innerHTML = '';
    const chars = [];
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const span = document.createElement('span');
      span.className = 'char';
      span.setAttribute('aria-hidden', 'true');
      span.style.display = 'inline-block';
      span.textContent = ch === ' ' ? '\u00A0' : ch;
      span.style.setProperty('--i', i);
      nameWrap.appendChild(span);
      chars.push(span);
    }
    return chars;
  }

  // ---------------------------
  // Glow parallax (mouse)
  // ---------------------------
  function enableGlowParallax(loader) {
    const ring = loader && loader.querySelector('.glow-ring');
    if (!ring) return null;
    if (isTouchDevice()) { ring.style.display = 'none'; return null; }

    if (typeof gsap !== 'undefined' && gsap.quickSetter) {
      const setX = gsap.quickSetter(ring, 'x', 'px');
      const setY = gsap.quickSetter(ring, 'y', 'px');
      const handler = (e) => {
        const x = (e.clientX / window.innerWidth - 0.5) * 36; // subtle intensity
        const y = (e.clientY / window.innerHeight - 0.5) * 36;
        setX(x); setY(y);
      };
      window.addEventListener('mousemove', handler, { passive: true });
      return handler;
    } else {
      const handler = (e) => {
        const x = (e.clientX / window.innerWidth - 0.5) * 36;
        const y = (e.clientY / window.innerHeight - 0.5) * 36;
        ring.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      };
      window.addEventListener('mousemove', handler, { passive: true });
      return handler;
    }
  }

  // ---------------------------
  // Cleanup and handoff
  // ---------------------------
  function cleanupAndContinue(loader) {
    if (completed) return;
    completed = true;
    isRunning = false;
    clearTimeout(safetyTimer);

    // Remove glow handler
    try { if (glowHandler) window.removeEventListener('mousemove', glowHandler); } catch (e) {}

    // Remove page blur
    const main = document.querySelector('main');
    if (main) main.classList.remove(cfg.pageBlurClass);
    // remove loader DOM
    try { if (loader && loader.parentNode) loader.parentNode.removeChild(loader); } catch (e) {}

    // revert SplitType if present
    try { if (splitInstance && typeof splitInstance.revert === 'function') splitInstance.revert(); } catch (e) {}

    // focus main for accessibility
    if (main) {
      const prev = main.getAttribute('tabindex');
      main.setAttribute('tabindex', '-1');
      main.focus({ preventScroll: true });
      if (prev === null) main.removeAttribute('tabindex'); else main.setAttribute('tabindex', prev);
    }

    // refresh scroll systems if present
    safe(() => { if (typeof ScrollTrigger !== 'undefined' && ScrollTrigger.refresh) ScrollTrigger.refresh(); });
    safe(() => { if (window.__lenis && typeof window.__lenis.update === 'function') window.__lenis.update(); });

    window.__loader_done = true;
  }

  function forceCleanup(loader) {
    if (!loader) return cleanupAndContinue(loader);
    // quick hide for immediate action
    loader.classList.add('fast-hide');
    setTimeout(() => cleanupAndContinue(loader), 80);
  }

  // ---------------------------
  // GSAP timeline path (preferred)
  // ---------------------------
  function runGSAPPath(loader, chars) {
    if (typeof gsap === 'undefined') return false;
    try {
      // register ScrollTrigger if present
      if (typeof ScrollTrigger !== 'undefined') {
        try { gsap.registerPlugin(ScrollTrigger); } catch (e) {}
      }

      // set initial states
      gsap.set(chars, { yPercent: 120, autoAlpha: 0, transformOrigin: '50% 80%' });
      // ensure accent/glow visible subtle
      gsap.set(loader.querySelectorAll('.accent-bar, .glow-ring'), { autoAlpha: 0.9 });

      const tl = gsap.timeline({
        defaults: { ease: 'power3.out' }
      });

      // animate chars in with stagger
      tl.to(chars, {
        yPercent: 0,
        autoAlpha: 1,
        duration: cfg.charDuration,
        stagger: cfg.charStagger,
        ease: 'expo.out'
      }, 0);

      // tell CSS to perform micro-floating + accent reveal
      tl.call(() => loader.classList.add('animate'), null, `-=${Math.min(0.45, cfg.charDuration)}`);

      // hold so user can see name
      tl.to({}, { duration: cfg.holdAfter });

      // before exit: ensure fonts are ready (so hero text won't jump)
      tl.call(() => {
        // add page blur for cinematic feel
        const main = document.querySelector('main');
        if (main) main.classList.add(cfg.pageBlurClass);
      });

      // wait for fonts.ready (max timeout) then perform exit animation
      tl.call(() => {
        return waitForFonts(cfg.fontWaitMs);
      });

      // exit animation
      tl.to(loader, {
        autoAlpha: 0,
        y: 18,
        filter: 'blur(10px)',
        duration: cfg.exitDuration,
        ease: 'power2.inOut',
        onStart: () => loader.classList.add('dissolving'),
        onComplete: () => cleanupAndContinue(loader)
      });

      // safety timer
      safetyTimer = setTimeout(() => {
        if (!completed) {
          console.warn('Loader safety timeout — forcing cleanup');
          try { if (glowHandler) window.removeEventListener('mousemove', glowHandler); } catch (e) {}
          forceCleanup(loader);
        }
      }, cfg.safetyMs);

      return true;
    } catch (e) {
      console.warn('GSAP loader path failed:', e);
      return false;
    }
  }

  // ---------------------------
  // CSS fallback path
  // ---------------------------
  function runCSSFallback(loader, chars) {
    // set indices for CSS-driven stagger
    chars.forEach((c, i) => c.style.setProperty('--i', i));

    // small tick to ensure styles applied then toggle animate
    requestAnimationFrame(() => {
      loader.classList.add('animate');

      // add page blur before exit
      const totalRevealMs = Math.round((cfg.charDuration + cfg.charStagger * (chars.length - 1)) * 1000);
      const holdMs = Math.round(cfg.holdAfter * 1000);
      const delayBeforeExit = Math.max(200, totalRevealMs + holdMs);

      setTimeout(() => {
        // add page blur
        const main = document.querySelector('main');
        if (main) main.classList.add(cfg.pageBlurClass);

        // wait a moment for font readiness then hide
        waitForFonts(cfg.fontWaitMs).then(() => {
          // trigger CSS hide (use is-hidden so CSS exit transitions run)
          loader.classList.add('is-hidden');
          setTimeout(() => cleanupAndContinue(loader), Math.round(cfg.exitDuration * 1000) + 40);
        });
      }, delayBeforeExit);
    });

    // safety
    safetyTimer = setTimeout(() => {
      if (!completed) {
        console.warn('Loader CSS safety timeout — forcing cleanup');
        try { if (glowHandler) window.removeEventListener('mousemove', glowHandler); } catch (e) {}
        forceCleanup(loader);
      }
    }, cfg.safetyMs);
  }

  // ---------------------------
  // Main runner
  // ---------------------------
  function runLoaderInternal() {
    if (isRunning) return;
    isRunning = true;

    const loader = document.querySelector('.loader');
    if (!loader) { window.__loader_done = true; return; }

    // if prefers-reduced-motion -> skip gracefully
    if (prefersReduced) {
      loader.classList.add('is-hidden');
      cleanupAndContinue(loader);
      return;
    }

    // defensive centering
    loader.style.display = loader.style.display || 'grid';
    loader.style.placeItems = loader.style.placeItems || 'center';

    const nameWrap = loader.querySelector('.loader-name');
    if (!nameWrap) { forceCleanup(loader); return; }

    // build chars (SplitType or manual)
    const chars = buildChars(nameWrap);
    if (!chars || chars.length === 0) { forceCleanup(loader); return; }

    // enable glow parallax
    glowHandler = enableGlowParallax(loader);

    // Try GSAP path, otherwise CSS fallback
    const usedGSAP = runGSAPPath(loader, chars);
    if (!usedGSAP) runCSSFallback(loader, chars);

    // allow Escape key to skip
    const escHandler = (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        try { if (glowHandler) window.removeEventListener('mousemove', glowHandler); } catch (err) {}
        forceCleanup(loader);
      }
    };
    window.addEventListener('keydown', escHandler, { passive: true });

    // ensure we remove esc listener at cleanup
    const cleanupEsc = () => { try { window.removeEventListener('keydown', escHandler); } catch (e) {} };
    // Attach a finalizer to cleanupEsc when done
    // We will attempt to remove again in cleanupAndContinue but do it here too:
    const origCleanup = cleanupAndContinue;
    cleanupAndContinue = function (l) { cleanupEsc(); origCleanup(l); };
  }

  // ---------------------------
  // Public API
  // ---------------------------
  window.__loader = window.__loader || {};
  window.__loader.run = function runNow() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', runLoaderInternal, { once: true });
    } else runLoaderInternal();
  };
  window.__loader.skip = function skipNow() {
    const loader = document.querySelector('.loader');
    if (!loader) return;
    try { if (glowHandler) window.removeEventListener('mousemove', glowHandler); } catch (e) {}
    forceCleanup(loader);
  };
  window.__loader.done = () => !!window.__loader_done;

  // auto-run
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.__loader.run, { once: true });
  } else {
    setTimeout(window.__loader.run, 12);
  }

  // Export small helpers for debugging
  window.__loader._cfg = cfg;

})(); // IIFE end





