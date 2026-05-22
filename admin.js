/* ============================================================
   R&B — admin.js
   Auth-gated payment dashboard: stats, table, approve/reject.
   Depends on: supabase.js (rbGetSession, rbSupabase, rbSignOut)
============================================================ */
(function () {
  'use strict';

  /* ── Config ────────────────────────────────────────────── */
  var ADMIN_EMAIL = 'APNI_EMAIL_DAAL'; // replace with your email address

  /* ── State ─────────────────────────────────────────────── */
  var allPayments   = [];
  var currentFilter = 'all';
  var pendingAction = null; // { id, newStatus }

  /* ── Element refs ───────────────────────────────────────── */
  var loadingEl    = document.getElementById('rb-admin-loading');
  var errorEl      = document.getElementById('rb-admin-error');
  var errorMsgEl   = document.getElementById('rb-admin-error-msg');
  var mainEl       = document.getElementById('rb-admin-main');
  var statsEl      = document.getElementById('rb-admin-stats');
  var tbodyEl      = document.getElementById('rb-admin-tbody');
  var tableEl      = document.getElementById('rb-admin-table');
  var emptyEl      = document.getElementById('rb-admin-empty');
  var countEl      = document.getElementById('rb-admin-count');
  var modalEl      = document.getElementById('rb-admin-modal');
  var modalImgEl   = document.getElementById('rb-admin-modal-img');
  var confirmEl    = document.getElementById('rb-admin-confirm');
  var confirmMsgEl = document.getElementById('rb-admin-confirm-msg');
  var confirmOkEl  = document.getElementById('rb-admin-confirm-ok');

  /* ── Auth guard ─────────────────────────────────────────── */
  async function init() {
    if (typeof rbGetSession !== 'function' || typeof rbSupabase === 'undefined') {
      window.location.replace('index.html');
      return;
    }
    var session = await rbGetSession();
    if (!session || session.user.email !== ADMIN_EMAIL) {
      window.location.replace('index.html');
      return;
    }
    await loadPayments();
  }

  /* ── Data ───────────────────────────────────────────────── */
  async function loadPayments() {
    showLoading();
    var result = await rbSupabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false });

    if (result.error) {
      showError('Failed to load payments: ' + result.error.message);
      return;
    }
    allPayments = result.data || [];
    renderStats();
    renderTable(currentFilter);
    showMain();
  }

  /* ── Stats ──────────────────────────────────────────────── */
  function renderStats() {
    var defs = [
      { label: 'Total',    value: allPayments.length,          mod: ''         },
      { label: 'Pending',  value: cnt('status', 'pending'),    mod: 'pending'  },
      { label: 'Approved', value: cnt('status', 'approved'),   mod: 'approved' },
      { label: 'Rejected', value: cnt('status', 'rejected'),   mod: 'rejected' },
      { label: 'Scholar',  value: cnt('plan',   'scholar'),    mod: 'scholar'  },
      { label: 'Pro',      value: cnt('plan',   'pro'),        mod: 'pro'      },
    ];
    statsEl.innerHTML = defs.map(function (d) {
      return '<div class="rb-admin-stat' + (d.mod ? ' rb-admin-stat--' + d.mod : '') + '">'
           +   '<span class="rb-admin-stat__value">' + d.value + '</span>'
           +   '<span class="rb-admin-stat__label">' + d.label + '</span>'
           + '</div>';
    }).join('');
  }

  /* ── Table ──────────────────────────────────────────────── */
  function renderTable(filter) {
    var rows = filter === 'all'
      ? allPayments
      : allPayments.filter(function (p) { return p.status === filter; });

    countEl.textContent = rows.length + ' payment' + (rows.length !== 1 ? 's' : '');

    if (!rows.length) {
      tableEl.style.display = 'none';
      emptyEl.style.display = 'block';
      return;
    }
    tableEl.style.display = '';
    emptyEl.style.display = 'none';

    tbodyEl.innerHTML = rows.map(function (row) {
      var date = new Date(row.created_at).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
      });

      var imgCell = row.screenshot_url
        ? '<button class="rb-admin-thumb-btn" data-url="' + ea(row.screenshot_url) + '" aria-label="View screenshot">'
        +   '<img src="' + ea(row.screenshot_url) + '" alt="" class="rb-admin-thumb" loading="lazy" />'
        + '</button>'
        : '<span class="rb-admin-no-img">—</span>';

      var actions = (row.status === 'pending')
        ? '<div class="rb-admin-row-actions">'
        +   '<button class="rb-admin-action-btn rb-admin-action-btn--approve"'
        +     ' data-id="' + ea(row.id) + '" data-email="' + ea(row.email || '') + '">Approve</button>'
        +   '<button class="rb-admin-action-btn rb-admin-action-btn--reject"'
        +     ' data-id="' + ea(row.id) + '" data-email="' + ea(row.email || '') + '">Reject</button>'
        + '</div>'
        : '<span class="rb-admin-no-action">—</span>';

      return '<tr>'
        + td('Email',      'rb-admin-td--email', eh(row.email || '—'))
        + td('Plan',       '',                   planBadge(row.plan))
        + td('Method',     '',                   cap(row.payment_method || '—'))
        + td('Date',       'rb-admin-td--date',  date)
        + td('Screenshot', '',                   imgCell)
        + td('Status',     '',                   statusBadge(row.status))
        + td('Actions',    '',                   actions)
        + '</tr>';
    }).join('');
  }

  function td(label, extraClass, content) {
    var cls = 'data-label="' + label + '"' + (extraClass ? ' class="' + extraClass + '"' : '');
    return '<td ' + cls + '>' + content + '</td>';
  }

  /* ── Table event delegation ─────────────────────────────── */
  tbodyEl.addEventListener('click', function (e) {
    var thumb      = e.target.closest('.rb-admin-thumb-btn');
    var approveBtn = e.target.closest('.rb-admin-action-btn--approve');
    var rejectBtn  = e.target.closest('.rb-admin-action-btn--reject');

    if (thumb)      { openModal(thumb.dataset.url);                                          return; }
    if (approveBtn) { openConfirm(approveBtn.dataset.id, approveBtn.dataset.email, 'approved'); return; }
    if (rejectBtn)  { openConfirm(rejectBtn.dataset.id,  rejectBtn.dataset.email,  'rejected'); }
  });

  /* ── Screenshot lightbox ────────────────────────────────── */
  function openModal(url) {
    modalImgEl.src = url;
    show(modalEl);
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    hide(modalEl);
    modalImgEl.src = '';
    document.body.style.overflow = '';
  }

  document.getElementById('rb-admin-modal-close').addEventListener('click', closeModal);
  modalEl.addEventListener('click', function (e) { if (e.target === modalEl) closeModal(); });

  /* ── Confirm dialog ─────────────────────────────────────── */
  function openConfirm(id, email, newStatus) {
    pendingAction = { id: id, newStatus: newStatus };
    var verb = newStatus === 'approved' ? 'Approve' : 'Reject';
    confirmMsgEl.textContent = verb + ' payment from ' + (email || 'this user') + '?';
    confirmOkEl.className    = 'rb-admin-confirm-ok rb-admin-confirm-ok--' + newStatus;
    confirmOkEl.textContent  = verb;
    show(confirmEl);
    document.body.style.overflow = 'hidden';
  }

  function closeConfirm() {
    pendingAction = null;
    hide(confirmEl);
    document.body.style.overflow = '';
  }

  document.getElementById('rb-admin-confirm-cancel').addEventListener('click', closeConfirm);
  confirmEl.addEventListener('click', function (e) { if (e.target === confirmEl) closeConfirm(); });

  confirmOkEl.addEventListener('click', async function () {
    if (!pendingAction) return;
    var action = pendingAction;
    closeConfirm();

    var result = await rbSupabase
      .from('payments')
      .update({ status: action.newStatus })
      .eq('id', action.id);

    if (result.error) {
      showError('Update failed: ' + result.error.message);
      return;
    }
    await loadPayments();
  });

  /* ── Filter tabs ─────────────────────────────────────────── */
  document.querySelectorAll('.rb-admin-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.rb-admin-tab').forEach(function (t) {
        t.classList.remove('rb-admin-tab--active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('rb-admin-tab--active');
      tab.setAttribute('aria-selected', 'true');
      currentFilter = tab.dataset.filter;
      renderTable(currentFilter);
    });
  });

  /* ── Sign out ────────────────────────────────────────────── */
  document.getElementById('rb-admin-signout').addEventListener('click', async function () {
    if (typeof rbSignOut === 'function') await rbSignOut();
    window.location.replace('signin.html');
  });

  document.getElementById('rb-admin-retry').addEventListener('click', loadPayments);

  /* ── Keyboard ────────────────────────────────────────────── */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    closeModal();
    closeConfirm();
  });

  /* ── UI state helpers ────────────────────────────────────── */
  function showLoading() {
    show(loadingEl);
    hide(errorEl);
    mainEl.style.display = 'none';
  }

  function showMain() {
    hide(loadingEl);
    hide(errorEl);
    mainEl.style.display = 'block';
  }

  function showError(msg) {
    errorMsgEl.textContent = msg;
    hide(loadingEl);
    show(errorEl);
    mainEl.style.display = 'none';
  }

  function show(el) { el.classList.remove('rb-admin-overlay--hidden'); }
  function hide(el) { el.classList.add('rb-admin-overlay--hidden');    }

  /* ── Micro helpers ───────────────────────────────────────── */
  function cnt(field, val) {
    return allPayments.filter(function (p) { return p[field] === val; }).length;
  }

  /* HTML-escape for text content */
  function eh(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* HTML-escape for attribute values */
  function ea(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function cap(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : str; }

  function statusBadge(s) {
    return '<span class="rb-admin-status rb-admin-status--' + (s || 'unknown') + '">' + cap(s || 'Unknown') + '</span>';
  }

  function planBadge(p) {
    return '<span class="rb-admin-plan rb-admin-plan--' + (p || 'free') + '">' + cap(p || 'Free') + '</span>';
  }

  /* ── Boot ────────────────────────────────────────────────── */
  init();
})();
