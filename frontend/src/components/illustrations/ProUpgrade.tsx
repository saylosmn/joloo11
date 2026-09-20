// Pro upgrade promotional illustration.
import Svg, { Rect, Text as SvgText } from "react-native-svg";

type Props = { size?: number };

export function ProUpgradeArt({ size = 200 }: Props) {
  const h = size * (160 / 240);
  return (
    <Svg width={size} height={h} viewBox="0 0 240 160">
      <Rect x="40" y="16" width="160" height="126" rx="16" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="3" />
      <Rect x="82" y="6" width="76" height="28" rx="14" fill="#F59E0B" />
      <SvgText x="120" y="25" textAnchor="middle" fontFamily="System" fontSize="15" fontWeight="700" fill="#FFFFFF">
        PRO
      </SvgText>
      <Rect x="62" y="52" width="116" height="10" rx="5" fill="#FEF3C7" />
      <Rect x="62" y="70" width="116" height="10" rx="5" fill="#FEF3C7" />
      <Rect x="62" y="88" width="80" height="10" rx="5" fill="#FEF3C7" />
      <Rect x="70" y="108" width="100" height="28" rx="14" fill="#2563EB" />
      <SvgText x="120" y="127" textAnchor="middle" fontFamily="System" fontSize="13" fontWeight="700" fill="#FFFFFF">
        Идэвхжүүлэх
      </SvgText>
    </Svg>
  );
}

export default ProUpgradeArt;
