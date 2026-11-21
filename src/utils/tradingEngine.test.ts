import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDashboardSummary,
  DEFAULT_JOURNAL_TRADES,
  formatIdr,
  formatShortDateLabel,
  getLocalDateKey,
} from './tradingEngine';
import type { CashflowEntry, TradeEntry } from '../types/journal';

test('formatIdr and formatShortDateLabel format Indonesian currency and dates accurately', () => {
  assert.equal(formatIdr(200000), 'Rp200.000');
  assert.equal(formatIdr(18000, true), '+Rp18.000');
  assert.equal(formatIdr(-12000), '-Rp12.000');
  assert.equal(formatShortDateLabel('2026-11-20'), '20 Nov 2026');
});

test('computeDashboardSummary aggregates KPIs and ranks best vs worst trading method', () => {
  const summary = computeDashboardSummary(200000, DEFAULT_JOURNAL_TRADES, []);

  assert.equal(summary.totalTrades, 10);
  assert.equal(summary.winCount, 5);
  assert.equal(summary.lossCount, 4);
  assert.equal(summary.beCount, 1);
  assert.equal(summary.winRatePct, 50);

  // Net PnL: 18000 - 12000 + 15000 + 24000 - 9000 - 14000 + 0 + 19500 + 22000 - 8500 = +55000
  assert.equal(summary.pureTradingPnLIdr, 55000);
  assert.equal(summary.currentBalanceIdr, 255000);
  assert.equal(summary.pureTradingReturnPct, 27.5);

  // Best method should be Breakout Structure (+64000, 100% win rate)
  assert.equal(summary.bestMethod?.method, 'Breakout Structure');
  assert.equal(summary.bestMethod?.netPnLIdr, 64000);
  assert.equal(summary.bestMethod?.winRatePct, 100);

  // Worst method should be Counter-Trend Scalping (-34500, 0% win rate)
  assert.equal(summary.worstMethod?.method, 'Counter-Trend Scalping');
  assert.equal(summary.worstMethod?.netPnLIdr, -34500);
  assert.equal(summary.worstMethod?.winRatePct, 0);
});

test('computeDashboardSummary separates deposited cashflows from pure trading PnL', () => {
  const cashflows: CashflowEntry[] = [
    {
      id: 'cf-1',
      dateKey: '2026-11-15',
      dateLabel: '15 Nov 2026',
      type: 'deposit',
      amountIdr: 100000,
      note: 'Tambah modal akun',
      createdAt: '2026-11-15T10:00:00Z',
    },
  ];
  const summary = computeDashboardSummary(200000, DEFAULT_JOURNAL_TRADES, cashflows);

  assert.equal(summary.totalDepositedIdr, 300000);
  assert.equal(summary.pureTradingPnLIdr, 55000);
  assert.equal(summary.currentBalanceIdr, 355000);
});

test('computeDashboardSummary filters metrics, curve, and method rankings by date range', () => {
  const periodSummary = computeDashboardSummary(200000, DEFAULT_JOURNAL_TRADES, [], {
    startDate: '2026-11-16',
    endDate: '2026-11-20',
  });

  // Prior trades (Nov 10-14): +18k -12k +15k +24k -9k = +36k => starting period balance = 236,000
  assert.equal(periodSummary.isPeriodFiltered, true);
  assert.equal(periodSummary.initialCapitalIdr, 236000);
  assert.equal(periodSummary.totalTrades, 5);
  assert.equal(periodSummary.winCount, 2);
  assert.equal(periodSummary.lossCount, 2);
  assert.equal(periodSummary.beCount, 1);
  assert.equal(periodSummary.winRatePct, 40);

  // Period PnL (Nov 16-20): -14k +0 +19.5k +22k -8.5k = +19,000
  assert.equal(periodSummary.pureTradingPnLIdr, 19000);
  assert.equal(periodSummary.currentBalanceIdr, 255000);
  assert.equal(periodSummary.bestMethod?.method, 'Breakout Structure');
  assert.equal(periodSummary.bestMethod?.netPnLIdr, 22000);
  assert.equal(periodSummary.worstMethod?.method, 'Counter-Trend Scalping');
  assert.equal(periodSummary.worstMethod?.netPnLIdr, -22500);

  // Empty future range preserves balance and reports zero trades cleanly
  const emptyPeriod = computeDashboardSummary(200000, DEFAULT_JOURNAL_TRADES, [], {
    startDate: '2026-12-01',
    endDate: '2026-12-07',
  });
  assert.equal(emptyPeriod.totalTrades, 0);
  assert.equal(emptyPeriod.pureTradingPnLIdr, 0);
  assert.equal(emptyPeriod.currentBalanceIdr, 255000);
  assert.equal(emptyPeriod.equityCurve.length, 1);
});

test('computeDashboardSummary detects Circuit Breaker warning at 2 losses and triggers at 3+ losses in a day', () => {
  const today = getLocalDateKey();
  const makeLoss = (idx: number, dateKey: string): TradeEntry => ({
    id: `loss-${idx}`,
    dateKey,
    session: 'London',
    dateLabel: formatShortDateLabel(dateKey),
    pair: 'XAUUSD',
    position: 'Buy',
    method: 'Scalping',
    riskPercent: 2,
    outcome: 'Loss',
    pnlIdr: -10000,
    note: '',
    createdAt: `${dateKey}T10:0${idx}:00Z`,
  });

  // 2 losses today => warning state, not yet triggered
  const warningSummary = computeDashboardSummary(200000, [makeLoss(1, today), makeLoss(2, today)], []);
  assert.equal(warningSummary.circuitBreaker.todayLossCount, 2);
  assert.equal(warningSummary.circuitBreaker.isWarning, true);
  assert.equal(warningSummary.circuitBreaker.isTodayTriggered, false);
  assert.equal(warningSummary.circuitBreaker.hasAnyTriggeredDay, false);

  // 3 losses today => Circuit Breaker triggered
  const triggeredSummary = computeDashboardSummary(
    200000,
    [makeLoss(1, today), makeLoss(2, today), makeLoss(3, today)],
    []
  );
  assert.equal(triggeredSummary.circuitBreaker.todayLossCount, 3);
  assert.equal(triggeredSummary.circuitBreaker.todayLossIdr, 30000);
  assert.equal(triggeredSummary.circuitBreaker.isTodayTriggered, true);
  assert.equal(triggeredSummary.circuitBreaker.isWarning, false);
  assert.equal(triggeredSummary.circuitBreaker.hasAnyTriggeredDay, true);
  assert.equal(triggeredSummary.circuitBreaker.triggeredDays.length, 1);
  assert.equal(triggeredSummary.circuitBreaker.triggeredDays[0].lossCount, 3);
});
