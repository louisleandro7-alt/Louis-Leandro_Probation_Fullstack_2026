// public/js/api.js
// Single reusable service layer for talking to the backend. Every page uses
// this instead of calling fetch() directly, so there's one place that knows
// about response shape, error format, and auth cookies.
'use strict';

const Api = (() => {
  async function request(path, options = {}) {
    const { method = 'GET', body, headers } = options;
    const res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(headers || {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    let json = null;
    try {
      json = await res.json();
    } catch {
      // No/invalid JSON body (e.g. network hiccup) — handled below.
    }

    if (!res.ok) {
      const message = (json && json.error && json.error.message) || `Request failed (${res.status})`;
      const err = new Error(message);
      err.status = res.status;
      err.fields = (json && json.error && json.error.fields) || null;
      throw err;
    }

    return json ? json.data : null;
  }

  function toQueryString(params) {
    const usable = Object.entries(params || {}).filter(
      ([, v]) => v !== '' && v !== undefined && v !== null
    );
    const qs = new URLSearchParams(usable).toString();
    return qs ? `?${qs}` : '';
  }

  return {
    getEvents: (params) => request(`/api/events${toQueryString(params)}`),
    getEvent: (id) => request(`/api/events/${encodeURIComponent(id)}`),
    createEvent: (payload) => request('/api/events', { method: 'POST', body: payload }),
    updateEvent: (id, payload) =>
      request(`/api/events/${encodeURIComponent(id)}`, { method: 'PUT', body: payload }),
    deleteEvent: (id) => request(`/api/events/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    login: (payload) => request('/api/auth/login', { method: 'POST', body: payload }),
    logout: () => request('/api/auth/logout', { method: 'POST' }),
    me: () => request('/api/auth/me'),
  };
})();
