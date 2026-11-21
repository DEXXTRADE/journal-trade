import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  BarChart3,
  Check,
  Database,
  LayoutDashboard,
  Layers,
  Menu,
  Moon,
  Pencil,
  Plus,
  ShieldAlert,
  Sun,
  Table2,
  Trash,
  Wallet,
  X,
} from 'lucide-react';
import {
  addCashflowInDb,
  addTradeInDb,
  batchAddTradesInDb,
  clearJournalDataInDb,
  deleteCashflowInDb,
  deleteTradeInDb,
  ensureJournalSettings,
  replaceWithDemoDataInDb,
  subscribeCashflows,
  subscribeJournalSettings,
  subscribeTrades,
  updateInitialCapitalInDb,
  updateJournalNameInDb,
  updateThemeInDb,
} from './services/firestoreJournal';
import { AddTradeModal } from './components/AddTradeModal';
import { CapitalModal } from './components/CapitalModal';
import { CircuitBreakerBanner } from './components/CircuitBreakerBanner';
import { DateRangeBar } from './components/DateRangeBar';
import { EquityCurveChart } from './components/EquityCurveChart';
import { JournalLogTable } from './components/JournalLogTable';
import { MethodAnalyticsSection } from './components/MethodAnalyticsSection';
import type {
  CashflowEntry,
  DateRangeFilter,
  JournalState,
  ThemeMode,
  TradeDirection,
  TradeEntry,
  TradeOutcome,
  TradingSession,
} from './types/journal';
import {
  BLUEPRINT_LIMITS,
  computeDashboardSummary,
  DEFAULT_INITIAL_CAPITAL_IDR,
  DEFAULT_JOURNAL_NAME,
  formatIdr,
  formatShortDateLabel,
  getLocalDateKey,
  normalizeTradePnl,
} from './utils/tradingEngine';

type ActiveView = 'dashboard' | 'methods' | 'journal';

function sanitizeDirection(val: string): TradeDirection {
  return String(val).toLowerCase().includes('sell') ? 'Sell' : 'Buy';
}

function sanitizeSession(val: string): TradingSession {
  const lower = String(val).toLowerCase();
  if (lower.includes('asia')) return 'Asia';
  if (lower.includes('new')) return 'New York';
  return 'London';
}

function sanitizeOutcome(val: string, pnl: number): TradeOutcome {
  const lower = String(val).toLowerCase();
  if (lower === 'be' || lower.includes('break')) return 'BE';
  if (lower.includes('loss') || pnl < 0) return 'Loss';
  return 'Win';
}

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [journalState, setJournalState] = useState<JournalState>({
    journalName: DEFAULT_JOURNAL_NAME,
    initialCapitalIdr: DEFAULT_INITIAL_CAPITAL_IDR,
    trades: [],
    cashflows: [],
  });
  const [isLoadingJournal, setIsLoadingJournal] = useState(true);
  const [fatalSyncError, setFatalSyncError] = useState<Error | null>(null);

  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState<DateRangeFilter>({ startDate: '', endDate: '' });

  const [isEditingName, setIsEditingName] = useState(false);
  const [draftJournalName, setDraftJournalName] = useState('');

  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isAddTradeOpen, setIsAddTradeOpen] = useState(false);
  const [isCapitalOpen, setIsCapitalOpen] = useState(false);

  const [isImportingAi, setIsImportingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isMutatingDb, setIsMutatingDb] = useState(false);

  // Apply .dark class to <html> root whenever theme changes
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Direct Firestore real-time sync (no login gate required)
  useEffect(() => {
    let isCancelled = false;
    let unsubSettings: (() => void) | null = null;
    let unsubTrades: (() => void) | null = null;
    let unsubCashflows: (() => void) | null = null;

    setIsLoadingJournal(true);

    const startSync = async () => {
      try {
        await ensureJournalSettings();
        if (isCancelled) return;

        let settingsLoaded = false;
        let tradesLoaded = false;
        let cashflowsLoaded = false;

        const markReadyIfAllLoaded = () => {
          if (settingsLoaded && tradesLoaded && cashflowsLoaded && !isCancelled) {
            setIsLoadingJournal(false);
          }
        };

        unsubSettings = subscribeJournalSettings(
          (settings) => {
            setJournalState((prev) => ({
              ...prev,
              journalName: settings.journalName,
              initialCapitalIdr: settings.initialCapitalIdr,
            }));
            setTheme(settings.theme);
            settingsLoaded = true;
            markReadyIfAllLoaded();
          },
          (err) => {
            if (!isCancelled) setFatalSyncError(err);
          }
        );

        unsubTrades = subscribeTrades(
          (trades) => {
            setJournalState((prev) => ({ ...prev, trades }));
            tradesLoaded = true;
            markReadyIfAllLoaded();
          },
          (err) => {
            if (!isCancelled) setFatalSyncError(err);
          }
        );

        unsubCashflows = subscribeCashflows(
          (cashflows) => {
            setJournalState((prev) => ({ ...prev, cashflows }));
            cashflowsLoaded = true;
            markReadyIfAllLoaded();
          },
          (err) => {
            if (!isCancelled) setFatalSyncError(err);
          }
        );
      } catch (err) {
        if (!isCancelled) {
          setFatalSyncError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    };

    void startSync();

    return () => {
      isCancelled = true;
      unsubSettings?.();
      unsubTrades?.();
      unsubCashflows?.();
    };
  }, []);

  useEffect(() => {
    document.title = `${journalState.journalName} — Dashboard Jurnal Trading Forex`;
  }, [journalState.journalName]);

  if (fatalSyncError) {
    throw fatalSyncError;
  }

  const overallSummary = useMemo(
    () =>
      computeDashboardSummary(
        journalState.initialCapitalIdr,
        journalState.trades,
        journalState.cashflows
      ),
    [journalState.initialCapitalIdr, journalState.trades, journalState.cashflows]
  );

  const summary = useMemo(
    () =>
      computeDashboardSummary(
        journalState.initialCapitalIdr,
        journalState.trades,
        journalState.cashflows,
        dateRange
      ),
    [journalState.initialCapitalIdr, journalState.trades, journalState.cashflows, dateRange]
  );

  const handleToggleTheme = async () => {
    const nextTheme: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    try {
      await updateThemeInDb(nextTheme);
    } catch (err) {
      setFatalSyncError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const startEditingJournalName = () => {
    setDraftJournalName(journalState.journalName);
    setIsEditingName(true);
  };

  const handleSaveJournalName = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = draftJournalName.trim().slice(0, BLUEPRINT_LIMITS.JOURNAL_NAME_MAX);
    if (!trimmed) return;
    setIsEditingName(false);
    try {
      await updateJournalNameInDb(trimmed);
    } catch (err) {
      setFatalSyncError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleCancelEditJournalName = () => {
    setIsEditingName(false);
    setDraftJournalName('');
  };

  const handleAddManualTrade = async (tradeData: Omit<TradeEntry, 'id' | 'createdAt'>) => {
    try {
      await addTradeInDb(tradeData);
    } catch (err) {
      setFatalSyncError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleAiImport = async (payload: {
    rawText: string;
    imageBase64?: string;
    imageMimeType?: string;
  }): Promise<boolean> => {
    setIsImportingAi(true);
    setAiError(null);

    try {
      const response = await fetch('/api/analyze-trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: payload.rawText,
          imageBase64: payload.imageBase64,
          imageMimeType: payload.imageMimeType,
          referenceDate: getLocalDateKey(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Gagal mengekstrak data trade.');
      }

      const rawParsed = Array.isArray(data.parsedTrades) ? data.parsedTrades : [];
      if (rawParsed.length === 0) {
        throw new Error('Tidak ditemukan transaksi yang jelas pada catatan atau gambar.');
      }

      const newTrades: Array<Omit<TradeEntry, 'id' | 'createdAt'>> = rawParsed.map(
        (item: Record<string, unknown>) => {
          const rawPnl = Number(item.pnlIdr ?? 0);
          const outcome = sanitizeOutcome(String(item.outcome ?? 'Win'), rawPnl);
          const pnlIdr = normalizeTradePnl(outcome, rawPnl);
          const dateKey =
            typeof item.dateKey === 'string' && BLUEPRINT_LIMITS.DATE_KEY_PATTERN.test(item.dateKey)
              ? item.dateKey
              : getLocalDateKey();

          return {
            dateKey,
            session: sanitizeSession(String(item.session || 'London')),
            dateLabel: formatShortDateLabel(dateKey),
            pair: String(item.pair || 'EURUSD')
              .toUpperCase()
              .slice(0, BLUEPRINT_LIMITS.PAIR_MAX),
            position: sanitizeDirection(String(item.position || 'Buy')),
            method: (String(item.method || 'Setup Umum').trim() || 'Setup Umum').slice(
              0,
              BLUEPRINT_LIMITS.METHOD_MAX
            ),
            riskPercent: Math.max(0.1, Math.min(100, Number(item.riskPercent ?? 1.5))),
            outcome,
            pnlIdr,
            note: String(item.note || '').slice(0, BLUEPRINT_LIMITS.NOTE_MAX),
          };
        }
      );

      await batchAddTradesInDb(newTrades);
      return true;
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Gagal menghubungi server.');
      return false;
    } finally {
      setIsImportingAi(false);
    }
  };

  const handleDeleteTrade = async (id: string) => {
    try {
      await deleteTradeInDb(id);
    } catch (err) {
      setFatalSyncError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleUpdateInitialCapital = async (amountIdr: number) => {
    try {
      await updateInitialCapitalInDb(amountIdr);
    } catch (err) {
      setFatalSyncError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleAddCashflow = async (entry: Omit<CashflowEntry, 'id' | 'createdAt'>) => {
    try {
      await addCashflowInDb(entry);
    } catch (err) {
      setFatalSyncError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleDeleteCashflow = async (id: string) => {
    try {
      await deleteCashflowInDb(id);
    } catch (err) {
      setFatalSyncError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleLoadDemoData = async () => {
    if (isMutatingDb) return;
    setIsMutatingDb(true);
    try {
      await replaceWithDemoDataInDb();
      setMethodFilter('ALL');
      setDateRange({ startDate: '', endDate: '' });
    } catch (err) {
      setFatalSyncError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsMutatingDb(false);
    }
  };

  const handleClearAllTrades = async () => {
    if (isMutatingDb) return;
    setIsMutatingDb(true);
    try {
      await clearJournalDataInDb();
      setMethodFilter('ALL');
      setDateRange({ startDate: '', endDate: '' });
    } catch (err) {
      setFatalSyncError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsMutatingDb(false);
    }
  };

  const navItems: Array<{ id: ActiveView; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'methods', label: 'Analisa Metode', icon: Layers },
    { id: 'journal', label: 'Log Jurnal', icon: Table2 },
  ];

  const activeViewTitle =
    activeView === 'dashboard'
      ? 'Dashboard Ringkasan'
      : activeView === 'methods'
      ? 'Analisa Metode Terbaik & Terburuk'
      : 'Log Jurnal Transaksi';

  return (
    <div className="min-h-screen bg-[#F4F6F9] dark:bg-[#090E1A] text-slate-900 dark:text-slate-100 flex transition-colors duration-200">
      {/* Deep Obsidian Navy Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-[#0B1120] dark:bg-[#060A14] dark:border-r dark:border-slate-800/80 text-slate-300 px-5 py-6 justify-between">
        <div className="space-y-8">
          <div className="px-2">
            {isEditingName ? (
              <form onSubmit={handleSaveJournalName} className="space-y-2">
                <label htmlFor="sidebar-journal-name-input" className="sr-only">
                  Nama jurnal
                </label>
                <input
                  id="sidebar-journal-name-input"
                  type="text"
                  value={draftJournalName}
                  onChange={(e) => setDraftJournalName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') handleCancelEditJournalName();
                  }}
                  maxLength={BLUEPRINT_LIMITS.JOURNAL_NAME_MAX}
                  autoFocus
                  required
                  className="w-full px-2.5 py-1.5 text-sm font-semibold text-white bg-slate-900 border border-teal-500/70 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                />
                <div className="flex items-center gap-1.5">
                  <button
                    type="submit"
                    aria-label="Simpan nama jurnal"
                    className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-medium text-white bg-teal-700 hover:bg-teal-600 rounded-md transition-colors"
                  >
                    <Check className="w-3 h-3" aria-hidden="true" />
                    Simpan
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEditJournalName}
                    aria-label="Batal edit nama jurnal"
                    className="px-2 py-1 text-[11px] font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors"
                  >
                    Batal
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span className="text-lg font-bold tracking-tight text-white truncate">
                  {journalState.journalName}
                </span>
                <button
                  type="button"
                  onClick={startEditingJournalName}
                  aria-label="Edit nama jurnal"
                  title="Edit nama jurnal"
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>

          <nav aria-label="Navigasi utama" className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap text-left ${
                    isActive
                      ? 'bg-slate-800/90 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-teal-400' : 'text-slate-400'
                    }`}
                    aria-hidden="true"
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Account Summary, Theme & Data Utilities */}
        <div className="space-y-4">
          <div className="p-4 bg-[#111827] dark:bg-slate-900/90 border border-transparent dark:border-slate-800/80 rounded-xl space-y-2.5">
            <div className="text-[11px] font-medium text-slate-400">Ringkasan Akun</div>
            <div className="text-lg font-bold font-mono tabular-nums text-white">
              {formatIdr(overallSummary.currentBalanceIdr)}
            </div>
            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
              <span className="text-slate-400">Profit/Loss</span>
              <span
                className={`font-mono tabular-nums font-semibold ${
                  overallSummary.pureTradingPnLIdr > 0
                    ? 'text-emerald-400'
                    : overallSummary.pureTradingPnLIdr < 0
                    ? 'text-rose-400'
                    : 'text-slate-300'
                }`}
              >
                {formatIdr(overallSummary.pureTradingPnLIdr, true)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsCapitalOpen(true)}
              className="w-full mt-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
            >
              <Wallet className="w-3.5 h-3.5 text-teal-400" aria-hidden="true" />
              Atur Modal Akun
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isMutatingDb}
              onClick={handleLoadDemoData}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-2 text-[11px] font-medium text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
            >
              <Database className="w-3.5 h-3.5" aria-hidden="true" />
              Data Contoh
            </button>
            <button
              type="button"
              disabled={isMutatingDb}
              onClick={handleClearAllTrades}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-2 text-[11px] font-medium text-slate-400 hover:text-rose-300 bg-slate-900/80 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
            >
              <Trash className="w-3.5 h-3.5" aria-hidden="true" />
              Kosongkan
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {isMobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={() => setIsMobileNavOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-72 max-w-[85vw] bg-[#0B1120] dark:bg-[#060A14] text-slate-200 h-full p-5 flex flex-col justify-between z-10">
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-2">
                <span className="text-lg font-bold text-white truncate">
                  {journalState.journalName}
                </span>
                <button
                  type="button"
                  onClick={() => setIsMobileNavOpen(false)}
                  aria-label="Tutup menu"
                  className="p-2 text-slate-400 hover:text-white rounded-lg"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
              <nav aria-label="Navigasi seluler" className="space-y-1.5">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveView(item.id);
                        setIsMobileNavOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg text-left ${
                        isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setIsMobileNavOpen(false);
                  setIsCapitalOpen(true);
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-medium text-white bg-slate-800 rounded-lg"
              >
                <Wallet className="w-4 h-4 text-teal-400" aria-hidden="true" />
                Atur Modal Akun
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isMutatingDb}
                  onClick={() => {
                    void handleLoadDemoData();
                    setIsMobileNavOpen(false);
                  }}
                  className="flex-1 py-2 text-xs text-slate-300 bg-slate-900 rounded-lg"
                >
                  Data Contoh
                </button>
                <button
                  type="button"
                  disabled={isMutatingDb}
                  onClick={() => {
                    void handleClearAllTrades();
                    setIsMobileNavOpen(false);
                  }}
                  className="flex-1 py-2 text-xs text-slate-400 bg-slate-900 rounded-lg"
                >
                  Kosongkan
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Clean 3-Zone Top Bar */}
        <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur border-b border-slate-200/90 dark:border-slate-800 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-3 transition-colors">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(true)}
              aria-label="Buka menu navigasi"
              className="lg:hidden p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg shrink-0"
            >
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>
            <div className="text-sm text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5 min-w-0">
              {isEditingName ? (
                <form
                  onSubmit={handleSaveJournalName}
                  className="lg:hidden flex items-center gap-1.5 min-w-0"
                >
                  <label htmlFor="mobile-journal-name-input" className="sr-only">
                    Nama jurnal
                  </label>
                  <input
                    id="mobile-journal-name-input"
                    type="text"
                    value={draftJournalName}
                    onChange={(e) => setDraftJournalName(e.target.value)}
                    maxLength={BLUEPRINT_LIMITS.JOURNAL_NAME_MAX}
                    required
                    className="w-32 sm:w-44 px-2 py-1 text-xs font-semibold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 border border-teal-600 rounded-md focus:outline-none"
                  />
                  <button
                    type="submit"
                    aria-label="Simpan nama jurnal"
                    className="p-1 text-white bg-teal-700 rounded-md shrink-0"
                  >
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEditJournalName}
                    aria-label="Batal edit nama jurnal"
                    className="p-1 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-md shrink-0"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </form>
              ) : (
                <>
                  <span className="lg:hidden font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {journalState.journalName}
                  </span>
                  <button
                    type="button"
                    onClick={startEditingJournalName}
                    aria-label="Edit nama jurnal"
                    className="lg:hidden p-1 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 rounded-md shrink-0"
                  >
                    <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </>
              )}
              <span className="hidden lg:inline font-semibold text-slate-900 dark:text-slate-100">
                {activeViewTitle}
              </span>
              <span className="hidden sm:inline mx-1 text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
              <span className="hidden sm:inline font-mono tabular-nums text-slate-600 dark:text-slate-300">
                {summary.totalTrades} Trade · Win Rate {summary.winRatePct}%
              </span>
              {summary.circuitBreaker.hasAnyTriggeredDay && (
                <span className="hidden md:inline-flex items-center gap-1 ml-2 text-xs font-semibold text-rose-700 dark:text-rose-400">
                  <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
                  Rem Darurat Terpicu
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleToggleTheme}
              data-testid="theme-toggle-button"
              aria-label={theme === 'dark' ? 'Ubah ke Mode Terang' : 'Ubah ke Mode Gelap'}
              title={theme === 'dark' ? 'Ubah ke Mode Terang' : 'Ubah ke Mode Gelap'}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                  <span className="hidden sm:inline">Mode Terang</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
                  <span className="hidden sm:inline">Mode Gelap</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsCapitalOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Wallet className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" aria-hidden="true" />
              Modal
            </button>

            <button
              type="button"
              onClick={() => setIsAddTradeOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              Catat Trade
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-7 space-y-6">
          {isLoadingJournal ? (
            <div className="bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-slate-800 rounded-xl p-10 text-center text-sm text-slate-600 dark:text-slate-300">
              Menyinkronkan data jurnal dari Firestore...
            </div>
          ) : (
            <>
              {/* Date Range Filter Bar at Top of Dashboard */}
              <DateRangeBar dateRange={dateRange} onChange={setDateRange} />

              {/* Circuit Breaker (Rem Darurat 3x Loss Sehari) Monitoring */}
              <CircuitBreakerBanner status={summary.circuitBreaker} />

              {/* 4-Column KPI Summary Strip */}
              <section
                aria-label="Statistik utama"
                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
              >
                <div className="bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-slate-800 rounded-xl p-5 transition-colors">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {summary.isPeriodFiltered ? 'Saldo Akhir Periode' : 'Saldo Akun Saat Ini'}
                  </div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1.5">
                    {formatIdr(summary.currentBalanceIdr)}
                  </div>
                  <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-1.5">
                    {summary.isPeriodFiltered
                      ? `Saldo awal periode ${formatIdr(summary.initialCapitalIdr)}`
                      : `Modal disetor ${formatIdr(summary.totalDepositedIdr)}`}
                  </div>
                </div>

                <div className="bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-slate-800 rounded-xl p-5 transition-colors">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {summary.isPeriodFiltered ? 'Profit / Loss Periode' : 'Profit / Loss Bersih'}
                  </div>
                  <div
                    className={`text-2xl font-bold font-mono tabular-nums mt-1.5 ${
                      summary.pureTradingPnLIdr > 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : summary.pureTradingPnLIdr < 0
                        ? 'text-rose-700 dark:text-rose-400'
                        : 'text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    {formatIdr(summary.pureTradingPnLIdr, true)}
                  </div>
                  <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-1.5">
                    Return{' '}
                    {summary.pureTradingReturnPct >= 0
                      ? `+${summary.pureTradingReturnPct}%`
                      : `${summary.pureTradingReturnPct}%`}{' '}
                    {summary.isPeriodFiltered ? 'di periode ini' : 'dari modal awal'}
                  </div>
                </div>

                <div className="bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-slate-800 rounded-xl p-5 transition-colors">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Win Rate</div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1.5">
                    {summary.winRatePct.toFixed(1)}%
                  </div>
                  <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-1.5">
                    {summary.winCount} Win · {summary.lossCount} Loss · {summary.beCount} BE
                  </div>
                </div>

                <div className="bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-slate-800 rounded-xl p-5 transition-colors">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Profit Factor</div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1.5">
                    {summary.profitFactor === null ? '∞' : summary.profitFactor.toFixed(2)}
                  </div>
                  <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-1.5">
                    Avg Win {formatIdr(summary.avgWinIdr)} · Avg Loss {formatIdr(summary.avgLossIdr)}
                  </div>
                </div>
              </section>

              {activeView === 'dashboard' && (
                <>
                  {/* Equity Curve + Pair Breakdown Split */}
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
                    <div className="xl:col-span-8">
                      <EquityCurveChart
                        equityCurve={summary.equityCurve}
                        initialCapitalIdr={summary.initialCapitalIdr}
                        isPeriodFiltered={summary.isPeriodFiltered}
                      />
                    </div>

                    <aside className="xl:col-span-4 bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between space-y-5 transition-colors">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                          <div>
                            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                              Performa per Pair
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              Kontribusi hasil bersih tiap instrumen
                            </p>
                          </div>
                          <BarChart3 className="w-4 h-4 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                        </div>

                        {summary.pairStats.length === 0 ? (
                          <p className="text-xs text-slate-500 dark:text-slate-400 py-8 text-center">
                            Belum ada data pair tercatat.
                          </p>
                        ) : (
                          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                            {summary.pairStats.map((ps) => (
                              <li
                                key={ps.pair}
                                className="py-3 flex items-center justify-between gap-3"
                              >
                                <div>
                                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    {ps.pair}
                                  </div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                                    {ps.totalTrades} trade · WR {ps.winRatePct}%
                                  </div>
                                </div>
                                <div
                                  className={`text-sm font-bold font-mono tabular-nums ${
                                    ps.netPnLIdr > 0
                                      ? 'text-emerald-700 dark:text-emerald-400'
                                      : ps.netPnLIdr < 0
                                      ? 'text-rose-700 dark:text-rose-400'
                                      : 'text-slate-600 dark:text-slate-400'
                                  }`}
                                >
                                  {formatIdr(ps.netPnLIdr, true)}
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Quick Best vs Worst Trade Highlight */}
                      {summary.bestTrade && (
                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 dark:text-slate-400">Trade Terbaik</span>
                            <span className="font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                              #{summary.bestTrade.no} {summary.bestTrade.pair} (
                              {formatIdr(summary.bestTrade.pnlIdr, true)})
                            </span>
                          </div>
                          {summary.worstTrade && (
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500 dark:text-slate-400">Trade Terburuk</span>
                              <span className="font-mono tabular-nums font-semibold text-rose-700 dark:text-rose-400">
                                #{summary.worstTrade.no} {summary.worstTrade.pair} (
                                {formatIdr(summary.worstTrade.pnlIdr)})
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </aside>
                  </div>

                  {/* Best & Worst Method Analytics */}
                  <MethodAnalyticsSection
                    methodStats={summary.methodStats}
                    bestMethod={summary.bestMethod}
                    worstMethod={summary.worstMethod}
                    selectedMethodFilter={methodFilter}
                    onSelectMethodFilter={setMethodFilter}
                  />

                  {/* Full Trade Log */}
                  <JournalLogTable
                    rows={summary.computedRows}
                    availableMethods={summary.availableMethods}
                    methodFilter={methodFilter}
                    onMethodFilterChange={setMethodFilter}
                    onDeleteTrade={handleDeleteTrade}
                    onOpenAddModal={() => setIsAddTradeOpen(true)}
                  />
                </>
              )}

              {activeView === 'methods' && (
                <>
                  <MethodAnalyticsSection
                    methodStats={summary.methodStats}
                    bestMethod={summary.bestMethod}
                    worstMethod={summary.worstMethod}
                    selectedMethodFilter={methodFilter}
                    onSelectMethodFilter={setMethodFilter}
                  />
                  <JournalLogTable
                    rows={summary.computedRows}
                    availableMethods={summary.availableMethods}
                    methodFilter={methodFilter}
                    onMethodFilterChange={setMethodFilter}
                    onDeleteTrade={handleDeleteTrade}
                    onOpenAddModal={() => setIsAddTradeOpen(true)}
                  />
                </>
              )}

              {activeView === 'journal' && (
                <JournalLogTable
                  rows={summary.computedRows}
                  availableMethods={summary.availableMethods}
                  methodFilter={methodFilter}
                  onMethodFilterChange={setMethodFilter}
                  onDeleteTrade={handleDeleteTrade}
                  onOpenAddModal={() => setIsAddTradeOpen(true)}
                />
              )}
            </>
          )}
        </main>
      </div>

      <AddTradeModal
        isOpen={isAddTradeOpen}
        onClose={() => setIsAddTradeOpen(false)}
        onSubmitManualTrade={handleAddManualTrade}
        onSubmitAiImport={handleAiImport}
        isImportingAi={isImportingAi}
        aiError={aiError}
        onClearAiError={() => setAiError(null)}
      />

      <CapitalModal
        isOpen={isCapitalOpen}
        onClose={() => setIsCapitalOpen(false)}
        initialCapitalIdr={journalState.initialCapitalIdr}
        onUpdateInitialCapital={handleUpdateInitialCapital}
        cashflows={journalState.cashflows}
        onAddCashflow={handleAddCashflow}
        onDeleteCashflow={handleDeleteCashflow}
      />
    </div>
  );
}
