import { getRiskColor, getRiskLabel } from '@/types';

interface RiskBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showGauge?: boolean;
}

export function RiskBadge({ score, size = 'md', showLabel = false, showGauge = false }: RiskBadgeProps) {
  const color = getRiskColor(score);
  const label = getRiskLabel(score);

  if (showGauge) {
    return <RiskGauge score={score} size={size} />;
  }

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 font-bold rounded',
    md: 'text-xs px-2 py-1 font-bold rounded-md',
    lg: 'text-sm px-3 py-1.5 font-bold rounded-lg',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 ${sizeClasses[size]}`}
      style={{ backgroundColor: `${color}18`, color }}
    >
      <span
        className="rounded-full flex-shrink-0"
        style={{
          backgroundColor: color,
          width: size === 'sm' ? 5 : size === 'md' ? 6 : 8,
          height: size === 'sm' ? 5 : size === 'md' ? 6 : 8,
        }}
      />
      {score}
      {showLabel && <span className="opacity-70">· {label}</span>}
    </span>
  );
}

interface RiskGaugeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

export function RiskGauge({ score, size = 'md' }: RiskGaugeProps) {
  const color = getRiskColor(score);
  const label = getRiskLabel(score);

  const dim = size === 'sm' ? 48 : size === 'md' ? 64 : 80;
  const strokeWidth = size === 'sm' ? 4 : size === 'md' ? 5 : 6;
  const r = (dim - strokeWidth * 2) / 2;
  const cx = dim / 2;
  const cy = dim / 2;

  // Arc semi-circle (180°) from left to right, top half
  const circumference = Math.PI * r; // half-circle arc length
  void circumference;

  // SVG path for semi-circle starting at 180° (left) going clockwise to 0° (right)
  const startAngle = Math.PI; // 180 degrees = left
  const endAngle = 0; // 0 degrees = right
  const startX = cx + r * Math.cos(startAngle);
  const startY = cy + r * Math.sin(startAngle);
  const endX = cx + r * Math.cos(endAngle);
  const endY = cy + r * Math.sin(endAngle);

  const trackPath = `M ${startX} ${startY} A ${r} ${r} 0 0 1 ${endX} ${endY}`;

  // Progress endpoint
  const angle = Math.PI - (score / 100) * Math.PI;
  const progressEndX = cx + r * Math.cos(angle);
  const progressEndY = cy + r * Math.sin(angle);
  const largeArc = score > 50 ? 1 : 0;
  const progressPath = score === 0
    ? ''
    : score === 100
    ? `M ${startX} ${startY} A ${r} ${r} 0 1 1 ${endX + 0.001} ${endY}`
    : `M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${progressEndX} ${progressEndY}`;

  const fontSize = size === 'sm' ? 11 : size === 'md' ? 14 : 18;
  const labelFontSize = size === 'sm' ? 7 : size === 'md' ? 8 : 10;

  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg width={dim} height={dim / 2 + strokeWidth + 4} viewBox={`0 0 ${dim} ${dim / 2 + strokeWidth + 4}`}>
        {/* Track */}
        <path
          d={trackPath}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Progress */}
        {progressPath && (
          <path
            d={progressPath}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 3px ${color}60)` }}
          />
        )}
        {/* Score text */}
        <text
          x={cx}
          y={dim / 2 + 2}
          textAnchor="middle"
          fill={color}
          fontSize={fontSize}
          fontWeight="700"
          fontFamily="system-ui"
        >
          {score}
        </text>
      </svg>
      <span
        className="font-semibold uppercase tracking-wide"
        style={{ color, fontSize: labelFontSize }}
      >
        {label}
      </span>
    </div>
  );
}
