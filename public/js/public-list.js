// public/js/public-list.js
'use strict';

(function () {
  const region = document.getElementById('events-region');
  const skeletonGrid = document.getElementById('skeleton-grid');
  const searchInput = document.getElementById('search-input');
  const tabGroup = document.getElementById('status-tabs');
  const pagination = document.getElementById('pagination');

  skeletonGrid.innerHTML = Components.skeletonCards(6);

  const state = { search: '', status: '', page: 1 };
  let debounceTimer = null;
  let requestToken = 0;

  function renderLoading() {
    region.innerHTML = `<div class="event-grid">${Components.skeletonCards(6)}</div>`;
    pagination.hidden = true;
  }

  function renderError(message) {
    region.innerHTML = Components.stateBlock({
      title: 'Couldn\u2019t load events',
      body: message || 'Something went wrong while reaching the server. Please try again.',
      variant: 'error',
    });
    pagination.hidden = true;
  }

  function renderEmpty() {
    const hasFilters = state.search || state.status;
    region.innerHTML = Components.stateBlock({
      title: hasFilters ? 'No matching events' : 'No events yet',
      body: hasFilters
        ? 'Try a different search term or clear the status filter.'
        : 'Check back soon — new events will show up here as soon as they\u2019re added.',
    });
    pagination.hidden = true;
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
      state.page = state.page + 1;
      load();
    });
  }

  async function load() {
    renderLoading();
    const myToken = ++requestToken;
    try {
      const data = await Api.getEvents({
        search: state.search,
        status: state.status,
        page: state.page,
        limit: 9,
      });
      if (myToken !== requestToken) return; // a newer request superseded this one
      if (!data.events.length) {
        renderEmpty();
        return;
      }
      region.innerHTML = `<div class="event-grid">${data.events.map(Components.eventCard).join('')}</div>`;
      renderPagination(data.pagination);
    } catch (err) {
      if (myToken !== requestToken) return;
      renderError(err.message);
    }
  }

  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
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

  load();
})();
