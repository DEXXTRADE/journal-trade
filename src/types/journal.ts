export type TradeDirection = 'Buy' | 'Sell';
export type TradeOutcome = 'Win' | 'Loss' | 'BE';
export type TradingSession = 'Asia' | 'London' | 'New York';

export interface TradeEntry {
  id: string;
  dateKey: string; // YYYY-MM-DD
  session: TradingSession;
  dateLabel: string; // e.g., "18 Nov 2026"
  pair: string;
  position: TradeDirection;
  method: string; // Trading strategy / setup method
  riskPercent: number;
  outcome: TradeOutcome;
  pnlIdr: number;
  note: string;
  createdAt: string;
}

export interface CashflowEntry {
  id: string;
  dateKey: string;
  dateLabel: string;
  type: 'deposit' | 'withdraw';
  amountIdr: number;
  note: string;
  createdAt: string;
}

export interface ComputedTradeRow extends TradeEntry {
  no: number;
  endingBalanceIdr: number;
  pureTradingBalanceIdr: number;
}

export interface EquityPoint {
  step: number;
  label: string;
  eventType: 'initial' | 'trade' | 'cashflow';
  totalBalanceIdr: number;
  depositedCapitalIdr: number;
  pureTradingEquityIdr: number;
  pureTradingPnLIdr: number;
  outcome?: TradeOutcome;
  pair?: string;
  method?: string;
  pnlIdr?: number;
}

export interface MethodStats {
  method: string;
  totalTrades: number;
  winCount: number;
  lossCount: number;
  beCount: number;
  winRatePct: number;
  netPnLIdr: number;
  avgPnLIdr: number;
  grossProfitIdr: number;
  grossLossIdr: number;
  profitFactor: number | null; // null when grossLossIdr === 0 and grossProfitIdr > 0
  bestTradePnLIdr: number;
  worstTradePnLIdr: number;
  topPair: string;
}

export interface PairStats {
  pair: string;
  totalTrades: number;
  winRatePct: number;
  netPnLIdr: number;
}

export interface DateRangeFilter {
  startDate: string; // YYYY-MM-DD or ''
  endDate: string;   // YYYY-MM-DD or ''
}

export interface DailyCircuitBreakerDay {
  dateKey: string;
  dateLabel: string;
  lossCount: number;
  totalLossIdr: number;
  totalTrades: number;
}

export interface CircuitBreakerStatus {
  dailyLossLimit: number;
  todayDateKey: string;
  todayLossCount: number;
  todayLossIdr: number;
  isTodayTriggered: boolean;
  isWarning: boolean;
  triggeredDays: DailyCircuitBreakerDay[];
  hasAnyTriggeredDay: boolean;
}

export interface DashboardSummary {
  initialCapitalIdr: number;
  accountInitialCapitalIdr: number;
  totalDepositedIdr: number;
  netCashflowIdr: number;
  currentBalanceIdr: number;
  pureTradingPnLIdr: number;
  pureTradingReturnPct: number;
  isPeriodFiltered: boolean;
  totalTrades: number;
  winCount: number;
  lossCount: number;
  beCount: number;
  winRatePct: number;
  profitFactor: number | null;
  avgWinIdr: number;
  avgLossIdr: number;
  bestTrade: ComputedTradeRow | null;
  worstTrade: ComputedTradeRow | null;
  methodStats: MethodStats[];
  bestMethod: MethodStats | null;
  worstMethod: MethodStats | null;
  pairStats: PairStats[];
  availableMethods: string[];
  computedRows: ComputedTradeRow[];
  equityCurve: EquityPoint[];
  circuitBreaker: CircuitBreakerStatus;
}

export interface JournalState {
  journalName: string;
  initialCapitalIdr: number;
  trades: TradeEntry[];
  cashflows: CashflowEntry[];
}
