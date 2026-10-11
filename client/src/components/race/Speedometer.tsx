const MAX_WPM = 160;
const ARC = 'M26 112 A94 94 0 0 1 214 112';
const point = (radius: number, fraction: number): [number, number] => {
  const angle = Math.PI + fraction * Math.PI;
  return [120 + radius * Math.cos(angle), 112 + radius * Math.sin(angle)];
};
const TICKS = Array.from({ length: 33 }, (_, index) => {
  const major = index % 8 === 0;
  const [x1, y1] = point(83, index / 32);
  const [x2, y2] = point(major ? 70 : 77, index / 32);
  const [x, y] = point(57, index / 32);
  return { index, major, x1, y1, x2, y2, x, y };
});

/** Kit 22's real-WPM instrument, with a fixed scale and an uncapped readout. */
export function Speedometer({ wpm }: { wpm: number }) {
  const value = Number.isFinite(wpm) ? Math.max(0, wpm) : 0;
  const fraction = Math.min(1, value / MAX_WPM);
  return (
    <div className="speedometer" role="img" aria-label={`Typing speed ${Math.round(value)} words per minute. Dial scale 0 to ${MAX_WPM}.`}>
      <svg viewBox="0 0 240 170" aria-hidden="true">
        <path className="speedometer-rim" d="M14 112 A106 106 0 0 1 226 112" />
        <path className="speedometer-track" d={ARC} />
        <path className="speedometer-fill" d={ARC} pathLength="100" strokeDasharray={`${fraction * 100} 100`} />
        {TICKS.map((tick) => (
          <g key={tick.index}>
            <line className={tick.major ? 'speedometer-tick-major' : 'speedometer-tick'} x1={tick.x1} y1={tick.y1} x2={tick.x2} y2={tick.y2} />
            {tick.major && <text className="speedometer-scale" x={tick.x} y={tick.y + (tick.index === 0 || tick.index === 32 ? 16 : 4)}>{tick.index * 5}</text>}
          </g>
        ))}
        <g className="speedometer-needle" style={{ transform: `rotate(${fraction * 180}deg)` }}>
          <path d="M120 107 L39 112 L120 117 L133 112 Z" />
        </g>
        <circle className="speedometer-hub" cx="120" cy="112" r="7" />
        <circle cx="120" cy="112" r="2.5" fill="var(--g-lime)" />
        <text className="speedometer-value" x="120" y="148">{Math.round(value)}</text>
        <text className="speedometer-unit" x="120" y="166">WORDS / MIN</text>
      </svg>
    </div>
  );
}
