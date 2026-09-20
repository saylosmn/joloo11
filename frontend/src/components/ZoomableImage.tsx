// Question images are road signs and small diagrams — at 200px they are often
// unreadable. Tapping opens a full-screen viewer with pinch, pan and
// double-tap zoom; the thumbnail carries a badge so it reads as tappable.
import Ionicons from "@react-native-vector-icons/ionicons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { Modal, Pressable, StyleProp, useWindowDimensions, View, ViewStyle } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/src/components/AppText";
import { font, motion, radius, spacing, type, useTheme } from "@/src/theme";

const AnimatedImage = Animated.createAnimatedComponent(Image);

export function QuestionImage({
  uri,
  height = 200,
  style,
  testID,
  caption,
}: {
  uri?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  caption?: string;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  if (!uri) return null;

  return (
    <>
      <Pressable
        testID={testID}
        accessibilityRole="imagebutton"
        accessibilityLabel={caption ?? "Асуултын зураг — томруулж харах"}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          setOpen(true);
        }}
        style={({ pressed }) => [
          {
            width: "100%",
            height,
            borderRadius: radius.lg,
            backgroundColor: colors.surfaceTertiary,
            overflow: "hidden",
            opacity: pressed ? 0.92 : 1,
          },
          style,
        ]}
      >
        <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="contain" transition={150} />
        <View
          style={{
            position: "absolute",
            right: spacing.sm,
            bottom: spacing.sm,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            backgroundColor: colors.overlay,
            paddingHorizontal: 8,
            paddingVertical: 5,
            borderRadius: radius.pill,
          }}
        >
          <Ionicons name="expand" size={13} color="#FFFFFF" />
          <Text style={{ color: "#FFFFFF", fontSize: type.xs, fontFamily: font.bold }}>Томруулах</Text>
        </View>
      </Pressable>

      <ImageViewer uri={uri} visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function ImageViewer({
  uri,
  visible,
  onClose,
}: {
  uri?: string;
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const scale = useSharedValue(1);
  const saved = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const backdrop = useSharedValue(1);

  const reset = () => {
    scale.value = 1;
    saved.value = 1;
    x.value = 0;
    y.value = 0;
    savedX.value = 0;
    savedY.value = 0;
    backdrop.value = 1;
  };

  const close = () => {
    reset();
    onClose();
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(0.6, Math.min(6, saved.value * e.scale));
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withTiming(1, { ...motion.soft, easing: Easing.out(Easing.cubic) });
        x.value = withTiming(0, { ...motion.soft, easing: Easing.out(Easing.cubic) });
        y.value = withTiming(0, { ...motion.soft, easing: Easing.out(Easing.cubic) });
      }
      saved.value = Math.max(1, scale.value);
      savedX.value = x.value;
      savedY.value = y.value;
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      if (scale.value > 1) {
        x.value = savedX.value + e.translationX;
        y.value = savedY.value + e.translationY;
      } else {
        // At 1x a downward drag dismisses, iOS-photo style.
        y.value = e.translationY;
        backdrop.value = Math.max(0.3, 1 - Math.abs(e.translationY) / 400);
      }
    })
    .onEnd((e) => {
      if (scale.value > 1) {
        savedX.value = x.value;
        savedY.value = y.value;
        return;
      }
      if (Math.abs(e.translationY) > 120) {
        runOnJS(close)();
      } else {
        y.value = withTiming(0, { ...motion.soft, easing: Easing.out(Easing.cubic) });
        backdrop.value = withTiming(1, { duration: 160 });
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const next = scale.value > 1.3 ? 1 : 2.5;
      scale.value = withTiming(next, { ...motion.soft, easing: Easing.out(Easing.cubic) });
      saved.value = next;
      if (next === 1) {
        x.value = withTiming(0, { ...motion.soft, easing: Easing.out(Easing.cubic) });
        y.value = withTiming(0, { ...motion.soft, easing: Easing.out(Easing.cubic) });
        savedX.value = 0;
        savedY.value = 0;
      }
    });

  const gesture = Gesture.Simultaneous(pinch, Gesture.Exclusive(doubleTap, pan));

  const imgStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View style={[{ flex: 1, backgroundColor: "#000000" }, backdropStyle]}>
          <GestureDetector gesture={gesture}>
            <Animated.View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <AnimatedImage
                source={{ uri }}
                style={[{ width, height: height * 0.8 }, imgStyle]}
                contentFit="contain"
                transition={120}
                accessibilityLabel="Асуултын зураг"
              />
            </Animated.View>
          </GestureDetector>

          <Pressable
            testID="image-viewer-close"
            accessibilityRole="button"
            accessibilityLabel="Зургийг хаах"
            onPress={close}
            hitSlop={12}
            style={{
              position: "absolute",
              top: insets.top + spacing.md,
              right: spacing.gutter,
              width: 44,
              height: 44,
              borderRadius: radius.pill,
              backgroundColor: "rgba(255,255,255,0.16)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>

          <View
            style={{
              position: "absolute",
              bottom: insets.bottom + spacing.xl,
              alignSelf: "center",
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: radius.pill,
              backgroundColor: "rgba(255,255,255,0.12)",
            }}
          >
            <Ionicons name="scan-outline" size={14} color="rgba(255,255,255,0.9)" />
            <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: type.sm, fontFamily: font.medium }}>
              Хоёр товшиж томруул · доош чирж хаа
            </Text>
          </View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}
