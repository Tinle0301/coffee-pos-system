export async function callService(service, label, ...args) {
  try {
    return await service(...args);
  } catch (error) {
    return {
      data: null,
      error: {
        message: error instanceof Error ? error.message : `${label} failed`,
        code: error?.code,
      },
    };
  }
}

export function todayISO() {
  return toISODate(new Date());
}

export function toISODate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function parseISODate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatMoney(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount ?? 0));
}

export function formatDateTime(value) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}