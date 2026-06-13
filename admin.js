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
    renderRevenue();
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
        +     ' data-id="' + ea(row.id) + '" data-email="' + ea(row.email || '') + '" data-plan="' + ea(row.plan || '') + '" data-user-id="' + ea(row.user_id || '') + '">Approve</button>'
        +   '<button class="rb-admin-action-btn rb-admin-action-btn--reject"'
        +     ' data-id="' + ea(row.id) + '" data-email="' + ea(row.email || '') + '" data-plan="' + ea(row.plan || '') + '" data-user-id="' + ea(row.user_id || '') + '">Reject</button>'
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

    if (thumb)      { openModal(thumb.dataset.url);                                                                      return; }
    if (approveBtn) { openConfirm(approveBtn.dataset.id, approveBtn.dataset.email, approveBtn.dataset.plan, approveBtn.dataset.userId, 'approved'); return; }
    if (rejectBtn)  { openConfirm(rejectBtn.dataset.id,  rejectBtn.dataset.email,  rejectBtn.dataset.plan,  rejectBtn.dataset.userId,  'rejected'); }
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
  function openConfirm(id, email, plan, userId, newStatus) {
    pendingAction = { id: id, email: email, plan: plan, userId: userId, newStatus: newStatus };
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

    var profilePromise = action.userId
      ? rbSupabase.from('profiles').select('full_name').eq('user_id', action.userId).single()
      : Promise.resolve({ data: null });
    profilePromise.then(function (r) {
      var userName = (r.data && r.data.full_name) ? r.data.full_name : action.email;
      fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_email:  action.email,
          user_name: userName,
          plan:      action.plan,
          type:      action.newStatus
        })
      }).then(function (res) { return res.json(); }).then(function (data) {
        if (data.success) {
          showToast('Email sent to user');
        } else {
          console.error('send-email error:', data.error);
          showToast('Email failed to send');
        }
      }).catch(function (err) {
        console.error('send-email fetch error:', err);
        showToast('Email failed to send');
      });
    });
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

  /* ── TopicScout Settings ───────────────────────────────── */
  (function initTopicScoutSettings() {
    var settingsSection = document.getElementById('rb-admin-topicscout-settings');
    if (!settingsSection) return;

    var fFree    = document.getElementById('ts-free-limit');
    var fScholar = document.getElementById('ts-scholar-limit');
    var fPro     = document.getElementById('ts-pro-limit');
    var saveBtn  = document.getElementById('rb-topicscout-save');
    var msgEl    = document.getElementById('rb-topicscout-msg');

    var KEYS = {
      free:    'topicscout_free_limit',
      scholar: 'topicscout_scholar_limit',
      pro:     'topicscout_pro_limit'
    };
    var DEFAULTS = { free: 3, scholar: 15, pro: 30 };

    fetchSettings();

    function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

    function isJwtError(err) {
      var msg = (err.message || err.hint || '').toLowerCase();
      return msg.includes('jwt') || msg.includes('issued at') || msg.includes('clock') || msg.includes('token');
    }

    async function attemptFetch() {
      return rbSupabase
        .from('settings')
        .select('key, value')
        .in('key', [KEYS.free, KEYS.scholar, KEYS.pro]);
    }

    function populateDefaults() {
      fFree.value    = DEFAULTS.free;
      fScholar.value = DEFAULTS.scholar;
      fPro.value     = DEFAULTS.pro;
    }

    async function fetchSettings() {
      var r = await attemptFetch();

      // Retry once after 1 s if this looks like a clock-skew JWT error
      if (r.error && isJwtError(r.error)) {
        console.warn('settings fetch: JWT clock error, retrying in 1 s…', r.error.message);
        await delay(1000);
        r = await attemptFetch();
      }

      if (r.error) {
        console.error('settings fetch', r.error);
        populateDefaults();
        setMsg('Could not load settings — showing defaults. You can still save.', 'info');
        return;
      }

      var map = {};
      (r.data || []).forEach(function (row) { map[row.key] = row.value; });

      fFree.value    = map[KEYS.free]    != null ? parseInt(map[KEYS.free],    10) : DEFAULTS.free;
      fScholar.value = map[KEYS.scholar] != null ? parseInt(map[KEYS.scholar], 10) : DEFAULTS.scholar;
      fPro.value     = map[KEYS.pro]     != null ? parseInt(map[KEYS.pro],     10) : DEFAULTS.pro;
    }

    saveBtn.addEventListener('click', async function () {
      var freeVal    = parseInt(fFree.value,    10);
      var scholarVal = parseInt(fScholar.value, 10);
      var proVal     = parseInt(fPro.value,     10);

      if (isNaN(freeVal)    || freeVal    < 0) { setMsg('Free limit must be a non-negative number.',    'error'); fFree.focus();    return; }
      if (isNaN(scholarVal) || scholarVal < 0) { setMsg('Scholar limit must be a non-negative number.', 'error'); fScholar.focus(); return; }
      if (isNaN(proVal)     || proVal     < 0) { setMsg('Pro limit must be a non-negative number.',     'error'); fPro.focus();     return; }

      saveBtn.disabled    = true;
      saveBtn.textContent = 'Saving…';

      var now = new Date().toISOString();
      var upserts = [
        { key: KEYS.free,    value: String(freeVal),    updated_at: now },
        { key: KEYS.scholar, value: String(scholarVal), updated_at: now },
        { key: KEYS.pro,     value: String(proVal),     updated_at: now }
      ];

      var r = await rbSupabase
        .from('settings')
        .upsert(upserts, { onConflict: 'key' });

      saveBtn.disabled    = false;
      saveBtn.textContent = 'Save Settings';

      if (r.error) {
        console.error('settings save', r.error);
        setMsg('Error: ' + r.error.message, 'error');
        return;
      }

      setMsg('Settings saved.', 'success');
    });

    function setMsg(msg, type) {
      msgEl.textContent = msg;
      msgEl.className   = 'rb-admin-settings-msg'
        + (type === 'error'   ? ' rb-admin-settings-msg--error'   : '')
        + (type === 'success' ? ' rb-admin-settings-msg--success' : '');
    }
  })();

  /* ── Revenue Overview ───────────────────────────────────── */
  function renderRevenue() {
    var SCHOLAR_PRICE = 6000;
    var PRO_PRICE     = 10000;

    function pad2(n) { return n < 10 ? '0' + n : '' + n; }
    function fmtPKR(n) { return 'PKR ' + Number(n).toLocaleString('en-US'); }
    function fmtK(n) {
      if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
      if (n >= 1000)    return Math.round(n / 1000) + 'K';
      return '' + n;
    }

    var approved = allPayments.filter(function(p) { return p.status === 'approved'; });

    var now   = new Date();
    var thisY = now.getFullYear();
    var thisM = now.getMonth();

    function mkKey(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1); }
    var thisKey = mkKey(now);
    var lastKey = mkKey(new Date(thisY, thisM - 1, 1));

    /* Group approved payments by month */
    var monthMap = {};
    approved.forEach(function(p) {
      var d   = new Date(p.created_at);
      var key = mkKey(d);
      if (!monthMap[key]) {
        monthMap[key] = {
          scholar: 0, pro: 0,
          label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        };
      }
      if (p.plan === 'scholar')      monthMap[key].scholar++;
      else if (p.plan === 'pro')     monthMap[key].pro++;
    });

    /* Overall totals */
    var totalScholar = 0, totalPro = 0;
    approved.forEach(function(p) {
      if (p.plan === 'scholar')  totalScholar++;
      else if (p.plan === 'pro') totalPro++;
    });
    var totalRevenue = totalScholar * SCHOLAR_PRICE + totalPro * PRO_PRICE;
    var thisData     = monthMap[thisKey] || { scholar: 0, pro: 0 };
    var lastData     = monthMap[lastKey] || { scholar: 0, pro: 0 };
    var thisMonthRev = thisData.scholar * SCHOLAR_PRICE + thisData.pro * PRO_PRICE;
    var lastMonthRev = lastData.scholar * SCHOLAR_PRICE + lastData.pro * PRO_PRICE;

    /* Unique paying users */
    var uniqueSet = {}, thisSet = {};
    approved.forEach(function(p) {
      var uid = p.user_id || p.email || ('' + p.id);
      uniqueSet[uid] = true;
      if (mkKey(new Date(p.created_at)) === thisKey) thisSet[uid] = true;
    });
    var payingUsers  = Object.keys(uniqueSet).length;
    var newThisMonth = Object.keys(thisSet).length;

    /* ── Summary cards ─────────────────────────────────────── */
    var cardsEl = document.getElementById('rb-revenue-cards');
    if (cardsEl) {
      var cardDefs = [
        { label: 'Total Revenue', value: fmtPKR(totalRevenue), mod: 'total'     },
        { label: 'This Month',    value: fmtPKR(thisMonthRev), mod: 'thismonth' },
        { label: 'Last Month',    value: fmtPKR(lastMonthRev), mod: 'lastmonth' },
        { label: 'MRR',           value: fmtPKR(thisMonthRev), mod: 'mrr'       },
        { label: 'Paying Users',  value: '' + payingUsers,     mod: 'users',
          sub: '↑ ' + newThisMonth + ' new this month' }
      ];
      cardsEl.innerHTML = cardDefs.map(function(c) {
        return '<div class="rb-admin-stat rb-admin-stat--rev rb-admin-stat--rev-' + c.mod + '">'
          + '<span class="rb-admin-stat__value">' + c.value + '</span>'
          + '<span class="rb-admin-stat__label">' + c.label + '</span>'
          + (c.sub ? '<span class="rb-revenue-stat__sub">' + eh(c.sub) + '</span>' : '')
          + '</div>';
      }).join('');
    }

    /* ── Last 6 months array for chart ─────────────────────── */
    var last6 = [];
    for (var i = 5; i >= 0; i--) {
      var d6 = new Date(thisY, thisM - i, 1);
      var k6 = mkKey(d6);
      var m6 = monthMap[k6] || { scholar: 0, pro: 0 };
      last6.push({
        label:   d6.toLocaleDateString('en-US', { month: 'short' }) + '’' + ('' + d6.getFullYear()).slice(2),
        scholar: m6.scholar,
        pro:     m6.pro
      });
    }

    /* ── Plan breakdown ─────────────────────────────────────── */
    var breakdownEl = document.getElementById('rb-revenue-breakdown');
    if (breakdownEl) {
      var sRev = totalScholar * SCHOLAR_PRICE;
      var pRev = totalPro     * PRO_PRICE;
      var maxR = Math.max(sRev, pRev, 1);

      breakdownEl.innerHTML =
          '<h3 class="rb-revenue-breakdown__title">Plan Breakdown</h3>'
        + '<div class="rb-revenue-breakdown__inner">'
        +   '<div class="rb-revenue-breakdown__bars">'
        +     buildBreakdownRow('Scholar', 'scholar', totalScholar, 6, sRev, Math.round(sRev / maxR * 100))
        +     buildBreakdownRow('Pro',     'pro',     totalPro,    10, pRev, Math.round(pRev / maxR * 100))
        +   '</div>'
        +   '<div class="rb-revenue-donut">' + buildDonutSvg(sRev, pRev) + '</div>'
        + '</div>';
    }

    function buildBreakdownRow(name, mod, count, kPrice, rev, barPct) {
      return '<div class="rb-revenue-breakdown__row">'
        + '<div class="rb-revenue-breakdown__plan-label">'
        +   '<span class="rb-revenue-dot rb-revenue-dot--' + mod + '"></span>'
        +   '<span class="rb-revenue-plan-name">' + name + '</span>'
        + '</div>'
        + '<div class="rb-revenue-bar-track">'
        +   '<div class="rb-revenue-bar rb-revenue-bar--' + mod + '" style="width:' + barPct + '%"></div>'
        + '</div>'
        + '<span class="rb-revenue-plan-stat">' + count + ' × PKR ' + kPrice + 'K = ' + fmtPKR(rev) + '</span>'
        + '</div>';
    }

    function buildDonutSvg(sRev, pRev) {
      var total = sRev + pRev;
      var r = 45, cx = 60, cy = 60, sw = 14;
      var circ  = 2 * Math.PI * r;
      var out   = '<svg width="120" height="120" viewBox="0 0 120 120" role="img" aria-label="Plan revenue split">';
      out += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none"'
           + ' stroke="var(--border)" stroke-width="' + sw + '"/>';
      if (total > 0) {
        var sDash  = sRev / total * circ;
        var pDash  = circ - sDash;
        var pStart = -90 + sRev / total * 360;
        out += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none"'
             + ' stroke="#E8601A" stroke-width="' + sw + '"'
             + ' stroke-dasharray="' + sDash.toFixed(2) + ' ' + pDash.toFixed(2) + '"'
             + ' stroke-dashoffset="0" transform="rotate(-90 ' + cx + ' ' + cy + ')"/>';
        out += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none"'
             + ' stroke="#4a9edd" stroke-width="' + sw + '"'
             + ' stroke-dasharray="' + pDash.toFixed(2) + ' ' + sDash.toFixed(2) + '"'
             + ' stroke-dashoffset="0" transform="rotate(' + pStart.toFixed(1) + ' ' + cx + ' ' + cy + ')"/>';
      }
      var cLabel = total > 0 ? Math.round(sRev / total * 100) + '%' : '—';
      out += '<text x="' + cx + '" y="' + cy + '" text-anchor="middle" dominant-baseline="middle"'
           + ' font-size="14" font-weight="700" fill="currentColor">' + cLabel + '</text>';
      out += '<text x="' + cx + '" y="' + (cy + 16) + '" text-anchor="middle"'
           + ' font-size="9" opacity="0.6" fill="currentColor">Scholar</text>';
      out += '</svg>';
      return out;
    }

    /* ── Monthly table ──────────────────────────────────────── */
    var monthKeys = Object.keys(monthMap).sort().reverse();
    var revTbody  = document.getElementById('rb-revenue-tbody');
    var revEmpty  = document.getElementById('rb-revenue-empty');
    var revTable  = document.getElementById('rb-revenue-table');

    if (revTable && revEmpty) {
      if (!monthKeys.length) {
        revTable.style.display = 'none';
        revEmpty.style.display = 'block';
      } else {
        revTable.style.display = '';
        revEmpty.style.display = 'none';
        if (revTbody) {
          revTbody.innerHTML = monthKeys.map(function(key, idx) {
            var m        = monthMap[key];
            var rev      = m.scholar * SCHOLAR_PRICE + m.pro * PRO_PRICE;
            var prevKey  = monthKeys[idx + 1];
            var growthCell = '—';
            if (prevKey) {
              var prev    = monthMap[prevKey];
              var prevRev = prev.scholar * SCHOLAR_PRICE + prev.pro * PRO_PRICE;
              if (prevRev > 0) {
                var pct = Math.round((rev - prevRev) / prevRev * 100);
                if      (pct > 0) growthCell = '<span class="rb-revenue-growth rb-revenue-growth--up">↑ '   + pct           + '%</span>';
                else if (pct < 0) growthCell = '<span class="rb-revenue-growth rb-revenue-growth--down">↓ ' + Math.abs(pct) + '%</span>';
                else              growthCell = '<span class="rb-revenue-growth">0%</span>';
              } else if (rev > 0) {
                growthCell = '<span class="rb-revenue-growth rb-revenue-growth--up">New</span>';
              }
            }
            return '<tr>'
              + '<td data-label="Month">'        + eh(m.label)   + '</td>'
              + '<td data-label="Scholar Users">' + m.scholar     + '</td>'
              + '<td data-label="Pro Users">'     + m.pro         + '</td>'
              + '<td data-label="Total Revenue">' + fmtPKR(rev)   + '</td>'
              + '<td data-label="Growth">'        + growthCell     + '</td>'
              + '</tr>';
          }).join('');
        }
      }
    }

    /* ── Bar chart (deferred until layout is complete) ──────── */
    requestAnimationFrame(function() {
      var canvas = document.getElementById('rb-revenue-chart');
      if (!canvas || !canvas.getContext) return;
      var wrap = canvas.parentElement;
      var W    = (wrap ? wrap.clientWidth : 0) || 480;
      var H    = 240;
      canvas.width  = W;
      canvas.height = H;

      var ctx     = canvas.getContext('2d');
      var isDark  = document.documentElement.getAttribute('data-theme') === 'dark';
      var textClr = isDark ? '#cbd5e1' : '#4b5563';
      var gridClr = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
      var S_CLR   = '#E8601A', P_CLR = '#4a9edd';
      var pL = 60, pR = 16, pT = 16, pB = 44;
      var cW = W - pL - pR, cH = H - pT - pB;

      var maxV = 0;
      last6.forEach(function(m) {
        var t = m.scholar * SCHOLAR_PRICE + m.pro * PRO_PRICE;
        if (t > maxV) maxV = t;
      });
      if (!maxV) maxV = 10000;
      var mag = Math.pow(10, Math.floor(Math.log10(maxV)));
      maxV = Math.ceil(maxV / mag) * mag;

      ctx.clearRect(0, 0, W, H);

      for (var g = 0; g <= 4; g++) {
        var yPct = g / 4;
        var gy   = pT + cH * (1 - yPct);
        ctx.beginPath(); ctx.strokeStyle = gridClr; ctx.lineWidth = 1;
        ctx.moveTo(pL, gy); ctx.lineTo(W - pR, gy); ctx.stroke();
        ctx.fillStyle = textClr; ctx.font = '10px Inter,sans-serif'; ctx.textAlign = 'right';
        ctx.fillText(fmtK(Math.round(yPct * maxV)), pL - 5, gy + 3.5);
      }

      var grpW = cW / last6.length;
      var bW   = Math.min(Math.floor(grpW * 0.28), 18);
      var bgap = Math.max(Math.floor(bW * 0.3), 2);

      last6.forEach(function(m, i) {
        var gx = pL + i * grpW + grpW / 2;
        var sH = m.scholar * SCHOLAR_PRICE / maxV * cH;
        var pH = m.pro     * PRO_PRICE     / maxV * cH;
        if (sH > 0) { ctx.fillStyle = S_CLR; ctx.fillRect(Math.floor(gx - bgap / 2 - bW), Math.floor(pT + cH - sH), bW, Math.ceil(sH)); }
        if (pH > 0) { ctx.fillStyle = P_CLR; ctx.fillRect(Math.floor(gx + bgap / 2),       Math.floor(pT + cH - pH), bW, Math.ceil(pH)); }
        ctx.fillStyle = textClr; ctx.font = '10px Inter,sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(m.label, gx, H - pB + 14);
      });

      var lX = pL + cW / 2 - 58, lY = H - 8;
      ctx.fillStyle = S_CLR; ctx.fillRect(lX, lY - 9, 10, 9);
      ctx.fillStyle = textClr; ctx.font = '10px Inter,sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('Scholar', lX + 14, lY);
      ctx.fillStyle = P_CLR; ctx.fillRect(lX + 72, lY - 9, 10, 9);
      ctx.fillStyle = textClr; ctx.fillText('Pro', lX + 86, lY);
    });
  }

  /* ── Boot ────────────────────────────────────────────────── */
  init();
})();
