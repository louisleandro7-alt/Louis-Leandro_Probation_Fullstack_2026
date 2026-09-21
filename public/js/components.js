// public/js/components.js
// Small, framework-free "components": pure functions that turn data into
// HTML strings or DOM nodes. Reused across public and admin pages so markup
// for a status chip, a date, or a card only lives in one place.
'use strict';

const Components = (() => {
  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]));
  }

  const STATUS_LABEL = {
    upcoming: 'Upcoming',
    ongoing: 'Ongoing',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };

  function statusChip(status) {
    const label = STATUS_LABEL[status] || status;
    return `<span class="chip chip-${escapeHtml(status)}">${escapeHtml(label)}</span>`;
  }

  function formatDate(isoString, { withTime = true } = {}) {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return 'Unknown date';
    const dateOpts = { year: 'numeric', month: 'short', day: 'numeric' };
    const timeOpts = { hour: '2-digit', minute: '2-digit' };
    const datePart = date.toLocaleDateString(undefined, dateOpts);
    if (!withTime) return datePart;
    const timePart = date.toLocaleTimeString(undefined, timeOpts);
    return `${datePart} \u00b7 ${timePart}`;
  }

  function eventCard(event) {
    const excerpt = event.description.length > 120
      ? `${event.description.slice(0, 117)}...`
      : event.description;
    return `
      <a class="event-card" href="/event.html?id=${encodeURIComponent(event.id)}">
        <span class="event-card__date">${formatDate(event.event_date)}</span>
        <h3 class="event-card__title">${escapeHtml(event.title)}</h3>
        <span class="event-card__location">${escapeHtml(event.location)}</span>
        <p class="event-card__excerpt">${escapeHtml(excerpt)}</p>
        ${statusChip(event.status)}
      </a>
    `;
  }

  function skeletonCards(count = 6) {
    return Array.from({ length: count })
      .map(() => '<div class="skeleton skeleton-card"></div>')
      .join('');
  }

  function stateBlock({ title, body, variant = '' }) {
    return `
      <div class="state-block ${variant ? `state-block--${variant}` : ''}">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(body)}</p>
      </div>
    `;
  }

  function showToast(message, { isError = false } = {}) {
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.toggle('is-error', isError);
    toast.classList.add('is-visible');
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => toast.classList.remove('is-visible'), 3200);
  }

  // Applies backend field errors (or a single message) onto a <form>'s
  // .form-field wrappers, matching by [data-field] attribute.
  function applyFieldErrors(form, fields) {
    form.querySelectorAll('.form-field').forEach((el) => {
      el.classList.remove('has-error');
      const msgEl = el.querySelector('.field-error');
      if (msgEl) msgEl.textContent = '';
    });
    if (!fields) return;
    Object.entries(fields).forEach(([field, message]) => {
      const wrapper = form.querySelector(`[data-field="${field}"]`);
      if (!wrapper) return;
      wrapper.classList.add('has-error');
      const msgEl = wrapper.querySelector('.field-error');
      if (msgEl) msgEl.textContent = message;
    });
  }

  return {
    escapeHtml,
    statusChip,
    formatDate,
    eventCard,
    skeletonCards,
    stateBlock,
    showToast,
    applyFieldErrors,
    STATUS_LABEL,
  };
})();
