// public/js/public-detail.js
'use strict';

(function () {
  const region = document.getElementById('detail-region');

  function getEventId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
  }

  function renderSkeleton() {
    region.innerHTML = `
      <div class="detail-layout">
        <div>
          <div class="skeleton" style="height:2rem;width:70%;margin-bottom:1rem;"></div>
          <div class="skeleton" style="height:1rem;width:100%;margin-bottom:0.5rem;"></div>
          <div class="skeleton" style="height:1rem;width:90%;margin-bottom:0.5rem;"></div>
          <div class="skeleton" style="height:1rem;width:60%;"></div>
        </div>
        <div class="skeleton" style="height:220px;"></div>
      </div>
    `;
  }

  function renderError(title, body) {
    region.innerHTML = Components.stateBlock({ title, body, variant: 'error' });
  }

  function renderEvent(event) {
    document.title = `${event.title} — IEEE ITB Events`;
    region.innerHTML = `
      <div class="detail-layout">
        <div>
          ${Components.statusChip(event.status)}
          <h1 style="margin-top: 0.75rem;">${Components.escapeHtml(event.title)}</h1>
          <p>${Components.escapeHtml(event.description)}</p>
        </div>
        <aside class="title-block" aria-label="Event details">
          <div class="title-block__row">
            <div class="title-block__label">Date</div>
            <div class="title-block__value">${Components.formatDate(event.event_date)}</div>
          </div>
          <div class="title-block__row">
            <div class="title-block__label">Location</div>
            <div class="title-block__value">${Components.escapeHtml(event.location)}</div>
          </div>
          <div class="title-block__row">
            <div class="title-block__label">Status</div>
            <div class="title-block__value">${Components.STATUS_LABEL[event.status] || event.status}</div>
          </div>
          <div class="title-block__row">
            <div class="title-block__label">Ref No.</div>
            <div class="title-block__value">EVT-${String(event.id).padStart(4, '0')}</div>
          </div>
        </aside>
      </div>
    `;
  }

  async function load() {
    const id = getEventId();
    if (!id) {
      renderError('No event specified', 'This link is missing an event id. Head back to the events list and pick one.');
      return;
    }
    renderSkeleton();
    try {
      const data = await Api.getEvent(id);
      renderEvent(data.event);
    } catch (err) {
      if (err.status === 404) {
        renderError('Event not found', 'This event may have been removed or the link is incorrect.');
      } else {
        renderError('Couldn\u2019t load this event', err.message);
      }
    }
  }

  load();
})();
