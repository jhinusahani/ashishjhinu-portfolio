/* hs.full.pretty.js — Ultra premium interactions for Ashish Sahani portfolio
   - Single file combining: loader, Lenis integration, GSAP/ScrollTrigger animations,
     SplitType-powered hero, card tilt/parallax, hover glow & accent, Swiper (optional),
     nav indicator, mobile menu, contact form labels, scroll progress, tests and teardown.
   - Defensive: works fine if any lib is missing. Respects prefers-reduced-motion and touch.
   - Keep this file deferred in HTML (defer attribute) and include library scripts before if possible.
*/

/* global gsap, ScrollTrigger, SplitType, Lenis, Swiper */
(function () {
  'use strict';

  /* ---------------------------
     CONFIG + UTILITIES
     --------------------------- */
  const $ = (sel, ctx = document) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from((ctx || document).querySelectorAll(sel));
  const isTouchDevice = () => ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const supportsPassive = (() => {
    try {
      let opts = Object.defineProperty({}, 'passive', { get: function () { return true; }});
      window.addEventListener('test', null, opts);
      window.removeEventListener('test', null, opts);
      return true;
    } catch (e) {
      return false;
    }
  })();

  const CONFIG = {
    debug: false,
    lenis: { duration: 1.05, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true, smoothTouch: true },
    hero: { titleDuration: 1.2, wordStagger: 0.035, subtitleStagger: 0.09, lineStagger: 0.09 },
    reveal: { interval: 0.12, batchMax: 8 },
    parallaxY: 10,
    cursorScale: 3.6,
    cardTilt: { maxX: 6, maxY: 8, speed: 0.12 },
    mobileBreakpoint: 850,
    swiper: {
      css: 'https://cdn.jsdelivr.net/npm/swiper@12.0.2/swiper-bundle.min.css',
      js: 'https://cdn.jsdelivr.net/npm/swiper@12.0.2/swiper-bundle.min.js'
    },
    scrollAccent: { maxBlur: 12, maxOpacity: 0.26, smoothFactor: 0.12, velocityScale: 0.06 }
  };

  const log = (...args) => { if (CONFIG.debug) console.log('[hs]', ...args); };

  /* ---------------------------
     GLOBAL STATE + TEARDOWN
     --------------------------- */
  let lenisInstance = null;
  let rafStarted = false;
  let teardownFns = [];
  function addTeardown(fn) { if (typeof fn === 'function') teardownFns.push(fn); }

  /* ---------------------------
     SAFE FEATURE HELPERS
     --------------------------- */
  function isGSAPAvailable() { return !!(window.gsap && window.gsap.timeline); }
  function isScrollTriggerAvailable() { return !!(window.gsap && window.gsap.plugins && window.gsap.plugins.ScrollTrigger); }
  function isSplitTypeAvailable() { return typeof SplitType !== 'undefined'; }
  function isSwiperAvailable() { return typeof Swiper !== 'undefined'; }

  /* ---------------------------
     DYNAMIC SWIPER LOADER
     --------------------------- */
  function loadSwiper() {
    if (isSwiperAvailable()) return Promise.resolve(window.Swiper);
    // inject css (idempotent)
    if (!document.querySelector(`link[href="${CONFIG.swiper.css}"]`)) {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = CONFIG.swiper.css;
      document.head.appendChild(l);
    }
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = CONFIG.swiper.js;
      s.async = true;
      s.onload = () => { resolve(window.Swiper); };
      s.onerror = (e) => { console.warn('Swiper failed to load', e); reject(e); };
      document.head.appendChild(s);
    });
  }

  /* ---------------------------
     1) Loader (safe)
     --------------------------- */
  function initLoader() {
    const loader = document.querySelector('.loader');
    if (!loader) return;
    if (prefersReducedMotion) { loader.remove?.(); return; }
    if (isGSAPAvailable()) {
      try {
        const tl = gsap.timeline();
        tl.to('.glow-ring', { scale: 1.06, opacity: 1, duration: 0.8, ease: 'power2.out' })
          .to('.loader-inner .loader-name', { y: -8, autoAlpha: 1, duration: 0.6 }, '-=0.5')
          .to('.accent-bar', { scaleX: 1, duration: 0.9 }, '-=0.6')
          .to(loader, { autoAlpha: 0, pointerEvents: 'none', duration: 0.55, delay: 0.25 })
          .call(() => { loader.remove?.(); });
      } catch (e) { loader.remove?.(); }
    } else {
      loader.style.transition = 'opacity 420ms ease';
      loader.style.opacity = '0';
      setTimeout(() => loader.remove?.(), 520);
    }
  }

  /* ---------------------------
     2) Lenis smooth scroll + RAF loop + ScrollTrigger proxy
     --------------------------- */
  function initLenis() {
    if (prefersReducedMotion) { log('reduced-motion => skip Lenis'); return null; }
    if (typeof Lenis === 'undefined') { log('Lenis not found'); return null; }

    if (window.__lenis && window.__lenis instanceof Lenis) {
      lenisInstance = window.__lenis;
      log('Reusing existing Lenis');
    } else {
      try {
        lenisInstance = new Lenis(CONFIG.lenis);
        window.__lenis = lenisInstance;
        log('Created Lenis');
      } catch (e) {
        console.warn('Lenis init error', e);
        lenisInstance = null;
      }
    }

    if (!lenisInstance) return null;

    if (!rafStarted) {
      rafStarted = true;
      (function rafLoop(t) {
        try { lenisInstance.raf(t); } catch (e) { /* ignore */ }
        requestAnimationFrame(rafLoop);
      })(performance.now());
    }

    // integrate with ScrollTrigger
    if (isScrollTriggerAvailable()) {
      try {
        const ST = window.gsap.plugins.ScrollTrigger;
        ST.scrollerProxy(document.documentElement, {
          scrollTop(value) {
            if (!arguments.length) return window.scrollY;
            lenisInstance.scrollTo(value, { immediate: true });
          },
          getBoundingClientRect() {
            return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
          },
          pinType: document.documentElement.style.transform ? 'transform' : 'fixed'
        });
        lenisInstance.on && lenisInstance.on('scroll', () => ST.update());
      } catch (e) { console.warn('Lenis <-> ScrollTrigger integration failed', e); }
    }

    return lenisInstance;
  }

  /* ---------------------------
     3) Custom Cursor (follower)
     --------------------------- */
  function initCursor() {
    const cur = document.getElementById('cursor-follower');
    if (!cur) return;
    if (isTouchDevice() || window.matchMedia('(hover: none), (pointer: coarse)').matches) { cur.style.display = 'none'; return; }
    if (prefersReducedMotion) { cur.style.display = 'none'; return; }

    // setup performance styles
    cur.style.position = 'fixed';
    cur.style.left = '0';
    cur.style.top = '0';
    cur.style.pointerEvents = 'none';
    cur.style.willChange = 'transform, opacity';

    let setX, setY;
    if (isGSAPAvailable() && gsap.quickSetter) {
      setX = gsap.quickSetter(cur, 'x', 'px');
      setY = gsap.quickSetter(cur, 'y', 'px');
    } else {
      setX = (x) => { cur.style.transform = `translate3d(${x}px, var(--cursor-y, 50%), 0)`; };
      setY = (y) => { cur.style.setProperty('--cursor-y', `${y}px`); };
    }

    let lastX = innerWidth / 2, lastY = innerHeight / 2, moved = false;
    const onMove = (e) => { lastX = e.clientX; lastY = e.clientY; moved = true; };
    window.addEventListener('pointermove', onMove, supportsPassive ? { passive: true } : false);

    let rafId = requestAnimationFrame(function tick() {
      if (moved) {
        try { setX(lastX); setY(lastY); } catch (e) {}
        moved = false;
      }
      rafId = requestAnimationFrame(tick);
    });

    const interactive = 'a, button, .btn, .card, .social-btn, input, textarea';
    const onOver = (e) => { if (e.target.closest && e.target.closest(interactive)) cur.classList.add('active'); };
    const onOut = (e) => { if (e.target.closest && e.target.closest(interactive)) cur.classList.remove('active'); };
    document.addEventListener('pointerover', onOver, supportsPassive ? { passive: true } : false);
    document.addEventListener('pointerout', onOut, supportsPassive ? { passive: true } : false);

    const teardown = () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerout', onOut);
    };
    addTeardown(teardown);
    return teardown;
  }

  /* ---------------------------
     4) Theme toggle
     --------------------------- */
  function initThemeToggle() {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;
    const root = document.documentElement;
    let stored = null;
    try { stored = localStorage.getItem('theme'); } catch (e) { /* ignore */ }
    if (stored === 'dark') { root.classList.add('dark-theme'); btn.setAttribute('aria-pressed', 'true'); }
    else { root.classList.remove('dark-theme'); btn.setAttribute('aria-pressed', 'false'); }

    const onToggle = () => {
      const isDark = root.classList.toggle('dark-theme');
      btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
      try { localStorage.setItem('theme', isDark ? 'dark' : 'light'); } catch (e) {}
      btn.textContent = isDark ? '☀️' : '🌙';
    };
    btn.addEventListener('click', onToggle, supportsPassive ? { passive: true } : false);
    addTeardown(() => btn.removeEventListener('click', onToggle));
    return onToggle;
  }

  /* ---------------------------
     5) NAV indicator + scroll-spy (robust)
     --------------------------- */
  function initNav() {
    const nav = document.querySelector('nav[aria-label="Primary navigation"]');
    if (!nav) return;
    const links = Array.from(nav.querySelectorAll('a'));
    let indicator = nav.querySelector('.nav-indicator');
    if (!indicator) {
      indicator = document.createElement('span');
      indicator.className = 'nav-indicator';
      nav.appendChild(indicator);
    }

    function place(a) {
      if (!a) return;
      const nr = nav.getBoundingClientRect();
      const r = a.getBoundingClientRect();
      indicator.style.width = `${r.width}px`;
      indicator.style.transform = `translateX(${r.left - nr.left}px)`;
      indicator.style.opacity = 1;
    }

    const onMouseEnter = (e) => place(e.currentTarget);
    links.forEach(l => l.addEventListener('mouseenter', onMouseEnter));
    nav.addEventListener('mouseleave', () => { indicator.style.opacity = 0.05; });

    // scroll spy
    const sections = links.map(a => {
      const href = a.getAttribute('href') || '';
      return href && href.startsWith('#') ? document.getElementById(href.slice(1)) : null;
    });

    const spy = () => {
      const pos = (window.scrollY || document.documentElement.scrollTop) + window.innerHeight * 0.2;
      sections.forEach((s, i) => {
        if (!s) return;
        const top = s.getBoundingClientRect().top + window.scrollY;
        const bottom = top + s.offsetHeight;
        if (pos >= top && pos < bottom) {
          links[i].classList.add('active');
          place(links[i]);
        } else {
          links[i].classList.remove('active');
        }
      });
    };
    window.addEventListener('scroll', spy, supportsPassive ? { passive: true } : false);
    window.addEventListener('resize', () => setTimeout(spy, 120));
    spy();

    addTeardown(() => {
      links.forEach(l => l.removeEventListener('mouseenter', onMouseEnter));
      window.removeEventListener('scroll', spy);
    });
  }

  /* ---------------------------
     6) Mobile nav toggle
     --------------------------- */
  function initMobileMenu() {
    const btn = document.querySelector('.mobile-nav-toggle');
    const overlay = document.querySelector('.mobile-nav-overlay');
    if (!btn || !overlay) return;
    const onToggle = () => document.body.classList.toggle('mobile-nav-active');
    const onOverlayClick = (e) => { if (e.target === overlay) document.body.classList.remove('mobile-nav-active'); };
    btn.addEventListener('click', onToggle);
    overlay.addEventListener('click', onOverlayClick);
    addTeardown(() => {
      btn.removeEventListener('click', onToggle);
      overlay.removeEventListener('click', onOverlayClick);
    });
  }

  /* ---------------------------
     7) HERO — cinematic SplitType + GSAP
     --------------------------- */
  function initHeroCinematic() {
    const hero = $('#hero');
    const title = $('#hero-title');
    if (!hero || !title) return;

    // gather sub-elements
    const subtitle = $('.subtitle');
    const ctas = Array.from(document.querySelectorAll('.hero .form-row .btn'));
    const stats = Array.from(document.querySelectorAll('.hero .hero-stats .stat'));
    const profileCard = $('.profile-card');
    const heroBg = $('.hero-bg');

    // respect reduced-motion and touch
    if (prefersReducedMotion || isTouchDevice()) {
      title.style.opacity = '1';
      subtitle && (subtitle.style.opacity = '1');
      ctas.forEach(b => b.style.opacity = '1');
      stats.forEach(s => s.style.opacity = '1');
      profileCard && (profileCard.style.opacity = '1');
      return;
    }

    const hasGSAP = isGSAPAvailable();
    const hasSplit = isSplitTypeAvailable();

    let localSplitTitle = null, localSplitSub = null, tl = null;
    let pointerMoveHandler = null;

    try {
      if (hasGSAP) {
        // register ScrollTrigger plugin (safe)
        try { gsap.registerPlugin(ScrollTrigger); } catch (e) { /* ignore if already */ }

        // Create splits
        if (hasSplit) {
          try {
            localSplitTitle = new SplitType(title, { types: 'words, chars', tagName: 'span' });
            if (subtitle) localSplitSub = new SplitType('.hero .subtitle', { types: 'lines', tagName: 'span' });
          } catch (e) {
            console.warn('SplitType threw', e);
            localSplitTitle = null; localSplitSub = null;
          }
        } else {
          // fallback: wrap words
          const wordsHtml = title.textContent.trim().split(/\s+/).map(w => `<span class="word">${w}</span>`).join(' ');
          title.innerHTML = wordsHtml;
          localSplitTitle = { words: Array.from(title.querySelectorAll('.word')) };
        }

        const words = (localSplitTitle && localSplitTitle.words) ? localSplitTitle.words : [title];
        words.forEach(w => { w.style.display = 'inline-block'; w.style.willChange = 'transform, opacity'; });

        // ambient heroBg pan
        if (heroBg) {
          heroBg.style.willChange = 'transform, filter';
          gsap.to(heroBg, { x: '4%', y: '-2%', scale: 1.02, duration: 24, ease: 'sine.inOut', yoyo: true, repeat: -1 });
        }

        // timeline
        tl = gsap.timeline({ defaults: { ease: 'expo.out' }, paused: true });

        // background entrance
        if (heroBg) tl.fromTo(heroBg, { autoAlpha: 0.0, scale: 1.03 }, { autoAlpha: 1, scale: 1, duration: 1.05 }, 0);

        // title animation
        tl.fromTo(words, { yPercent: 30, skewY: 8, autoAlpha: 0 }, {
          yPercent: 0, skewY: 0, autoAlpha: 1, duration: CONFIG.hero.titleDuration,
          stagger: { each: CONFIG.hero.wordStagger, from: 'start' }
        }, 0.06);

        // subtitle
        if (localSplitSub && localSplitSub.lines) {
          tl.fromTo(localSplitSub.lines, { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9, stagger: CONFIG.hero.lineStagger }, '-=0.8');
        } else if (subtitle) {
          tl.fromTo(subtitle, { y: 12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9 }, '-=0.6');
        }

        // CTAs and stats
        const extras = [...ctas, ...stats.filter(Boolean), profileCard].filter(Boolean);
        if (extras.length) {
          tl.fromTo(extras, { y: 28, autoAlpha: 0, scale: 0.995 }, { y: 0, autoAlpha: 1, scale: 1, duration: 0.9, stagger: 0.08 }, '-=0.55');
        }

        // small pointer micro-parallax (low amplitude)
        if (!isTouchDevice() && gsap.quickSetter) {
          const mover = heroBg || title;
          const setX = gsap.quickSetter(mover, 'x', 'px');
          const setY = gsap.quickSetter(mover, 'y', 'px');
          pointerMoveHandler = (e) => {
            const r = hero.getBoundingClientRect();
            const px = (e.clientX - r.left) / r.width - 0.5;
            const py = (e.clientY - r.top) / r.height - 0.5;
            // tween small motion
            gsap.to({}, { duration: 0.6, onUpdate() { try { setX(px * CONFIG.parallaxY * 0.25); setY(py * CONFIG.parallaxY * 0.12); } catch (err) {} } });
          };
          window.addEventListener('pointermove', pointerMoveHandler, supportsPassive ? { passive: true } : false);
          addTeardown(() => window.removeEventListener('pointermove', pointerMoveHandler));
        }

        // Attach tl to ScrollTrigger if available
        if (isScrollTriggerAvailable()) {
          ScrollTrigger.create({
            trigger: hero,
            start: 'top 80%',
            once: true,
            onEnter: () => tl.play()
          });
          addTeardown(() => { try { ScrollTrigger.getAll().forEach(s => s.kill()); } catch (e) {} });
        } else {
          tl.play();
        }

        addTeardown(() => {
          try { tl && tl.kill(); } catch (e) {}
          try { localSplitTitle && localSplitTitle.revert && localSplitTitle.revert(); } catch (e) {}
          try { localSplitSub && localSplitSub.revert && localSplitSub.revert(); } catch (e) {}
        });
      } else {
        // CSS fallback
        title.classList.add('reveal-fallback');
        subtitle && subtitle.classList.add('reveal-fallback');
        ctas.forEach(b => b.classList.add('reveal-fallback'));
        stats.forEach(s => s.classList.add('reveal-fallback'));
        profileCard && profileCard.classList.add('reveal-fallback');
      }
    } catch (err) {
      console.warn('initHeroCinematic failed', err);
      title.style.opacity = '1';
      subtitle && (subtitle.style.opacity = '1');
    }
  }

  /* ---------------------------
     8) Batched reveals + image parallax
     --------------------------- */
  function initReveals() {
    const selector = '[data-reveal], .project-grid .card, .testimonial, .skill-card, .case-card';
    const nodes = $$(selector);
    if (!nodes.length) return;
    if (prefersReducedMotion) {
      nodes.forEach(n => n.classList.add('revealed'));
      return;
    }

    if (isScrollTriggerAvailable()) {
      try {
        // use ScrollTrigger.batch if present
        ScrollTrigger.batch(nodes, {
          interval: CONFIG.reveal.interval,
          batchMax: CONFIG.reveal.batchMax,
          onEnter: (batch) => {
            gsap.fromTo(batch, { y: 36, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9, ease: 'power3.out', stagger: 0.06 });
          },
          start: 'top 92%'
        });
      } catch (e) {
        // fallback to per-element scrollTrigger
        nodes.forEach(n => {
          try {
            gsap.fromTo(n, { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.7, ease: 'power3.out', scrollTrigger: { trigger: n, start: 'top 90%' }});
          } catch (err) { n.classList.add('revealed'); }
        });
      }

      // image parallax for thumbs
      $$('.card .thumb img, .case-thumb img').forEach(img => {
        try {
          gsap.to(img, {
            yPercent: -CONFIG.parallaxY,
            ease: 'none',
            scrollTrigger: {
              trigger: img.closest('.card') || img.closest('.case-card'),
              start: 'top bottom',
              end: 'bottom top',
              scrub: 0.8
            }
          });
        } catch (e) {}
      });

      return;
    }

    // IO fallback
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries, obs) => {
        entries.forEach(en => {
          if (en.isIntersecting) {
            en.target.classList.add('revealed');
            obs.unobserve(en.target);
          }
        });
      }, { threshold: 0.12 });
      nodes.forEach(n => io.observe(n));
      addTeardown(() => io.disconnect());
    } else {
      nodes.forEach(n => n.classList.add('revealed'));
    }
  }

  /* ---------------------------
     9) Card tilt / parallax / magnetic
     --------------------------- */
  function initCardInteractions() {
    if (isTouchDevice() || prefersReducedMotion) return;
    const cards = $$('.card, .case-card, .profile-card, .skill-card');
    if (!cards.length) return;

    cards.forEach(card => {
      const thumb = card.querySelector('.thumb img') || card.querySelector('.profile-image');
      // performance hints
      card.style.willChange = 'transform';
      if (thumb) thumb.style.willChange = 'transform, filter';

      // quickSetters
      let qSetX = null, qSetY = null;
      if (thumb && isGSAPAvailable() && gsap.quickSetter) {
        qSetX = gsap.quickSetter(thumb, 'x', 'px');
        qSetY = gsap.quickSetter(thumb, 'y', 'px');
      }

      const onMove = (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        const rotY = (px - 0.5) * CONFIG.cardTilt.maxY;
        const rotX = (py - 0.5) * -CONFIG.cardTilt.maxX;
        card.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(0)`;
        if (thumb) {
          const tx = (px - 0.5) * 14;
          const ty = (py - 0.5) * 10;
          if (qSetX && qSetY) { qSetX(tx); qSetY(ty); } else thumb.style.transform = `translate(${tx}px, ${ty}px) scale(1.06)`;
          thumb.style.filter = `blur(${Math.abs(px - 0.5) * 6}px) saturate(1.05)`;
        }
      };
      const onLeave = () => {
        card.style.transform = '';
        if (thumb) { thumb.style.transform = ''; thumb.style.filter = ''; }
      };

      card.addEventListener('pointermove', onMove, supportsPassive ? { passive: true } : false);
      card.addEventListener('pointerleave', onLeave, supportsPassive ? { passive: true } : false);
      card.addEventListener('pointercancel', onLeave, supportsPassive ? { passive: true } : false);

      addTeardown(() => {
        card.removeEventListener('pointermove', onMove);
        card.removeEventListener('pointerleave', onLeave);
        card.removeEventListener('pointercancel', onLeave);
      });
    });
  }

  /* ---------------------------
     10) Testimonials tilt + shine
     --------------------------- */
  function initTestimonials() {
    if (isTouchDevice() || prefersReducedMotion) return;
    $$('.testimonial').forEach(card => {
      card.style.setProperty('--shine-x', '50%');
      card.style.setProperty('--shine-y', '50%');
      card.style.transition = 'transform 320ms cubic-bezier(.2,.9,.2,1)';

      const onMove = (e) => {
        const r = card.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width/2)) / (r.width/2);
        const dy = (e.clientY - (r.top + r.height/2)) / (r.height/2);
        card.style.transform = `rotateX(${-dy*8}deg) rotateY(${dx*8}deg) scale(1.03)`;
        card.style.setProperty('--shine-x', `${(dx + 1) * 50}%`);
        card.style.setProperty('--shine-y', `${(dy + 1) * 50}%`);
      };
      const onLeave = () => { card.style.transform = ''; card.style.setProperty('--shine-x','50%'); card.style.setProperty('--shine-y','50%'); };

      card.addEventListener('mousemove', onMove);
      card.addEventListener('mouseleave', onLeave);
      addTeardown(() => { card.removeEventListener('mousemove', onMove); card.removeEventListener('mouseleave', onLeave); });
    });
  }

  /* ---------------------------
     11) Hero stats count-up
     --------------------------- */
  function animateHeroStats() {
    const statEls = $$('.hero .stat strong');
    if (!statEls.length || prefersReducedMotion) return;
    statEls.forEach(el => {
      const raw = el.textContent || '';
      const parsed = parseFloat(raw.replace(/[^\d.]/g, '')) || 0;
      const target = parsed;
      const suffix = /[^0-9]+$/.test(raw) ? raw.replace(/^[\d\s]+/, '') : '';
      // use a numeric tween that updates innerText onUpdate
      if (isGSAPAvailable()) {
        const obj = { v: 0 };
        gsap.to(obj, {
          v: target,
          duration: 1.25,
          ease: 'power1.out',
          onUpdate() { el.textContent = Math.round(obj.v) + suffix; }
        });
      } else {
        // fallback: set final value
        el.textContent = target + suffix;
      }
    });
  }

  /* ---------------------------
     12) Case study hover
     --------------------------- */
  function initCaseStudy() {
    const caseCard = $('#case-study .case-card');
    if (!caseCard) return;
    const img = caseCard.querySelector('.case-thumb img');
    if (!img) return;

    const onEnter = () => {
      if (prefersReducedMotion) return;
      if (isGSAPAvailable()) {
        gsap.to(img, { scale: 1.06, duration: 0.9, ease: 'power3.out' });
        gsap.to(caseCard, { y: -8, boxShadow: '0 30px 60px rgba(12,18,28,0.10)', duration: 0.6, ease: 'power2.out' });
        gsap.to(caseCard.querySelectorAll('.case-cta .btn'), { y: 0, autoAlpha: 1, stagger: 0.06, duration: 0.45 });
      } else {
        img.style.transform = 'scale(1.06)';
        caseCard.style.transform = 'translateY(-8px)';
      }
    };
    const onLeave = () => {
      if (prefersReducedMotion) return;
      if (isGSAPAvailable()) {
        gsap.to(img, { scale: 1, duration: 0.9, ease: 'power3.out' });
        gsap.to(caseCard, { y: 0, boxShadow: 'var(--shadow-strong)', duration: 0.6 });
        gsap.to(caseCard.querySelectorAll('.case-cta .btn'), { y: 6, autoAlpha: 0.95, duration: 0.35 });
      } else {
        img.style.transform = '';
        caseCard.style.transform = '';
      }
    };

    caseCard.addEventListener('mouseenter', onEnter, supportsPassive ? { passive: true } : false);
    caseCard.addEventListener('mouseleave', onLeave, supportsPassive ? { passive: true } : false);

    // parallax if ScrollTrigger available
    if (isScrollTriggerAvailable() && !prefersReducedMotion) {
      try {
        gsap.to(img, {
          yPercent: -CONFIG.parallaxY,
          ease: 'none',
          scrollTrigger: { trigger: caseCard, start: 'top bottom', end: 'bottom top', scrub: 0.8 }
        });
      } catch (e) { /* ignore */ }
    }

    addTeardown(() => {
      caseCard.removeEventListener('mouseenter', onEnter);
      caseCard.removeEventListener('mouseleave', onLeave);
    });
  }

  /* ---------------------------
     13) Projects grid interactions + optional Swiper
     --------------------------- */
  async function initProjects() {
    const cards = $$('.project-grid .card');
    if (!cards.length) return;

    // Reveal handled by initReveals, here we do hover/interact
    cards.forEach(card => {
      const thumb = card.querySelector('.thumb img');
      let qSetX = null, qSetY = null;
      if (thumb && isGSAPAvailable() && gsap.quickSetter) {
        qSetX = gsap.quickSetter(thumb, 'x', 'px');
        qSetY = gsap.quickSetter(thumb, 'y', 'px');
      }

      const onPointerMove = (e) => {
        if (prefersReducedMotion) return;
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        const rotY = (px - 0.5) * CONFIG.cardTilt.maxY;
        const rotX = (py - 0.5) * -CONFIG.cardTilt.maxX;
        card.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(0)`;
        if (thumb) {
          const tx = (px - 0.5) * 14;
          const ty = (py - 0.5) * 10;
          if (qSetX && qSetY) { qSetX(tx); qSetY(ty); } else thumb.style.transform = `translate(${tx}px, ${ty}px) scale(1.06)`;
        }
      };
      const onPointerLeave = () => { card.style.transform = ''; if (thumb) thumb.style.transform = ''; };

      card.addEventListener('pointermove', onPointerMove, supportsPassive ? { passive: true } : false);
      card.addEventListener('pointerleave', onPointerLeave, supportsPassive ? { passive: true } : false);
      card.addEventListener('focus', () => { if (isGSAPAvailable()) gsap.to(card, { scale: 1.02, duration: 0.25, ease: 'power2.out' }); });
      card.addEventListener('blur', () => { if (isGSAPAvailable()) gsap.to(card, { scale: 1, duration: 0.25 }); });

      addTeardown(() => {
        card.removeEventListener('pointermove', onPointerMove);
        card.removeEventListener('pointerleave', onPointerLeave);
      });

      // underline effect for h3
      const title = card.querySelector('.card-body h3');
      if (title) {
        const underline = document.createElement('span');
        underline.className = 'h3-underline';
        Object.assign(underline.style, { position: 'absolute', left: 0, bottom: '-6px', height: '2px', width: '0', background: 'var(--accent-2)', transition: 'width 360ms var(--ease-std)' });
        title.style.position = 'relative';
        title.appendChild(underline);
        const onEnter = () => underline.style.width = '100%';
        const onLeave = () => underline.style.width = '0';
        card.addEventListener('mouseenter', onEnter);
        card.addEventListener('mouseleave', onLeave);
        card.addEventListener('focus', onEnter);
        card.addEventListener('blur', onLeave);
        addTeardown(() => {
          card.removeEventListener('mouseenter', onEnter);
          card.removeEventListener('mouseleave', onLeave);
          card.removeEventListener('focus', onEnter);
          card.removeEventListener('blur', onLeave);
        });
      }
    });

    // Make keyboard accessible
    makeCardsKeyboardAccessible();

    // Optional: if user wants a carousel on small screens, we can init Swiper
    // we'll attempt to dynamically load Swiper and initialize only if it succeeds
    try {
      // only initialize swiper if the container exists and user wants it
      const container = document.querySelector('.project-grid.swiper-request');
      if (container && !container.classList.contains('swiper-initialized') && !prefersReducedMotion) {
        const SwiperLib = await loadSwiper();
        if (SwiperLib) {
          // wrap children
          if (!container.classList.contains('swiper')) {
            const slides = Array.from(container.children);
            const wrapper = document.createElement('div'); wrapper.className = 'swiper-wrapper';
            slides.forEach(s => {
              const slide = document.createElement('div');
              slide.className = 'swiper-slide';
              slide.appendChild(s);
              wrapper.appendChild(slide);
            });
            container.innerHTML = '';
            container.classList.add('swiper');
            container.appendChild(wrapper);
            const pagination = document.createElement('div'); pagination.className = 'swiper-pagination';
            const prev = document.createElement('div'); prev.className = 'swiper-button-prev';
            const next = document.createElement('div'); next.className = 'swiper-button-next';
            container.appendChild(pagination); container.appendChild(prev); container.appendChild(next);
          }

          const swiper = new SwiperLib(container, {
            loop: true, speed: 900, centeredSlides: true, slidesPerView: 1.15, spaceBetween: 24,
            autoplay: { delay: 3500, disableOnInteraction: false }, grabCursor: true,
            pagination: { el: container.querySelector('.swiper-pagination'), clickable: true },
            navigation: { nextEl: container.querySelector('.swiper-button-next'), prevEl: container.querySelector('.swiper-button-prev') },
            breakpoints: { 768: { slidesPerView: 2.1, spaceBetween: 28 }, 1200: { slidesPerView: 3.1, spaceBetween: 36 } },
            on: {
              init() { container.classList.add('swiper-initialized'); this.slides.forEach(s => s.style.willChange = 'transform'); },
              progress() {
                if (!isGSAPAvailable()) return;
                for (let i = 0; i < this.slides.length; i++) {
                  const slide = this.slides[i];
                  const prog = slide.progress;
                  const inner = slide.querySelector('.thumb') || slide;
                  if (inner) gsap.to(inner, { x: prog * -20, rotation: prog * 2, duration: 0.6, ease: 'power3.out' });
                }
              }
            }
          });
          addTeardown(() => swiper && swiper.destroy(true, true));
        }
      }
    } catch (e) { console.warn('Swiper init error', e); }
  }

  function makeCardsKeyboardAccessible() {
    $$('.project-grid .card').forEach(c => {
      if (!c.hasAttribute('tabindex')) c.setAttribute('tabindex', '0');
      const onKey = (e) => { if (e.key === 'Enter') { const a = c.closest('a') || c.querySelector('a'); if (a) a.click(); } };
      c.addEventListener('keydown', onKey);
      addTeardown(() => c.removeEventListener('keydown', onKey));
    });
  }

  /* ---------------------------
     14) Scroll Accent & Hover Glow (velocity-based)
     --------------------------- */
  function initScrollAccentAndHover() {
    if (prefersReducedMotion) return;
    let accent = document.getElementById('ha-scroll-accent');
    if (!accent) {
      accent = document.createElement('div');
      accent.id = 'ha-scroll-accent';
      accent.setAttribute('aria-hidden', 'true');
      Object.assign(accent.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: 0, mixBlendMode: 'screen', opacity: 0, transition: 'opacity 300ms linear, transform 600ms cubic-bezier(.2,.9,.2,1)' });
      document.body.appendChild(accent);
    }

    // velocity sampler
    let lastY = window.scrollY || 0;
    let smoothed = 0;
    const cfg = CONFIG.scrollAccent;

    let rafId = null;
    function loop() {
      const y = window.scrollY || 0;
      const delta = Math.abs(y - lastY);
      lastY = y;
      const target = Math.min(1, delta * cfg.velocityScale);
      smoothed += (target - smoothed) * cfg.smoothFactor;
      const blur = (smoothed * cfg.maxBlur).toFixed(2);
      const opacity = (smoothed * cfg.maxOpacity).toFixed(3);
      accent.style.backdropFilter = `blur(${blur}px)`;
      accent.style.opacity = opacity;
      if (smoothed > 0.02) document.documentElement.classList.add('ha-scrolling'); else document.documentElement.classList.remove('ha-scrolling');
      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);
    addTeardown(() => { cancelAnimationFrame(rafId); try { accent.remove(); } catch (e) {} });

    // hover glow
    const selector = 'a, button, .card, .skill-card, .testimonial, .case-card, .profile-card, .btn';
    let lastEl = null;
    const onOver = (e) => {
      const el = e.target.closest && e.target.closest(selector);
      if (!el || el === lastEl) return;
      el.classList.add('ha-hover');
      lastEl = el;
      document.documentElement.style.setProperty('--ha-hover-accent', '0.14');
    };
    const onOut = (e) => {
      const el = e.target.closest && e.target.closest(selector);
      if (!el) return;
      el.classList.remove('ha-hover');
      lastEl = null;
      document.documentElement.style.setProperty('--ha-hover-accent', '0');
    };
    document.addEventListener('pointerover', onOver, supportsPassive ? { passive: true } : false);
    document.addEventListener('pointerout', onOut, supportsPassive ? { passive: true } : false);
    addTeardown(() => { document.removeEventListener('pointerover', onOver); document.removeEventListener('pointerout', onOut); });
  }

  /* ---------------------------
     15) Contact form floating labels
     --------------------------- */
  function initContactFormLabels() {
    const forms = document.querySelectorAll('.contact-form');
    forms.forEach(form => {
      form.querySelectorAll('label').forEach(label => {
        const input = label.querySelector('input, textarea');
        const floating = label.querySelector('.floating-label');
        if (!input || !floating) return;
        const setHas = () => { if (input.value && input.value.trim() !== '') label.classList.add('has-value'); else label.classList.remove('has-value'); };
        setHas();
        const onInput = () => setHas();
        const onFocus = () => label.classList.add('focused');
        const onBlur = () => label.classList.remove('focused');
        input.addEventListener('input', onInput);
        input.addEventListener('focus', onFocus);
        input.addEventListener('blur', onBlur);
        setTimeout(setHas, 300);
        addTeardown(() => { input.removeEventListener('input', onInput); input.removeEventListener('focus', onFocus); input.removeEventListener('blur', onBlur); });
      });
    });
  }

  /* ---------------------------
     16) Scroll progress bar
     --------------------------- */
  function initScrollProgress() {
    let bar = document.getElementById('scroll-progress');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'scroll-progress';
      bar.setAttribute('aria-hidden', 'true');
      Object.assign(bar.style, { position: 'fixed', top: 0, left: 0, height: '3px', width: '0%', zIndex: 9999, background: 'linear-gradient(90deg,var(--accent),var(--accent-2))', transition: 'width 120ms linear' });
      document.documentElement.appendChild(bar);
    }
    const onScroll = () => {
      const sc = window.scrollY || document.documentElement.scrollTop;
      const h = document.documentElement.scrollHeight - window.innerHeight;
      const pct = h > 0 ? (sc / h) * 100 : 0;
      bar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
    };
    window.addEventListener('scroll', onScroll, supportsPassive ? { passive: true } : false);
    onScroll();
    addTeardown(() => window.removeEventListener('scroll', onScroll));
  }

  /* ---------------------------
     17) Footer year update
     --------------------------- */
  function updateFooterYear() { const y = document.getElementById('year'); if (y) y.textContent = new Date().getFullYear(); }

  /* ---------------------------
     18) Keyboard focus hint (accessibility)
     --------------------------- */
  function initFocusVisible() {
    const handler = (e) => { if (e.key === 'Tab') document.documentElement.classList.add('user-tabbing'); window.removeEventListener('keydown', handler); };
    window.addEventListener('keydown', handler);
    addTeardown(() => window.removeEventListener('keydown', handler));
  }

  /* ---------------------------
     19) Init + teardown orchestration
     --------------------------- */
  async function initAll() {
    if (window.__ha_initialized) { log('already initialized'); return; }
    window.__ha_initialized = true;

    // small initial things
    initLoader();
    updateFooterYear();
    initFocusVisible();

    // scroll + lenis integration (non-blocking)
    initLenis();

    // cursor & UI bits
    initCursor();
    initThemeToggle();
    initMobileMenu();
    initNav();

    // hero + reveal + interactions
    initHeroCinematic();      // hero animation
    initReveals();           // reveal batch
    initCardInteractions();  // card tilt/parallax
    initTestimonials();
    initCaseStudy();
    await initProjects();    // includes optional Swiper dynamic load
    initContactFormLabels();

    // accent & hover & progress
    initScrollAccentAndHover();
    initScrollProgress();

    // small helpers
    makeCardsKeyboardAccessible();
    // try to animate stats if gsap available
    try { animateHeroStats(); } catch (e) {}

    // refresh ScrollTrigger measurements a bit after init
    setTimeout(() => { try { window.ScrollTrigger && window.ScrollTrigger.refresh && window.ScrollTrigger.refresh(); } catch (e) {} }, 700);

    // cleanup hook for SPA
    window.addEventListener('pagehide', teardownAll, { once: true });

    log('hs.full.pretty initialized');
  }

  function teardownAll() {
    try {
      teardownFns.forEach(fn => { try { fn(); } catch (e) {} });
      teardownFns = [];
      if (window.ScrollTrigger) {
        try { ScrollTrigger.getAll().forEach(t => t.kill()); } catch (e) {}
      }
      window.__ha_initialized = false;
      log('teardown complete');
    } catch (e) { console.warn('teardown error', e); }
  }

  // expose API
  window.__ha = window.__ha || {};
  window.__ha.init = initAll;
  window.__ha.teardown = teardownAll;
  window.__ha.getLenis = () => window.__lenis || null;

  // auto init on DOMContentLoaded
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAll);
  else setTimeout(initAll, 16);

})(); // end hs.full.pretty.js
