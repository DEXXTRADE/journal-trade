import { useMemo, useState } from 'react';
import type { EquityPoint } from '../types/journal';
import { formatIdr } from '../utils/tradingEngine';

interface EquityCurveChartProps {
  equityCurve: EquityPoint[];
  initialCapitalIdr: number;
  isPeriodFiltered?: boolean;
}

type CurveViewMode = 'total' | 'pure';

export function EquityCurveChart({
  equityCurve,
  initialCapitalIdr,
  isPeriodFiltered = false,
}: EquityCurveChartProps) {
  const [viewMode, setViewMode] = useState<CurveViewMode>('total');
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);

  const chartDimensions = {
    width: 820,
    height: 290,
    padTop: 22,
    padRight: 24,
    padBottom: 40,
    padLeft: 86,
  };

  const innerWidth = chartDimensions.width - chartDimensions.padLeft - chartDimensions.padRight;
  const innerHeight = chartDimensions.height - chartDimensions.padTop - chartDimensions.padBottom;

  const { yMin, yMax, yTicks } = useMemo(() => {
    const allValues: number[] = [];
    for (const pt of equityCurve) {
      allValues.push(pt.totalBalanceIdr, pt.depositedCapitalIdr, pt.pureTradingEquityIdr);
    }
    allValues.push(initialCapitalIdr);

    const rawMin = Math.min(...allValues);
    const rawMax = Math.max(...allValues);
    const span = Math.max(15000, rawMax - rawMin);
    const padding = Math.ceil(span * 0.16);

    const minBound = Math.max(0, Math.floor((rawMin - padding) / 1000) * 1000);
    const maxBound = Math.ceil((rawMax + padding) / 1000) * 1000;
    const step = Math.max(1000, Math.round((maxBound - minBound) / 4 / 500) * 500);

    const ticks: number[] = [];
    for (let i = 0; i <= 4; i += 1) {
      ticks.push(minBound + step * i);
    }
    return { yMin: minBound, yMax: ticks[ticks.length - 1], yTicks: ticks };
  }, [equityCurve, initialCapitalIdr]);

  const getX = (index: number): number => {
    if (equityCurve.length <= 1) return chartDimensions.padLeft + innerWidth / 2;
    return chartDimensions.padLeft + (index / (equityCurve.length - 1)) * innerWidth;
  };

  const getY = (value: number): number => {
    const ratio = (value - yMin) / Math.max(1, yMax - yMin);
    return chartDimensions.padTop + innerHeight - ratio * innerHeight;
  };

  const buildPolylinePoints = (selector: (pt: EquityPoint) => number): string => {
    return equityCurve
      .map((pt, idx) => `${getX(idx).toFixed(1)},${getY(selector(pt)).toFixed(1)}`)
      .join(' ');
  };

  const buildAreaPath = (selector: (pt: EquityPoint) => number): string => {
    if (equityCurve.length === 0) return '';
    const baseY = getY(yMin);
    const coords = equityCurve.map((pt, idx) => `${getX(idx).toFixed(1)},${getY(selector(pt)).toFixed(1)}`);
    const firstX = getX(0).toFixed(1);
    const lastX = getX(equityCurve.length - 1).toFixed(1);
    return `M ${firstX},${baseY.toFixed(1)} L ${coords.join(' L ')} L ${lastX},${baseY.toFixed(1)} Z`;
  };

  const activePoint =
    hoveredStep !== null
      ? equityCurve.find((p) => p.step === hoveredStep) ?? equityCurve[equityCurve.length - 1]
      : equityCurve[equityCurve.length - 1];

  const lastPurePnl = equityCurve[equityCurve.length - 1]?.pureTradingPnLIdr ?? 0;
  const primaryStroke = lastPurePnl >= 0 ? '#10B981' : '#F43F5E';

  return (
    <section
      aria-labelledby="heading-equity-curve"
      className="bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-slate-800 rounded-xl p-6 transition-colors"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h2 id="heading-equity-curve" className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Grafik Pertumbuhan Saldo (Equity Curve)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Pergerakan ekuitas akun dan hasil murni trading dari modal awal hingga trade terakhir.
          </p>
        </div>

        <div
          className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-lg self-start sm:self-auto"
          role="group"
          aria-label="Mode kurva saldo"
        >
          <button
            type="button"
            onClick={() => setViewMode('total')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              viewMode === 'total'
                ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Saldo &amp; Modal
          </button>
          <button
            type="button"
            onClick={() => setViewMode('pure')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              viewMode === 'pure'
                ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Ekuitas Murni Trading
          </button>
        </div>
      </div>

      {equityCurve.length <= 1 ? (
        <div className="py-14 text-center">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Belum ada data trade untuk digambarkan pada grafik.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Tambahkan trade pertama Anda untuk melihat kurva pertumbuhan saldo secara real-time.
          </p>
        </div>
      ) : (
        <div className="pt-5 space-y-4">
          {/* Active Point Inspection Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50/90 dark:bg-slate-900/75 rounded-lg border border-transparent dark:border-slate-800/80">
            <div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Titik Transaksi</div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5 truncate">
                {activePoint?.label ?? '-'}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Saldo Akun</div>
              <div className="text-sm font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                {formatIdr(activePoint?.totalBalanceIdr ?? 0)}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {isPeriodFiltered ? 'Baseline Periode' : 'Modal Disetor'}
              </div>
              <div className="text-sm font-semibold font-mono tabular-nums text-slate-700 dark:text-slate-300 mt-0.5">
                {formatIdr(activePoint?.depositedCapitalIdr ?? 0)}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Profit/Loss Murni</div>
              <div
                className={`text-sm font-semibold font-mono tabular-nums mt-0.5 ${
                  (activePoint?.pureTradingPnLIdr ?? 0) > 0
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : (activePoint?.pureTradingPnLIdr ?? 0) < 0
                    ? 'text-rose-700 dark:text-rose-400'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                {formatIdr(activePoint?.pureTradingPnLIdr ?? 0, true)}
              </div>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${chartDimensions.width} ${chartDimensions.height}`}
              className="w-full min-w-[540px] h-auto select-none"
              role="img"
              aria-label="Grafik garis pertumbuhan saldo trading forex"
            >
              <defs>
                <linearGradient id="equityAreaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={primaryStroke} stopOpacity="0.2" />
                  <stop offset="100%" stopColor={primaryStroke} stopOpacity="0.00" />
                </linearGradient>
              </defs>

              {yTicks.map((tick) => {
                const y = getY(tick);
                return (
                  <g key={tick}>
                    <line
                      x1={chartDimensions.padLeft}
                      x2={chartDimensions.padLeft + innerWidth}
                      y1={y}
                      y2={y}
                      className="stroke-slate-200 dark:stroke-slate-800"
                      strokeWidth="1"
                    />
                    <text
                      x={chartDimensions.padLeft - 10}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-slate-500 dark:fill-slate-400 text-[11px] font-mono tabular-nums"
                    >
                      {formatIdr(tick)}
                    </text>
                  </g>
                );
              })}

              {equityCurve.map((pt, idx) => {
                const showLabel =
                  equityCurve.length <= 12 ||
                  idx === 0 ||
                  idx === equityCurve.length - 1 ||
                  idx % Math.ceil(equityCurve.length / 8) === 0;
                if (!showLabel) return null;
                return (
                  <text
                    key={pt.step}
                    x={getX(idx)}
                    y={chartDimensions.height - 12}
                    textAnchor="middle"
                    className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono tabular-nums"
                  >
                    {pt.step === 0 ? 'Awal' : `#${pt.step}`}
                  </text>
                );
              })}

              {/* Area fill */}
              <path
                d={buildAreaPath((p) =>
                  viewMode === 'total' ? p.totalBalanceIdr : p.pureTradingEquityIdr
                )}
                fill="url(#equityAreaFill)"
              />

              {/* Deposited Capital Baseline */}
              <polyline
                fill="none"
                className="stroke-slate-400 dark:stroke-slate-500"
                strokeWidth="1.75"
                strokeDasharray="5 4"
                points={buildPolylinePoints((p) =>
                  viewMode === 'total' ? p.depositedCapitalIdr : initialCapitalIdr
                )}
              />

              {/* Main Equity Line */}
              <polyline
                fill="none"
                stroke={primaryStroke}
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={buildPolylinePoints((p) =>
                  viewMode === 'total' ? p.totalBalanceIdr : p.pureTradingEquityIdr
                )}
              />

              {equityCurve.map((pt, idx) => {
                const cx = getX(idx);
                const cy = getY(
                  viewMode === 'total' ? pt.totalBalanceIdr : pt.pureTradingEquityIdr
                );
                const isSelected = activePoint?.step === pt.step;

                let dotColor = '#0D9488';
                if (pt.eventType === 'trade') {
                  dotColor =
                    pt.outcome === 'Win' ? '#10B981' : pt.outcome === 'Loss' ? '#F43F5E' : '#F59E0B';
                } else if (pt.eventType === 'cashflow') {
                  dotColor = '#64748B';
                }

                return (
                  <g key={pt.step}>
                    {isSelected && (
                      <line
                        x1={cx}
                        x2={cx}
                        y1={chartDimensions.padTop}
                        y2={chartDimensions.padTop + innerHeight}
                        className="stroke-slate-300 dark:stroke-slate-600"
                        strokeWidth="1"
                        strokeDasharray="3 3"
                      />
                    )}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isSelected ? 5.5 : 3.8}
                      fill={dotColor}
                      className="stroke-white dark:stroke-[#111827]"
                      strokeWidth="1.5"
                    />
                    <rect
                      x={cx - 14}
                      y={chartDimensions.padTop}
                      width="28"
                      height={innerHeight}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredStep(pt.step)}
                      onFocus={() => setHoveredStep(pt.step)}
                      onMouseLeave={() => setHoveredStep(null)}
                      tabIndex={0}
                      aria-label={`${pt.label}: Saldo ${formatIdr(pt.totalBalanceIdr)}`}
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-4 h-0.5"
                style={{ backgroundColor: primaryStroke }}
                aria-hidden="true"
              />
              <span>
                {viewMode === 'total'
                  ? 'Kurva Saldo Akun'
                  : 'Kurva Ekuitas Murni Trading'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-4 border-t-2 border-dashed border-slate-400 dark:border-slate-500"
                aria-hidden="true"
              />
              <span>
                {isPeriodFiltered
                  ? 'Baseline Saldo Awal Periode'
                  : viewMode === 'total'
                  ? 'Baseline Modal Disetor'
                  : 'Baseline Modal Awal'}
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
