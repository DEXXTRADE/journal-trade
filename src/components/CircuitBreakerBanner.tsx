import { AlertTriangle, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { CircuitBreakerStatus } from '../types/journal';
import { formatIdr, formatShortDateLabel } from '../utils/tradingEngine';

interface CircuitBreakerBannerProps {
  status: CircuitBreakerStatus;
}

export function CircuitBreakerBanner({ status }: CircuitBreakerBannerProps) {
  const {
    dailyLossLimit,
    todayDateKey,
    todayLossCount,
    todayLossIdr,
    isTodayTriggered,
    isWarning,
    triggeredDays,
    hasAnyTriggeredDay,
  } = status;

  const containerStyle = hasAnyTriggeredDay
    ? 'bg-rose-50/90 border-rose-200'
    : isWarning
    ? 'bg-amber-50/90 border-amber-200'
    : 'bg-white border-slate-200/90';

  const filledSegments = Math.min(dailyLossLimit, todayLossCount);

  return (
    <section
      aria-label="Pemantauan Circuit Breaker"
      data-testid="circuit-breaker-banner"
      data-status={hasAnyTriggeredDay ? 'triggered' : isWarning ? 'warning' : 'safe'}
      className={`border rounded-xl px-5 py-4 transition-colors ${containerStyle}`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div
            className={`p-2 rounded-lg shrink-0 mt-0.5 ${
              hasAnyTriggeredDay
                ? 'bg-rose-100 text-rose-700'
                : isWarning
                ? 'bg-amber-100 text-amber-700'
                : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            {hasAnyTriggeredDay ? (
              <ShieldAlert className="w-5 h-5" aria-hidden="true" />
            ) : isWarning ? (
              <AlertTriangle className="w-5 h-5" aria-hidden="true" />
            ) : (
              <ShieldCheck className="w-5 h-5" aria-hidden="true" />
            )}
          </div>

          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900">
                {isTodayTriggered
                  ? 'Circuit Breaker Aktif — Batas 3x Loss Hari Ini Tercapai!'
                  : hasAnyTriggeredDay
                  ? 'Peringatan Circuit Breaker — Terdeteksi Hari ≥ 3x Loss'
                  : isWarning
                  ? 'Waspada Circuit Breaker — 2 dari 3 Loss Hari Ini'
                  : 'Circuit Breaker (Rem Darurat): Aman'}
              </h2>
              <span
                className={`text-xs font-mono tabular-nums font-semibold ${
                  isTodayTriggered
                    ? 'text-rose-700'
                    : isWarning
                    ? 'text-amber-800'
                    : 'text-slate-600'
                }`}
              >
                {todayLossCount}/{dailyLossLimit} Loss Hari Ini ({formatShortDateLabel(todayDateKey)})
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {isTodayTriggered ? (
                <>
                  Total kerugian hari ini mencapai{' '}
                  <span className="font-mono tabular-nums font-semibold text-rose-700">
                    -{formatIdr(todayLossIdr)}
                  </span>
                  . Hentikan eksekusi entry baru hari ini dan evaluasi setup sebelum sesi berikutnya.
                </>
              ) : hasAnyTriggeredDay ? (
                <>
                  Terdapat hari dengan ≥ {dailyLossLimit}x loss pada periode yang dipantau. Pastikan tetap berhenti trading saat batas harian tercapai.
                </>
              ) : isWarning ? (
                <>
                  1 loss lagi hari ini (saat ini{' '}
                  <span className="font-mono tabular-nums font-semibold text-amber-800">
                    -{formatIdr(todayLossIdr)}
                  </span>
                  ) akan mengaktifkan rem darurat. Perketat seleksi setup atau kurangi ukuran risiko.
                </>
              ) : (
                <>
                  Aturan rem darurat harian memantau batas maksimal {dailyLossLimit}x loss per hari.
                  {todayLossCount > 0 && (
                    <>
                      {' '}
                      Loss hari ini:{' '}
                      <span className="font-mono tabular-nums font-semibold text-rose-700">
                        -{formatIdr(todayLossIdr)}
                      </span>
                      .
                    </>
                  )}
                </>
              )}
            </p>

            {triggeredDays.length > 0 && (
              <div className="pt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <span className="font-medium text-rose-800">Hari terpicu:</span>
                {triggeredDays.map((day) => (
                  <span
                    key={day.dateKey}
                    className="font-mono tabular-nums text-rose-700 font-semibold"
                  >
                    {day.dateLabel} ({day.lossCount}x Loss · -{formatIdr(day.totalLossIdr)})
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 3-Segment Visual Daily Loss Meter */}
        <div className="flex items-center gap-3 shrink-0 self-start lg:self-center">
          <div className="text-right hidden sm:block">
            <div className="text-[11px] font-medium text-slate-500">Meter Loss Harian</div>
            <div
              className={`text-xs font-mono tabular-nums font-semibold ${
                isTodayTriggered
                  ? 'text-rose-700'
                  : isWarning
                  ? 'text-amber-800'
                  : 'text-slate-700'
              }`}
            >
              {todayLossCount} / {dailyLossLimit} Slot
            </div>
          </div>

          <div
            className="flex items-center gap-1.5"
            role="img"
            aria-label={`Meter loss hari ini: ${todayLossCount} dari ${dailyLossLimit}`}
          >
            {Array.from({ length: dailyLossLimit }).map((_, idx) => {
              const isFilled = idx < filledSegments;
              const slotColor = !isFilled
                ? 'bg-slate-200'
                : isTodayTriggered
                ? 'bg-rose-600'
                : isWarning
                ? 'bg-amber-500'
                : 'bg-rose-500';
              return (
                <span
                  key={idx}
                  className={`w-7 h-2.5 rounded-sm transition-colors ${slotColor}`}
                />
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
