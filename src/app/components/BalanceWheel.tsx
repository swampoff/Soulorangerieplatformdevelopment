import { DIRECTIONS } from './data';

interface BalanceWheelProps {
  scores: Record<string, number>;
  size?: number;
  interactive?: boolean;
}

export function BalanceWheel({ scores, size = 300, interactive = false }: BalanceWheelProps) {
  const center = size / 2;
  const maxRadius = size / 2 - 40;
  const directions = DIRECTIONS;
  const angleStep = (2 * Math.PI) / directions.length;

  const getPoint = (index: number, value: number) => {
    const angle = angleStep * index - Math.PI / 2;
    const radius = (value / 5) * maxRadius;
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
    };
  };

  const polygonPoints = directions
    .map((d, i) => {
      const point = getPoint(i, scores[d.id] || 0);
      return `${point.x},${point.y}`;
    })
    .join(' ');

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background circles */}
        {[1, 2, 3, 4, 5].map((level) => (
          <circle
            key={level}
            cx={center}
            cy={center}
            r={(level / 5) * maxRadius}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.08}
            strokeWidth={1}
          />
        ))}

        {/* Axis lines */}
        {directions.map((_, i) => {
          const endPoint = getPoint(i, 5);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={endPoint.x}
              y2={endPoint.y}
              stroke="currentColor"
              strokeOpacity={0.1}
              strokeWidth={1}
            />
          );
        })}

        {/* Filled polygon */}
        <polygon
          points={polygonPoints}
          fill="url(#wheelGradient)"
          fillOpacity={0.3}
          stroke="url(#wheelStroke)"
          strokeWidth={2}
        />

        {/* Gradient definitions */}
        <defs>
          <linearGradient id="wheelGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7A9B6D" />
            <stop offset="50%" stopColor="#A8C5DA" />
            <stop offset="100%" stopColor="#C4B5D4" />
          </linearGradient>
          <linearGradient id="wheelStroke" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7A9B6D" />
            <stop offset="100%" stopColor="#A8C5DA" />
          </linearGradient>
        </defs>

        {/* Data points */}
        {directions.map((d, i) => {
          const point = getPoint(i, scores[d.id] || 0);
          return (
            <circle
              key={d.id}
              cx={point.x}
              cy={point.y}
              r={interactive ? 6 : 4}
              fill={d.color}
              stroke="white"
              strokeWidth={2}
              className={interactive ? 'cursor-pointer' : ''}
            />
          );
        })}

        {/* Labels */}
        {directions.map((d, i) => {
          const labelPoint = getPoint(i, 6.2);
          return (
            <text
              key={d.id}
              x={labelPoint.x}
              y={labelPoint.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-xs fill-muted-foreground"
              style={{ fontSize: size < 250 ? '9px' : '11px' }}
            >
              {d.icon} {d.name}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
