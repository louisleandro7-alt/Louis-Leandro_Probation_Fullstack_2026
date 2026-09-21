// public/js/admin-login.js
'use strict';

(function () {
  const form = document.getElementById('login-form');
  const alertBox = document.getElementById('form-alert');
  const submitBtn = document.getElementById('submit-btn');

  function showAlert(message) {
    alertBox.textContent = message;
    alertBox.classList.add('is-visible');
  }

  function hideAlert() {
    alertBox.classList.remove('is-visible');
  }

  // If already logged in, skip straight to the dashboard.
  Api.me().then(() => {
    window.location.href = '/admin/dashboard.html';
  }).catch(() => { /* not logged in — stay on this page */ });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();
    Components.applyFieldErrors(form, null);

    const username = form.username.value.trim();
    const password = form.password.value;

    if (!username || !password) {
      Components.applyFieldErrors(form, {
        ...(username ? {} : { username: 'Username is required.' }),
        ...(password ? {} : { password: 'Password is required.' }),
      });
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in\u2026';
    try {
      await Api.login({ username, password });
      window.location.href = '/admin/dashboard.html';
    } catch (err) {
      if (err.fields) {
        Components.applyFieldErrors(form, err.fields);
      } else {
        showAlert(err.message || 'Sign in failed. Please try again.');
      }
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign in';
    }
  });
})();
