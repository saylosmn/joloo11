// Bottom sheets and dialogs in one place. @gorhom/bottom-sheet was already a
// dependency but unused — every screen hand-rolled a Modal with its own
// backdrop. Native gets the real gesture-driven sheet; web keeps a plain Modal,
// which behaves better there.
import { ReactNode, useCallback, useEffect, useMemo, useRef } from "react";
import { Dimensions, Modal, Platform, Pressable, StyleProp, View, ViewStyle } from "react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/src/components/AppText";
import { PrimaryButton } from "@/src/components/ui";
import { font, radius, spacing, type, useTheme } from "@/src/theme";

const isWeb = Platform.OS === "web";

export function Sheet({
  visible,
  onClose,
  children,
  title,
  snapPoints,
  contentStyle,
  testID,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  /** Provide to make the sheet scrollable at a fixed height, e.g. ["70%"]. */
  snapPoints?: string[];
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const ref = useRef<BottomSheetModal>(null);

  // Callers pass the snap points inline (`snapPoints={["85%"]}`), so the array
  // is a new object on every render and memoising on it changes nothing. The
  // bottom sheet re-reads its layout whenever this prop's identity changes, and
  // a sheet that fetches while opening — ProModal asks for the plan and the
  // limits — re-rendered mid-animation and snapped straight back shut. Key the
  // memo on the contents so the array stays the same object.
  const pointsKey = snapPoints?.join("|");
  const points = useMemo(() => (pointsKey ? pointsKey.split("|") : undefined), [pointsKey]);

  // The sheet reports every dismissal, including the one we ask for when the
  // parent sets `visible` to false. Telling the parent to close again from
  // there would undo state it has just set — ProModal opening a payment sheet,
  // for one — so only a dismissal the user made is passed on.
  const visibleRef = useRef(visible);
  const handleDismiss = useCallback(() => {
    if (visibleRef.current) onClose();
  }, [onClose]);

  useEffect(() => {
    // Recorded before the dismissal is asked for, so the callback above can
    // tell the two apart.
    visibleRef.current = visible;
    if (isWeb) return;
    if (visible) ref.current?.present();
    else ref.current?.dismiss();
  }, [visible]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" opacity={0.5} />
    ),
    [],
  );

  const header = title ? (
    <Text
      style={{
        color: colors.onSurface,
        fontSize: type.xl,
        fontFamily: font.bold,
        paddingHorizontal: spacing.gutter,
        paddingBottom: spacing.md,
      }}
    >
      {title}
    </Text>
  ) : null;

  if (isWeb) {
    if (!visible) return null;
    return (
      <Modal visible transparent animationType="slide" onRequestClose={onClose}>
        <Pressable
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay }}
          onPress={onClose}
          testID={testID ? `${testID}-backdrop` : undefined}
        />
        <View
          testID={testID}
          style={{
            marginTop: "auto",
            backgroundColor: colors.elev2,
            borderTopLeftRadius: radius.xxl,
            borderTopRightRadius: radius.xxl,
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.xl,
            maxHeight: "80%",
          }}
        >
          <View
            style={{
              width: 40,
              height: 4,
              borderRadius: radius.pill,
              backgroundColor: colors.borderStrong,
              alignSelf: "center",
              marginBottom: spacing.lg,
            }}
          />
          {header}
          <View style={[{ paddingHorizontal: spacing.gutter }, contentStyle]}>{children}</View>
        </View>
      </Modal>
    );
  }

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={points}
      enableDynamicSizing={!points}
      onDismiss={handleDismiss}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: colors.borderStrong, width: 40 }}
      maxDynamicContentSize={Dimensions.get("window").height * 0.85}
      backgroundStyle={{ backgroundColor: colors.elev2, borderRadius: radius.xxl }}
    >
      {points ? (
        <>
          {header}
          <BottomSheetScrollView
            contentContainerStyle={[
              { paddingHorizontal: spacing.gutter, paddingBottom: insets.bottom + spacing.xl },
              contentStyle,
            ]}
            testID={testID}
          >
            {children}
          </BottomSheetScrollView>
        </>
      ) : (
        <BottomSheetView
          style={[{ paddingBottom: insets.bottom + spacing.xl }, contentStyle]}
          testID={testID}
        >
          {header}
          <View style={{ paddingHorizontal: spacing.gutter }}>{children}</View>
        </BottomSheetView>
      )}
    </BottomSheetModal>
  );
}

export type DialogAction = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  loading?: boolean;
  testID?: string;
};

/**
 * Centered confirm dialog with a springy entrance. Replaces four hand-built
 * Modal + backdrop blocks that all looked slightly different.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  actions,
  onClose,
  icon,
  testID,
}: {
  visible: boolean;
  title: string;
  message?: string;
  actions: DialogAction[];
  onClose: () => void;
  icon?: ReactNode;
  testID?: string;
}) {
  const { colors } = useTheme();
  const v = useSharedValue(0);

  useEffect(() => {
    // Timing rather than spring: the web runtime settles springs early, which
    // would leave the dialog slightly transparent and undersized there.
    v.value = visible
      ? withTiming(1, { duration: 220, easing: Easing.out(Easing.back(1.4)) })
      : withTiming(0, { duration: 120 });
  }, [visible, v]);

  const boxStyle = useAnimatedStyle(() => ({
    opacity: v.value,
    transform: [{ scale: 0.92 + v.value * 0.08 }],
  }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          alignItems: "center",
          justifyContent: "center",
          padding: spacing.xxl,
        }}
      >
        <Pressable
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          accessibilityLabel="Хаах"
          onPress={onClose}
        />
        <Animated.View
          testID={testID}
          style={[
            {
              width: "100%",
              backgroundColor: colors.elev3,
              borderRadius: radius.xl,
              padding: spacing.xl,
              borderWidth: 1,
              borderColor: colors.border,
            },
            boxStyle,
          ]}
        >
          {icon ? <View style={{ alignItems: "center", marginBottom: spacing.md }}>{icon}</View> : null}
          <Text style={{ color: colors.onSurface, fontSize: type.xl, fontFamily: font.bold }}>{title}</Text>
          {message ? (
            <Text
              style={{
                color: colors.muted,
                fontSize: type.base,
                lineHeight: 21,
                marginTop: spacing.sm,
                fontFamily: font.regular,
              }}
            >
              {message}
            </Text>
          ) : null}
          <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
            {actions.map((a) => (
              <PrimaryButton
                key={a.label}
                title={a.label}
                variant={a.variant ?? "primary"}
                loading={a.loading}
                onPress={a.onPress}
                testID={a.testID}
              />
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

export { BottomSheet };
