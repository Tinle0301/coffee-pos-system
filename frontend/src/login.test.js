import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderLoginScreen } from './login.js';
import { login } from './backend/auth.js';

// Node can't load the CDN-based supabase-client.js chain, so mock auth.js
// (the same module login.js imports).
vi.mock('./backend/auth.js', () => ({ login: vi.fn() }));

const $ = (selector) => document.querySelector(selector);
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function fillAndSubmit(email, password) {
  $('#login-email').value = email;
  $('#login-password').value = password;
  $('#login-form').dispatchEvent(new Event('submit', { cancelable: true }));
}

describe('POS-10: Login screen', () => {
  let onLoginSuccess;

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '<div id="root"></div>';
    onLoginSuccess = vi.fn();
    renderLoginScreen($('#root'), { onLoginSuccess });
  });

  it('renders email, password and a Log in button', () => {
    expect($('#login-email').type).toBe('email');
    expect($('#login-password').type).toBe('password');
    expect($('#login-submit').textContent.trim()).toBe('Log in');
    expect($('#login-error').hidden).toBe(true);
  });

  it('asks for both fields without calling the backend', () => {
    fillAndSubmit('', '');
    expect($('#login-error').hidden).toBe(false);
    expect($('#login-error').textContent).toBe('Enter your email and password.');
    expect(login).not.toHaveBeenCalled();
  });

  it('signs in and hands the staff profile to main.js', async () => {
    const staff = { staffAccountIdentifier: 'abc', staffFullName: 'Ana B', staffRoleType: 'Barista' };
    login.mockResolvedValue({ data: staff, error: null });

    fillAndSubmit('ana@cafe.test', 'secret');
    expect($('#login-submit').disabled).toBe(true); // double-tap guard while waiting
    expect($('#login-submit-label').textContent).toBe('Logging in…');
    await flush();

    expect(login).toHaveBeenCalledWith('ana@cafe.test', 'secret');
    expect(onLoginSuccess).toHaveBeenCalledWith(staff);
  });

  it('shows the backend message and re-enables the button on wrong credentials', async () => {
    login.mockResolvedValue({ data: null, error: { code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password.' } });

    fillAndSubmit('ana@cafe.test', 'wrong');
    await flush();

    expect($('#login-error').textContent).toBe('Incorrect email or password.');
    expect($('#login-submit').disabled).toBe(false);
    expect($('#login-submit-label').textContent).toBe('Log in');
    expect(onLoginSuccess).not.toHaveBeenCalled();
  });

  it('clears the old error when trying again', async () => {
    fillAndSubmit('', '');
    expect($('#login-error').hidden).toBe(false);

    login.mockResolvedValue({ data: { staffAccountIdentifier: 'abc' }, error: null });
    fillAndSubmit('ana@cafe.test', 'secret');
    expect($('#login-error').hidden).toBe(true);
    await flush();
  });

  it('shows and hides the password', () => {
    $('#toggle-password').click();
    expect($('#login-password').type).toBe('text');
    expect($('#toggle-password').textContent).toBe('Hide');

    $('#toggle-password').click();
    expect($('#login-password').type).toBe('password');
    expect($('#toggle-password').textContent).toBe('Show');
  });
});
