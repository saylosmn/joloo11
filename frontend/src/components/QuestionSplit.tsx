// On a tablet (or a phone in landscape) the picture and the question sit side
// by side instead of stacking, so both are readable without scrolling.
import { ReactNode } from "react";
import { View } from "react-native";

import { useResponsive } from "@/src/lib/responsive";
import { spacing } from "@/src/theme";

export function QuestionSplit({
  image,
  children,
}: {
  image?: ReactNode;
  children: ReactNode;
}) {
  const { isWide } = useResponsive();

  if (!isWide || !image) {
    return (
      <>
        {image}
        {children}
      </>
    );
  }

  return (
    <View style={{ flexDirection: "row", gap: spacing.xl, alignItems: "flex-start" }}>
      <View style={{ flex: 1 }}>{image}</View>
      <View style={{ flex: 1.15 }}>{children}</View>
    </View>
  );
}
