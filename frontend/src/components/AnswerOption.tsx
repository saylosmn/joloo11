import Ionicons from "@react-native-vector-icons/ionicons";
import * as Haptics from "expo-haptics";
import { Pressable, Text } from "react-native";

import { font, makeStyles, useTheme } from "@/src/theme";

export type OptionState = "default" | "selected" | "correct" | "wrong";

export function AnswerOption({
  optionKey,
  text,
  state,
  onPress,
  disabled,
  testID,
}: {
  optionKey: string;
  text: string;
  state: OptionState;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();

  const config = {
    default: {
      bg: colors.surfaceSecondary,
      border: colors.border,
      fg: colors.onSurfaceSecondary,
      icon: "ellipse-outline",
      iconColor: colors.muted,
    },
    selected: {
      bg: colors.brandTertiary,
      border: colors.brandPrimary,
      fg: colors.onBrandTertiary,
      icon: "radio-button-on",
      iconColor: colors.brandPrimary,
    },
    correct: {
      bg: colors.successSubtle,
      border: colors.success,
      fg: colors.onSuccessSubtle,
      icon: "checkmark-circle",
      iconColor: colors.success,
    },
    wrong: {
      bg: colors.errorSubtle,
      border: colors.error,
      fg: colors.onErrorSubtle,
      icon: "close-circle",
      iconColor: colors.error,
    },
  }[state];

  return (
    <Pressable
      testID={testID}
      disabled={disabled}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.option,
        {
          backgroundColor: config.bg,
          borderColor: config.border,
          borderWidth: state === "default" ? 1 : 2,
          opacity: pressed && !disabled ? 0.92 : 1,
        },
      ]}
    >
      <Ionicons name={config.icon as any} size={22} color={config.iconColor} />
      <Text style={[styles.optionText, { color: config.fg }]}>{text}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  option: {
    minHeight: 56,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 23,
    fontFamily: font.medium,
  },
}));
