import { useMemo, useState } from 'react';
import { Download, Plus, Search, Trash2 } from 'lucide-react';
import type { ComputedTradeRow, TradeOutcome } from '../types/journal';
import { formatIdr } from '../utils/tradingEngine';

interface JournalLogTableProps {
  rows: ComputedTradeRow[];
  availableMethods: string[];
  methodFilter: string;
  onMethodFilterChange: (method: string) => void;
  onDeleteTrade: (id: string) => void;
  onOpenAddModal: () => void;
}

type OutcomeFilter = 'ALL' | TradeOutcome;

export function JournalLogTable({
  rows,
  availableMethods,
  methodFilter,
  onMethodFilterChange,
  onDeleteTrade,
  onOpenAddModal,
}: JournalLogTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('ALL');

  const usedMethods = useMemo(() => {
    const set = new Set(rows.map((r) => r.method));
    return availableMethods.filter((m) => set.has(m));
  }, [rows, availableMethods]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((row) => {
      if (outcomeFilter !== 'ALL' && row.outcome !== outcomeFilter) {
        return false;
      }
      if (methodFilter !== 'ALL' && row.method !== methodFilter) {
        return false;
      }
      if (!q) return true;
      return (
        row.pair.toLowerCase().includes(q) ||
        row.method.toLowerCase().includes(q) ||
        row.dateLabel.toLowerCase().includes(q) ||
        row.session.toLowerCase().includes(q) ||
        row.note.toLowerCase().includes(q)
      );
    });
  }, [rows, searchQuery, outcomeFilter, methodFilter]);

  const handleExportCsv = () => {
    const header = [
      'No',
      'Tanggal',
      'Sesi',
      'Pair',
      'Posisi',
      'Metode',
      'Risiko (%)',
      'Hasil',
      'Profit/Loss (Rp)',
      'Saldo Akhir (Rp)',
      'Catatan',
    ];
    const escapeCell = (val: string | number) => `"${String(val).replace(/"/g, '""')}"`;
    const csvLines = [
      header.map(escapeCell).join(','),
      ...filteredRows.map((r) =>
        [
          r.no,
          r.dateLabel,
          r.session,
          r.pair,
          r.position,
          r.method,
          `${r.riskPercent}%`,
          r.outcome,
          r.pnlIdr,
          r.endingBalanceIdr,
          r.note,
        ]
          .map(escapeCell)
          .join(',')
      ),
    ];
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `jurnal-trade-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section
      aria-labelledby="heading-log-jurnal"
      className="bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-slate-800 rounded-xl p-6 transition-colors"
    >
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h2 id="heading-log-jurnal" className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Riwayat Transaksi (Trade Log)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Daftar lengkap seluruh trade beserta metode setup, hasil, saldo akhir, dan catatan eksekusi.
          </p>
        </div>

        <div className="flex flex-wrap lg:flex-nowrap items-center gap-2.5 shrink-0">
          <div className="relative">
            <Search
              className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <label htmlFor="journal-search" className="sr-only">
              Cari pair, metode, atau catatan
            </label>
            <input
              id="journal-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari pair atau catatan..."
              className="pl-9 pr-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 dark:focus:border-teal-500 w-44 sm:w-48"
            />
          </div>

          <div>
            <label htmlFor="method-filter-select" className="sr-only">
              Filter berdasarkan metode
            </label>
            <select
              id="method-filter-select"
              value={methodFilter}
              onChange={(e) => onMethodFilterChange(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 dark:focus:border-teal-500"
            >
              <option value="ALL">Semua Metode</option>
              {usedMethods.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div
            className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-lg shrink-0"
            role="group"
            aria-label="Filter hasil trade"
          >
            {(['ALL', 'Win', 'Loss', 'BE'] as OutcomeFilter[]).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setOutcomeFilter(opt)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  outcomeFilter === opt
                    ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {opt === 'ALL' ? 'Semua' : opt}
              </button>
            ))}
          </div>

          {rows.length > 0 && (
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              Ekspor CSV
            </button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="py-12 text-center space-y-3">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Belum ada transaksi yang tercatat.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Mulai catat trade pertama Anda untuk mengisi tabel riwayat, grafik saldo, dan analisa metode.
          </p>
          <button
            type="button"
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 dark:bg-teal-600 rounded-lg hover:bg-slate-800 dark:hover:bg-teal-500 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            Catat Trade Pertama
          </button>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Tidak ada trade yang cocok dengan filter yang dipilih.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left border-collapse" data-testid="journal-log-table">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <th scope="col" className="py-3 pr-2.5 whitespace-nowrap">No</th>
                <th scope="col" className="py-3 px-2.5 whitespace-nowrap">Tanggal / Sesi</th>
                <th scope="col" className="py-3 px-2.5 whitespace-nowrap">Pair</th>
                <th scope="col" className="py-3 px-2.5 whitespace-nowrap">Posisi</th>
                <th scope="col" className="py-3 px-2.5 whitespace-nowrap">Metode</th>
                <th scope="col" className="py-3 px-2.5 text-right whitespace-nowrap">Risiko</th>
                <th scope="col" className="py-3 px-2.5 whitespace-nowrap">Hasil</th>
                <th scope="col" className="py-3 px-2.5 text-right whitespace-nowrap">Profit/Loss</th>
                <th scope="col" className="py-3 px-2.5 text-right whitespace-nowrap">Saldo Akhir</th>
                <th scope="col" className="py-3 px-2.5 min-w-[200px]">Catatan</th>
                <th scope="col" className="py-3 pl-2 text-right whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-[13px]">
              {filteredRows.map((row) => {
                const outcomeTextClass =
                  row.outcome === 'Win'
                    ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                    : row.outcome === 'Loss'
                    ? 'text-rose-700 dark:text-rose-400 font-semibold'
                    : 'text-amber-700 dark:text-amber-400 font-semibold';

                const pnlClass =
                  row.pnlIdr > 0
                    ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                    : row.pnlIdr < 0
                    ? 'text-rose-700 dark:text-rose-400 font-semibold'
                    : 'text-slate-600 dark:text-slate-400';

                return (
                  <tr key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 pr-2.5 font-mono tabular-nums text-slate-500 dark:text-slate-400 align-top whitespace-nowrap">
                      {row.no}
                    </td>
                    <td className="py-3 px-2.5 text-slate-700 dark:text-slate-300 whitespace-nowrap align-top">
                      <span>{row.dateLabel}</span>
                      <span className="text-slate-400 dark:text-slate-600 mx-1" aria-hidden="true">·</span>
                      <span className="text-slate-500 dark:text-slate-400 text-xs">{row.session}</span>
                    </td>
                    <td className="py-3 px-2.5 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap align-top">
                      {row.pair}
                    </td>
                    <td className="py-3 px-2.5 text-slate-700 dark:text-slate-300 whitespace-nowrap align-top">
                      {row.position}
                    </td>
                    <td className="py-3 px-2.5 text-slate-700 dark:text-slate-300 whitespace-nowrap align-top">
                      {row.method}
                    </td>
                    <td className="py-3 px-2.5 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap align-top">
                      {row.riskPercent.toFixed(1)}%
                    </td>
                    <td className={`py-3 px-2.5 whitespace-nowrap align-top ${outcomeTextClass}`}>
                      {row.outcome}
                    </td>
                    <td className={`py-3 px-2.5 text-right font-mono tabular-nums whitespace-nowrap align-top ${pnlClass}`}>
                      {formatIdr(row.pnlIdr, true)}
                    </td>
                    <td className="py-3 px-2.5 text-right font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap align-top">
                      {formatIdr(row.endingBalanceIdr)}
                    </td>
                    <td className="py-3 px-2.5 text-slate-600 dark:text-slate-400 text-xs leading-relaxed min-w-[200px] align-top">
                      {row.note || '—'}
                    </td>
                    <td className="py-3 pl-2 text-right align-top whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onDeleteTrade(row.id)}
                        aria-label={`Hapus trade #${row.no} ${row.pair}`}
                        className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-md transition-colors"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
