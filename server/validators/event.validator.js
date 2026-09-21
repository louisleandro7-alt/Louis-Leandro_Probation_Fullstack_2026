// server/validators/event.validator.js
// Backend validation for event create/update payloads. The frontend also
// validates for good UX, but the API never trusts the client.
'use strict';

const VALID_STATUSES = ['upcoming', 'ongoing', 'completed', 'cancelled'];

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

// Returns { valid: boolean, errors: { field: message }, clean: {...} }
function validateEventPayload(body, { partial = false } = {}) {
  const errors = {};
  const clean = {};
  body = body || {};

  // title
  if (!partial || body.title !== undefined) {
    if (!isNonEmptyString(body.title)) {
      errors.title = 'Title is required.';
    } else if (body.title.trim().length < 3 || body.title.trim().length > 150) {
      errors.title = 'Title must be between 3 and 150 characters.';
    } else {
      clean.title = body.title.trim();
    }
  }

  // description
  if (!partial || body.description !== undefined) {
    if (!isNonEmptyString(body.description)) {
      errors.description = 'Description is required.';
    } else if (body.description.trim().length < 10 || body.description.trim().length > 5000) {
      errors.description = 'Description must be between 10 and 5000 characters.';
    } else {
      clean.description = body.description.trim();
    }
  }

  // event_date
  if (!partial || body.event_date !== undefined) {
    const date = new Date(body.event_date);
    if (!body.event_date || Number.isNaN(date.getTime())) {
      errors.event_date = 'A valid event date is required.';
    } else {
      clean.event_date = date.toISOString();
    }
  }

  // location
  if (!partial || body.location !== undefined) {
    if (!isNonEmptyString(body.location)) {
      errors.location = 'Location is required.';
    } else if (body.location.trim().length < 2 || body.location.trim().length > 200) {
      errors.location = 'Location must be between 2 and 200 characters.';
    } else {
      clean.location = body.location.trim();
    }
  }

  // status
  if (!partial || body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      errors.status = `Status must be one of: ${VALID_STATUSES.join(', ')}.`;
    } else {
      clean.status = body.status;
    }
  }

  // image_url (optional)
  if (body.image_url !== undefined && body.image_url !== null && body.image_url !== '') {
    if (typeof body.image_url !== 'string' || body.image_url.trim().length > 2000) {
      errors.image_url = 'Image URL is invalid.';
    } else {
      try {
        // eslint-disable-next-line no-new
        new URL(body.image_url.trim());
        clean.image_url = body.image_url.trim();
      } catch {
        errors.image_url = 'Image URL must be a valid absolute URL.';
      }
    }
  } else if (body.image_url === '' || body.image_url === null) {
    clean.image_url = null;
  }

  return { valid: Object.keys(errors).length === 0, errors, clean };
}

module.exports = { validateEventPayload, VALID_STATUSES };
