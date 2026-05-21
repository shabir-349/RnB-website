/* ============================================================
   R&B — Research and Beyond | script.js
   ============================================================ */

(function () {
  'use strict';

  /* ============================================================
     DARK MODE TOGGLE
     Reads from localStorage, applies [data-theme] on <html>
  ============================================================ */
  const html = document.documentElement;
  const themeToggle = document.getElementById('rb-theme-toggle');

  function applyTheme(theme) {
    html.setAttribute('data-theme', theme);
    localStorage.setItem('rb-theme', theme);
  }

  // On load, restore saved preference or respect OS preference
  const savedTheme = localStorage.getItem('rb-theme');
  if (savedTheme) {
    applyTheme(savedTheme);
  } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    applyTheme('dark');
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      const current = html.getAttribute('data-theme');
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });
  }

  /* ============================================================
     STICKY NAV — add class after 80px scroll
  ============================================================ */
  const nav = document.getElementById('rb-nav');

  function handleNavScroll() {
    if (!nav) return;
    if (window.scrollY > 80) {
      nav.classList.add('rb-nav--scrolled');
    } else {
      nav.classList.remove('rb-nav--scrolled');
    }
  }

  window.addEventListener('scroll', handleNavScroll, { passive: true });
  handleNavScroll();

  /* ============================================================
     SMOOTH SCROLL — anchor links
  ============================================================ */
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      const target = document.querySelector(targetId);
      if (!target) return;

      e.preventDefault();

      // Close mobile menu if open
      closeMobileMenu();

      const navHeight = nav ? nav.getBoundingClientRect().height : 0;
      const top = target.getBoundingClientRect().top + window.scrollY - navHeight - 16;

      window.scrollTo({ top: top, behavior: 'smooth' });
    });
  });

  /* ============================================================
     MOBILE HAMBURGER MENU
  ============================================================ */
  const hamburger = document.getElementById('rb-hamburger');
  const mobileMenu = document.getElementById('rb-mobile-menu');

  function openMobileMenu() {
    if (!hamburger || !mobileMenu) return;
    hamburger.setAttribute('aria-expanded', 'true');
    mobileMenu.classList.add('rb-mobile-menu--open');
    document.body.style.overflow = 'hidden';
  }

  function closeMobileMenu() {
    if (!hamburger || !mobileMenu) return;
    hamburger.setAttribute('aria-expanded', 'false');
    mobileMenu.classList.remove('rb-mobile-menu--open');
    document.body.style.overflow = '';
  }

  if (hamburger) {
    hamburger.addEventListener('click', function () {
      const isOpen = hamburger.getAttribute('aria-expanded') === 'true';
      if (isOpen) {
        closeMobileMenu();
      } else {
        openMobileMenu();
      }
    });
  }

  // Close menu on Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeMobileMenu();
  });

  /* ============================================================
     FAQ ACCORDION
     Only one item open at a time
  ============================================================ */
  const accordionTriggers = document.querySelectorAll('.rb-accordion__trigger');

  accordionTriggers.forEach(function (trigger) {
    trigger.addEventListener('click', function () {
      const isOpen = this.getAttribute('aria-expanded') === 'true';
      const panelId = this.getAttribute('aria-controls');
      const panel = document.getElementById(panelId);

      // Close all
      accordionTriggers.forEach(function (t) {
        const pid = t.getAttribute('aria-controls');
        const p = document.getElementById(pid);
        t.setAttribute('aria-expanded', 'false');
        if (p) p.classList.remove('rb-panel--open');
      });

      // Open clicked if it was closed
      if (!isOpen && panel) {
        this.setAttribute('aria-expanded', 'true');
        panel.classList.add('rb-panel--open');
      }
    });
  });

  /* ============================================================
     INTERSECTION OBSERVER — Fade-in-up on sections
  ============================================================ */
  const fadeTargets = document.querySelectorAll(
    '.rb-section, .rb-phase-card, .rb-mode-card, .rb-agent-card, .rb-course-card, .rb-plan-card, .rb-accordion__item, .rb-stat, .rb-testimonial-card, .rb-why__text'
  );

  const fadeObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('rb-in-view');
          fadeObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
  );

  fadeTargets.forEach(function (el) {
    el.classList.add('rb-fade-up');
    fadeObserver.observe(el);
  });

  /* ============================================================
     STAT COUNTERS — Animate from 0 to target when in view
     Setup deferred via requestIdleCallback: counters are well
     below the fold and don't need to be ready on first paint.
  ============================================================ */
  function scheduleWork(fn) {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(fn, { timeout: 2000 });
    } else {
      setTimeout(fn, 1);
    }
  }

  function animateCounter(el) {
    const target = parseInt(el.getAttribute('data-target'), 10);
    const suffix = el.getAttribute('data-suffix') || '';
    const duration = 1400;
    const startTime = performance.now();

    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target) + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  scheduleWork(function () {
    const statNums = document.querySelectorAll('.rb-stat__num');
    const counterObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            counterObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );
    statNums.forEach(function (el) { counterObserver.observe(el); });
  });

  /* ============================================================
     HERO TYPING ANIMATION
     Types the search query, then reveals result cards
  ============================================================ */
  const queryEl = document.getElementById('rb-typing-query');
  const resultsEl = document.getElementById('rb-mockup-results');
  const fullQuery = 'Find me a meta-analysis topic in pediatric neurology';

  if (queryEl && resultsEl) {
    let charIndex = 0;
    let typingStarted = false;

    function typeChar() {
      if (charIndex < fullQuery.length) {
        queryEl.textContent = fullQuery.slice(0, charIndex + 1);
        charIndex++;
        // Vary typing speed slightly for realism
        const delay = 45 + Math.random() * 35;
        setTimeout(typeChar, delay);
      } else {
        // Pause then reveal result cards
        setTimeout(function () {
          resultsEl.classList.add('rb-results--visible');
        }, 500);
      }
    }

    // Start typing when hero is visible (immediate on load since it's above fold)
    function startTyping() {
      if (typingStarted) return;
      typingStarted = true;
      setTimeout(typeChar, 800);
    }

    // Use IntersectionObserver in case user starts below fold
    const heroObserver = new IntersectionObserver(
      function (entries) {
        if (entries[0].isIntersecting) {
          startTyping();
          heroObserver.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    const heroSection = document.getElementById('rb-hero');
    if (heroSection) {
      heroObserver.observe(heroSection);
    } else {
      startTyping();
    }
  }

  /* ============================================================
     PHASES SCROLL HINT — hide after user scrolls the track
  ============================================================ */
  const phaseHint = document.querySelector('.rb-phases__scroll-hint');
  const phaseTrackWrap = document.querySelector('.rb-phases__scroll-wrap');

  if (phaseHint && phaseTrackWrap) {
    phaseTrackWrap.addEventListener('scroll', function () {
      if (phaseTrackWrap.scrollLeft > 40) {
        phaseHint.style.opacity = '0';
      }
    }, { passive: true });
  }

  /* ============================================================
     LAZY-LOAD IMAGES below the fold
     (images added via loading="lazy" in HTML is safest,
      but we also add it via JS for any missed ones)
  ============================================================ */
  document.querySelectorAll('img:not([loading])').forEach(function (img) {
    img.setAttribute('loading', 'lazy');
  });

  /* ============================================================
     HERO NETWORK CANVAS
     Drifting nodes + connecting edges evoke a citation graph.
     Throttled to ~30fps. Paused when off-screen or tab hidden.
     Static (no drift) when prefers-reduced-motion is set.
  ============================================================ */
  (function initHeroNetwork() {
    const canvas = document.getElementById('rb-hero-network');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const heroSection = document.getElementById('rb-hero');
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Skip canvas on data-saver or very slow connections
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn && (conn.saveData || String(conn.effectiveType).indexOf('2g') !== -1)) {
      canvas.style.display = 'none';
      return;
    }

    // Reduce node count on narrow viewports to keep the frame budget lean
    const isMobile = window.innerWidth < 768;
    const TOTAL_NODES = isMobile ? 30 : 60;
    const HUB_COUNT   = isMobile ? 4  : 8;
    const LINK_DIST     = 140;
    const LINK_DIST_SQ  = LINK_DIST * LINK_DIST; // avoid sqrt for culled pairs
    const MAX_EDGE_OPACITY = 0.25;
    const FRAME_INTERVAL   = 1000 / 30;

    let nodes = [];
    let animId = null;
    let heroVisible = true;
    let pageVisible = !document.hidden;
    let lastFrame = 0;
    let resizeTimer = null;

    function buildNodes() {
      nodes = [];
      const w = canvas.width;
      const h = canvas.height;
      for (let i = 0; i < TOTAL_NODES; i++) {
        const isHub   = i < HUB_COUNT;
        const isAmber = Math.random() < 0.2;
        const baseR   = isHub ? 4 : (1.5 + Math.random());
        nodes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          r: baseR, baseR: baseR,
          isHub: isHub, isAmber: isAmber,
          phase: Math.random() * Math.PI * 2,
        });
      }
    }

    function setSize() {
      canvas.width  = heroSection.offsetWidth;
      canvas.height = heroSection.offsetHeight;
      buildNodes();
    }

    // Shared draw — used both by the animation loop and the one-shot static render
    function drawScene() {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Edges — compare squared distance first to skip sqrt on far pairs
      ctx.lineWidth = 0.75;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const distSq = dx * dx + dy * dy;
          if (distSq < LINK_DIST_SQ) {
            const d     = Math.sqrt(distSq);
            const alpha = (1 - d / LINK_DIST) * MAX_EDGE_OPACITY;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = 'rgba(232,236,243,' + alpha + ')';
            ctx.stroke();
          }
        }
      }

      // Nodes
      nodes.forEach(function (n) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = n.isAmber ? 'rgba(232,163,61,0.5)' : 'rgba(232,236,243,0.4)';
        ctx.fill();
      });
    }

    function frame(ts) {
      animId = requestAnimationFrame(frame);
      if (!heroVisible || !pageVisible) return;
      if (ts - lastFrame < FRAME_INTERVAL) return;
      lastFrame = ts;

      const w = canvas.width;
      const h = canvas.height;
      nodes.forEach(function (n) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x <= 0 || n.x >= w) { n.vx *= -1; n.x = Math.max(0, Math.min(w, n.x)); }
        if (n.y <= 0 || n.y >= h) { n.vy *= -1; n.y = Math.max(0, Math.min(h, n.y)); }
        if (n.isHub) {
          n.phase += 0.021;
          n.r = n.baseR + 2 * Math.abs(Math.sin(n.phase));
        }
      });

      drawScene();
    }

    // Pause when hero scrolls out of view
    new IntersectionObserver(function (entries) {
      heroVisible = entries[0].isIntersecting;
    }, { threshold: 0 }).observe(heroSection);

    // Pause when tab is hidden
    document.addEventListener('visibilitychange', function () {
      pageVisible = !document.hidden;
    });

    // Debounced ResizeObserver keeps canvas in sync with hero dimensions
    new ResizeObserver(function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        setSize();
        if (prefersReduced) drawScene();
      }, 150);
    }).observe(heroSection);

    setSize();

    if (prefersReduced) {
      // Static network — draw once, no animation loop needed
      drawScene();
    } else {
      animId = requestAnimationFrame(frame);
    }
  })();

  /* ============================================================
     MODE CARDS — 3D tilt + cursor spotlight
     Only on hover-capable, fine-pointer devices.
     Disabled when prefers-reduced-motion is set.
  ============================================================ */
  (function initModeTilt() {
    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!canHover || prefersReduced) return;

    document.querySelectorAll('.rb-mode-card').forEach(function (card) {
      card.addEventListener('mouseenter', function () {
        card.style.setProperty('--mouse-x', '50%');
        card.style.setProperty('--mouse-y', '50%');
      });

      card.addEventListener('mousemove', function (e) {
        const r = card.getBoundingClientRect();
        const x = e.clientX - r.left;
        const y = e.clientY - r.top;

        // Spotlight position as percentage
        card.style.setProperty('--mouse-x', (x / r.width * 100) + '%');
        card.style.setProperty('--mouse-y', (y / r.height * 100) + '%');

        // Tilt: map cursor offset from center → ±8 deg on each axis
        const rotY = ((x - r.width  / 2) / (r.width  / 2)) * 8;
        const rotX = -((y - r.height / 2) / (r.height / 2)) * 8;
        card.style.transform =
          'perspective(800px) rotateX(' + rotX + 'deg) rotateY(' + rotY + 'deg) translateY(-4px) scale(1.02)';
      });

      card.addEventListener('mouseleave', function () {
        card.style.transform = '';
      });
    });
  })();

})();
