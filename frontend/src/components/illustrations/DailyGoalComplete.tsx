// Daily goal completion ring — shows progress with animated checkmark.
import Svg, { Circle, Path, Text as SvgText } from "react-native-svg";

type Props = {
  current: number;
  goal: number;
  size?: number;
};

export function DailyGoalComplete({ current, goal, size = 120 }: Props) {
  const pct = Math.min(1, current / Math.max(1, goal));
  const r = 40;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  const done = pct >= 1;

  return (
    <Svg width={size} height={size + 24} viewBox="0 0 120 140">
      {/* Track */}
      <Circle cx="60" cy="56" r={r} fill="none" stroke="#E2E8F0" strokeWidth="10" />
      {/* Progress arc */}
      <Circle
        cx="60"
        cy="56"
        r={r}
        fill="none"
        stroke={done ? "#10B981" : "#2563EB"}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${circ}`}
        strokeDashoffset={offset}
        rotation="-90"
        origin="60, 56"
      />
      {/* Center */}
      {done ? (
        <>
          <Circle cx="60" cy="56" r="24" fill="#DCFCE7" />
          <Path
            d="M48 56 L56 64 L74 46"
            fill="none"
            stroke="#10B981"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <SvgText
          x="60"
          y="62"
          textAnchor="middle"
          fontFamily="System"
          fontSize="18"
          fontWeight="700"
          fill="#2563EB"
        >
          {`${current}/${goal}`}
        </SvgText>
      )}
      <SvgText
        x="60"
        y="120"
        textAnchor="middle"
        fontFamily="System"
        fontSize="13"
        fontWeight="500"
        fill={done ? "#10B981" : "#64748B"}
      >
        {done ? `${current}/${goal} даалгавар ✓` : `${current}/${goal} даалгавар`}
      </SvgText>
    </Svg>
  );
}

export default DailyGoalComplete;
