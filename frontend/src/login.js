
import { login } from './backend/auth.js';

/**
 * Renders the login screen into `container` and wires up its behavior.
 * @param {HTMLElement} container
 * @param {{ onLoginSuccess: (staff: object) => void }} options
 */
export function renderLoginScreen(container, { onLoginSuccess }) {
  container.innerHTML = `
    <div class="login-screen">
      <div class="screen-container login-card">
        <div class="login-mark" aria-hidden="true">&#9749;</div>
        <h1 class="login-title">Start your shift</h1>
        <p class="login-subtitle">Sign in to open the register.</p>

        <form id="login-form" novalidate>
          <label class="field-label" for="login-email">Email</label>
          <input
            id="login-email"
            name="email"
            type="email"
            inputmode="email"
            autocomplete="username"
            required
          />

          <label class="field-label" for="login-password">Password</label>
          <div class="password-row">
            <input
              id="login-password"
              name="password"
              type="password"
              autocomplete="current-password"
              required
            />
            <button type="button" id="toggle-password" class="btn-ghost" aria-label="Show password">Show</button>
          </div>

          <p id="login-error" class="error" role="alert" hidden></p>

          <button type="submit" id="login-submit">
            <span id="login-submit-label">Log in</span>
          </button>
        </form>
      </div>
    </div>
  `;

  const form = container.querySelector('#login-form');
  const emailInput = container.querySelector('#login-email');
  const passwordInput = container.querySelector('#login-password');
  const toggleBtn = container.querySelector('#toggle-password');
  const submitBtn = container.querySelector('#login-submit');
  const submitLabel = container.querySelector('#login-submit-label');
  const errorBox = container.querySelector('#login-error');

  toggleBtn.addEventListener('click', () => {
    const willShow = passwordInput.type === 'password';
    passwordInput.type = willShow ? 'text' : 'password';
    toggleBtn.textContent = willShow ? 'Hide' : 'Show';
    toggleBtn.setAttribute('aria-label', willShow ? 'Hide password' : 'Show password');
  });

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function hideError() {
    errorBox.hidden = true;
    errorBox.textContent = '';
  }

  function setSubmitting(isSubmitting) {
    submitBtn.disabled = isSubmitting;
    submitLabel.textContent = isSubmitting ? 'Logging in…' : 'Log in';
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideError();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showError('Enter your email and password.');
      return;
    }

    if (submitBtn.disabled) return; // guard against double-tap
    setSubmitting(true);

    // Real auth.js never throws — it always returns { data, error }.
    const { data: staff, error } = await login(email, password);

    setSubmitting(false);

    if (error) {
      // error.message is already safe to show as-is (see auth.js's own
      // comment: it never leaks whether an account exists).
      showError(error.message);
      return;
    }

    onLoginSuccess(staff);
  });
}
