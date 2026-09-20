// ЗХД monogram — for favicon, small avatars, watermarks.
import Svg, { Rect, Text as SvgText } from "react-native-svg";

type Props = { size?: number };

export function Monogram({ size = 48 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 86 86">
      <Rect width="86" height="86" rx="20" fill="#2563EB" />
      <SvgText
        x="43"
        y="46"
        textAnchor="middle"
        fontFamily="System"
        fontSize="22"
        fontWeight="700"
        fill="#FFFFFF"
      >
        ЗХД
      </SvgText>
      <Rect x="26" y="56" width="34" height="5" rx="2.5" fill="#93C5FD" />
    </Svg>
  );
}

export default Monogram;
