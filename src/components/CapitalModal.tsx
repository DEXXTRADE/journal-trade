import { useEffect, useState, type FormEvent } from 'react';
import { Trash2, X } from 'lucide-react';
import type { CashflowEntry } from '../types/journal';
import {
  BLUEPRINT_LIMITS,
  formatIdr,
  formatShortDateLabel,
  getLocalDateKey,
} from '../utils/tradingEngine';

interface CapitalModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCapitalIdr: number;
  onUpdateInitialCapital: (amountIdr: number) => void;
  cashflows: CashflowEntry[];
  onAddCashflow: (entry: Omit<CashflowEntry, 'id' | 'createdAt'>) => void;
  onDeleteCashflow: (id: string) => void;
}

export function CapitalModal({
  isOpen,
  onClose,
  initialCapitalIdr,
  onUpdateInitialCapital,
  cashflows,
  onAddCashflow,
  onDeleteCashflow,
}: CapitalModalProps) {
  const [capitalInput, setCapitalInput] = useState(String(initialCapitalIdr));
  const [dateKey, setDateKey] = useState(() => getLocalDateKey());
  const [type, setType] = useState<'deposit' | 'withdraw'>('deposit');
  const [amountInput, setAmountInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setCapitalInput(String(initialCapitalIdr));
  }, [initialCapitalIdr]);

  if (!isOpen) return null;

  const handleCapitalSave = (e: FormEvent) => {
    e.preventDefault();
    const num = Number(capitalInput);
    if (!Number.isFinite(num) || num <= 0) {
      setFormError('Modal awal harus lebih dari Rp0.');
      return;
    }
    setFormError(null);
    onUpdateInitialCapital(Math.round(num));
  };

  const handleAddCashflow = (e: FormEvent) => {
    e.preventDefault();
    const amount = Number(amountInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Masukkan nominal transaksi modal yang valid lebih dari Rp0.');
      return;
    }
    setFormError(null);
    onAddCashflow({
      dateKey,
      dateLabel: formatShortDateLabel(dateKey),
      type,
      amountIdr: Math.round(amount),
      note: noteInput.trim() || (type === 'deposit' ? 'Deposit akun' : 'Withdraw profit'),
    });
    setAmountInput('');
    setNoteInput('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-capital-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 id="modal-capital-title" className="text-lg font-semibold text-slate-900">
              Modal Awal &amp; Arus Kas Akun
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Atur modal awal dan catat deposit atau withdraw agar terpisah dari hasil murni trading.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog modal"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleCapitalSave} className="space-y-3 pb-5 border-b border-slate-100">
          <label htmlFor="initial-capital-input" className="block text-xs font-semibold text-slate-700">
            Modal Awal (Rp)
          </label>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <input
              id="initial-capital-input"
              type="number"
              min="1000"
              step="1000"
              value={capitalInput}
              onChange={(e) => setCapitalInput(e.target.value)}
              className="w-full sm:flex-1 min-w-0 px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600/20"
            />
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
            >
              Simpan Modal Awal
            </button>
          </div>
        </form>

        <form onSubmit={handleAddCashflow} className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">Catat Deposit / Withdraw</h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="cf-type" className="block text-xs font-medium text-slate-700 mb-1">
                Jenis
              </label>
              <select
                id="cf-type"
                value={type}
                onChange={(e) => setType(e.target.value as 'deposit' | 'withdraw')}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                <option value="deposit">Deposit</option>
                <option value="withdraw">Withdraw</option>
              </select>
            </div>

            <div>
              <label htmlFor="cf-date" className="block text-xs font-medium text-slate-700 mb-1">
                Tanggal
              </label>
              <input
                id="cf-date"
                type="date"
                value={dateKey}
                onChange={(e) => setDateKey(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label htmlFor="cf-amount" className="block text-xs font-medium text-slate-700 mb-1">
                Nominal (Rp)
              </label>
              <input
                id="cf-amount"
                type="number"
                min="1000"
                step="1000"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="50000"
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label htmlFor="cf-note" className="block text-xs font-medium text-slate-700 mb-1">
              Keterangan
            </label>
            <input
              id="cf-note"
              type="text"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              maxLength={BLUEPRINT_LIMITS.CASHFLOW_NOTE_MAX}
              placeholder="Contoh: Tambah saldo akun / Tarik sebagian profit"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
            />
          </div>

          {formError && (
            <p role="alert" className="text-xs text-rose-700">
              {formError}
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Simpan Transaksi Modal
            </button>
          </div>
        </form>

        <div className="pt-4 border-t border-slate-100 space-y-2.5">
          <h3 className="text-xs font-semibold text-slate-700">Riwayat Deposit &amp; Withdraw</h3>
          {cashflows.length === 0 ? (
            <p className="text-xs text-slate-500">Belum ada catatan deposit atau withdraw.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {cashflows.map((cf) => (
                <li key={cf.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium text-slate-900">
                      <span
                        className={
                          cf.type === 'deposit' ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'
                        }
                      >
                        {cf.type === 'deposit' ? 'Deposit' : 'Withdraw'}
                      </span>{' '}
                      · {cf.dateLabel} ·{' '}
                      <span className="font-mono tabular-nums">{formatIdr(cf.amountIdr)}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">{cf.note}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteCashflow(cf.id)}
                    aria-label={`Hapus transaksi ${cf.dateLabel}`}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
