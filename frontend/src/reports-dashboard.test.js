// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  reportsDashboardScreen as screen, formatMoney, formatHour, hourWindow, presetRange, wholePercents,
} from './reports-dashboard.js';
import { loadDashboard } from './dashboard-api.js';

vi.mock('./dashboard-api.js', () => ({
  PAYMENT_METHODS: ['Cash', 'Credit/Debit', 'Mobile Pay'],
  reportToday: () => '2026-10-20',
  addDays: (iso, n) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
  },
  loadDashboard: vi.fn(),
}));

const hours = (counts) => Array.from({ length: 24 }, (_, h) => ({ hourOfDay: h, orderCount: counts[h] ?? 0 }));
const activityOk = () => ({
  data: {
    bestSellers: [
      { menuItemIdentifier: 'a', menuItemName: 'Latte', quantitySold: 40, grossItemRevenue: 180 },
      { menuItemIdentifier: 'b', menuItemName: 'Drip Coffee', quantitySold: 20, grossItemRevenue: 55 },
    ],
    busiestHours: hours({ 8: 12, 9: 20, 14: 5 }),
  },
  error: null,
});
const paymentsOk = () => ({
  data: { totals: { Cash: 25, 'Credit/Debit': 50, 'Mobile Pay': 25 }, revenue: 100, orderCount: 4, truncated: false },
  error: null,
});

describe('formatting helpers', () => {
  it('formats money with thousands separators', () => {
    expect(formatMoney(1234.5)).toBe('$1,234.50');
    expect(formatMoney(0)).toBe('$0.00');
  });

  it('formats hours on a 12-hour clock', () => {
    expect(formatHour(0)).toBe('12 AM');
    expect(formatHour(9)).toBe('9 AM');
    expect(formatHour(12)).toBe('12 PM');
    expect(formatHour(23)).toBe('11 PM');
  });

  it('shows 5 AM to 9 PM by default and widens for odd hours', () => {
    expect(hourWindow(hours({ 9: 3 }))).toEqual({ first: 5, last: 21 });
    expect(hourWindow(hours({ 3: 1, 23: 2 }))).toEqual({ first: 3, last: 23 });
  });

  it('rounds percentages so they always add up to 100', () => {
    expect(wholePercents([612.25, 1480.5, 390.75])).toEqual([25, 59, 16]);
    expect(wholePercents([1, 1, 1]).reduce((a, b) => a + b, 0)).toBe(100);
    expect(wholePercents([0, 0, 0])).toEqual([0, 0, 0]);
    expect(wholePercents([50, 0, 50])).toEqual([50, 0, 50]);
  });

  it('builds preset ranges ending today', () => {
    expect(presetRange('today')).toEqual({ startDate: '2026-10-20', endDate: '2026-10-20' });
    expect(presetRange('7')).toEqual({ startDate: '2026-10-14', endDate: '2026-10-20' });
    expect(presetRange('30')).toEqual({ startDate: '2026-09-21', endDate: '2026-10-20' });
  });
});

describe('section rendering', () => {
  const $ = (html) => { document.body.innerHTML = html; return document.body; };

  it('summarises revenue, orders and average order', () => {
    const body = $(screen.renderSummary(paymentsOk()));
    expect(body.textContent).toContain('$100.00');
    expect(body.textContent).toContain('$25.00'); // 100 / 4
    expect(body.querySelectorAll('.rd-stat')).toHaveLength(3);
  });

  it('renders nothing for the summary when payments failed', () => {
    expect(screen.renderSummary({ data: null, error: { message: 'x' } })).toBe('');
  });

  it('ranks best sellers with quantity and revenue', () => {
    const body = $(screen.renderBestSellers(activityOk()));
    const rows = [...body.querySelectorAll('.rd-best-row')];
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Latte');
    expect(rows[0].textContent).toContain('40');
    expect(rows[0].textContent).toContain('$180.00');
    expect(rows[0].querySelector('.rd-bar span').style.width).toBe('100%');
    expect(rows[1].querySelector('.rd-bar span').style.width).toBe('50%');
  });

  it('escapes item names', () => {
    const a = activityOk();
    a.data.bestSellers[0].menuItemName = '<img src=x onerror=alert(1)>';
    expect($(screen.renderBestSellers(a)).querySelector('img')).toBeNull();
  });

  it('says so when nothing sold', () => {
    const a = { data: { bestSellers: [], busiestHours: hours({}) }, error: null };
    expect($(screen.renderBestSellers(a)).textContent).toContain('No items sold');
    expect($(screen.renderHours(a)).textContent).toContain('No orders');
  });

  it('highlights the peak hour and names it', () => {
    const body = $(screen.renderHours(activityOk()));
    expect(body.querySelector('.rd-hours-summary').textContent).toContain('9 AM–10 AM');
    expect(body.querySelector('.rd-hours-summary').textContent).toContain('20 orders');
    const peaks = body.querySelectorAll('.rd-hour.is-peak');
    expect(peaks).toHaveLength(1);
    expect(peaks[0].textContent).toContain('9 AM: 20 orders');
    expect(body.querySelectorAll('.rd-hour')).toHaveLength(17); // 5 AM..9 PM
  });

  it('mentions a tie for busiest hour', () => {
    const a = { data: { bestSellers: [], busiestHours: hours({ 8: 7, 15: 7 }) }, error: null };
    expect($(screen.renderHours(a)).querySelector('.rd-hours-summary').textContent).toContain('tied with 1 other hour');
  });

  it('shows each payment method with amount and percent', () => {
    const body = $(screen.renderPayments(paymentsOk()));
    const rows = [...body.querySelectorAll('.rd-pay-row')];
    expect(rows.map((r) => r.querySelector('.rd-pay-name').textContent)).toEqual(['Cash', 'Credit/Debit', 'Mobile Pay']);
    expect(rows[1].textContent).toContain('$50.00');
    expect(rows[1].querySelector('.rd-pay-pct').textContent).toBe('50%');
    expect(body.querySelector('.rd-pay-bar').getAttribute('aria-label')).toBe('Cash 25%, Credit/Debit 50%, Mobile Pay 25%');
  });

  it('warns when the payment list was cut off', () => {
    const p = paymentsOk();
    p.data.truncated = true;
    expect($(screen.renderPayments(p)).querySelector('.rd-note')).not.toBeNull();
  });

  it('shows each section error on its own', () => {
    const err = { data: null, error: { code: 'X', message: 'Could not load sales activity for this date range.' } };
    expect($(screen.renderBestSellers(err)).querySelector('.rd-error').textContent).toContain('Could not load sales activity');
    expect($(screen.renderHours(err)).querySelector('.rd-error')).not.toBeNull();
    expect($(screen.renderPayments(err)).querySelector('.rd-error')).not.toBeNull();
  });
});

describe('Reports dashboard screen', () => {
  const $ = (s) => document.querySelector(s);
  const tick = () => new Promise((r) => setTimeout(r, 0));
  let navigate;

  async function mount() {
    document.body.innerHTML = screen.render();
    navigate = vi.fn();
    await screen.init(navigate);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    loadDashboard.mockResolvedValue({ activity: activityOk(), payments: paymentsOk() });
  });

  it('loads the last 7 days by default and fills every section', async () => {
    await mount();
    expect(loadDashboard).toHaveBeenCalledWith('2026-10-14', '2026-10-20');
    expect($('.rd-preset[data-preset="7"]').getAttribute('aria-pressed')).toBe('true');
    expect($('#rd-from').value).toBe('2026-10-14');
    expect($('#rd-range-note').textContent).toContain('2026-10-14 to 2026-10-20');
    expect($('#rd-summary').textContent).toContain('$100.00');
    expect($('#rd-best').textContent).toContain('Latte');
    expect($('#rd-hours').textContent).toContain('Busiest hour');
    expect($('#rd-pay').textContent).toContain('Cash');
  });

  it('switches presets and reloads', async () => {
    await mount();
    $('.rd-preset[data-preset="today"]').click();
    await tick();
    expect(loadDashboard).toHaveBeenLastCalledWith('2026-10-20', '2026-10-20');
    expect($('.rd-preset[data-preset="today"]').getAttribute('aria-pressed')).toBe('true');
    expect($('.rd-preset[data-preset="7"]').getAttribute('aria-pressed')).toBe('false');
    expect($('#rd-range-note').textContent).toContain('Showing 2026-10-20 (Pacific time)');
  });

  it('applies a custom range', async () => {
    await mount();
    $('#rd-from').value = '2026-10-01';
    $('#rd-to').value = '2026-10-10';
    $('#rd-custom').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await tick();
    expect(loadDashboard).toHaveBeenLastCalledWith('2026-10-01', '2026-10-10');
    expect(document.querySelectorAll('.rd-preset[aria-pressed="true"]')).toHaveLength(0);
  });

  it('refuses a reversed custom range without reloading', async () => {
    await mount();
    loadDashboard.mockClear();
    $('#rd-from').value = '2026-10-10';
    $('#rd-to').value = '2026-10-01';
    $('#rd-custom').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await tick();
    expect(loadDashboard).not.toHaveBeenCalled();
    expect($('#rd-range-note').textContent).toContain('start date on or before');
  });

  it('shows one failing section without hiding the others', async () => {
    loadDashboard.mockResolvedValue({
      activity: { data: null, error: { code: 'LOOKUP_FAILED', message: 'Could not load sales activity for this date range.' } },
      payments: paymentsOk(),
    });
    await mount();
    expect($('#rd-best').textContent).toContain('Could not load sales activity');
    expect($('#rd-hours .rd-error')).not.toBeNull();
    expect($('#rd-pay').textContent).toContain('$50.00');
    expect($('#rd-summary').textContent).toContain('$100.00');
  });

  it('ignores taps on Refresh while loading', async () => {
    await mount();
    let finish;
    loadDashboard.mockReturnValue(new Promise((r) => { finish = r; }));
    const refresh = $('#rd-refresh-btn');
    refresh.click();
    refresh.click();
    expect(loadDashboard).toHaveBeenCalledTimes(2); // first load + one refresh
    expect(refresh.disabled).toBe(true);
    finish({ activity: activityOk(), payments: paymentsOk() });
    await tick();
    expect(refresh.disabled).toBe(false);
  });

  it('drops a slow answer that was replaced by a newer request', async () => {
    await mount();
    let slow;
    loadDashboard.mockReturnValueOnce(new Promise((r) => { slow = r; }));
    $('.rd-preset[data-preset="30"]').click(); // slow request
    loadDashboard.mockResolvedValueOnce({
      activity: { data: { bestSellers: [{ menuItemIdentifier: 'z', menuItemName: 'Mocha', quantitySold: 1, grossItemRevenue: 5 }], busiestHours: hours({ 9: 1 }) }, error: null },
      payments: paymentsOk(),
    });
    $('.rd-preset[data-preset="today"]').click(); // newer request
    await tick();
    slow({ activity: activityOk(), payments: paymentsOk() }); // late answer for the 30-day request
    await tick();
    expect($('#rd-best').textContent).toContain('Mocha');
    expect($('#rd-best').textContent).not.toContain('Latte');
  });

  it('goes back to Admin Home', async () => {
    await mount();
    $('#rd-back-btn').click();
    expect(navigate).toHaveBeenCalledWith('admin');
  });
});
