// src/login.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderLoginScreen } from './login.js';
import * as auth from './auth.js';

function getEls() {
  return {
    emailInput: document.getElementById('login-email'),
    passwordInput: document.getElementById('login-password'),
    submitBtn: document.getElementById('login-submit'),
    submitLabel: document.getElementById('login-submit-label'),
    errorBox: document.getElementById('login-error'),
    form: document.getElementById('login-form'),
  };
}

describe('renderLoginScreen', () => {
  let container;
  let onLoginSuccess;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    container = document.getElementById('app');
    onLoginSuccess = vi.fn();
    renderLoginScreen(container, { onLoginSuccess });
  });

  it('shows a validation message when submitted empty', async () => {
    const { form, errorBox } = getEls();
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();

    expect(errorBox.hidden).toBe(false);
    expect(errorBox.textContent).toBe('Enter your email and password.');
    expect(onLoginSuccess).not.toHaveBeenCalled();
  });

  it('shows a generic error on invalid credentials, never the raw message', async () => {
    vi.spyOn(auth, 'login').mockRejectedValueOnce(new Error('Invalid credentials'));
    const { form, emailInput, passwordInput, errorBox } = getEls();

    emailInput.value = 'wrong@demo.com';
    passwordInput.value = 'wrongpass';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(errorBox.hidden).toBe(false);
    expect(errorBox.textContent).toBe('Incorrect email or password.');
  });

  it('calls onLoginSuccess with the user on valid credentials', async () => {
    const fakeUser = { userIdentifier: '1', userRoleType: 'barista', employeeName: 'Alex Rivera' };
    vi.spyOn(auth, 'login').mockResolvedValueOnce(fakeUser);
    const { form, emailInput, passwordInput } = getEls();

    emailInput.value = 'barista@demo.com';
    passwordInput.value = 'password123';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(onLoginSuccess).toHaveBeenCalledWith(fakeUser);
  });

  it('disables the submit button and shows a loading label while submitting', async () => {
    let resolveLogin;
    vi.spyOn(auth, 'login').mockReturnValueOnce(
      new Promise((resolve) => {
        resolveLogin = resolve;
      })
    );
    const { form, emailInput, passwordInput, submitBtn, submitLabel } = getEls();

    emailInput.value = 'barista@demo.com';
    passwordInput.value = 'password123';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();

    expect(submitBtn.disabled).toBe(true);
    expect(submitLabel.textContent).toBe('Logging in\u2026');

    resolveLogin({ userIdentifier: '1', userRoleType: 'barista', employeeName: 'Alex Rivera' });
    await new Promise((r) => setTimeout(r, 0));
  });

  it('toggles the password field type when Show/Hide is clicked', () => {
    const { passwordInput } = getEls();
    const toggleBtn = document.getElementById('toggle-password');

    expect(passwordInput.type).toBe('password');
    toggleBtn.click();
    expect(passwordInput.type).toBe('text');
    toggleBtn.click();
    expect(passwordInput.type).toBe('password');
  });
});
