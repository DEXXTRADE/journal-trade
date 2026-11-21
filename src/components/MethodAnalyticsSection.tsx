import { ArrowDownRight, ArrowUpRight, Filter, Layers } from 'lucide-react';
import type { MethodStats } from '../types/journal';
import { formatIdr } from '../utils/tradingEngine';

interface MethodAnalyticsSectionProps {
  methodStats: MethodStats[];
  bestMethod: MethodStats | null;
  worstMethod: MethodStats | null;
  selectedMethodFilter: string;
  onSelectMethodFilter: (method: string) => void;
}

export function MethodAnalyticsSection({
  methodStats,
  bestMethod,
  worstMethod,
  selectedMethodFilter,
  onSelectMethodFilter,
}: MethodAnalyticsSectionProps) {
  const maxAbsPnL = Math.max(
    1,
    ...methodStats.map((m) => Math.abs(m.netPnLIdr))
  );

  return (
    <section
      aria-labelledby="heading-method-analytics"
      className="bg-white border border-slate-200/90 rounded-xl p-6 space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h2 id="heading-method-analytics" className="text-base font-semibold text-slate-900">
            Analisa Metode Terbaik &amp; Terburuk
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Perbandingan profitabilitas, win rate, dan profit factor di setiap metode trading Anda.
          </p>
        </div>

        {selectedMethodFilter !== 'ALL' && (
          <button
            type="button"
            onClick={() => onSelectMethodFilter('ALL')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            <Filter className="w-3.5 h-3.5" aria-hidden="true" />
            Filter Aktif: {selectedMethodFilter} (Reset)
          </button>
        )}
      </div>

      {methodStats.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm font-medium text-slate-700">Belum ada data metode trading.</p>
          <p className="text-xs text-slate-500 mt-1">
            Catat beberapa transaksi dengan label metode/strategi untuk melihat peringkat performa metode terbaik dan terburuk.
          </p>
        </div>
      ) : (
        <>
          {/* Best vs Worst Method Spotlight */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Best Method */}
            <div className="p-5 bg-emerald-50/60 rounded-xl space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                    <ArrowUpRight className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                    <span>Metode Terbaik</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mt-1">
                    {bestMethod?.method ?? '-'}
                  </h3>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold font-mono tabular-nums text-emerald-700">
                    {bestMethod ? formatIdr(bestMethod.netPnLIdr, true) : '-'}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                    Rata-rata {bestMethod ? formatIdr(bestMethod.avgPnLIdr, true) : '-'}/trade
                  </div>
                </div>
              </div>

              {bestMethod && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 border-t border-emerald-200/60 text-xs text-slate-700 font-mono tabular-nums">
                  <span>{bestMethod.totalTrades} Trade ({bestMethod.winCount}W/{bestMethod.lossCount}L/{bestMethod.beCount}BE)</span>
                  <span aria-hidden="true">·</span>
                  <span>Win Rate {bestMethod.winRatePct}%</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    PF {bestMethod.profitFactor === null ? '∞' : bestMethod.profitFactor}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-sans">Pair utama: {bestMethod.topPair}</span>
                </div>
              )}
            </div>

            {/* Worst Method */}
            <div className="p-5 bg-rose-50/60 rounded-xl space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-800">
                    <ArrowDownRight className="w-4 h-4 text-rose-600" aria-hidden="true" />
                    <span>Metode Terburuk</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mt-1">
                    {worstMethod ? worstMethod.method : 'Belum Ada Metode Rugi'}
                  </h3>
                </div>
                {worstMethod && (
                  <div className="text-right">
                    <div
                      className={`text-lg font-bold font-mono tabular-nums ${
                        worstMethod.netPnLIdr < 0 ? 'text-rose-700' : 'text-slate-800'
                      }`}
                    >
                      {formatIdr(worstMethod.netPnLIdr, true)}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                      Rata-rata {formatIdr(worstMethod.avgPnLIdr, true)}/trade
                    </div>
                  </div>
                )}
              </div>

              {worstMethod ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 border-t border-rose-200/60 text-xs text-slate-700 font-mono tabular-nums">
                  <span>{worstMethod.totalTrades} Trade ({worstMethod.winCount}W/{worstMethod.lossCount}L/{worstMethod.beCount}BE)</span>
                  <span aria-hidden="true">·</span>
                  <span>Win Rate {worstMethod.winRatePct}%</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    PF {worstMethod.profitFactor === null ? '∞' : worstMethod.profitFactor}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-sans">Pair dominan: {worstMethod.topPair}</span>
                </div>
              ) : (
                <p className="text-xs text-slate-600 pt-2 border-t border-rose-200/60">
                  Baru terdapat satu metode aktif dengan performa positif.
                </p>
              )}
            </div>
          </div>

          {/* Visual Performance Bar Ranking */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                <span>Peringkat Profit/Loss Bersih per Metode</span>
              </div>
              <span className="font-normal text-slate-500">Klik baris untuk memfilter jurnal</span>
            </div>

            <div className="space-y-2.5">
              {methodStats.map((m) => {
                const widthPct = Math.max(4, Math.round((Math.abs(m.netPnLIdr) / maxAbsPnL) * 100));
                const isPositive = m.netPnLIdr >= 0;
                const isSelected = selectedMethodFilter === m.method;

                return (
                  <button
                    key={m.method}
                    type="button"
                    onClick={() =>
                      onSelectMethodFilter(isSelected ? 'ALL' : m.method)
                    }
                    className={`w-full text-left p-3 rounded-lg transition-colors flex flex-col sm:flex-row sm:items-center gap-3 ${
                      isSelected
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-50/90 hover:bg-slate-100 text-slate-900'
                    }`}
                  >
                    <div className="sm:w-52 shrink-0">
                      <div className="text-sm font-semibold truncate">{m.method}</div>
                      <div
                        className={`text-[11px] font-mono tabular-nums ${
                          isSelected ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        {m.totalTrades} trade · WR {m.winRatePct}% · PF{' '}
                        {m.profitFactor === null ? '∞' : m.profitFactor}
                      </div>
                    </div>

                    <div className="flex-1 flex items-center gap-3 min-w-0">
                      <div
                        className={`flex-1 h-2.5 rounded-full overflow-hidden ${
                          isSelected ? 'bg-slate-800' : 'bg-slate-200/80'
                        }`}
                      >
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isPositive ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>

                      <div
                        className={`w-28 text-right text-sm font-bold font-mono tabular-nums shrink-0 ${
                          isSelected
                            ? isPositive
                              ? 'text-emerald-300'
                              : 'text-rose-300'
                            : isPositive
                            ? 'text-emerald-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {formatIdr(m.netPnLIdr, true)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detailed Method Table */}
          <div className="overflow-x-auto pt-2 border-t border-slate-100">
            <table className="w-full text-left border-collapse" data-testid="method-analytics-table">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th scope="col" className="py-2.5 pr-3 whitespace-nowrap">Metode / Strategi</th>
                  <th scope="col" className="py-2.5 px-3 text-right whitespace-nowrap">Trade</th>
                  <th scope="col" className="py-2.5 px-3 text-right whitespace-nowrap">W / L / BE</th>
                  <th scope="col" className="py-2.5 px-3 text-right whitespace-nowrap">Win Rate</th>
                  <th scope="col" className="py-2.5 px-3 text-right whitespace-nowrap">Profit Factor</th>
                  <th scope="col" className="py-2.5 px-3 text-right whitespace-nowrap">Rata-rata / Trade</th>
                  <th scope="col" className="py-2.5 pl-3 text-right whitespace-nowrap">Net Profit/Loss</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[13px]">
                {methodStats.map((m, idx) => {
                  const isBest = idx === 0 && m.netPnLIdr > 0;
                  const isWorst =
                    worstMethod && worstMethod.method === m.method && m.netPnLIdr < 0;

                  return (
                    <tr key={m.method} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 pr-3 font-medium text-slate-900 whitespace-nowrap">
                        <span>{m.method}</span>
                        {isBest && (
                          <span className="ml-2 text-[11px] font-semibold text-emerald-700">
                            Terbaik
                          </span>
                        )}
                        {isWorst && (
                          <span className="ml-2 text-[11px] font-semibold text-rose-700">
                            Terburuk
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {m.totalTrades}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {m.winCount} / {m.lossCount} / {m.beCount}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                        {m.winRatePct.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                        {m.profitFactor === null ? '∞' : m.profitFactor.toFixed(2)}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap ${
                          m.avgPnLIdr > 0
                            ? 'text-emerald-700'
                            : m.avgPnLIdr < 0
                            ? 'text-rose-700'
                            : 'text-slate-600'
                        }`}
                      >
                        {formatIdr(m.avgPnLIdr, true)}
                      </td>
                      <td
                        className={`py-2.5 pl-3 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                          m.netPnLIdr > 0
                            ? 'text-emerald-700'
                            : m.netPnLIdr < 0
                            ? 'text-rose-700'
                            : 'text-slate-700'
                        }`}
                      >
                        {formatIdr(m.netPnLIdr, true)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
