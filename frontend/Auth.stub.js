// src/js/services/auth.stub.js
// TEMPORARY — delete this file once backend/services/auth.js is merged.
// Swap the import in login.js from this file to '../../backend/services/auth.js'
// when that lands. Shape must match ../../../docs/API_CONTRACT.md.

const DEMO_ACCOUNTS = [
  { email: 'barista@demo.com', password: 'password123', employee_id: '1', employee_name: 'Alex Rivera', role: 'barista' },
  { email: 'manager@demo.com', password: 'password123', employee_id: '2', employee_name: 'Jordan Lee', role: 'manager' },
];

/**
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ data: { employee_id: string, employee_name: string, role: string } | null, error: { message: string } | null }>}
 */
export async function login(email, password) {
  // simulate network latency so loading/disabled states are testable
  await new Promise((resolve) => setTimeout(resolve, 500));

  const account = DEMO_ACCOUNTS.find(
    (a) => a.email === email && a.password === password
  );

  if (!account) {
    return { data: null, error: { message: 'Invalid credentials' } };
  }

  const { password: _omit, ...employee } = account;
  return { data: employee, error: null };
}