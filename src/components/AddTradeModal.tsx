import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { ImagePlus, Plus, Send, X } from 'lucide-react';
import type {
  TradeDirection,
  TradeEntry,
  TradeOutcome,
  TradingSession,
} from '../types/journal';
import { BLUEPRINT_LIMITS, formatShortDateLabel, getLocalDateKey } from '../utils/tradingEngine';

interface AddTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitManualTrade: (trade: Omit<TradeEntry, 'id' | 'createdAt'>) => void;
  onSubmitAiImport: (payload: {
    rawText: string;
    imageBase64?: string;
    imageMimeType?: string;
  }) => Promise<boolean>;
  isImportingAi: boolean;
  aiError: string | null;
  onClearAiError: () => void;
}

type ModalTab = 'manual' | 'import';

export function AddTradeModal({
  isOpen,
  onClose,
  onSubmitManualTrade,
  onSubmitAiImport,
  isImportingAi,
  aiError,
  onClearAiError,
}: AddTradeModalProps) {
  const [activeTab, setActiveTab] = useState<ModalTab>('manual');

  // Manual state
  const [dateKey, setDateKey] = useState(() => getLocalDateKey());
  const [session, setSession] = useState<TradingSession>('London');
  const [pair, setPair] = useState('XAUUSD');
  const [position, setPosition] = useState<TradeDirection>('Buy');
  const [method, setMethod] = useState('');
  const [riskPercent, setRiskPercent] = useState('1.5');
  const [outcome, setOutcome] = useState<TradeOutcome>('Win');
  const [pnlAmount, setPnlAmount] = useState('');
  const [note, setNote] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  // Import state
  const [rawText, setRawText] = useState('');
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | undefined>(undefined);
  const [imageMimeType, setImageMimeType] = useState<string | undefined>(undefined);
  const [imageFileName, setImageFileName] = useState<string | null>(null);
  const [importValidationError, setImportValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleManualSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleanPair = pair.trim().toUpperCase();
    const finalMethod = method.trim();
    const parsedRisk = Number(riskPercent);
    const rawPnl = Number(pnlAmount || '0');

    if (!cleanPair) {
      setManualError('Nama pair wajib diisi (contoh: XAUUSD, EURUSD).');
      return;
    }
    if (!finalMethod) {
      setManualError('Tulis nama metode / strategi trading Anda.');
      return;
    }
    if (!Number.isFinite(parsedRisk) || parsedRisk <= 0) {
      setManualError('Persentase risiko harus lebih dari 0.');
      return;
    }
    if (outcome !== 'BE' && (!Number.isFinite(rawPnl) || rawPnl <= 0)) {
      setManualError('Masukkan nominal Profit/Loss (Rp) lebih dari 0.');
      return;
    }

    setManualError(null);
    const signedPnl =
      outcome === 'BE' ? 0 : outcome === 'Loss' ? -Math.abs(rawPnl) : Math.abs(rawPnl);

    onSubmitManualTrade({
      dateKey,
      session,
      dateLabel: formatShortDateLabel(dateKey),
      pair: cleanPair,
      position,
      method: finalMethod,
      riskPercent: Number(parsedRisk.toFixed(2)),
      outcome,
      pnlIdr: Math.round(signedPnl),
      note: note.trim(),
    });

    setMethod('');
    setPnlAmount('');
    setNote('');
    onClose();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setImportValidationError('File harus berupa gambar (PNG, JPG, WebP).');
      return;
    }
    setImportValidationError(null);
    onClearAiError();
    setImageFileName(file.name);
    setImageMimeType(file.type);

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setImagePreviewUrl(result);
      const commaIdx = result.indexOf(',');
      setImageBase64(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImagePreviewUrl(null);
    setImageBase64(undefined);
    setImageMimeType(undefined);
    setImageFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImportSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!rawText.trim() && !imageBase64) {
      setImportValidationError('Tempel catatan hasil trade atau lampirkan screenshot.');
      return;
    }
    setImportValidationError(null);
    onClearAiError();
    const ok = await onSubmitAiImport({
      rawText: rawText.trim(),
      imageBase64,
      imageMimeType,
    });
    if (ok) {
      setRawText('');
      clearImage();
      onClose();
    }
  };

  const inputClass =
    'w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 dark:focus:border-teal-500';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 dark:bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-add-trade-title"
    >
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 id="modal-add-trade-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Catat Trade Baru
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Masukkan detail transaksi beserta metode yang digunakan untuk melacak performa strategi.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog catat trade"
            className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div
          className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-lg w-fit"
          role="tablist"
          aria-label="Metode pencatatan"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'manual'}
            onClick={() => setActiveTab('manual')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'manual'
                ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Form Jurnal
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'import'}
            onClick={() => setActiveTab('import')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'import'
                ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Impor Catatan / Screenshot
          </button>
        </div>

        {activeTab === 'manual' ? (
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="trade-date" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Tanggal
                </label>
                <input
                  id="trade-date"
                  type="date"
                  value={dateKey}
                  onChange={(e) => setDateKey(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="trade-session" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Sesi Market
                </label>
                <select
                  id="trade-session"
                  value={session}
                  onChange={(e) => setSession(e.target.value as TradingSession)}
                  className={inputClass}
                >
                  <option value="Asia">Asia</option>
                  <option value="London">London</option>
                  <option value="New York">New York</option>
                </select>
              </div>

              <div>
                <label htmlFor="trade-pair" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Pair
                </label>
                <input
                  id="trade-pair"
                  type="text"
                  value={pair}
                  onChange={(e) => setPair(e.target.value)}
                  maxLength={BLUEPRINT_LIMITS.PAIR_MAX}
                  placeholder="XAUUSD"
                  required
                  className={`${inputClass} uppercase`}
                />
              </div>

              <div>
                <label htmlFor="trade-position" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Posisi
                </label>
                <select
                  id="trade-position"
                  value={position}
                  onChange={(e) => setPosition(e.target.value as TradeDirection)}
                  className={inputClass}
                >
                  <option value="Buy">Buy</option>
                  <option value="Sell">Sell</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="trade-method" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Metode / Strategi
                </label>
                <input
                  id="trade-method"
                  type="text"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  maxLength={BLUEPRINT_LIMITS.METHOD_MAX}
                  placeholder="Ketik metode Anda (contoh: Breakout Structure, Pullback EMA)"
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="trade-risk" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Risiko (%)
                </label>
                <input
                  id="trade-risk"
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="100"
                  value={riskPercent}
                  onChange={(e) => setRiskPercent(e.target.value)}
                  required
                  className={`${inputClass} font-mono tabular-nums`}
                />
              </div>

              <div>
                <label htmlFor="trade-outcome" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Hasil
                </label>
                <select
                  id="trade-outcome"
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value as TradeOutcome)}
                  className={inputClass}
                >
                  <option value="Win">Win</option>
                  <option value="Loss">Loss</option>
                  <option value="BE">BE (Breakeven)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="trade-pnl" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nominal Profit/Loss (Rp)
                </label>
                <input
                  id="trade-pnl"
                  type="number"
                  min="0"
                  step="100"
                  disabled={outcome === 'BE'}
                  value={outcome === 'BE' ? '0' : pnlAmount}
                  onChange={(e) => setPnlAmount(e.target.value)}
                  placeholder={outcome === 'Loss' ? 'Contoh: 10000' : 'Contoh: 25000'}
                  className={`${inputClass} font-mono tabular-nums disabled:bg-slate-50 dark:disabled:bg-slate-800/50 disabled:text-slate-400 dark:disabled:text-slate-500`}
                />
              </div>
            </div>

            <div>
              <label htmlFor="trade-note" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Catatan Setup
              </label>
              <input
                id="trade-note"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={BLUEPRINT_LIMITS.NOTE_MAX}
                placeholder="Contoh: Retest support valid di H1, eksekusi sesuai plan"
                className={inputClass}
              />
            </div>

            {manualError && (
              <div
                role="alert"
                className="p-3 text-xs text-rose-800 dark:text-rose-200 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-lg"
              >
                {manualError}
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Batal
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 dark:bg-teal-600 hover:bg-slate-800 dark:hover:bg-teal-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                Simpan Trade
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleImportSubmit} className="space-y-4">
            <div>
              <label htmlFor="import-notes" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Tempel Catatan atau Poin Transaksi
              </label>
              <textarea
                id="import-notes"
                rows={4}
                value={rawText}
                onChange={(e) => {
                  setRawText(e.target.value);
                  if (importValidationError) setImportValidationError(null);
                }}
                placeholder={
                  'Contoh:\n- EURUSD Buy metode Breakout Structure, risiko 1.5%, win +Rp18.000\n- XAUUSD Sell metode Counter-Trend Scalping, risiko 2%, loss -Rp12.000'
                }
                className={`${inputClass} py-2.5 px-3.5`}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  id="import-screenshot-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="sr-only"
                />
                <label
                  htmlFor="import-screenshot-upload"
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors whitespace-nowrap shrink-0"
                >
                  <ImagePlus className="w-4 h-4 text-slate-600 dark:text-slate-400" aria-hidden="true" />
                  Lampirkan Screenshot
                </label>
                {imageFileName && (
                  <div className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <span className="truncate max-w-[180px]">{imageFileName}</span>
                    <button
                      type="button"
                      onClick={clearImage}
                      aria-label="Hapus screenshot"
                      className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isImportingAi}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-slate-900 dark:bg-teal-600 rounded-lg hover:bg-slate-800 dark:hover:bg-teal-500 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
              >
                <Send className="w-3.5 h-3.5" aria-hidden="true" />
                {isImportingAi ? 'Memproses...' : 'Ekstrak & Simpan'}
              </button>
            </div>

            {imagePreviewUrl && (
              <img
                src={imagePreviewUrl}
                alt="Pratinjau screenshot trade"
                className="max-h-44 rounded-lg border border-slate-200 dark:border-slate-700 object-contain"
              />
            )}

            {(importValidationError || aiError) && (
              <div
                role="alert"
                className="p-3 text-xs text-rose-800 dark:text-rose-200 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-lg"
              >
                {importValidationError || aiError}
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
