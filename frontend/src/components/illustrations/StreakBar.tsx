// Weekly streak bar — shows 7 days with fire icon for active streak.
import Svg, { Circle, Path, Text as SvgText } from "react-native-svg";

const DAYS = ["Да", "Мя", "Лх", "Пү", "Ба", "Бя", "Ня"];

type Props = {
  /** How many consecutive days completed (0–7). */
  streak: number;
  /** Which day of the week is today (0=Monday). */
  today?: number;
  size?: number;
};

export function StreakBar({ streak, today = new Date().getDay(), size = 280 }: Props) {
  // Map JS getDay (0=Sun) to our Mon-first index
  const todayIdx = today === 0 ? 6 : today - 1;
  const h = size * (60 / 280);

  return (
    <Svg width={size} height={h + 10} viewBox="0 0 280 70">
      {DAYS.map((d, i) => {
        const x = 20 + i * 36;
        const done = i <= todayIdx && i >= todayIdx - streak + 1 && streak > 0;
        const isToday = i === todayIdx;
        return (
          <Circle
            key={i}
            cx={x}
            cy="30"
            r="14"
            fill={done ? (isToday ? "#F59E0B" : "#10B981") : "#E2E8F0"}
          />
        );
      })}
      {DAYS.map((d, i) => {
        const x = 20 + i * 36;
        const done = i <= todayIdx && i >= todayIdx - streak + 1 && streak > 0;
        return (
          <SvgText
            key={`t${i}`}
            x={x}
            y="34"
            textAnchor="middle"
            fontFamily="System"
            fontSize="10"
            fontWeight={i === todayIdx ? "700" : "500"}
            fill={done ? "#FFFFFF" : "#94A3B8"}
          >
            {d}
          </SvgText>
        );
      })}
      {/* Fire icon for active streak */}
      {streak > 0 && (
        <>
          <Path
            d="M254 4 C254 4 248 16 248 20 A6 6 0 0 0 260 20 C260 16 254 4 254 4 Z"
            fill="#F59E0B"
          />
          <SvgText
            x="268"
            y="18"
            fontFamily="System"
            fontSize="16"
            fontWeight="700"
            fill="#F59E0B"
          >
            {streak}
          </SvgText>
        </>
      )}
    </Svg>
  );
}

export default StreakBar;
