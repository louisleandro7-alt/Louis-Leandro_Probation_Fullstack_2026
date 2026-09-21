// public/js/admin-dashboard.js
'use strict';

(function () {
  const tableRegion = document.getElementById('table-region');
  const pagination = document.getElementById('pagination');
  const searchInput = document.getElementById('search-input');
  const tabGroup = document.getElementById('status-tabs');
  const usernameEl = document.getElementById('admin-username');
  const logoutBtn = document.getElementById('logout-btn');

  const eventModalOverlay = document.getElementById('event-modal-overlay');
  const eventForm = document.getElementById('event-form');
  const eventModalTitle = document.getElementById('event-modal-title');
  const eventFormAlert = document.getElementById('event-form-alert');
  const saveBtn = document.getElementById('save-event-btn');
  const addBtn = document.getElementById('add-event-btn');
  const cancelFormBtn = document.getElementById('cancel-form-btn');

  const confirmOverlay = document.getElementById('confirm-modal-overlay');
  const confirmBody = document.getElementById('confirm-body');
  const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
  const confirmCancelBtn = document.getElementById('confirm-cancel-btn');

  const state = { search: '', status: '', page: 1 };
  let currentEvents = [];
  let pendingDeleteId = null;

  // ---------- Auth guard ----------
  Api.me()
    .then((data) => {
      usernameEl.textContent = `Signed in as ${data.admin.username}`;
      load();
    })
    .catch(() => {
      window.location.href = '/admin/login.html';
    });

  logoutBtn.addEventListener('click', async () => {
    try {
      await Api.logout();
    } finally {
      window.location.href = '/admin/login.html';
    }
  });

  // ---------- Date helpers ----------
  function pad(n) { return String(n).padStart(2, '0'); }

  function isoToLocalInputValue(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function localInputValueToIso(value) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  // ---------- Table rendering ----------
  function renderLoading() {
    tableRegion.innerHTML = `
      <div class="table-wrap">
        <div style="padding: 1.5rem; display:grid; gap:0.75rem;">
          ${Array.from({ length: 4 }).map(() => '<div class="skeleton" style="height:2.25rem;"></div>').join('')}
        </div>
      </div>
    `;
    pagination.hidden = true;
  }

  function renderError(message) {
    tableRegion.innerHTML = Components.stateBlock({
      title: 'Couldn\u2019t load events',
      body: message || 'Something went wrong while reaching the server. Please try again.',
      variant: 'error',
    });
    pagination.hidden = true;
  }

  function renderEmpty() {
    const hasFilters = state.search || state.status;
    tableRegion.innerHTML = Components.stateBlock({
      title: hasFilters ? 'No matching events' : 'No events yet',
      body: hasFilters
        ? 'Try a different search term or clear the status filter.'
        : 'Click "Add event" above to create the first one.',
    });
    pagination.hidden = true;
  }

  function renderTable(events) {
    const rows = events.map((ev) => `
      <tr data-id="${ev.id}">
        <td>${Components.escapeHtml(ev.title)}</td>
        <td>${Components.formatDate(ev.event_date)}</td>
        <td>${Components.escapeHtml(ev.location)}</td>
        <td>${Components.statusChip(ev.status)}</td>
        <td>
          <div class="row-actions">
            <button type="button" class="btn btn-secondary btn-sm" data-action="edit" data-id="${ev.id}">Edit</button>
            <button type="button" class="btn btn-danger btn-sm" data-action="delete" data-id="${ev.id}">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');

    tableRegion.innerHTML = `
      <div class="table-wrap">
        <table class="events-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Date</th>
              <th>Location</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function renderPagination(meta) {
    if (meta.totalPages <= 1) {
      pagination.hidden = true;
      return;
    }
    pagination.hidden = false;
    pagination.innerHTML = `
      <button class="btn btn-secondary btn-sm" id="prev-page" ${meta.page <= 1 ? 'disabled' : ''}>Previous</button>
      <span>Page ${meta.page} of ${meta.totalPages}</span>
      <button class="btn btn-secondary btn-sm" id="next-page" ${meta.page >= meta.totalPages ? 'disabled' : ''}>Next</button>
    `;
    document.getElementById('prev-page').addEventListener('click', () => {
      state.page = Math.max(1, state.page - 1);
      load();
    });
    document.getElementById('next-page').addEventListener('click', () => {
      state.page += 1;
      load();
    });
  }

  let requestToken = 0;
  async function load() {
    renderLoading();
    const myToken = ++requestToken;
    try {
      const data = await Api.getEvents({
        search: state.search,
        status: state.status,
        page: state.page,
        limit: 8,
      });
      if (myToken !== requestToken) return;
      currentEvents = data.events;
      if (!data.events.length) {
        renderEmpty();
        return;
      }
      renderTable(data.events);
      renderPagination(data.pagination);
    } catch (err) {
      if (myToken !== requestToken) return;
      if (err.status === 401) {
        window.location.href = '/admin/login.html';
        return;
      }
      renderError(err.message);
    }
  }

  searchInput.addEventListener('input', () => {
    clearTimeout(searchInput._t);
    searchInput._t = setTimeout(() => {
      state.search = searchInput.value.trim();
      state.page = 1;
      load();
    }, 300);
  });

  tabGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-status]');
    if (!btn) return;
    tabGroup.querySelectorAll('button').forEach((b) => {
      b.classList.remove('is-active');
      b.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('is-active');
    btn.setAttribute('aria-selected', 'true');
    state.status = btn.dataset.status;
    state.page = 1;
    load();
  });

  // ---------- Add / Edit modal ----------
  function openEventModal(event) {
    eventForm.reset();
    Components.applyFieldErrors(eventForm, null);
    eventFormAlert.classList.remove('is-visible');
    document.getElementById('event-id').value = event ? event.id : '';
    eventModalTitle.textContent = event ? 'Edit event' : 'Add event';

    if (event) {
      document.getElementById('title').value = event.title;
      document.getElementById('description').value = event.description;
      document.getElementById('event_date').value = isoToLocalInputValue(event.event_date);
      document.getElementById('status').value = event.status;
      document.getElementById('location').value = event.location;
      document.getElementById('image_url').value = event.image_url || '';
    } else {
      document.getElementById('status').value = 'upcoming';
    }

    eventModalOverlay.classList.add('is-open');
    document.getElementById('title').focus();
  }

  function closeEventModal() {
    eventModalOverlay.classList.remove('is-open');
  }

  addBtn.addEventListener('click', () => openEventModal(null));
  cancelFormBtn.addEventListener('click', closeEventModal);
  eventModalOverlay.addEventListener('click', (e) => {
    if (e.target === eventModalOverlay) closeEventModal();
  });

  tableRegion.addEventListener('click', (e) => {
    const editBtn = e.target.closest('[data-action="edit"]');
    if (editBtn) {
      const ev = currentEvents.find((x) => String(x.id) === editBtn.dataset.id);
      if (ev) openEventModal(ev);
      return;
    }
    const deleteBtn = e.target.closest('[data-action="delete"]');
    if (deleteBtn) {
      const ev = currentEvents.find((x) => String(x.id) === deleteBtn.dataset.id);
      openDeleteConfirm(ev);
    }
  });

  eventForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    Components.applyFieldErrors(eventForm, null);
    eventFormAlert.classList.remove('is-visible');

    const id = document.getElementById('event-id').value;
    const isoDate = localInputValueToIso(document.getElementById('event_date').value);

    const payload = {
      title: document.getElementById('title').value.trim(),
      description: document.getElementById('description').value.trim(),
      event_date: isoDate,
      status: document.getElementById('status').value,
      location: document.getElementById('location').value.trim(),
      image_url: document.getElementById('image_url').value.trim() || null,
    };

    // Lightweight client-side pre-check for a snappier UX; the server is the
    // real source of truth and re-validates everything regardless.
    const clientErrors = {};
    if (payload.title.length < 3) clientErrors.title = 'Title must be at least 3 characters.';
    if (payload.description.length < 10) clientErrors.description = 'Description must be at least 10 characters.';
    if (!isoDate) clientErrors.event_date = 'Please choose a valid date and time.';
    if (payload.location.length < 2) clientErrors.location = 'Location is required.';
    if (Object.keys(clientErrors).length) {
      Components.applyFieldErrors(eventForm, clientErrors);
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving\u2026';
    try {
      if (id) {
        await Api.updateEvent(id, payload);
        Components.showToast('Event updated.');
      } else {
        await Api.createEvent(payload);
        Components.showToast('Event created.');
      }
      closeEventModal();
      load();
    } catch (err) {
      if (err.status === 401) {
        window.location.href = '/admin/login.html';
        return;
      }
      if (err.fields) {
        Components.applyFieldErrors(eventForm, err.fields);
      } else {
        eventFormAlert.textContent = err.message || 'Could not save this event.';
        eventFormAlert.classList.add('is-visible');
      }
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save event';
    }
  });

  // ---------- Delete confirmation ----------
  function openDeleteConfirm(event) {
    if (!event) return;
    pendingDeleteId = event.id;
    confirmBody.textContent = `"${event.title}" will be permanently removed. This can\u2019t be undone.`;
    confirmOverlay.classList.add('is-open');
  }

  function closeDeleteConfirm() {
    confirmOverlay.classList.remove('is-open');
    pendingDeleteId = null;
  }

  confirmCancelBtn.addEventListener('click', closeDeleteConfirm);
  confirmOverlay.addEventListener('click', (e) => {
    if (e.target === confirmOverlay) closeDeleteConfirm();
  });

  confirmDeleteBtn.addEventListener('click', async () => {
    if (!pendingDeleteId) return;
    confirmDeleteBtn.disabled = true;
    confirmDeleteBtn.textContent = 'Deleting\u2026';
    try {
      await Api.deleteEvent(pendingDeleteId);
      Components.showToast('Event deleted.');
      closeDeleteConfirm();
      load();
    } catch (err) {
      Components.showToast(err.message || 'Could not delete this event.', { isError: true });
    } finally {
      confirmDeleteBtn.disabled = false;
      confirmDeleteBtn.textContent = 'Delete event';
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeEventModal();
      closeDeleteConfirm();
    }
  });
})();
