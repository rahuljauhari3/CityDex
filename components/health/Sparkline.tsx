/** Tiny inline SVG line chart. Null values leave gaps; the last point is marked. */
export function Sparkline({
  values,
  width = 120,
  height = 32,
  color = "#fc5200",
  label,
  muted,
}: {
  values: (number | null)[];
  width?: number;
  height?: number;
  color?: string;
  label: string;
  /** Indexes drawn as hollow points (e.g. visits at a different pace). */
  muted?: Set<number>;
}) {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length < 2) return null;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const pad = 3;
  const x = (i: number) => pad + (i / Math.max(1, values.length - 1)) * (width - pad * 2);
  const y = (v: number) => (max === min ? height / 2 : pad + (1 - (v - min) / (max - min)) * (height - pad * 2));
  const segments: string[] = [];
  let current = "";
  values.forEach((v, i) => {
    if (v === null) {
      if (current) segments.push(current);
      current = "";
      return;
    }
    current += `${current ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
  });
  if (current) segments.push(current);
  const lastIdx = values.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0).at(-1)!;
  const showDots = values.length <= 12;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="overflow-visible">
      {segments.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      ))}
      {showDots &&
        values.map((v, i) =>
          v === null ? null : (
            <circle
              key={i}
              cx={x(i)}
              cy={y(v)}
              r={2.5}
              fill={muted?.has(i) ? "#f4e4c1" : color}
              stroke={color}
              strokeWidth={1.5}
            />
          ),
        )}
      <circle cx={x(lastIdx)} cy={y(values[lastIdx]!)} r={3.5} fill={color} stroke="#5b3a29" strokeWidth={1.5} />
    </svg>
  );
}
