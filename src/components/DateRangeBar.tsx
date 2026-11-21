import { Calendar, RotateCcw } from 'lucide-react';
import type { DateRangeFilter } from '../types/journal';
import {
  formatShortDateLabel,
  getLocalDateKey,
  getMonthRangeForDate,
  shiftDateKey,
} from '../utils/tradingEngine';

interface DateRangeBarProps {
  dateRange: DateRangeFilter;
  onChange: (next: DateRangeFilter) => void;
}

type PresetKey = 'all' | '7d' | '30d' | 'month' | 'custom';

export function DateRangeBar({ dateRange, onChange }: DateRangeBarProps) {
  const todayKey = getLocalDateKey();
  const weekStartKey = shiftDateKey(todayKey, -6);
  const monthRollingStartKey = shiftDateKey(todayKey, -29);
  const currentMonthRange = getMonthRangeForDate();

  const activePreset: PresetKey =
    !dateRange.startDate && !dateRange.endDate
      ? 'all'
      : dateRange.startDate === weekStartKey && dateRange.endDate === todayKey
      ? '7d'
      : dateRange.startDate === monthRollingStartKey && dateRange.endDate === todayKey
      ? '30d'
      : dateRange.startDate === currentMonthRange.startDate &&
        dateRange.endDate === currentMonthRange.endDate
      ? 'month'
      : 'custom';

  const hasFilter = Boolean(dateRange.startDate || dateRange.endDate);

  const rangeSummaryLabel = !hasFilter
    ? 'Semua Riwayat'
    : dateRange.startDate && dateRange.endDate
    ? `${formatShortDateLabel(dateRange.startDate)} — ${formatShortDateLabel(dateRange.endDate)}`
    : dateRange.startDate
    ? `Mulai ${formatShortDateLabel(dateRange.startDate)}`
    : `Sampai ${formatShortDateLabel(dateRange.endDate)}`;

  const handlePreset = (preset: Exclude<PresetKey, 'custom'>) => {
    if (preset === 'all') {
      onChange({ startDate: '', endDate: '' });
      return;
    }
    if (preset === '7d') {
      onChange({ startDate: weekStartKey, endDate: todayKey });
      return;
    }
    if (preset === '30d') {
      onChange({ startDate: monthRollingStartKey, endDate: todayKey });
      return;
    }
    onChange(currentMonthRange);
  };

  return (
    <section
      aria-label="Filter rentang tanggal"
      className="bg-white border border-slate-200/90 rounded-xl px-4 py-3.5 sm:px-5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3.5"
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
          <Calendar className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
          <span>Periode:</span>
          <span className="font-mono tabular-nums text-slate-600 font-medium">
            {rangeSummaryLabel}
          </span>
        </div>

        <div
          className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
          role="group"
          aria-label="Preset rentang tanggal"
        >
          {(
            [
              { key: 'all', label: 'Semua' },
              { key: '7d', label: 'Mingguan (7H)' },
              { key: '30d', label: '30 Hari' },
              { key: 'month', label: 'Bulan Ini' },
            ] as const
          ).map((item) => {
            const isActive = activePreset === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handlePreset(item.key)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
        <div className="flex items-center gap-1.5">
          <label htmlFor="filter-date-start" className="text-xs font-medium text-slate-500">
            Dari
          </label>
          <input
            id="filter-date-start"
            type="date"
            value={dateRange.startDate}
            onChange={(e) => onChange({ ...dateRange, startDate: e.target.value })}
            aria-label="Tanggal mulai"
            className="px-2.5 py-1.5 text-xs font-mono tabular-nums border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <label htmlFor="filter-date-end" className="text-xs font-medium text-slate-500">
            Sampai
          </label>
          <input
            id="filter-date-end"
            type="date"
            value={dateRange.endDate}
            onChange={(e) => onChange({ ...dateRange, endDate: e.target.value })}
            aria-label="Tanggal akhir"
            className="px-2.5 py-1.5 text-xs font-mono tabular-nums border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
          />
        </div>

        {hasFilter && (
          <button
            type="button"
            onClick={() => onChange({ startDate: '', endDate: '' })}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            Reset
          </button>
        )}
      </div>
    </section>
  );
}
