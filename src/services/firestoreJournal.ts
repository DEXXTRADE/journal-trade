import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type { CashflowEntry, TradeEntry } from '../types/journal';
import {
  BLUEPRINT_LIMITS,
  DEFAULT_INITIAL_CAPITAL_IDR,
  DEFAULT_JOURNAL_NAME,
  DEFAULT_JOURNAL_TRADES,
  formatShortDateLabel,
  getLocalDateKey,
  normalizeTradePnl,
} from '../utils/tradingEngine';

export interface JournalSettingsDoc {
  journalName: string;
  initialCapitalIdr: number;
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
  userId: string,
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
    ownerId: userId,
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

export async function ensureJournalSettings(userId: string): Promise<void> {
  const settingsPath = `users/${userId}/journal/settings`;
  const settingsRef = doc(db, 'users', userId, 'journal', 'settings');
  try {
    const snap = await getDoc(settingsRef);
    if (!snap.exists()) {
      await setDoc(settingsRef, {
        ownerId: userId,
        journalName: DEFAULT_JOURNAL_NAME,
        initialCapitalIdr: DEFAULT_INITIAL_CAPITAL_IDR,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, settingsPath);
  }
}

export function subscribeJournalSettings(
  userId: string,
  onData: (settings: JournalSettingsDoc) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${userId}/journal/settings`;
  const ref = doc(db, 'users', userId, 'journal', 'settings');
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData({
          journalName: DEFAULT_JOURNAL_NAME,
          initialCapitalIdr: DEFAULT_INITIAL_CAPITAL_IDR,
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
  userId: string,
  onData: (trades: TradeEntry[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${userId}/trades`;
  const q = query(collection(db, 'users', userId, 'trades'), where('ownerId', '==', userId));
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
  userId: string,
  onData: (cashflows: CashflowEntry[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${userId}/cashflows`;
  const q = query(
    collection(db, 'users', userId, 'cashflows'),
    where('ownerId', '==', userId)
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

export async function updateJournalNameInDb(userId: string, journalName: string): Promise<void> {
  const path = `users/${userId}/journal/settings`;
  const cleanName = clampString(journalName, BLUEPRINT_LIMITS.JOURNAL_NAME_MAX);
  if (!cleanName) return;

  try {
    await updateDoc(doc(db, 'users', userId, 'journal', 'settings'), {
      journalName: cleanName,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateInitialCapitalInDb(
  userId: string,
  initialCapitalIdr: number
): Promise<void> {
  const path = `users/${userId}/journal/settings`;
  const safeAmount = sanitizeAmount(initialCapitalIdr, DEFAULT_INITIAL_CAPITAL_IDR);

  try {
    await updateDoc(doc(db, 'users', userId, 'journal', 'settings'), {
      initialCapitalIdr: safeAmount,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function addTradeInDb(
  userId: string,
  trade: Omit<TradeEntry, 'id' | 'createdAt'>
): Promise<void> {
  const tradeId = `trade-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const path = `users/${userId}/trades/${tradeId}`;
  const payload = buildTradePayload(userId, trade, new Date().toISOString());

  try {
    await setDoc(doc(db, 'users', userId, 'trades', tradeId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function batchAddTradesInDb(
  userId: string,
  trades: Array<Omit<TradeEntry, 'id' | 'createdAt'>>
): Promise<void> {
  const path = `users/${userId}/trades`;
  const batch = writeBatch(db);
  const nowMs = Date.now();

  trades.forEach((trade, idx) => {
    const tradeId = `imp-${nowMs}-${idx}-${Math.random().toString(36).slice(2, 6)}`;
    const clientCreatedAt = new Date(nowMs + idx * 1000).toISOString();
    const ref = doc(db, 'users', userId, 'trades', tradeId);
    batch.set(ref, buildTradePayload(userId, trade, clientCreatedAt));
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteTradeInDb(userId: string, tradeId: string): Promise<void> {
  const path = `users/${userId}/trades/${tradeId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'trades', tradeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function addCashflowInDb(
  userId: string,
  entry: Omit<CashflowEntry, 'id' | 'createdAt'>
): Promise<void> {
  const cfId = `cf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const path = `users/${userId}/cashflows/${cfId}`;
  const dateKey = sanitizeDateKey(entry.dateKey);

  try {
    await setDoc(doc(db, 'users', userId, 'cashflows', cfId), {
      ownerId: userId,
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

export async function deleteCashflowInDb(userId: string, cashflowId: string): Promise<void> {
  const path = `users/${userId}/cashflows/${cashflowId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'cashflows', cashflowId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function clearJournalDataInDb(userId: string): Promise<void> {
  const tradesPath = `users/${userId}/trades`;
  const cashflowsPath = `users/${userId}/cashflows`;

  try {
    const [tradesSnap, cashflowsSnap] = await Promise.all([
      getDocs(query(collection(db, 'users', userId, 'trades'), where('ownerId', '==', userId))),
      getDocs(
        query(collection(db, 'users', userId, 'cashflows'), where('ownerId', '==', userId))
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

export async function replaceWithDemoDataInDb(userId: string): Promise<void> {
  const path = `users/${userId}/trades`;
  try {
    const [tradesSnap, cashflowsSnap] = await Promise.all([
      getDocs(query(collection(db, 'users', userId, 'trades'), where('ownerId', '==', userId))),
      getDocs(
        query(collection(db, 'users', userId, 'cashflows'), where('ownerId', '==', userId))
      ),
    ]);

    const batch = writeBatch(db);
    tradesSnap.docs.forEach((d) => batch.delete(d.ref));
    cashflowsSnap.docs.forEach((d) => batch.delete(d.ref));

    batch.update(doc(db, 'users', userId, 'journal', 'settings'), {
      initialCapitalIdr: DEFAULT_INITIAL_CAPITAL_IDR,
      updatedAt: serverTimestamp(),
    });

    for (const demo of DEFAULT_JOURNAL_TRADES) {
      const ref = doc(db, 'users', userId, 'trades', demo.id);
      batch.set(ref, buildTradePayload(userId, demo, demo.createdAt));
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
