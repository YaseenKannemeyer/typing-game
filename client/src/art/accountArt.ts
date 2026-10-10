/**
 * Typed ports of design-kits/account-profile-kit/src/{charts,account,profile}.js
 * string renderers: line charts, per-mode bars, initials avatar and the
 * progress-preservation illustration. Output is byte-identical to the kit
 * (accountArt.test.ts). Data must be preaggregated by the server.
 */
import { escapeHtml as E, iconSvg } from './gridArt';

export const CHART_TOKENS = { wpm: '#b9f46a', accuracy: '#9fcaff', grid: '#354b3c', axis: '#b1beb3', fill: '#b9f46a10', stroke: 3, point: 4 } as const;

export interface DailyPoint {
  date: string;
  value: number | null;
}

interface NormalizedPoint {
  date: string;
  time: number;
  value: number | null;
}

export function normalizeSeries(data: readonly DailyPoint[]): NormalizedPoint[] {
  return data
    .map((d) => ({
      date: String(d.date),
      time: Date.parse(d.date),
      value: typeof d.value === 'number' && Number.isFinite(d.value) && d.value >= 0 ? d.value : null,
    }))
    .filter((d) => Number.isFinite(d.time))
    .sort((a, b) => a.time - b.time);
}

const DATE_FORMAT = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });
export const dateLabel = (d: string) => DATE_FORMAT.format(new Date(d));

export interface LineChartOptions {
  data?: readonly DailyPoint[];
  metric?: 'wpm' | 'accuracy';
  title?: string;
  compact?: boolean;
}

export function lineChartSvg({ data = [], metric = 'wpm', title = metric === 'accuracy' ? 'Accuracy trend' : 'Your pace, over time', compact = false }: LineChartOptions = {}): string {
  const normalized = normalizeSeries(data);
  const points = normalized.map((p) => ({ ...p, value: metric === 'accuracy' && p.value !== null && p.value > 100 ? null : p.value }));
  const valid = points.filter((p): p is NormalizedPoint & { value: number } => p.value !== null);
  const unit = metric === 'accuracy' ? '%' : ' WPM';
  if (!valid.length)
    return `<div class="a-chart-empty"><span>${iconSvg('clock', 32)}</span><h3>Your first race starts the story.</h3><p>Finish a verified race to see your ${metric === 'accuracy' ? 'accuracy' : 'WPM'} here.</p></div>`;
  const width = 600, height = 240, left = 48, right = 18, top = 22, bottom = 38;
  const min = metric === 'accuracy' && Math.min(...valid.map((p) => p.value)) >= 90 ? 90 : 0;
  const max = metric === 'accuracy' ? 100 : Math.max(20, Math.ceil(Math.max(...valid.map((p) => p.value)) / 20) * 20);
  const t0 = points[0]!.time, t1 = points[points.length - 1]!.time;
  const X = (t: number) => left + (t1 === t0 ? (width - left - right) / 2 : ((t - t0) / (t1 - t0)) * (width - left - right));
  const Y = (v: number) => top + ((max - v) / (max - min)) * (height - top - bottom);
  let path = '', open = false;
  for (const p of points) {
    if (p.value === null) {
      open = false;
      continue;
    }
    path += `${open ? 'L' : 'M'}${X(p.time).toFixed(2)} ${Y(p.value).toFixed(2)} `;
    open = true;
  }
  const color = metric === 'accuracy' ? CHART_TOKENS.accuracy : CHART_TOKENS.wpm;
  const labels = [
    ...new Map(
      (points.length === 1 ? [points[0]!] : [points[0]!, points[Math.floor((points.length - 1) / 2)]!, points[points.length - 1]!]).map((p) => [p.time, p]),
    ).values(),
  ];
  const desc = `${title}. ${valid.length} daily values. Vertical axis ${min} to ${max}${unit}. Missing values are gaps.`;
  return `<div class="a-chart-wrap"><div class="a-chart-range">${metric === 'accuracy' ? `Range ${min}–100%` : 'Daily mean WPM · zero baseline'}<span>UTC dates</span></div><svg xmlns="http://www.w3.org/2000/svg" class="a-line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${E(desc)}"><title>${E(title)}</title>${Array.from({ length: 5 }, (_, i) => {
    const v = min + ((max - min) * i) / 4, y = Y(v);
    return `<path d="M${left} ${y}H${width - right}" stroke="#354b3c" stroke-width="1" stroke-dasharray="3 5"/><text x="${left - 10}" y="${y + 4}" text-anchor="end" fill="#b1beb3" font-size="10" font-family="sans-serif">${Number(v.toFixed(1))}</text>`;
  }).join('')}<path d="${path}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${valid
    .map((p) => `<g><circle cx="${X(p.time)}" cy="${Y(p.value)}" r="4" fill="${color}" stroke="#17251d" stroke-width="2"/><circle class="a-point-target" cx="${X(p.time)}" cy="${Y(p.value)}" r="10" fill="transparent" tabindex="0" role="img" aria-label="${E(dateLabel(p.date))}: ${p.value.toFixed(1)}${unit}"><title>${E(dateLabel(p.date))}: ${p.value.toFixed(1)}${unit}</title></circle></g>`)
    .join('')}${labels
    .map((p, i) => `<text x="${X(p.time)}" y="${height - 12}" text-anchor="${i === 0 ? 'start' : i === labels.length - 1 ? 'end' : 'middle'}" fill="#b1beb3" font-size="10" font-family="sans-serif">${dateLabel(p.date)}</text>`)
    .join('')}</svg>${compact ? '' : `<details class="a-data-details"><summary>View chart data</summary><div class="a-table-scroll"><table aria-label="${E(title)} data"><thead><tr><th scope="col">Date (UTC)</th><th scope="col">${metric === 'accuracy' ? 'Accuracy' : 'WPM'}</th></tr></thead><tbody>${points
    .map((p) => `<tr><th scope="row">${E(p.date.slice(0, 10))}</th><td>${p.value === null ? 'No data' : p.value.toFixed(1) + unit}</td></tr>`)
    .join('')}</tbody></table></div></details>`}</div>`;
}

export interface ModeBest {
  mode: string;
  wpm: number | null;
}

export function modeBestsHtml(bests: readonly ModeBest[] = []): string {
  const clamp = (n: number) => Math.min(1, Math.max(0, Number(n) || 0));
  const max = Math.max(20, ...bests.map((b) => (Number.isFinite(b.wpm) ? b.wpm! : 0)));
  return `<div class="a-mode-bars">${bests
    .map((b) => `<div class="a-mode-row"><span>${E(b.mode)}</span><div class="a-bar-track" aria-hidden="true"><i style="width:${Number.isFinite(b.wpm) ? clamp(b.wpm! / max) * 100 : 0}%"></i></div><strong>${Number.isFinite(b.wpm) ? b.wpm!.toFixed(1) + ' <small>WPM</small>' : '<small>Not raced yet</small>'}</strong></div>`)
    .join('')}</div>`;
}

export function avatarSvg(name: string, size = 88): string {
  const initials = String(name).trim().split(/\s+/).slice(0, 2).map((n) => Array.from(n)[0] || '').join('').toUpperCase();
  const px = Math.min(300, Math.max(24, Number(size) || 0));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${px}" height="${px}" role="img" aria-label="${E(name)} avatar"><rect x="2" y="2" width="96" height="96" rx="26" fill="#b9f46a"/><path d="M0 82L80 0H100V30L30 100H0Z" fill="#91bd55" opacity=".7"/><text x="50" y="63" text-anchor="middle" font-family="Arial,sans-serif" font-size="37" font-weight="700" fill="#21351f">${E(initials)}</text></svg>`;
}

export function preserveArtSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 190" role="img" aria-label="A shield protects your race history"><rect x="26" y="37" width="184" height="119" rx="15" fill="#314b32" stroke="#7c9b65" stroke-width="2"/><path d="M44 67H165M44 86H138M44 105H158M44 124H106" stroke="#729565" stroke-width="6" stroke-linecap="round"/><path d="M204 68L248 84V119Q246 148 204 169Q162 148 160 119V84Z" fill="#b9f46a" stroke="#17291a" stroke-width="4"/><path d="M184 116L199 132L228 100" stroke="#233e26" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="212" cy="37" r="9" fill="#dce4cf"/><path d="M233 47V31M225 39H241" stroke="#91b579" stroke-width="3"/></svg>`;
}
