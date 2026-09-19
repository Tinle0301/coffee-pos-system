// Login.js
import { login } from './Auth.stub.js';
// TODO: once backend/services/auth.js exists, switch the import above to that.

const form = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const submitBtn = document.getElementById('login-submit');
const errorBox = document.getElementById('login-error');
const successBox = document.getElementById('login-success');
const successName = document.getElementById('success-name');
const logoutBtn = document.getElementById('logout-btn');

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
  submitBtn.querySelector('.btn-label').textContent = isSubmitting
    ? 'Logging in…'
    : 'Log in';
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

  if (submitBtn.disabled) return;

  setSubmitting(true);

  const { data: employee, error } = await login(email, password);

  setSubmitting(false);

  if (error) {
    showError('Incorrect email or password.');
    return;
  }

  sessionStorage.setItem('employee', JSON.stringify(employee));

  form.hidden = true;
  successName.textContent = employee.employee_name;
  successBox.hidden = false;

  window.location.replace('Neworder.html');
});

logoutBtn.addEventListener('click', () => {
  sessionStorage.removeItem('employee');
  window.location.replace(window.location.pathname);
});