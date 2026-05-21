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

  /* ============================================================
     PAYMENT PAGE — read ?plan= from URL and update content
  ============================================================ */
  (function initPaymentPlanDisplay() {
    // Only run on payment page
    if (!document.getElementById('rb-plan-name')) return;

    var PLANS = {
      scholar: {
        name: 'R&B Scholar',
        badge: 'Most popular',
        amount: '$9',
        period: '/month  ·  PKR 800/month',
        note: 'or $79/year (PKR 7,000/yr) — save 27%',
        pkr: 'PKR 800',
        usd: '$9.00 USD'
      },
      pro: {
        name: 'R&B Pro',
        badge: '',
        amount: '$25',
        period: '/month  ·  PKR 2,500/month',
        note: '',
        pkr: 'PKR 2,500',
        usd: '$25.00 USD'
      }
    };

    var param = new URLSearchParams(window.location.search).get('plan') || 'scholar';
    var plan = PLANS[param] || PLANS.scholar;

    // Update summary card
    var elName   = document.getElementById('rb-plan-name');
    var elBadge  = document.getElementById('rb-plan-badge');
    var elAmount = document.getElementById('rb-plan-amount');
    var elPeriod = document.getElementById('rb-plan-period');
    var elNote   = document.getElementById('rb-plan-note');

    if (elName)   elName.textContent  = plan.name;
    if (elAmount) elAmount.textContent = plan.amount;
    if (elPeriod) elPeriod.textContent = plan.period;
    if (elNote)   elNote.textContent   = plan.note;

    if (elBadge) {
      elBadge.textContent = plan.badge;
      elBadge.style.display = plan.badge ? '' : 'none';
    }

    // Update "Amount to send" cells inside each payment option
    document.querySelectorAll('.rb-amount-pkr').forEach(function (el) {
      el.textContent = plan.pkr;
    });
    document.querySelectorAll('.rb-amount-usd').forEach(function (el) {
      el.textContent = plan.usd;
    });

    // Update page <title>
    document.title = 'Pay for ' + plan.name + ' — R&B Research and Beyond';
  })();

  /* ============================================================
     SIGNUP FORM — Supabase auth
  ============================================================ */
  (function initSignupForm() {
    var form = document.getElementById('rb-signup-form');
    if (!form) return;

    // Redirect to dashboard if already logged in
    if (typeof rbRedirectIfLoggedIn === 'function') rbRedirectIfLoggedIn();

    function setError(id, msg) {
      var el = document.getElementById(id);
      if (el) el.textContent = msg;
    }

    function clearErrors() {
      ['signup-name-err', 'signup-email-err', 'signup-password-err', 'signup-confirm-err', 'signup-terms-err'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.textContent = '';
      });
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearErrors();

      var name     = document.getElementById('signup-name');
      var email    = document.getElementById('signup-email');
      var password = document.getElementById('signup-password');
      var confirm  = document.getElementById('signup-confirm');
      var terms    = document.getElementById('signup-terms');
      var msg      = document.getElementById('rb-signup-msg');
      var btn      = form.querySelector('[type="submit"]');
      var valid    = true;

      if (!name || !name.value.trim()) {
        setError('signup-name-err', 'Full name is required.');
        valid = false;
      }

      var emailVal = email ? email.value.trim() : '';
      if (!emailVal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
        setError('signup-email-err', 'Please enter a valid email address.');
        valid = false;
      }

      if (!password || password.value.length < 8) {
        setError('signup-password-err', 'Password must be at least 8 characters.');
        valid = false;
      }

      if (confirm && password && confirm.value !== password.value) {
        setError('signup-confirm-err', 'Passwords do not match.');
        valid = false;
      }

      if (terms && !terms.checked) {
        setError('signup-terms-err', 'You must agree to the terms to continue.');
        valid = false;
      }

      if (!valid) return;

      if (btn) { btn.disabled = true; btn.textContent = 'Creating account…'; }

      if (typeof rbSignUp !== 'function') {
        if (msg) { msg.textContent = 'Auth not configured — add your credentials to supabase.js.'; msg.className = 'rb-form__msg rb-form__msg--error'; }
        if (btn) { btn.disabled = false; btn.textContent = 'Create account'; }
        return;
      }

      var result = await rbSignUp(name.value.trim(), email.value.trim(), password.value);

      if (result.error) {
        if (msg) { msg.textContent = result.error.message; msg.className = 'rb-form__msg rb-form__msg--error'; }
        if (btn) { btn.disabled = false; btn.textContent = 'Create account'; }
        return;
      }

      // data.session is null when Supabase requires email confirmation (default)
      if (result.data && result.data.session) {
        // Email confirmation disabled — user is immediately signed in
        if (msg) { msg.textContent = 'Account created! Redirecting to payment…'; msg.className = 'rb-form__msg rb-form__msg--success'; }
        var plan = new URLSearchParams(window.location.search).get('plan') || 'scholar';
        setTimeout(function () { window.location.href = 'payment.html?plan=' + plan; }, 1200);
      } else {
        // Email confirmation required — prompt user to check inbox
        if (msg) { msg.textContent = 'Almost there! Check your inbox and confirm your email, then sign in.'; msg.className = 'rb-form__msg rb-form__msg--success'; }
        if (btn) { btn.disabled = false; btn.textContent = 'Create account'; }
      }
    });
  })();

  /* ============================================================
     SIGNIN FORM
  ============================================================ */
  (function initSigninForm() {
    var form = document.getElementById('rb-signin-form');
    if (!form) return;

    if (typeof rbRedirectIfLoggedIn === 'function') rbRedirectIfLoggedIn();

    function setError(id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
    }

    function clearErrors() {
      ['signin-email-err', 'signin-password-err'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.textContent = '';
      });
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearErrors();

      var email    = document.getElementById('signin-email');
      var password = document.getElementById('signin-password');
      var msg      = document.getElementById('rb-signin-msg');
      var btn      = form.querySelector('button[type="submit"]');
      var valid    = true;

      var emailVal = email ? email.value.trim() : '';
      if (!emailVal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
        setError('signin-email-err', 'Please enter a valid email address.');
        valid = false;
      }

      if (!password || !password.value) {
        setError('signin-password-err', 'Password is required.');
        valid = false;
      }

      if (!valid) return;

      if (btn) { btn.disabled = true; btn.textContent = 'Signing in…'; }

      if (typeof rbSignIn !== 'function') {
        if (msg) { msg.textContent = 'Auth not configured — add your credentials to supabase.js.'; msg.className = 'rb-form__msg rb-form__msg--error'; }
        if (btn) { btn.disabled = false; btn.textContent = 'Sign in'; }
        return;
      }

      var result = await rbSignIn(email.value.trim(), password.value);

      if (result.error) {
        if (msg) { msg.textContent = result.error.message; msg.className = 'rb-form__msg rb-form__msg--error'; }
        if (btn) { btn.disabled = false; btn.textContent = 'Sign in'; }
        return;
      }

      if (msg) { msg.textContent = 'Signed in! Redirecting…'; msg.className = 'rb-form__msg rb-form__msg--success'; }
      setTimeout(function () { window.location.replace('dashboard.html'); }, 800);
    });
  })();

  /* ============================================================
     PASSWORD SHOW / HIDE TOGGLE
  ============================================================ */
  document.querySelectorAll('.rb-form__pw-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var targetId = this.getAttribute('data-target');
      var input = document.getElementById(targetId);
      if (!input) return;
      var showing = input.type !== 'password';
      input.type = showing ? 'password' : 'text';
      this.classList.toggle('rb-pw--visible', !showing);
      this.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    });
  });

  /* ============================================================
     PAYMENT METHOD SELECTOR
  ============================================================ */
  (function initPaymentOptions() {
    var options = document.querySelectorAll('.rb-payment-option');
    if (!options.length) return;

    function selectOption(chosen) {
      options.forEach(function (opt) {
        opt.classList.remove('rb-payment-option--selected');
        opt.setAttribute('aria-checked', 'false');
      });
      chosen.classList.add('rb-payment-option--selected');
      chosen.setAttribute('aria-checked', 'true');
    }

    options.forEach(function (option) {
      option.addEventListener('click', function () { selectOption(this); });
      option.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectOption(this); }
      });
    });
  })();

  /* ============================================================
     COPY TO CLIPBOARD — payment page account numbers
  ============================================================ */
  (function initCopyables() {
    var copyables = document.querySelectorAll('.rb-copyable');
    if (!copyables.length) return;

    var toast = document.createElement('div');
    toast.className = 'rb-copy-toast';
    toast.textContent = 'Copied to clipboard!';
    document.body.appendChild(toast);

    var toastTimer;

    function showToast() {
      clearTimeout(toastTimer);
      toast.classList.add('rb-copy-toast--show');
      toastTimer = setTimeout(function () { toast.classList.remove('rb-copy-toast--show'); }, 2000);
    }

    copyables.forEach(function (el) {
      el.addEventListener('click', function () {
        var text = this.getAttribute('data-copy') || this.textContent.trim();
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text).then(showToast);
        } else {
          var ta = document.createElement('textarea');
          ta.value = text;
          ta.setAttribute('readonly', '');
          ta.style.cssText = 'position:fixed;top:-9999px;opacity:0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          showToast();
        }
      });
    });
  })();

  /* ============================================================
     DASHBOARD SIDEBAR TOGGLE (mobile)
  ============================================================ */
  (function initDashSidebar() {
    var toggle  = document.getElementById('rb-dash-sidebar-toggle');
    var sidebar = document.getElementById('rb-dash-sidebar');
    if (!toggle || !sidebar) return;

    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = sidebar.classList.toggle('rb-dash__sidebar--open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });

    document.addEventListener('click', function (e) {
      if (!sidebar.contains(e.target) && !toggle.contains(e.target)) {
        sidebar.classList.remove('rb-dash__sidebar--open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  })();

  /* ============================================================
     DASHBOARD AUTH GUARD + USER DISPLAY
  ============================================================ */
  (function initDashboard() {
    if (!document.getElementById('rb-dash')) return;
    if (typeof rbRequireAuth !== 'function') return;

    rbRequireAuth().then(function (session) {
      if (!session) return;

      var name = (session.user.user_metadata && session.user.user_metadata.full_name)
        ? session.user.user_metadata.full_name
        : session.user.email;

      var usernameEl = document.querySelector('.rb-dash-nav__username');
      if (usernameEl) usernameEl.textContent = name;

      var avatarEl = document.querySelector('.rb-dash-nav__avatar');
      if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase();

      var welcomeEl = document.querySelector('.rb-dash__welcome-heading');
      if (welcomeEl) {
        var firstName = name.split(' ')[0];
        welcomeEl.textContent = 'Welcome back, ' + firstName + '.';
      }
    });
  })();

  /* ============================================================
     LOGOUT HANDLER
  ============================================================ */
  (function initLogout() {
    var btn = document.getElementById('rb-signout-btn');
    if (!btn) return;

    btn.addEventListener('click', async function (e) {
      e.preventDefault();
      if (typeof rbSignOut === 'function') await rbSignOut();
      window.location.replace('signin.html');
    });
  })();

})();
