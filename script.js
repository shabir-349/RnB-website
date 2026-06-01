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
     ANCHOR SCROLL — nav sections
     Targets the five main sections explicitly. Delays position
     measurement by 400ms so fonts and dynamic content finish
     rendering before we read getBoundingClientRect(), preventing
     the wrong-position-on-first-click bug on mobile.
  ============================================================ */
  var NAV_ANCHOR_SELECTOR = [
    'a[href="#pricing"]',
    'a[href="#faq"]',
    'a[href="#how-it-works"]',
    'a[href="#modes"]',
    'a[href="#academy"]'
  ].join(', ');

  document.querySelectorAll(NAV_ANCHOR_SELECTOR).forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      var targetId = this.getAttribute('href');
      var target = document.querySelector(targetId);
      if (!target) return;

      e.preventDefault();

      var menuOpen = document.getElementById('rb-mobile-menu');
      if (menuOpen && menuOpen.classList.contains('rb-mobile-menu--open')) {
        closeMobileMenu();
      }

      // 400ms lets fonts finish loading and layout settle before we
      // measure the target's position — fixes first-click miss on mobile.
      setTimeout(function () {
        var top = target.getBoundingClientRect().top + window.pageYOffset - 100;
        window.scrollTo({ top: top, behavior: 'smooth' });
      }, 400);
    });
  });

  /* General fallback for any other in-page anchor links */
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    if (anchor.matches(NAV_ANCHOR_SELECTOR)) return; // already handled above
    anchor.addEventListener('click', function (e) {
      var targetId = this.getAttribute('href');
      if (targetId === '#') return;
      var target = document.querySelector(targetId);
      if (!target) return;
      e.preventDefault();
      var top = target.getBoundingClientRect().top + window.pageYOffset - 100;
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
     PLAN BUTTONS — save selection + redirect through auth
     Intercepts clicks on pricing links that go to payment.html.
     Stores plan in localStorage so it survives the auth redirect.
  ============================================================ */
  (function initPlanButtons() {
    document.querySelectorAll('a[href^="payment.html?plan="]').forEach(function (link) {
      link.addEventListener('click', async function (e) {
        e.preventDefault();
        var href = link.getAttribute('href');
        var plan = new URLSearchParams(href.split('?')[1]).get('plan');
        if (!plan) return;
        localStorage.setItem('rb-pending-plan', plan);

        if (typeof rbGetSession === 'function') {
          var session = await rbGetSession();
          if (session) {
            window.location.href = 'payment.html?plan=' + plan;
            return;
          }
        }
        window.location.href = 'signin.html';
      });
    });
  })();

  /* ============================================================
     SIGNUP FORM — Supabase auth
  ============================================================ */
  (function initSignupForm() {
    var form = document.getElementById('rb-signup-form');
    if (!form) return;

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
        if (msg) { msg.textContent = 'Account created! Redirecting…'; msg.className = 'rb-form__msg rb-form__msg--success'; }
        var pendingPlan = localStorage.getItem('rb-pending-plan');
        if (pendingPlan) {
          localStorage.removeItem('rb-pending-plan');
          setTimeout(function () { window.location.replace('payment.html?plan=' + pendingPlan); }, 1200);
        } else {
          rbSupabase.from('payments').select('status').eq('user_id', result.data.session.user.id).order('created_at', { ascending: false }).limit(1).then(function (pr) {
            var status = pr.data && pr.data.length ? pr.data[0].status : null;
            var dest = status ? 'dashboard.html' : 'index.html';
            setTimeout(function () { window.location.replace(dest); }, 1200);
          });
        }
      } else {
        // Email confirmation required — plan stays in localStorage until they sign in
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
      var pendingPlan = localStorage.getItem('rb-pending-plan');
      if (pendingPlan) {
        localStorage.removeItem('rb-pending-plan');
        setTimeout(function () { window.location.replace('payment.html?plan=' + pendingPlan); }, 800);
      } else {
        rbGetSession().then(function (sess) {
          if (!sess) { setTimeout(function () { window.location.replace('index.html'); }, 800); return; }
          rbSupabase.from('payments').select('status').eq('user_id', sess.user.id).order('created_at', { ascending: false }).limit(1).then(function (pr) {
            var status = pr.data && pr.data.length ? pr.data[0].status : null;
            var dest = status ? 'dashboard.html' : 'index.html';
            setTimeout(function () { window.location.replace(dest); }, 800);
          });
        });
      }
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
     PAYMENT SUBMIT — auth guard, image preview, upload to Supabase
  ============================================================ */
  (function initPaymentSubmit() {
    var form = document.getElementById('rb-payment-form');
    if (!form) return;

    // Auth guard + plan-aware payment status check
    if (typeof rbGetSession === 'function') {
      rbGetSession().then(function (session) {
        if (!session) {
          var plan = new URLSearchParams(window.location.search).get('plan');
          if (plan) localStorage.setItem('rb-pending-plan', plan);
          window.location.replace('signin.html');
          return;
        }

        var urlPlan = new URLSearchParams(window.location.search).get('plan') || 'scholar';

        // Check if user already has an approved payment
        rbSupabase.from('payments')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(1)
          .then(function (approvedResult) {
            var approvedPayment = approvedResult.data && approvedResult.data.length ? approvedResult.data[0] : null;

            if (approvedPayment && approvedPayment.plan === urlPlan) {
              // Already on this plan — no need to pay again
              window.location.replace('dashboard.html');
              return;
            }

            // No approved payment for this plan (new user or upgrading) — check for any pending
            rbSupabase.from('payments')
              .select('id')
              .eq('user_id', session.user.id)
              .eq('status', 'pending')
              .limit(1)
              .then(function (pendingResult) {
                if (pendingResult.data && pendingResult.data.length) {
                  // Pending payment exists — lock them to the dashboard review screen
                  window.location.replace('dashboard.html');
                  return;
                }
                // No pending payment → show form normally (new user or upgrading)
              });
          });
      });
    }

    var fileInput  = document.getElementById('rb-proof-file');
    var uploadZone = document.getElementById('rb-upload-zone');
    var previewEl  = document.getElementById('rb-upload-preview');
    var previewImg = document.getElementById('rb-upload-preview-img');
    var removeBtn  = document.getElementById('rb-upload-remove');
    var selectedFile = null;

    function showPreview(file) {
      var url = URL.createObjectURL(file);
      if (previewImg) previewImg.src = url;
      if (uploadZone) uploadZone.classList.add('rb-upload-zone--has-file');
    }

    function clearPreview() {
      selectedFile = null;
      if (previewImg) previewImg.src = '';
      if (fileInput) fileInput.value = '';
      if (uploadZone) uploadZone.classList.remove('rb-upload-zone--has-file');
    }

    if (removeBtn) {
      removeBtn.addEventListener('click', function (e) {
        e.stopPropagation(); // prevent zone click from opening file picker
        clearPreview();
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', function () {
        selectedFile = fileInput.files[0] || null;
        if (selectedFile) showPreview(selectedFile);
      });
    }

    if (uploadZone && fileInput) {
      // Forward clicks on the zone (icon, text, preview) to the file input
      uploadZone.addEventListener('click', function (e) {
        if (e.target !== fileInput) fileInput.click();
      });
      uploadZone.addEventListener('dragover', function (e) {
        e.preventDefault();
        uploadZone.classList.add('rb-upload-zone--dragover');
      });
      uploadZone.addEventListener('dragleave', function () {
        uploadZone.classList.remove('rb-upload-zone--dragover');
      });
      uploadZone.addEventListener('drop', function (e) {
        e.preventDefault();
        uploadZone.classList.remove('rb-upload-zone--dragover');
        var file = e.dataTransfer && e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
          selectedFile = file;
          showPreview(file);
        }
      });
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      var proofErr = document.getElementById('rb-proof-err');
      var msg      = document.getElementById('rb-payment-msg');
      var btn      = document.getElementById('rb-payment-submit');

      if (proofErr) proofErr.textContent = '';
      if (msg) { msg.textContent = ''; msg.className = 'rb-form__msg'; }

      // Re-check auth at submit time
      if (typeof rbGetSession !== 'function') {
        if (msg) { msg.textContent = 'Auth not configured.'; msg.className = 'rb-form__msg rb-form__msg--error'; }
        return;
      }
      var session = await rbGetSession();
      if (!session) { window.location.replace('signin.html'); return; }

      // File check
      if (!selectedFile) {
        if (proofErr) proofErr.textContent = 'Please select your payment screenshot.';
        return;
      }

      // Plan + payment method
      var plan = new URLSearchParams(window.location.search).get('plan') || 'scholar';
      var selectedOpt = document.querySelector('.rb-payment-option--selected');
      var methodMap = { 'opt-easypaisa': 'easypaisa', 'opt-jazzcash': 'jazzcash', 'opt-bank': 'bank' };
      var method = selectedOpt ? (methodMap[selectedOpt.id] || selectedOpt.id) : 'unknown';

      if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }

      // Upload screenshot to Supabase Storage
      var safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      var storagePath = session.user.id + '/' + Date.now() + '_' + safeName;
      var uploadResult = await rbSupabase.storage.from('payment-proofs').upload(storagePath, selectedFile);

      if (uploadResult.error) {
        if (msg) { msg.textContent = uploadResult.error.message; msg.className = 'rb-form__msg rb-form__msg--error'; }
        if (btn) { btn.disabled = false; btn.textContent = 'Submit Payment Proof'; }
        return;
      }

      // Get public URL
      var urlData = rbSupabase.storage.from('payment-proofs').getPublicUrl(storagePath);
      var screenshotUrl = urlData.data ? urlData.data.publicUrl : '';

      // Insert payment record
      var insertResult = await rbSupabase.from('payments').insert({
        user_id: session.user.id,
        email: session.user.email,
        plan: plan,
        payment_method: method,
        screenshot_url: screenshotUrl,
        status: 'pending',
      });

      if (insertResult.error) {
        if (msg) { msg.textContent = insertResult.error.message; msg.className = 'rb-form__msg rb-form__msg--error'; }
        if (btn) { btn.disabled = false; btn.textContent = 'Submit Payment Proof'; }
        return;
      }

      // Notify admin of new payment — fire and forget
      fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_email: session.user.email,
          plan:     plan,
          method:   method,
          type:     'new_payment'
        })
      }).catch(function (err) { console.error('admin notify error:', err); });

      // Success — hide form, show confirmation card
      var proofSection = document.getElementById('rb-proof-section');
      var confirmCard  = document.getElementById('rb-payment-confirm');
      if (proofSection) proofSection.hidden = true;
      if (confirmCard)  confirmCard.hidden = false;
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

  var rbDashboardPlan = 'free';
  var _rbCallLoadQuota = null;

  /* ============================================================
     DASHBOARD AUTH GUARD + USER DISPLAY + PLAN STATE
  ============================================================ */
  (function initDashboard() {
    if (!document.getElementById('rb-dash')) return;
    if (typeof rbRequireAuth !== 'function') return;

    /* ── Loading overlay ─────────────────────────────────────── */
    var _dashOverlay = document.getElementById('rb-dash-page-loading');
    var _dashEl      = document.getElementById('rb-dash');

    function _revealDash() {
      if (_dashOverlay) _dashOverlay.classList.add('rb-dash-loading-overlay--hidden');
      if (_dashEl) _dashEl.removeAttribute('hidden');
    }

    /* ── Lecture video modal ─────────────────────────────────── */
    var _modal = document.createElement('div');
    _modal.id = 'rb-video-modal';
    _modal.className = 'rb-video-modal';
    _modal.setAttribute('role', 'dialog');
    _modal.setAttribute('aria-modal', 'true');
    _modal.setAttribute('aria-label', 'Lecture video');
    _modal.innerHTML =
      '<div class="rb-video-modal__backdrop"></div>'
      + '<div class="rb-video-modal__box">'
      +   '<div class="rb-video-modal__bar">'
      +     '<button type="button" class="rb-video-modal__fullscreen" aria-label="Enter fullscreen">'
      +       '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>'
      +     '</button>'
      +     '<button type="button" class="rb-video-modal__close" aria-label="Close video">'
      +       '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
      +     '</button>'
      +   '</div>'
      +   '<div class="rb-video-modal__player" id="rb-video-modal-player"></div>'
      + '</div>';
    document.body.appendChild(_modal);
    var _player = _modal.querySelector('#rb-video-modal-player');
    var _fsBtn  = _modal.querySelector('.rb-video-modal__fullscreen');

    function _enterFullscreen() {
      var req = _player.requestFullscreen || _player.webkitRequestFullscreen;
      if (!req) return;
      req.call(_player).then(function () {
        if (screen.orientation && typeof screen.orientation.lock === 'function') {
          screen.orientation.lock('landscape').catch(function () {});
        }
      }).catch(function () {});
    }

    function _onFullscreenChange() {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (screen.orientation && typeof screen.orientation.unlock === 'function') {
          screen.orientation.unlock();
        }
      }
    }

    document.addEventListener('fullscreenchange', _onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', _onFullscreenChange);

    if (_fsBtn) {
      _fsBtn.addEventListener('click', function () {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
          var exit = document.exitFullscreen || document.webkitExitFullscreen;
          if (exit) exit.call(document);
        } else {
          _enterFullscreen();
        }
      });
    }

    function _toDriveEmbed(url) {
      if (!url) return null;
      // Already a /preview embed URL — use as-is
      if (/drive\.google\.com\/file\/d\/.+\/preview/.test(url)) return url;
      // Standard share/view URL — extract file ID
      var m = url.match(/drive\.google\.com\/file\/d\/([^/?&\s]+)/);
      return m ? 'https://drive.google.com/file/d/' + m[1] + '/preview' : null;
    }

    function openLectureModal(videoUrl) {
      _player.innerHTML = '';
      if (!videoUrl) {
        var msg = document.createElement('p');
        msg.className = 'rb-video-modal__no-video';
        msg.textContent = 'No video available for this lecture yet.';
        _player.appendChild(msg);
      } else {
        var driveUrl = _toDriveEmbed(videoUrl);
        if (driveUrl) {
          var iframe = document.createElement('iframe');
          iframe.src = driveUrl;
          iframe.setAttribute('allow', 'autoplay; fullscreen');
          iframe.setAttribute('allowfullscreen', '');
          _player.appendChild(iframe);
        } else {
          // Fallback for direct video file URLs
          var video = document.createElement('video');
          video.src = videoUrl;
          video.controls = true;
          video.autoplay = true;
          video.setAttribute('playsinline', '');
          video.setAttribute('webkit-playsinline', '');
          _player.appendChild(video);
        }
      }
      _modal.classList.add('rb-video-modal--open');
      document.body.style.overflow = 'hidden';
    }

    function closeLectureModal() {
      _modal.classList.remove('rb-video-modal--open');
      _player.innerHTML = '';
      document.body.style.overflow = '';
    }

    _modal.querySelector('.rb-video-modal__close').addEventListener('click', closeLectureModal);
    _modal.querySelector('.rb-video-modal__backdrop').addEventListener('click', closeLectureModal);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && _modal.classList.contains('rb-video-modal--open')) closeLectureModal();
    });

    /* ── "Watch on desktop" popup (mobile-only) ─────────────── */
    var _wpopup = document.createElement('div');
    _wpopup.id = 'rb-watch-popup';
    _wpopup.className = 'rb-watch-popup';
    _wpopup.setAttribute('role', 'dialog');
    _wpopup.setAttribute('aria-modal', 'true');
    _wpopup.setAttribute('aria-label', 'Viewing recommendation');
    _wpopup.innerHTML =
      '<div class="rb-watch-popup__backdrop"></div>'
      + '<div class="rb-watch-popup__card">'
      +   '<div class="rb-watch-popup__icon" aria-hidden="true">'
      +     '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>'
      +   '</div>'
      +   '<p class="rb-watch-popup__msg">For the best viewing experience, we recommend watching lectures on a desktop or laptop.</p>'
      +   '<div class="rb-watch-popup__actions">'
      +     '<button type="button" class="rb-btn rb-btn--amber rb-watch-popup__continue">Continue Anyway</button>'
      +     '<button type="button" class="rb-btn rb-btn--outline rb-watch-popup__dismiss">Got it</button>'
      +   '</div>'
      + '</div>';
    document.body.appendChild(_wpopup);

    var _wpopupVideoUrl = null;

    function openWatchPopup(videoUrl) {
      _wpopupVideoUrl = videoUrl;
      _wpopup.classList.add('rb-watch-popup--open');
      document.body.style.overflow = 'hidden';
    }

    function closeWatchPopup() {
      _wpopup.classList.remove('rb-watch-popup--open');
      _wpopupVideoUrl = null;
      document.body.style.overflow = '';
    }

    _wpopup.querySelector('.rb-watch-popup__continue').addEventListener('click', function () {
      var url = _wpopupVideoUrl;
      closeWatchPopup();
      openLectureModal(url);
    });
    _wpopup.querySelector('.rb-watch-popup__dismiss').addEventListener('click', closeWatchPopup);
    _wpopup.querySelector('.rb-watch-popup__backdrop').addEventListener('click', closeWatchPopup);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && _wpopup.classList.contains('rb-watch-popup--open')) closeWatchPopup();
    });

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

      // Query the payments table for this user's latest payment record
      rbSupabase.from('payments')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .then(function (result) {
          var payment = result.data && result.data.length ? result.data[0] : null;
          applyPlanState(payment ? payment.status : null, payment ? payment.plan : null);
          rbDashboardPlan = getUserLectureLevel(payment);
          loadLectures(rbDashboardPlan);
          if (typeof _rbCallLoadQuota === 'function') _rbCallLoadQuota();

          if (payment && payment.status === 'pending') {
            rbSupabase
              .channel('rb-payment-watch-' + session.user.id)
              .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'payments',
                filter: 'user_id=eq.' + session.user.id
              }, function (payload) {
                var newStatus = payload.new && payload.new.status;
                if (newStatus === 'approved' || newStatus === 'rejected') {
                  window.location.reload();
                }
              })
              .subscribe();
          }
        });
    });

    function getUserLectureLevel(payment) {
      if (!payment || payment.status !== 'approved') return 'free';
      return payment.plan === 'pro' ? 'pro' : 'scholar';
    }

    function rbEscHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    var DASH_PLAY_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
    var DASH_LOCK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';

    function loadLectures(userLevel) {
      var container = document.getElementById('rb-dash-lectures-container');
      var loadingEl = document.getElementById('rb-dash-lectures-loading');
      if (!container) return;

      container.addEventListener('click', function (e) {
        var btn = e.target.closest('.rb-lecture-start');
        if (!btn) return;
        e.preventDefault();
        var videoUrl = btn.dataset.videoUrl;
        if (window.innerWidth < 768) {
          openWatchPopup(videoUrl);
        } else {
          openLectureModal(videoUrl);
        }
      });

      var canAccess = {
        free:    true,
        scholar: userLevel === 'scholar' || userLevel === 'pro',
        pro:     userLevel === 'pro'
      };

      rbSupabase
        .from('lectures')
        .select('id, title, category, duration, access_level, order_number, video_url')
        .order('order_number', { ascending: true })
        .order('created_at', { ascending: true })
        .then(function (result) {
          if (loadingEl) loadingEl.remove();

          if (result.error) {
            container.innerHTML = '<p class="rb-dash-lectures-error">Could not load lectures. Please refresh the page.</p>';
            _revealDash();
            return;
          }

          var lectures = result.data || [];

          if (!lectures.length) {
            container.innerHTML = '<p class="rb-dash-lectures-empty">No lectures available yet — check back soon.</p>';
            _revealDash();
            return;
          }

          var totalCount    = lectures.length;
          var unlockedCount = lectures.filter(function (l) { return canAccess[l.access_level]; }).length;
          var freeCount     = lectures.filter(function (l) { return l.access_level === 'free'; }).length;

          // Update "Lessons Unlocked" stat with real counts
          document.querySelectorAll('.rb-dash-stat').forEach(function (stat) {
            var label = stat.querySelector('.rb-dash-stat__label');
            if (label && label.textContent.trim() === 'Lessons Unlocked') {
              var numEl = stat.querySelector('.rb-dash-stat__num');
              if (numEl) numEl.textContent = unlockedCount + '/' + totalCount;
            }
          });

          // Update Academy section CTA and subtitle
          var sectionCta = document.querySelector('#rb-dash-academy .rb-dash-section__cta');
          if (sectionCta) {
            if (userLevel === 'free') {
              sectionCta.textContent = 'Unlock all ' + totalCount + ' lessons →';
            } else {
              sectionCta.style.display = 'none';
            }
          }
          var sectionSub = document.querySelector('#rb-dash-academy .rb-dash-section__sub');
          if (sectionSub) {
            sectionSub.textContent = userLevel === 'free'
              ? freeCount + ' lesson' + (freeCount === 1 ? '' : 's') + ' free on the Free plan. Upgrade to Scholar for the full library.'
              : 'All ' + totalCount + ' lessons unlocked.';
          }

          // Render lecture cards
          container.innerHTML = lectures.map(function (lec, i) {
            var thumbIdx = (i % 8) + 1;
            var meta     = [lec.category, lec.duration].filter(Boolean).join(' · ');
            var metaHtml = meta ? '<p class="rb-dash-course__meta">' + rbEscHtml(meta) + '</p>' : '';

            if (canAccess[lec.access_level]) {
              var isFreeLec  = lec.access_level === 'free';
              var badgeCls   = 'rb-dash-course__free-badge';
              var badgeLabel = isFreeLec ? 'Free' : 'Unlocked';
              return '<article class="rb-dash-course rb-dash-course--free">'
                + '<div class="rb-dash-course__thumb rb-course-thumb--' + thumbIdx + '" aria-hidden="true">' + DASH_PLAY_SVG + '</div>'
                + '<div class="rb-dash-course__body">'
                +   '<span class="' + badgeCls + '">' + badgeLabel + '</span>'
                +   '<h3 class="rb-dash-course__title">' + rbEscHtml(lec.title) + '</h3>'
                +   metaHtml
                +   '<div class="rb-dash-course__progress" aria-label="0% complete"><div class="rb-dash-course__progress-bar"></div></div>'
                + '</div>'
                + '<button type="button" class="rb-btn rb-btn--outline rb-dash-course__btn rb-lecture-start" data-video-url="' + rbEscHtml(lec.video_url || '') + '">Start</button>'
                + '</article>';
            }

            var isPro      = lec.access_level === 'pro';
            var reqLabel   = isPro ? 'Pro' : 'Scholar';
            var badgeCls   = isPro ? 'rb-dash-course__pro-badge' : 'rb-dash-course__scholar-badge';
            var upgradeUrl = isPro ? 'payment.html?plan=pro' : 'payment.html';
            return '<article class="rb-dash-course rb-dash-course--locked" aria-label="' + rbEscHtml(lec.title) + ' — locked">'
              + '<div class="rb-dash-course__thumb rb-course-thumb--' + thumbIdx + '" aria-hidden="true">'
              +   DASH_PLAY_SVG
              +   '<div class="rb-dash-course__lock-overlay" aria-hidden="true">' + DASH_LOCK_SVG + '</div>'
              + '</div>'
              + '<div class="rb-dash-course__body">'
              +   '<span class="' + badgeCls + '">' + reqLabel + '</span>'
              +   '<h3 class="rb-dash-course__title">' + rbEscHtml(lec.title) + '</h3>'
              +   metaHtml
              + '</div>'
              + '<a href="' + upgradeUrl + '" class="rb-btn rb-btn--amber rb-dash-course__btn">Unlock</a>'
              + '</article>';
          }).join('');
          _revealDash();
        });
    }

    function applyPlanState(status, plan) {
      var dash         = document.getElementById('rb-dash');
      var pendingCard  = document.getElementById('rb-dash-pending');
      var rejectedCard = document.getElementById('rb-dash-rejected');
      var freeCard     = document.getElementById('rb-dash-free');
      var upgradeBtn   = document.querySelector('#rb-dash-sidebar-footer .rb-btn--amber');
      var planLabel    = document.querySelector('.rb-dash__plan-label');
      var welcomeSub   = document.querySelector('.rb-dash__welcome-sub');

      // Add CSS state class so existing stylesheet rules still fire
      if (dash && status) dash.classList.add('rb-dash--' + status);

      if (!status) {
        // No payment record — free plan
        if (freeCard) freeCard.style.display = 'block';

      } else if (status === 'pending') {
        // CSS (.rb-dash--pending) handles the full lockout — only the status card is shown.
        // No sidebar, no welcome, no stats — just the pending message and sign-out in the nav.

      } else if (status === 'rejected') {
        // CSS (.rb-dash--rejected) handles the full lockout — only the rejection card is shown.

      } else if (status === 'approved') {
        var isScholar = (plan !== 'pro');
        var planDisplayName = isScholar ? 'Scholar Plan' : 'Pro Plan';

        if (planLabel) planLabel.innerHTML = 'You\'re on the <strong>' + planDisplayName + '</strong>';

        if (welcomeSub) {
          welcomeSub.textContent = isScholar
            ? 'You\'re on the Scholar Plan. All Academy content and research modes are unlocked.'
            : 'You\'re on the Pro Plan. Everything is unlocked including 1:1 mentorship.';
        }

        // Plan badge next to welcome heading
        var welcomeHeadingEl = document.querySelector('.rb-dash__welcome-heading');
        if (welcomeHeadingEl) {
          var planBadge = document.createElement('span');
          planBadge.className = 'rb-plan-badge rb-plan-badge--' + (isScholar ? 'scholar' : 'pro');
          planBadge.textContent = planDisplayName;
          welcomeHeadingEl.appendChild(planBadge);
        }

        // Scholar: show sidebar with "Upgrade to Pro" CTA + upsell card
        // Pro: sidebar footer stays hidden via .rb-dash--approved CSS rule
        var sidebarFooter = document.getElementById('rb-dash-sidebar-footer');
        if (isScholar) {
          if (sidebarFooter) sidebarFooter.style.display = 'flex';
          if (upgradeBtn) {
            upgradeBtn.textContent = 'Upgrade to Pro';
            upgradeBtn.href = 'payment.html?plan=pro';
          }
          var proUpsellCard = document.getElementById('rb-dash-pro-upsell');
          if (proUpsellCard) proUpsellCard.removeAttribute('hidden');
        }

        // Unlock sidebar nav — remove locked class and lock icon spans
        document.querySelectorAll('.rb-dash__nav-link--locked').forEach(function (link) {
          link.classList.remove('rb-dash__nav-link--locked');
          link.removeAttribute('aria-label');
          var lock = link.querySelector('.rb-dash__nav-lock');
          if (lock) lock.remove();
        });

        // Unlock locked courses
        document.querySelectorAll('.rb-dash-course--locked').forEach(function (course) {
          course.classList.remove('rb-dash-course--locked');
          var overlay = course.querySelector('.rb-dash-course__lock-overlay');
          if (overlay) overlay.remove();
          var badge = course.querySelector('.rb-dash-course__scholar-badge');
          if (badge) { badge.className = 'rb-dash-course__free-badge'; badge.textContent = 'Unlocked'; }
          var btn = course.querySelector('.rb-btn');
          if (btn) { btn.textContent = 'Start'; btn.href = '#'; btn.className = 'rb-btn rb-btn--outline rb-dash-course__btn'; }
        });

        // Unlock research modes
        document.querySelectorAll('.rb-dash-mode__lock').forEach(function (lock) { lock.remove(); });

        // Unlock quick actions
        document.querySelectorAll('.rb-dash-action--locked').forEach(function (action) {
          action.classList.remove('rb-dash-action--locked');
          var lock = action.querySelector('.rb-dash-action__lock');
          if (lock) lock.remove();
          action.href = '#';
        });

        // Update stats
        document.querySelectorAll('.rb-dash-stat').forEach(function (stat) {
          var label = stat.querySelector('.rb-dash-stat__label');
          if (!label) return;
          var text = label.textContent.trim();
          if (text === 'Lessons Unlocked') {
            var numEl = stat.querySelector('.rb-dash-stat__num');
            if (numEl) numEl.textContent = '97/97';
          }
          if (text === 'Match Score') {
            stat.classList.remove('rb-dash-stat--locked');
            var lockLabel = stat.querySelector('.rb-dash-stat__lock-label');
            if (lockLabel) lockLabel.remove();
          }
        });

        // Update section subtitles
        var academySub = document.querySelector('#rb-dash-academy .rb-dash-section__sub');
        if (academySub) academySub.textContent = 'All 97 lessons unlocked.';
        var modesSub = document.querySelector('.rb-dash-section:last-of-type .rb-dash-section__sub');
        if (modesSub) modesSub.textContent = 'All 6 research modes unlocked.';
      }
    }
  })();

  /* ============================================================
     PRICING BUTTONS — update based on current plan when logged in
     Runs only on pages with a #pricing section (index.html)
  ============================================================ */
  (function initPricingButtons() {
    if (!document.getElementById('pricing')) return;
    if (typeof rbGetSession !== 'function') return;

    rbGetSession().then(function (session) {
      if (!session) return;

      rbSupabase.from('payments')
        .select('status, plan')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(function (result) {
          var payment = result.data;
          var status = payment ? payment.status : null;
          var plan   = payment ? payment.plan   : null;
          if (!status) return;

          var scholarBtn = document.querySelector('a[href="payment.html?plan=scholar"]');
          var proBtn     = document.querySelector('a[href="payment.html?plan=pro"]');

          function makeCurrentPlan(btn, label) {
            if (!btn) return;
            btn.textContent = label;
            btn.className = btn.className.replace('rb-btn--amber', 'rb-btn--outline');
            btn.classList.add('rb-btn--current-plan');
            btn.removeAttribute('href');
          }

          if (status === 'pending') {
            if (plan === 'scholar' && scholarBtn) makeCurrentPlan(scholarBtn, 'Under Review…');
            if (plan === 'pro'     && proBtn)     makeCurrentPlan(proBtn,     'Under Review…');

          } else if (status === 'approved') {
            if (plan === 'scholar') {
              makeCurrentPlan(scholarBtn, 'Current Plan ✓');
              if (proBtn) {
                proBtn.textContent = 'Upgrade to Pro →';
                proBtn.className = proBtn.className.replace('rb-btn--outline', 'rb-btn--amber');
                proBtn.href = 'payment.html?plan=pro';
              }
            } else if (plan === 'pro') {
              makeCurrentPlan(proBtn,     'Current Plan ✓');
              makeCurrentPlan(scholarBtn, 'Included in Pro ✓');
            }
          }
        });
    });
  })();

  /* ============================================================
     LANDING PAGE CTA — dynamic button state based on auth + plan
  ============================================================ */
  (function initLandingCtaState() {
    var heroBtn     = document.getElementById('rb-hero-cta');
    var ctaBtn      = document.getElementById('rb-cta-strip-btn');
    var ctaSub      = document.getElementById('rb-cta-strip-sub');
    var freePlanBtn = document.getElementById('rb-free-plan-btn');
    if (!heroBtn && !ctaBtn && !freePlanBtn) return;
    if (typeof rbGetSession !== 'function') return;

    rbGetSession().then(function (session) {
      if (!session) return; // logged out — defaults are correct

      // Check payment status — pending/rejected users must go to dashboard
      rbSupabase.from('payments')
        .select('status')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .then(function (result) {
          var status = result.data && result.data.length ? result.data[0].status : null;

          if (status === 'pending' || status === 'rejected') {
            window.location.replace('dashboard.html');
            return;
          }

          // Free or approved user — point all CTA/free-plan buttons to dashboard
          if (heroBtn)     heroBtn.href     = 'dashboard.html';
          if (ctaBtn)      ctaBtn.href      = 'dashboard.html';
          if (freePlanBtn) freePlanBtn.href = 'dashboard.html';

          if (status === 'approved') {
            if (heroBtn)     heroBtn.textContent     = 'Go to Dashboard';
            if (ctaBtn)      ctaBtn.textContent      = 'Go to Dashboard';
            if (freePlanBtn) freePlanBtn.textContent = 'Go to Dashboard';
            if (ctaSub)      ctaSub.textContent      = 'Welcome back — your workspace is ready.';
          }
        });
    });
  })();

  /* ============================================================
     LOGOUT HANDLER
  ============================================================ */
  (function initLogout() {
    document.querySelectorAll('.rb-signout-trigger').forEach(function (btn) {
      btn.addEventListener('click', async function (e) {
        e.preventDefault();
        if (typeof rbSignOut === 'function') await rbSignOut();
        window.location.replace('signin.html');
      });
    });
  })();

  /* ============================================================
     TOPICSCOUT AI — generate research topics via OpenAI
  ============================================================ */
  (function initTopicScout() {
    var btn      = document.getElementById('rb-ts-btn');
    var popEl    = document.getElementById('rb-ts-population');
    var intEl    = document.getElementById('rb-ts-intervention');
    var designEl = document.getElementById('rb-ts-study-design');
    var results  = document.getElementById('rb-ts-results');
    var quotaEl  = document.getElementById('rb-ts-quota');
    if (!btn || !popEl || !designEl || !results) return;

    function escHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function showErrorToast(msg) {
      var existing = document.getElementById('rb-ts-err-toast');
      if (existing) existing.remove();
      var toast = document.createElement('div');
      toast.id = 'rb-ts-err-toast';
      toast.className = 'rb-toast rb-ts-toast--error rb-toast--fade';
      toast.textContent = msg;
      document.body.appendChild(toast);
      toast.getBoundingClientRect(); // force reflow for transition
      toast.classList.remove('rb-toast--fade');
      setTimeout(function () {
        toast.classList.add('rb-toast--fade');
        setTimeout(function () { if (toast.parentNode) toast.remove(); }, 350);
      }, 3500);
    }

    function renderQuota(count, limit) {
      if (!quotaEl) return;
      var remaining = Math.max(0, limit - count);
      var depleted  = remaining === 0;
      quotaEl.removeAttribute('hidden');
      quotaEl.className = 'rb-ts-quota'
        + (depleted ? ' rb-ts-quota--depleted' : (remaining === 1 ? ' rb-ts-quota--warning' : ''));
      quotaEl.textContent = depleted
        ? 'Daily limit reached. Upgrade your plan for more generations.'
        : remaining + ' / ' + limit + ' generation' + (limit === 1 ? '' : 's') + ' remaining today';
      btn.disabled = depleted;
    }

    async function loadQuota() {
      if (!quotaEl) return;
      var session = null;
      try {
        session = typeof rbGetSession === 'function' ? await rbGetSession() : null;
      } catch (e) { return; }
      if (!session) return;

      try {
        var res = await fetch('/api/generate-topics?userId=' + encodeURIComponent(session.user.id) + '&plan=' + encodeURIComponent(rbDashboardPlan));
        if (!res.ok) return;
        var data = await res.json();
        if (data && data.usage) renderQuota(data.usage.count, data.usage.limit);
      } catch (e) {
        // Non-critical: quota display updates after first generation
      }
    }

    _rbCallLoadQuota = loadQuota;

    // Clear inline errors on correction
    popEl.addEventListener('input', function () {
      var e = document.getElementById('rb-ts-pop-err');
      if (e) e.setAttribute('hidden', '');
      popEl.classList.remove('rb-ts-input--err');
    });
    designEl.addEventListener('change', function () {
      var e = document.getElementById('rb-ts-design-err');
      if (e) e.setAttribute('hidden', '');
      designEl.classList.remove('rb-ts-input--err');
    });

    btn.addEventListener('click', async function () {
      var population   = popEl.value.trim();
      var intervention = intEl ? intEl.value.trim() : '';
      var studyDesign  = designEl.value;

      // Inline validation
      var valid = true;
      var popErr    = document.getElementById('rb-ts-pop-err');
      var designErr = document.getElementById('rb-ts-design-err');
      if (!population) {
        if (popErr) popErr.removeAttribute('hidden');
        popEl.classList.add('rb-ts-input--err');
        valid = false;
      }
      if (!studyDesign) {
        if (designErr) designErr.removeAttribute('hidden');
        designEl.classList.add('rb-ts-input--err');
        valid = false;
      }
      if (!valid) return;

      var userId = null;

      if (typeof rbGetSession === 'function') {
        var session = await rbGetSession();
        if (session) userId = session.user.id;
      }

      btn.disabled = true;
      results.removeAttribute('hidden');
      results.innerHTML =
        '<div class="rb-topicscout__loading">'
        + '<div class="rb-spinner rb-spinner--sm rb-spinner--dark"></div>'
        + '<span>Generating research topics…</span>'
        + '</div>';

      try {
        var res = await fetch('/api/generate-topics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ population: population, intervention: intervention || '', studyDesign: studyDesign, userId: userId, plan: rbDashboardPlan })
        });

        var data = await res.json();

        if (res.status === 429) {
          results.setAttribute('hidden', '');
          results.innerHTML = '';
          var u = data.usage || {};
          renderQuota(u.count != null ? u.count : 999, u.limit != null ? u.limit : 999);
          return;
        }

        if (!res.ok || (!data.success && !Array.isArray(data.candidates))) throw new Error(data.error || 'Unknown error');

        if (data.usage) renderQuota(data.usage.count, data.usage.limit);

        var candidates = Array.isArray(data.candidates) ? data.candidates
          : (Array.isArray(data.topics) ? data.topics : []);
        var meta = data.meta || {};

        // Meta banner
        var metaInfoHtml = '';
        var candidateCount = meta.total_candidates != null ? meta.total_candidates : candidates.length;
        if (candidateCount > 0) {
          metaInfoHtml += '<p class="rb-ts-meta-info">' + candidateCount
            + ' candidate' + (candidateCount === 1 ? '' : 's') + ' generated</p>';
        }
        if (meta.under_target) {
          metaInfoHtml += '<div class="rb-ts-under-target-banner">'
            + '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>'
            + '<span>' + escHtml(meta.under_target_reason || 'Fewer candidates than requested were generated.') + '</span>'
            + '</div>';
        }

        function probClass(level) {
          var l = (level || '').toLowerCase();
          if (l === 'very_low' || l === 'low') return 'rb-topic-card__prob-badge--green';
          if (l === 'moderate') return 'rb-topic-card__prob-badge--amber';
          return 'rb-topic-card__prob-badge--red';
        }
        function fmtLevel(level) { return (level || '').replace(/_/g, ' '); }

        var cardsHtml = candidates.map(function (c, idx) {
          var bodyId = 'rb-tc-body-' + idx;
          var score = c.composite_score != null ? c.composite_score : '—';
          var pubVal = (c.estimated_publication_value || '').toLowerCase();
          var pubValLabels = { low: 'Low', moderate: 'Moderate', high: 'High', very_high: 'Very High' };

          // MA classification badge (hidden when "not_applicable")
          var maHtml = '';
          if (c.ma_classification && c.ma_classification !== 'not_applicable') {
            maHtml = '<span class="rb-topic-card__badge rb-topic-card__badge--ma" title="'
              + escHtml(c.ma_classification_rationale || '') + '">'
              + escHtml(c.ma_classification.replace(/_/g, ' ')) + '</span>';
          }

          var pubValHtml = pubVal
            ? '<span class="rb-topic-card__pubval rb-topic-card__pubval--' + escHtml(pubVal) + '">'
              + escHtml(pubValLabels[pubVal] || pubVal) + ' Publication Value</span>'
            : '';

          // PICO block
          var pico = c.pico || {};
          var picoRows = '';
          picoRows += '<div class="rb-topic-card__pico-row"><span class="rb-topic-card__pico-label">Population</span><span class="rb-topic-card__pico-value">' + escHtml(pico.population || '—') + '</span></div>';
          picoRows += '<div class="rb-topic-card__pico-row"><span class="rb-topic-card__pico-label">Intervention / Exposure</span><span class="rb-topic-card__pico-value">' + escHtml(pico.intervention || '—') + '</span></div>';
          if (pico.comparator) {
            picoRows += '<div class="rb-topic-card__pico-row"><span class="rb-topic-card__pico-label">Comparator</span><span class="rb-topic-card__pico-value">' + escHtml(pico.comparator) + '</span></div>';
          }
          var outcomesText = Array.isArray(pico.outcomes) ? pico.outcomes.join(', ') : (pico.outcomes || '');
          if (outcomesText) {
            picoRows += '<div class="rb-topic-card__pico-row"><span class="rb-topic-card__pico-label">Outcomes</span><span class="rb-topic-card__pico-value">' + escHtml(outcomesText) + '</span></div>';
          }
          if (pico.timeframe) {
            picoRows += '<div class="rb-topic-card__pico-row"><span class="rb-topic-card__pico-label">Timeframe</span><span class="rb-topic-card__pico-value">' + escHtml(pico.timeframe) + '</span></div>';
          }
          if (pico.setting) {
            picoRows += '<div class="rb-topic-card__pico-row"><span class="rb-topic-card__pico-label">Setting</span><span class="rb-topic-card__pico-value">' + escHtml(pico.setting) + '</span></div>';
          }

          // Probability badges
          var probHtml = '<div class="rb-topic-card__prob-row">'
            + '<span class="rb-topic-card__prob-badge ' + probClass(c.prior_synthesis_probability) + '">Prior Synthesis: ' + escHtml(fmtLevel(c.prior_synthesis_probability)) + '</span>'
            + '<span class="rb-topic-card__prob-badge ' + probClass(c.sufficient_studies_probability) + '">Sufficient Studies: ' + escHtml(fmtLevel(c.sufficient_studies_probability)) + '</span>'
            + '<span class="rb-topic-card__prob-badge ' + probClass(c.heterogeneity_probability) + '">Heterogeneity: ' + escHtml(fmtLevel(c.heterogeneity_probability)) + '</span>'
            + '</div>';

          // Pills
          var dbs = Array.isArray(c.likely_databases) ? c.likely_databases : [];
          var dbHtml = dbs.length
            ? '<div class="rb-topic-card__pills">' + dbs.map(function (d) { return '<span class="rb-topic-card__pill">' + escHtml(d) + '</span>'; }).join('') + '</div>'
            : '';
          var sts = Array.isArray(c.likely_study_types) ? c.likely_study_types : [];
          var stHtml = sts.length
            ? '<div class="rb-topic-card__pills">' + sts.map(function (s) { return '<span class="rb-topic-card__pill">' + escHtml(s) + '</span>'; }).join('') + '</div>'
            : '';

          // Limitations
          var lims = Array.isArray(c.possible_limitations) ? c.possible_limitations : [];
          var limHtml = lims.length
            ? '<ul class="rb-topic-card__limitations">' + lims.map(function (l) { return '<li>' + escHtml(l) + '</li>'; }).join('') + '</ul>'
            : '';

          // Red flags (only if non-empty)
          var rfs = Array.isArray(c.red_flags) ? c.red_flags : [];
          var rfHtml = rfs.length
            ? '<div class="rb-topic-card__red-flags-section">'
              + '<span class="rb-topic-card__red-flags-label">&#9888; Red Flags</span>'
              + '<ul class="rb-topic-card__red-flags-list">' + rfs.map(function (f) { return '<li>' + escHtml(f) + '</li>'; }).join('') + '</ul>'
              + '</div>'
            : '';

          // MA rationale below badge (expandable text)
          var maRationaleHtml = '';
          if (c.ma_classification && c.ma_classification !== 'not_applicable' && c.ma_classification_rationale) {
            maRationaleHtml = '<p class="rb-topic-card__ma-rationale">' + escHtml(c.ma_classification_rationale) + '</p>';
          }

          return '<div class="rb-topic-card rb-topic-card--collapsible">'
            // Collapsed header — always visible
            + '<div class="rb-topic-card__summary" role="button" tabindex="0" aria-expanded="false" aria-controls="' + bodyId + '">'
            +   '<div class="rb-topic-card__summary-top">'
            +     '<h3 class="rb-topic-card__title">' + escHtml(c.title) + '</h3>'
            +     '<span class="rb-topic-card__score-badge">' + escHtml(String(score)) + '/100</span>'
            +   '</div>'
            +   '<div class="rb-topic-card__summary-badges">'
            +     '<span class="rb-topic-card__badge">' + escHtml(c.study_design || '') + '</span>'
            +     maHtml
            +     pubValHtml
            +     '<svg class="rb-topic-card__chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>'
            +   '</div>'
            + '</div>'
            // Expanded body — hidden by default
            + '<div class="rb-topic-card__body" id="' + bodyId + '" hidden>'
            +   '<div class="rb-topic-card__section">'
            +     '<span class="rb-topic-card__row-label">PICO</span>'
            +     '<div class="rb-topic-card__pico">' + picoRows + '</div>'
            +   '</div>'
            +   '<div class="rb-topic-card__row"><span class="rb-topic-card__row-label">Rationale</span><p class="rb-topic-card__row-text">' + escHtml(c.rationale || '') + '</p></div>'
            +   '<div class="rb-topic-card__row"><span class="rb-topic-card__row-label">Evidence Gap</span><p class="rb-topic-card__row-text">' + escHtml(c.evidence_gap || '') + '</p></div>'
            +   '<div class="rb-topic-card__row"><span class="rb-topic-card__row-label">Novelty</span>'
            +     (c.novelty_axis ? '<span class="rb-topic-card__novelty-badge">' + escHtml(c.novelty_axis.replace(/_/g, ' ')) + '</span>' : '')
            +     '<p class="rb-topic-card__row-text">' + escHtml(c.novelty_content || '') + '</p>'
            +   '</div>'
            +   '<div class="rb-topic-card__row"><span class="rb-topic-card__row-label">Feasibility Assessment</span><p class="rb-topic-card__row-text">' + escHtml(c.feasibility_assessment || '') + '</p></div>'
            +   '<div class="rb-topic-card__section"><span class="rb-topic-card__row-label">Synthesis Probabilities</span>' + probHtml + '</div>'
            +   (dbHtml ? '<div class="rb-topic-card__section"><span class="rb-topic-card__row-label">Likely Databases</span>' + dbHtml + '</div>' : '')
            +   (stHtml ? '<div class="rb-topic-card__section"><span class="rb-topic-card__row-label">Likely Study Types</span>' + stHtml + '</div>' : '')
            +   (limHtml ? '<div class="rb-topic-card__section"><span class="rb-topic-card__row-label">Possible Limitations</span>' + limHtml + '</div>' : '')
            +   rfHtml
            +   maRationaleHtml
            + '</div>'
            + '</div>';
        }).join('');

        results.innerHTML = metaInfoHtml + cardsHtml;

        // Wire up collapsible toggle
        results.querySelectorAll('.rb-topic-card__summary').forEach(function (summary) {
          function toggle() {
            var card = summary.closest('.rb-topic-card--collapsible');
            var body = document.getElementById(summary.getAttribute('aria-controls'));
            if (!body) return;
            var expanded = summary.getAttribute('aria-expanded') === 'true';
            summary.setAttribute('aria-expanded', String(!expanded));
            if (expanded) {
              body.setAttribute('hidden', '');
              card.classList.remove('rb-topic-card--expanded');
            } else {
              body.removeAttribute('hidden');
              card.classList.add('rb-topic-card--expanded');
            }
          }
          summary.addEventListener('click', toggle);
          summary.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
          });
        });

      } catch (err) {
        results.setAttribute('hidden', '');
        results.innerHTML = '';
        showErrorToast((err && err.message) ? err.message : 'Failed to generate topics. Please try again.');
      }

      if (!quotaEl || !quotaEl.classList.contains('rb-ts-quota--depleted')) {
        btn.disabled = false;
      }
    });
  })();

  /* ============================================================
     NAV AUTH STATE — swap Sign in / Join Free for user info
     Runs on every page except the dashboard (which has its own).
  ============================================================ */
  (function initNavAuthState() {
    if (document.getElementById('rb-dash')) return;
    if (typeof rbGetSession !== 'function') return;

    rbGetSession().then(function (session) {
      if (!session) return;

      var fullName = (session.user.user_metadata && session.user.user_metadata.full_name)
        ? session.user.user_metadata.full_name
        : session.user.email;
      var firstName = fullName.split(' ')[0];
      var initial   = firstName.charAt(0).toUpperCase();

      // Desktop: replace Sign in link with avatar + name linking to dashboard
      var signinLink = document.querySelector('.rb-nav__actions .rb-signin');
      if (signinLink) {
        var userEl = document.createElement('a');
        userEl.href = 'dashboard.html';
        userEl.className = 'rb-nav__user';
        userEl.setAttribute('aria-label', firstName + ' — go to dashboard');
        userEl.innerHTML =
          '<span class="rb-nav__user-avatar" aria-hidden="true">' + initial + '</span>' +
          '<span class="rb-nav__user-name">' + firstName + '</span>';
        signinLink.replaceWith(userEl);
      }

      // Desktop: swap "Join Free" button → "Dashboard"
      var joinBtn = document.querySelector('.rb-nav__actions .rb-btn--amber');
      if (joinBtn) {
        joinBtn.textContent = 'Dashboard';
        joinBtn.href = 'dashboard.html';
      }

      // Mobile: update Sign in link
      var mobileSignin = document.querySelector('.rb-mobile-signin');
      if (mobileSignin) {
        mobileSignin.href = 'dashboard.html';
        mobileSignin.textContent = firstName;
      }

      // Mobile: update CTA button
      var mobileCta = document.querySelector('.rb-mobile-cta');
      if (mobileCta) {
        mobileCta.href = 'dashboard.html';
        mobileCta.textContent = 'Dashboard';
      }
    });
  })();

})();
