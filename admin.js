/* ============================================================
   R&B — admin.js
   Auth-gated payment dashboard: stats, table, approve/reject.
   Depends on: supabase.js (rbGetSession, rbSupabase, rbSignOut)
============================================================ */
(function () {
  'use strict';

  /* ── Config ────────────────────────────────────────────── */
  var ADMIN_EMAIL = 'shabirahmaddir598@gmail.com'; // replace with your email address

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

  /* ── Toast ───────────────────────────────────────────── */
  var toastTimer = null;
  function showToast(msg) {
    var toastEl   = document.getElementById('rb-toast');
    var toastMsgEl = document.getElementById('rb-toast-msg');
    if (!toastEl || !toastMsgEl) return;
    clearTimeout(toastTimer);
    toastMsgEl.textContent = msg;
    toastEl.classList.remove('rb-admin-overlay--hidden', 'rb-toast--fade');
    toastTimer = setTimeout(function () {
      toastEl.classList.add('rb-toast--fade');
      toastTimer = setTimeout(function () {
        toastEl.classList.add('rb-admin-overlay--hidden');
        toastEl.classList.remove('rb-toast--fade');
      }, 320);
    }, 2800);
  }

  /* ── Lecture Management ─────────────────────────────────── */
  (function initLectureAdmin() {
    var lectureForm   = document.getElementById('rb-lecture-form');
    if (!lectureForm) return;

    var lectureMsg    = document.getElementById('rb-lecture-msg');
    var lectureList   = document.getElementById('rb-lecture-list');
    var lectureSave   = document.getElementById('rb-lecture-save');
    var lectureCancel = document.getElementById('rb-lecture-cancel');
    var fTitle        = document.getElementById('lec-title');
    var fDesc         = document.getElementById('lec-description');
    var fVideoUrl     = document.getElementById('lec-video-url');
    var fThumbUrl     = document.getElementById('lec-thumbnail-url');
    var fCategory     = document.getElementById('lec-category');
    var fAccess       = document.getElementById('lec-access-level');
    var fOrder        = document.getElementById('lec-order');
    var fDuration     = document.getElementById('lec-duration');

    var editingId = null;

    fetchLectures();

    async function fetchLectures() {
      var r = await rbSupabase
        .from('lectures')
        .select('*')
        .order('order_number', { ascending: true })
        .order('created_at', { ascending: false });
      if (r.error) {
        console.error('lectures fetch', r.error);
        setMsg('Error loading lectures: ' + r.error.message, 'error');
        return;
      }
      renderLectures(r.data || []);
    }

    function renderLectures(lectures) {
      if (!lectures.length) {
        lectureList.innerHTML = '<p class="rb-admin-lecture-empty">No lectures yet. Add one above.</p>';
        return;
      }
      lectureList.innerHTML = lectures.map(function (lec) {
        var thumbHtml = lec.thumbnail_url
          ? '<div class="rb-admin-lec-card__thumb-wrap"><img class="rb-admin-lec-card__thumb" src="' + ea(lec.thumbnail_url) + '" alt="" loading="lazy" /></div>'
          : '';
        return '<div class="rb-admin-lec-card">'
          + thumbHtml
          + '<div class="rb-admin-lec-card__body">'
          +   '<div class="rb-admin-lec-card__meta">'
          +     lecAccessBadge(lec.access_level)
          +     (lec.category ? ' <span class="rb-admin-lec-card__cat">' + eh(lec.category) + '</span>' : '')
          +     ' <span class="rb-admin-lec-card__order">Order: ' + (lec.order_number || 0) + '</span>'
          +     (lec.duration ? ' <span class="rb-admin-lec-card__dur">' + eh(lec.duration) + '</span>' : '')
          +   '</div>'
          +   '<h3 class="rb-admin-lec-card__title">' + eh(lec.title) + '</h3>'
          +   (lec.description ? '<p class="rb-admin-lec-card__desc">' + eh(lec.description) + '</p>' : '')
          +   '<a class="rb-admin-lec-card__link" href="' + ea(lec.video_url) + '" target="_blank" rel="noopener noreferrer">Watch video ↗</a>'
          + '</div>'
          + '<div class="rb-admin-lec-card__actions">'
          +   '<button class="rb-admin-action-btn rb-admin-lec-edit" data-id="' + ea(lec.id) + '">Edit</button>'
          +   '<button class="rb-admin-action-btn rb-admin-action-btn--reject rb-admin-lec-delete" data-id="' + ea(lec.id) + '">Delete</button>'
          + '</div>'
          + '</div>';
      }).join('');
    }

    lectureForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var title       = fTitle.value.trim();
      var videoUrl    = fVideoUrl.value.trim();
      var accessLevel = fAccess.value;
      var orderRaw    = fOrder.value.trim();
      var orderNum    = orderRaw === '' ? 0 : parseInt(orderRaw, 10);

      if (!title)       { setMsg('Title is required.',        'error'); fTitle.focus();   return; }
      if (!videoUrl)    { setMsg('Video URL is required.',    'error'); fVideoUrl.focus(); return; }
      if (!accessLevel) { setMsg('Access level is required.', 'error'); fAccess.focus();  return; }
      if (isNaN(orderNum)) orderNum = 0;

      var payload = {
        title:         title,
        description:   fDesc.value.trim()    || null,
        video_url:     videoUrl,
        thumbnail_url: fThumbUrl.value.trim() || null,
        category:      fCategory.value.trim() || null,
        access_level:  accessLevel,
        order_number:  orderNum,
        duration:      fDuration.value.trim() || null,
      };

      lectureSave.disabled    = true;
      lectureSave.textContent = 'Saving…';

      var r = editingId
        ? await rbSupabase.from('lectures').update(payload).eq('id', editingId)
        : await rbSupabase.from('lectures').insert(payload);

      lectureSave.disabled    = false;
      lectureSave.textContent = editingId ? 'Update Lecture' : 'Save Lecture';

      if (r.error) {
        console.error('lecture save', r.error);
        setMsg('Error: ' + r.error.message, 'error');
        return;
      }

      setMsg(editingId ? 'Lecture updated.' : 'Lecture added.', 'success');
      resetLectureForm();
      fetchLectures();
    });

    lectureCancel.addEventListener('click', resetLectureForm);

    lectureList.addEventListener('click', function (e) {
      var editBtn   = e.target.closest('.rb-admin-lec-edit');
      var deleteBtn = e.target.closest('.rb-admin-lec-delete');
      if (editBtn)   editLecture(editBtn.dataset.id);
      if (deleteBtn) deleteLecture(deleteBtn.dataset.id);
    });

    function editLecture(id) {
      rbSupabase.from('lectures').select('*').eq('id', id).single().then(function (r) {
        if (r.error || !r.data) { setMsg('Could not load lecture.', 'error'); return; }
        var lec = r.data;
        editingId       = lec.id;
        fTitle.value    = lec.title || '';
        fDesc.value     = lec.description || '';
        fVideoUrl.value = lec.video_url || '';
        fThumbUrl.value = lec.thumbnail_url || '';
        fCategory.value = lec.category || '';
        fAccess.value   = lec.access_level || '';
        fOrder.value    = lec.order_number != null ? lec.order_number : 0;
        fDuration.value = lec.duration || '';
        lectureCancel.style.display  = '';
        lectureSave.textContent      = 'Update Lecture';
        lectureForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setMsg('Editing: ' + eh(lec.title), 'info');
      });
    }

    async function deleteLecture(id) {
      if (!confirm('Delete this lecture? This cannot be undone.')) return;
      var r = await rbSupabase.from('lectures').delete().eq('id', id);
      if (r.error) {
        console.error('lecture delete', r.error);
        setMsg('Delete failed: ' + r.error.message, 'error');
        return;
      }
      if (editingId === id) resetLectureForm();
      setMsg('Lecture deleted.', 'success');
      fetchLectures();
    }

    function resetLectureForm() {
      editingId = null;
      lectureForm.reset();
      lectureCancel.style.display = 'none';
      lectureSave.textContent     = 'Save Lecture';
      setMsg('', '');
    }

    function setMsg(msg, type) {
      lectureMsg.textContent = msg;
      lectureMsg.className   = 'rb-admin-lecture-msg'
        + (type === 'error'   ? ' rb-admin-lecture-msg--error'   : '')
        + (type === 'success' ? ' rb-admin-lecture-msg--success' : '')
        + (type === 'info'    ? ' rb-admin-lecture-msg--info'    : '');
    }

    function lecAccessBadge(level) {
      return '<span class="rb-admin-lec-badge rb-admin-lec-badge--' + (level || 'free') + '">'
        + cap(level || 'free') + '</span>';
    }
  })();

  /* ── User Management ────────────────────────────────── */
  (function initUserManagement() {
    var usersSection = document.getElementById('rb-admin-users');
    if (!usersSection) return;

    var usersCountEl  = document.getElementById('rb-users-count');
    var usersSearchEl = document.getElementById('rb-users-search');
    var usersTableEl  = document.getElementById('rb-users-table');
    var usersTbodyEl  = document.getElementById('rb-users-tbody');
    var usersEmptyEl  = document.getElementById('rb-users-empty');

    var allUsers    = [];
    var searchQuery = '';

    fetchUsers();

    async function fetchUsers() {
      var r = await rbSupabase
        .from('profiles')
        .select('id, user_id, full_name, email, plan, created_at')
        .order('created_at', { ascending: false });

      if (r.error) {
        console.error('users fetch', r.error);
        usersCountEl.textContent = 'Failed to load users.';
        return;
      }
      allUsers = r.data || [];
      renderUsers();
    }

    function renderUsers() {
      var q    = searchQuery.toLowerCase().trim();
      var rows = q
        ? allUsers.filter(function (u) {
            return (u.full_name || '').toLowerCase().includes(q)
                || (u.email    || '').toLowerCase().includes(q);
          })
        : allUsers;

      usersCountEl.textContent = allUsers.length + ' user' + (allUsers.length !== 1 ? 's' : '') + ' total'
        + (q ? ' · ' + rows.length + ' match' + (rows.length !== 1 ? 'es' : '') : '');

      if (!rows.length) {
        usersTableEl.style.display = 'none';
        usersEmptyEl.style.display = 'block';
        return;
      }
      usersTableEl.style.display = '';
      usersEmptyEl.style.display = 'none';

      usersTbodyEl.innerHTML = rows.map(function (user) {
        var date  = new Date(user.created_at).toLocaleDateString('en-US', {
          year: 'numeric', month: 'short', day: 'numeric'
        });
        var plan  = user.plan || 'free';
        var name  = user.full_name || '—';
        var email = user.email || '—';

        var select =
          '<select class="rb-admin-plan-select" data-uid="' + ea(user.id) + '" aria-label="Change plan for ' + ea(name) + '">'
          + ['free', 'scholar', 'pro'].map(function (p) {
              return '<option value="' + p + '"' + (plan === p ? ' selected' : '') + '>' + cap(p) + '</option>';
            }).join('')
          + '</select>';

        return '<tr>'
          + '<td data-label="Name">'                             + eh(name)        + '</td>'
          + '<td data-label="Email" class="rb-admin-td--email">' + eh(email)       + '</td>'
          + '<td data-label="Plan">'                             + planBadge(plan) + '</td>'
          + '<td data-label="Joined" class="rb-admin-td--date">' + date            + '</td>'
          + '<td data-label="Change Plan">'                      + select          + '</td>'
          + '</tr>';
      }).join('');
    }

    usersTbodyEl.addEventListener('change', async function (e) {
      var sel = e.target.closest('.rb-admin-plan-select');
      if (!sel) return;
      var uid     = sel.dataset.uid;
      var newPlan = sel.value;
      sel.disabled = true;

      var r = await rbSupabase
        .from('profiles')
        .update({ plan: newPlan })
        .eq('id', uid);

      sel.disabled = false;

      if (r.error) {
        console.error('plan update', r.error);
        showToast('Update failed: ' + r.error.message);
        return;
      }

      var user = allUsers.find(function (u) { return u.id === uid; });
      if (user) user.plan = newPlan;
      renderUsers();
      showToast('Plan updated to ' + cap(newPlan) + '.');
    });

    usersSearchEl.addEventListener('input', function () {
      searchQuery = usersSearchEl.value;
      renderUsers();
    });
  })();

  /* ── Boot ────────────────────────────────────────────────── */
  init();
})();
