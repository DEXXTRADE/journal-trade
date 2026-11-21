import type {
  CashflowEntry,
  CircuitBreakerStatus,
  ComputedTradeRow,
  DailyCircuitBreakerDay,
  DashboardSummary,
  DateRangeFilter,
  EquityPoint,
  MethodStats,
  PairStats,
  TradeEntry,
} from '../types/journal';

export const DEFAULT_INITIAL_CAPITAL_IDR = 200000;
export const DEFAULT_JOURNAL_NAME = 'JurnalFx';
export const DAILY_LOSS_LIMIT = 3;

export const BLUEPRINT_LIMITS = {
  JOURNAL_NAME_MAX: 40,
  METHOD_MAX: 80,
  PAIR_MAX: 20,
  NOTE_MAX: 500,
  CASHFLOW_NOTE_MAX: 300,
  DATE_LABEL_MAX: 30,
  CLIENT_CREATED_AT_MAX: 40,
  MAX_AMOUNT_IDR: 1_000_000_000_000,
  DATE_KEY_PATTERN: /^\d{4}-\d{2}-\d{2}$/,
} as const;

export function getLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey.trim());
  if (!match) return dateKey;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  d.setDate(d.getDate() + deltaDays);
  return getLocalDateKey(d);
}

export function getMonthRangeForDate(date: Date = new Date()): DateRangeFilter {
  const year = date.getFullYear();
  const month = date.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return {
    startDate: getLocalDateKey(start),
    endDate: getLocalDateKey(end),
  };
}

export function formatIdr(amount: number, showPlus = false): string {
  const rounded = Math.round(amount);
  const absFormatted = Math.abs(rounded).toLocaleString('id-ID');
  if (rounded < 0) {
    return `-Rp${absFormatted}`;
  }
  if (rounded > 0 && showPlus) {
    return `+Rp${absFormatted}`;
  }
  return `Rp${absFormatted}`;
}

export function formatShortDateLabel(dateKey: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey.trim());
  if (!match) return dateKey;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const year = match[1];
  const monthIdx = Math.max(0, Math.min(11, Number(match[2]) - 1));
  const day = Number(match[3]);
  return `${day} ${months[monthIdx]} ${year}`;
}

export function normalizeTradePnl(outcome: TradeEntry['outcome'], rawPnl: number): number {
  const clean = Number.isFinite(rawPnl) ? Math.round(rawPnl) : 0;
  if (outcome === 'BE') return 0;
  if (outcome === 'Loss') return -Math.abs(clean);
  return Math.abs(clean);
}

interface TimelineItem {
  kind: 'trade' | 'cashflow';
  dateKey: string;
  createdAt: string;
  orderIndex: number;
  trade?: TradeEntry;
  cashflow?: CashflowEntry;
}

export function computeDashboardSummary(
  initialCapitalIdr: number,
  trades: TradeEntry[],
  cashflows: CashflowEntry[] = [],
  dateRange?: Partial<DateRangeFilter>
): DashboardSummary {
  const safeInitial =
    initialCapitalIdr > 0 ? Math.round(initialCapitalIdr) : DEFAULT_INITIAL_CAPITAL_IDR;

  let startDate = dateRange?.startDate?.trim() || '';
  let endDate = dateRange?.endDate?.trim() || '';
  if (startDate && endDate && startDate > endDate) {
    [startDate, endDate] = [endDate, startDate];
  }
  const isPeriodFiltered = Boolean(startDate || endDate);

  const sortedTimeline: TimelineItem[] = [
    ...trades.map((trade, index) => ({
      kind: 'trade' as const,
      dateKey: trade.dateKey,
      createdAt: trade.createdAt,
      orderIndex: index,
      trade,
    })),
    ...cashflows.map((cf, index) => ({
      kind: 'cashflow' as const,
      dateKey: cf.dateKey,
      createdAt: cf.createdAt,
      orderIndex: trades.length + index,
      cashflow: cf,
    })),
  ].sort((a, b) => {
    const dateCmp = a.dateKey.localeCompare(b.dateKey);
    if (dateCmp !== 0) return dateCmp;
    const timeCmp = a.createdAt.localeCompare(b.createdAt);
    if (timeCmp !== 0) return timeCmp;
    return a.orderIndex - b.orderIndex;
  });

  let priorTradingPnLIdr = 0;
  let priorNetCashflowIdr = 0;
  let priorTradeCount = 0;
  const periodTimeline: TimelineItem[] = [];

  for (const item of sortedTimeline) {
    if (startDate && item.dateKey < startDate) {
      if (item.kind === 'trade' && item.trade) {
        priorTradeCount += 1;
        priorTradingPnLIdr += normalizeTradePnl(item.trade.outcome, item.trade.pnlIdr);
      } else if (item.kind === 'cashflow' && item.cashflow) {
        const cf = item.cashflow;
        const signedCash =
          cf.type === 'withdraw'
            ? -Math.abs(Math.round(cf.amountIdr))
            : Math.abs(Math.round(cf.amountIdr));
        priorNetCashflowIdr += signedCash;
      }
      continue;
    }

    if (endDate && item.dateKey > endDate) {
      continue;
    }

    periodTimeline.push(item);
  }

  const periodStartingBalanceIdr = startDate
    ? safeInitial + priorNetCashflowIdr + priorTradingPnLIdr
    : safeInitial;
  let currentBalanceIdr = periodStartingBalanceIdr;
  let totalDepositedUpToEndIdr = safeInitial + priorNetCashflowIdr;
  let chartBaselineIdr = periodStartingBalanceIdr;
  let netCashflowIdr = 0;
  let pureTradingPnLIdr = 0;

  const computedRows: ComputedTradeRow[] = [];
  const equityCurve: EquityPoint[] = [
    {
      step: 0,
      label: startDate ? 'Saldo Awal Periode' : 'Modal Awal',
      eventType: 'initial',
      totalBalanceIdr: periodStartingBalanceIdr,
      depositedCapitalIdr: chartBaselineIdr,
      pureTradingEquityIdr: periodStartingBalanceIdr,
      pureTradingPnLIdr: 0,
    },
  ];

  let tradeNo = priorTradeCount;
  let stepCount = 0;

  for (const item of periodTimeline) {
    if (item.kind === 'trade' && item.trade) {
      const t = item.trade;
      tradeNo += 1;
      stepCount += 1;

      const signedPnl = normalizeTradePnl(t.outcome, t.pnlIdr);
      const cleanMethod = t.method.trim() || 'Tanpa Metode';
      pureTradingPnLIdr += signedPnl;
      currentBalanceIdr += signedPnl;
      const pureTradingBalanceIdr = periodStartingBalanceIdr + pureTradingPnLIdr;

      const row: ComputedTradeRow = {
        ...t,
        method: cleanMethod,
        pnlIdr: signedPnl,
        no: tradeNo,
        endingBalanceIdr: currentBalanceIdr,
        pureTradingBalanceIdr,
      };
      computedRows.push(row);

      equityCurve.push({
        step: stepCount,
        label: `#${tradeNo} ${t.pair} (${cleanMethod})`,
        eventType: 'trade',
        totalBalanceIdr: currentBalanceIdr,
        depositedCapitalIdr: chartBaselineIdr,
        pureTradingEquityIdr: pureTradingBalanceIdr,
        pureTradingPnLIdr,
        outcome: t.outcome,
        pair: t.pair,
        method: cleanMethod,
        pnlIdr: signedPnl,
      });
    } else if (item.kind === 'cashflow' && item.cashflow) {
      const cf = item.cashflow;
      const signedCash =
        cf.type === 'withdraw' ? -Math.abs(Math.round(cf.amountIdr)) : Math.abs(Math.round(cf.amountIdr));
      stepCount += 1;

      totalDepositedUpToEndIdr += signedCash;
      chartBaselineIdr += signedCash;
      netCashflowIdr += signedCash;
      currentBalanceIdr += signedCash;

      equityCurve.push({
        step: stepCount,
        label: `${cf.type === 'deposit' ? 'Deposit' : 'Withdraw'} ${cf.dateLabel}`,
        eventType: 'cashflow',
        totalBalanceIdr: currentBalanceIdr,
        depositedCapitalIdr: chartBaselineIdr,
        pureTradingEquityIdr: periodStartingBalanceIdr + pureTradingPnLIdr,
        pureTradingPnLIdr,
        pnlIdr: signedCash,
      });
    }
  }

  const totalTrades = computedRows.length;
  const winRows = computedRows.filter((r) => r.outcome === 'Win');
  const lossRows = computedRows.filter((r) => r.outcome === 'Loss');
  const beRows = computedRows.filter((r) => r.outcome === 'BE');

  const winCount = winRows.length;
  const lossCount = lossRows.length;
  const beCount = beRows.length;
  const winRatePct = totalTrades > 0 ? Number(((winCount / totalTrades) * 100).toFixed(1)) : 0;

  const grossProfitAll = computedRows
    .filter((r) => r.pnlIdr > 0)
    .reduce((acc, r) => acc + r.pnlIdr, 0);
  const grossLossAll = Math.abs(
    computedRows.filter((r) => r.pnlIdr < 0).reduce((acc, r) => acc + r.pnlIdr, 0)
  );

  const profitFactor =
    grossLossAll > 0
      ? Number((grossProfitAll / grossLossAll).toFixed(2))
      : grossProfitAll > 0
      ? null
      : 0;

  const avgWinIdr = winCount > 0 ? Math.round(grossProfitAll / winCount) : 0;
  const avgLossIdr = lossCount > 0 ? Math.round(-grossLossAll / lossCount) : 0;
  const returnDenominator = periodStartingBalanceIdr > 0 ? periodStartingBalanceIdr : safeInitial;
  const pureTradingReturnPct = Number(((pureTradingPnLIdr / returnDenominator) * 100).toFixed(2));

  let bestTrade: ComputedTradeRow | null = null;
  if (winRows.length > 0) {
    bestTrade = winRows.reduce((best, cur) => (cur.pnlIdr > best.pnlIdr ? cur : best), winRows[0]);
  } else if (computedRows.length > 0) {
    bestTrade = computedRows.reduce((best, cur) => (cur.pnlIdr > best.pnlIdr ? cur : best), computedRows[0]);
  }

  let worstTrade: ComputedTradeRow | null = null;
  if (lossRows.length > 0) {
    worstTrade = lossRows.reduce((worst, cur) => (cur.pnlIdr < worst.pnlIdr ? cur : worst), lossRows[0]);
  }

  // Group stats by Trading Method
  const methodBuckets = new Map<string, ComputedTradeRow[]>();
  for (const row of computedRows) {
    const bucket = methodBuckets.get(row.method) ?? [];
    bucket.push(row);
    methodBuckets.set(row.method, bucket);
  }

  const methodStats: MethodStats[] = Array.from(methodBuckets.entries())
    .map(([method, rows]) => {
      const mWin = rows.filter((r) => r.outcome === 'Win').length;
      const mLoss = rows.filter((r) => r.outcome === 'Loss').length;
      const mBe = rows.filter((r) => r.outcome === 'BE').length;
      const mTotal = rows.length;
      const mWinRate = Number(((mWin / mTotal) * 100).toFixed(1));
      const netPnLIdr = rows.reduce((sum, r) => sum + r.pnlIdr, 0);
      const avgPnLIdr = Math.round(netPnLIdr / mTotal);
      const grossProfitIdr = rows.filter((r) => r.pnlIdr > 0).reduce((s, r) => s + r.pnlIdr, 0);
      const grossLossIdr = Math.abs(
        rows.filter((r) => r.pnlIdr < 0).reduce((s, r) => s + r.pnlIdr, 0)
      );
      const mProfitFactor =
        grossLossIdr > 0
          ? Number((grossProfitIdr / grossLossIdr).toFixed(2))
          : grossProfitIdr > 0
          ? null
          : 0;

      const bestTradePnLIdr = Math.max(...rows.map((r) => r.pnlIdr));
      const worstTradePnLIdr = Math.min(...rows.map((r) => r.pnlIdr));

      const pairCounts = new Map<string, number>();
      for (const r of rows) {
        pairCounts.set(r.pair, (pairCounts.get(r.pair) ?? 0) + 1);
      }
      const topPair =
        Array.from(pairCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-';

      return {
        method,
        totalTrades: mTotal,
        winCount: mWin,
        lossCount: mLoss,
        beCount: mBe,
        winRatePct: mWinRate,
        netPnLIdr,
        avgPnLIdr,
        grossProfitIdr,
        grossLossIdr,
        profitFactor: mProfitFactor,
        bestTradePnLIdr,
        worstTradePnLIdr,
        topPair,
      };
    })
    .sort((a, b) => {
      if (b.netPnLIdr !== a.netPnLIdr) return b.netPnLIdr - a.netPnLIdr;
      return b.winRatePct - a.winRatePct;
    });

  const bestMethod = methodStats.length > 0 ? methodStats[0] : null;
  const worstMethod =
    methodStats.length > 1
      ? methodStats[methodStats.length - 1]
      : methodStats.length === 1 && methodStats[0].netPnLIdr < 0
      ? methodStats[0]
      : null;

  // Group stats by Pair
  const pairBuckets = new Map<string, ComputedTradeRow[]>();
  for (const row of computedRows) {
    const bucket = pairBuckets.get(row.pair) ?? [];
    bucket.push(row);
    pairBuckets.set(row.pair, bucket);
  }

  const pairStats: PairStats[] = Array.from(pairBuckets.entries())
    .map(([pair, rows]) => {
      const wins = rows.filter((r) => r.outcome === 'Win').length;
      const netPnLIdr = rows.reduce((s, r) => s + r.pnlIdr, 0);
      return {
        pair,
        totalTrades: rows.length,
        winRatePct: Number(((wins / rows.length) * 100).toFixed(1)),
        netPnLIdr,
      };
    })
    .sort((a, b) => b.netPnLIdr - a.netPnLIdr);

  const availableMethods = methodStats.map((m) => m.method);

  // Circuit Breaker calculation (3x loss in a single day)
  const todayDateKey = getLocalDateKey();
  const todayTrades = trades.filter((t) => t.dateKey === todayDateKey);
  const todayLossTrades = todayTrades.filter((t) => t.outcome === 'Loss');
  const todayLossCount = todayLossTrades.length;
  const todayLossIdr = todayLossTrades.reduce(
    (sum, t) => sum + Math.abs(normalizeTradePnl(t.outcome, t.pnlIdr)),
    0
  );

  const dayBuckets = new Map<string, ComputedTradeRow[]>();
  for (const row of computedRows) {
    const bucket = dayBuckets.get(row.dateKey) ?? [];
    bucket.push(row);
    dayBuckets.set(row.dateKey, bucket);
  }

  const triggeredDays: DailyCircuitBreakerDay[] = Array.from(dayBuckets.entries())
    .map(([dateKey, rows]) => {
      const lossTrades = rows.filter((r) => r.outcome === 'Loss');
      return {
        dateKey,
        dateLabel: rows[0]?.dateLabel ?? formatShortDateLabel(dateKey),
        lossCount: lossTrades.length,
        totalLossIdr: lossTrades.reduce((sum, r) => sum + Math.abs(r.pnlIdr), 0),
        totalTrades: rows.length,
      };
    })
    .filter((d) => d.lossCount >= DAILY_LOSS_LIMIT)
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey));

  const isTodayTriggered = todayLossCount >= DAILY_LOSS_LIMIT;
  const isWarning = !isTodayTriggered && todayLossCount === DAILY_LOSS_LIMIT - 1;
  const circuitBreaker: CircuitBreakerStatus = {
    dailyLossLimit: DAILY_LOSS_LIMIT,
    todayDateKey,
    todayLossCount,
    todayLossIdr,
    isTodayTriggered,
    isWarning,
    triggeredDays,
    hasAnyTriggeredDay: isTodayTriggered || triggeredDays.length > 0,
  };

  return {
    initialCapitalIdr: periodStartingBalanceIdr,
    accountInitialCapitalIdr: safeInitial,
    totalDepositedIdr: totalDepositedUpToEndIdr,
    netCashflowIdr,
    currentBalanceIdr,
    pureTradingPnLIdr,
    pureTradingReturnPct,
    isPeriodFiltered,
    totalTrades,
    winCount,
    lossCount,
    beCount,
    winRatePct,
    profitFactor,
    avgWinIdr,
    avgLossIdr,
    bestTrade,
    worstTrade,
    methodStats,
    bestMethod,
    worstMethod,
    pairStats,
    availableMethods,
    computedRows,
    equityCurve,
    circuitBreaker,
  };
}

export const DEFAULT_JOURNAL_TRADES: TradeEntry[] = [
  {
    id: 'demo-1',
    dateKey: '2026-11-10',
    session: 'London',
    dateLabel: '10 Nov 2026',
    pair: 'EURUSD',
    position: 'Buy',
    method: 'Breakout Structure',
    riskPercent: 1.5,
    outcome: 'Win',
    pnlIdr: 18000,
    note: 'Breakout struktur H1 bersih setelah konsolidasi sesi Asia.',
    createdAt: '2026-11-10T14:20:00Z',
  },
  {
    id: 'demo-2',
    dateKey: '2026-11-11',
    session: 'New York',
    dateLabel: '11 Nov 2026',
    pair: 'XAUUSD',
    position: 'Sell',
    method: 'Counter-Trend Scalping',
    riskPercent: 2.0,
    outcome: 'Loss',
    pnlIdr: -12000,
    note: 'Melawan tren bullish kuat di M15, kena sweep SL.',
    createdAt: '2026-11-11T19:45:00Z',
  },
  {
    id: 'demo-3',
    dateKey: '2026-11-12',
    session: 'London',
    dateLabel: '12 Nov 2026',
    pair: 'GBPUSD',
    position: 'Buy',
    method: 'Pullback EMA',
    riskPercent: 1.5,
    outcome: 'Win',
    pnlIdr: 15000,
    note: 'Pullback ke EMA 21 searah tren H4, RR 1:2.5 tercapai.',
    createdAt: '2026-11-12T15:10:00Z',
  },
  {
    id: 'demo-4',
    dateKey: '2026-11-13',
    session: 'New York',
    dateLabel: '13 Nov 2026',
    pair: 'XAUUSD',
    position: 'Buy',
    method: 'Breakout Structure',
    riskPercent: 2.0,
    outcome: 'Win',
    pnlIdr: 24000,
    note: 'Breakout resistance intraday dengan volume tinggi pasca rilis data.',
    createdAt: '2026-11-13T20:05:00Z',
  },
  {
    id: 'demo-5',
    dateKey: '2026-11-14',
    session: 'London',
    dateLabel: '14 Nov 2026',
    pair: 'USDJPY',
    position: 'Sell',
    method: 'Supply & Demand',
    riskPercent: 1.5,
    outcome: 'Loss',
    pnlIdr: -9000,
    note: 'Zona supply H1 tertembus karena rilis sentimen BOJ.',
    createdAt: '2026-11-14T14:50:00Z',
  },
  {
    id: 'demo-6',
    dateKey: '2026-11-16',
    session: 'Asia',
    dateLabel: '16 Nov 2026',
    pair: 'XAUUSD',
    position: 'Buy',
    method: 'Counter-Trend Scalping',
    riskPercent: 2.0,
    outcome: 'Loss',
    pnlIdr: -14000,
    note: 'Menangkap pisau jatuh sebelum ada konfirmasi reversal.',
    createdAt: '2026-11-16T08:30:00Z',
  },
  {
    id: 'demo-7',
    dateKey: '2026-11-17',
    session: 'London',
    dateLabel: '17 Nov 2026',
    pair: 'EURUSD',
    position: 'Sell',
    method: 'Pullback EMA',
    riskPercent: 1.5,
    outcome: 'BE',
    pnlIdr: 0,
    note: 'Sudah sempat +1R namun harga berbalik, ditutup di breakeven.',
    createdAt: '2026-11-17T15:40:00Z',
  },
  {
    id: 'demo-8',
    dateKey: '2026-11-18',
    session: 'New York',
    dateLabel: '18 Nov 2026',
    pair: 'GBPUSD',
    position: 'Sell',
    method: 'Supply & Demand',
    riskPercent: 1.5,
    outcome: 'Win',
    pnlIdr: 19500,
    note: 'Rejection bersih di area supply H4, konfirmasi engulfing M15.',
    createdAt: '2026-11-18T19:15:00Z',
  },
  {
    id: 'demo-9',
    dateKey: '2026-11-19',
    session: 'London',
    dateLabel: '19 Nov 2026',
    pair: 'XAUUSD',
    position: 'Buy',
    method: 'Breakout Structure',
    riskPercent: 2.0,
    outcome: 'Win',
    pnlIdr: 22000,
    note: 'Retest neckline sempurna, hold posisi hingga TP penuh.',
    createdAt: '2026-11-19T14:55:00Z',
  },
  {
    id: 'demo-10',
    dateKey: '2026-11-20',
    session: 'New York',
    dateLabel: '20 Nov 2026',
    pair: 'EURJPY',
    position: 'Buy',
    method: 'Counter-Trend Scalping',
    riskPercent: 1.5,
    outcome: 'Loss',
    pnlIdr: -8500,
    note: 'Entry terlalu agresif di akhir sesi New York saat spread melebar.',
    createdAt: '2026-11-20T21:10:00Z',
  },
];
