import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type { CashflowEntry, ThemeMode, TradeEntry } from '../types/journal';
import {
  BLUEPRINT_LIMITS,
  DEFAULT_INITIAL_CAPITAL_IDR,
  DEFAULT_JOURNAL_NAME,
  DEFAULT_JOURNAL_TRADES,
  formatShortDateLabel,
  getLocalDateKey,
  normalizeTradePnl,
} from '../utils/tradingEngine';

export const MAIN_JOURNAL_ID = 'main';

export interface JournalSettingsDoc {
  journalName: string;
  initialCapitalIdr: number;
  theme: ThemeMode;
}

function clampString(val: string, maxLen: number): string {
  return val.trim().slice(0, maxLen);
}

function sanitizeDateKey(val: string): string {
  const clean = val.trim();
  return BLUEPRINT_LIMITS.DATE_KEY_PATTERN.test(clean) ? clean : getLocalDateKey();
}

function sanitizeAmount(val: number, fallback = 1): number {
  if (!Number.isFinite(val)) return fallback;
  return Math.max(1, Math.min(BLUEPRINT_LIMITS.MAX_AMOUNT_IDR, Math.round(val)));
}

function buildTradePayload(
  trade: Omit<TradeEntry, 'id' | 'createdAt'>,
  clientCreatedAt: string
) {
  const dateKey = sanitizeDateKey(trade.dateKey);
  const dateLabel = clampString(
    trade.dateLabel || formatShortDateLabel(dateKey),
    BLUEPRINT_LIMITS.DATE_LABEL_MAX
  );
  const pair = clampString(trade.pair.toUpperCase() || 'EURUSD', BLUEPRINT_LIMITS.PAIR_MAX);
  const method = clampString(trade.method || 'Setup Umum', BLUEPRINT_LIMITS.METHOD_MAX);
  const note = clampString(trade.note || '', BLUEPRINT_LIMITS.NOTE_MAX);
  const riskPercent = Math.max(0.1, Math.min(100, Number(trade.riskPercent) || 1));
  const rawSigned = normalizeTradePnl(trade.outcome, trade.pnlIdr);
  const pnlIdr = Math.max(
    -BLUEPRINT_LIMITS.MAX_AMOUNT_IDR,
    Math.min(BLUEPRINT_LIMITS.MAX_AMOUNT_IDR, rawSigned)
  );

  return {
    journalId: MAIN_JOURNAL_ID,
    dateKey,
    session: trade.session,
    dateLabel,
    pair,
    position: trade.position,
    method,
    riskPercent,
    outcome: trade.outcome,
    pnlIdr,
    note,
    clientCreatedAt: clampString(clientCreatedAt, BLUEPRINT_LIMITS.CLIENT_CREATED_AT_MAX),
    createdAt: serverTimestamp(),
  };
}

let inFlightEnsure: Promise<void> | null = null;

export async function ensureJournalSettings(): Promise<void> {
  if (inFlightEnsure) {
    return inFlightEnsure;
  }

  const settingsPath = `journals/${MAIN_JOURNAL_ID}`;
  const settingsRef = doc(db, 'journals', MAIN_JOURNAL_ID);

  inFlightEnsure = (async () => {
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(settingsRef);
        if (!snap.exists()) {
          tx.set(settingsRef, {
            journalId: MAIN_JOURNAL_ID,
            journalName: DEFAULT_JOURNAL_NAME,
            initialCapitalIdr: DEFAULT_INITIAL_CAPITAL_IDR,
            theme: 'light',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, settingsPath);
    } finally {
      inFlightEnsure = null;
    }
  })();

  return inFlightEnsure;
}

export function subscribeJournalSettings(
  onData: (settings: JournalSettingsDoc) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `journals/${MAIN_JOURNAL_ID}`;
  const ref = doc(db, 'journals', MAIN_JOURNAL_ID);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData({
          journalName: DEFAULT_JOURNAL_NAME,
          initialCapitalIdr: DEFAULT_INITIAL_CAPITAL_IDR,
          theme: 'light',
        });
        return;
      }
      const data = snap.data();
      onData({
        journalName:
          typeof data.journalName === 'string' && data.journalName.trim()
            ? data.journalName.trim()
            : DEFAULT_JOURNAL_NAME,
        initialCapitalIdr:
          typeof data.initialCapitalIdr === 'number' && data.initialCapitalIdr > 0
            ? data.initialCapitalIdr
            : DEFAULT_INITIAL_CAPITAL_IDR,
        theme: data.theme === 'dark' ? 'dark' : 'light',
      });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeTrades(
  onData: (trades: TradeEntry[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `journals/${MAIN_JOURNAL_ID}/trades`;
  const q = query(
    collection(db, 'journals', MAIN_JOURNAL_ID, 'trades'),
    where('journalId', '==', MAIN_JOURNAL_ID)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: TradeEntry[] = snap.docs.map((d) => {
        const data = d.data();
        const dateKey = typeof data.dateKey === 'string' ? data.dateKey : getLocalDateKey();
        return {
          id: d.id,
          dateKey,
          session:
            data.session === 'Asia' || data.session === 'New York' ? data.session : 'London',
          dateLabel:
            typeof data.dateLabel === 'string'
              ? data.dateLabel
              : formatShortDateLabel(dateKey),
          pair: typeof data.pair === 'string' ? data.pair : 'EURUSD',
          position: data.position === 'Sell' ? 'Sell' : 'Buy',
          method: typeof data.method === 'string' ? data.method : 'Tanpa Metode',
          riskPercent: typeof data.riskPercent === 'number' ? data.riskPercent : 1,
          outcome:
            data.outcome === 'Loss' || data.outcome === 'BE' ? data.outcome : 'Win',
          pnlIdr: typeof data.pnlIdr === 'number' ? data.pnlIdr : 0,
          note: typeof data.note === 'string' ? data.note : '',
          createdAt:
            typeof data.clientCreatedAt === 'string'
              ? data.clientCreatedAt
              : new Date().toISOString(),
        };
      });
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeCashflows(
  onData: (cashflows: CashflowEntry[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `journals/${MAIN_JOURNAL_ID}/cashflows`;
  const q = query(
    collection(db, 'journals', MAIN_JOURNAL_ID, 'cashflows'),
    where('journalId', '==', MAIN_JOURNAL_ID)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: CashflowEntry[] = snap.docs.map((d) => {
        const data = d.data();
        const dateKey = typeof data.dateKey === 'string' ? data.dateKey : getLocalDateKey();
        return {
          id: d.id,
          dateKey,
          dateLabel:
            typeof data.dateLabel === 'string'
              ? data.dateLabel
              : formatShortDateLabel(dateKey),
          type: data.type === 'withdraw' ? 'withdraw' : 'deposit',
          amountIdr: typeof data.amountIdr === 'number' ? data.amountIdr : 0,
          note: typeof data.note === 'string' ? data.note : '',
          createdAt:
            typeof data.clientCreatedAt === 'string'
              ? data.clientCreatedAt
              : new Date().toISOString(),
        };
      });
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function updateJournalNameInDb(journalName: string): Promise<void> {
  const path = `journals/${MAIN_JOURNAL_ID}`;
  const cleanName = clampString(journalName, BLUEPRINT_LIMITS.JOURNAL_NAME_MAX);
  if (!cleanName) return;

  try {
    await updateDoc(doc(db, 'journals', MAIN_JOURNAL_ID), {
      journalName: cleanName,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateInitialCapitalInDb(initialCapitalIdr: number): Promise<void> {
  const path = `journals/${MAIN_JOURNAL_ID}`;
  const safeAmount = sanitizeAmount(initialCapitalIdr, DEFAULT_INITIAL_CAPITAL_IDR);

  try {
    await updateDoc(doc(db, 'journals', MAIN_JOURNAL_ID), {
      initialCapitalIdr: safeAmount,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateThemeInDb(theme: ThemeMode): Promise<void> {
  const path = `journals/${MAIN_JOURNAL_ID}`;
  const safeTheme: ThemeMode = theme === 'dark' ? 'dark' : 'light';

  try {
    await updateDoc(doc(db, 'journals', MAIN_JOURNAL_ID), {
      theme: safeTheme,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function addTradeInDb(
  trade: Omit<TradeEntry, 'id' | 'createdAt'>
): Promise<void> {
  const tradeId = `trade-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const path = `journals/${MAIN_JOURNAL_ID}/trades/${tradeId}`;
  const payload = buildTradePayload(trade, new Date().toISOString());

  try {
    await setDoc(doc(db, 'journals', MAIN_JOURNAL_ID, 'trades', tradeId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function batchAddTradesInDb(
  trades: Array<Omit<TradeEntry, 'id' | 'createdAt'>>
): Promise<void> {
  const path = `journals/${MAIN_JOURNAL_ID}/trades`;
  const batch = writeBatch(db);
  const nowMs = Date.now();

  trades.forEach((trade, idx) => {
    const tradeId = `imp-${nowMs}-${idx}-${Math.random().toString(36).slice(2, 6)}`;
    const clientCreatedAt = new Date(nowMs + idx * 1000).toISOString();
    const ref = doc(db, 'journals', MAIN_JOURNAL_ID, 'trades', tradeId);
    batch.set(ref, buildTradePayload(trade, clientCreatedAt));
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteTradeInDb(tradeId: string): Promise<void> {
  const path = `journals/${MAIN_JOURNAL_ID}/trades/${tradeId}`;
  try {
    await deleteDoc(doc(db, 'journals', MAIN_JOURNAL_ID, 'trades', tradeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function addCashflowInDb(
  entry: Omit<CashflowEntry, 'id' | 'createdAt'>
): Promise<void> {
  const cfId = `cf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const path = `journals/${MAIN_JOURNAL_ID}/cashflows/${cfId}`;
  const dateKey = sanitizeDateKey(entry.dateKey);

  try {
    await setDoc(doc(db, 'journals', MAIN_JOURNAL_ID, 'cashflows', cfId), {
      journalId: MAIN_JOURNAL_ID,
      dateKey,
      dateLabel: clampString(
        entry.dateLabel || formatShortDateLabel(dateKey),
        BLUEPRINT_LIMITS.DATE_LABEL_MAX
      ),
      type: entry.type === 'withdraw' ? 'withdraw' : 'deposit',
      amountIdr: sanitizeAmount(entry.amountIdr, 1000),
      note: clampString(entry.note || '', BLUEPRINT_LIMITS.CASHFLOW_NOTE_MAX),
      clientCreatedAt: new Date().toISOString(),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteCashflowInDb(cashflowId: string): Promise<void> {
  const path = `journals/${MAIN_JOURNAL_ID}/cashflows/${cashflowId}`;
  try {
    await deleteDoc(doc(db, 'journals', MAIN_JOURNAL_ID, 'cashflows', cashflowId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function clearJournalDataInDb(): Promise<void> {
  const tradesPath = `journals/${MAIN_JOURNAL_ID}/trades`;
  const cashflowsPath = `journals/${MAIN_JOURNAL_ID}/cashflows`;

  try {
    const [tradesSnap, cashflowsSnap] = await Promise.all([
      getDocs(
        query(
          collection(db, 'journals', MAIN_JOURNAL_ID, 'trades'),
          where('journalId', '==', MAIN_JOURNAL_ID)
        )
      ),
      getDocs(
        query(
          collection(db, 'journals', MAIN_JOURNAL_ID, 'cashflows'),
          where('journalId', '==', MAIN_JOURNAL_ID)
        )
      ),
    ]);

    const batch = writeBatch(db);
    tradesSnap.docs.forEach((d) => batch.delete(d.ref));
    cashflowsSnap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${tradesPath} & ${cashflowsPath}`);
  }
}

export async function replaceWithDemoDataInDb(): Promise<void> {
  const path = `journals/${MAIN_JOURNAL_ID}/trades`;
  try {
    const [tradesSnap, cashflowsSnap] = await Promise.all([
      getDocs(
        query(
          collection(db, 'journals', MAIN_JOURNAL_ID, 'trades'),
          where('journalId', '==', MAIN_JOURNAL_ID)
        )
      ),
      getDocs(
        query(
          collection(db, 'journals', MAIN_JOURNAL_ID, 'cashflows'),
          where('journalId', '==', MAIN_JOURNAL_ID)
        )
      ),
    ]);

    const batch = writeBatch(db);
    tradesSnap.docs.forEach((d) => batch.delete(d.ref));
    cashflowsSnap.docs.forEach((d) => batch.delete(d.ref));

    batch.update(doc(db, 'journals', MAIN_JOURNAL_ID), {
      initialCapitalIdr: DEFAULT_INITIAL_CAPITAL_IDR,
      updatedAt: serverTimestamp(),
    });

    for (const demo of DEFAULT_JOURNAL_TRADES) {
      const ref = doc(db, 'journals', MAIN_JOURNAL_ID, 'trades', demo.id);
      batch.set(ref, buildTradePayload(demo, demo.createdAt));
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
