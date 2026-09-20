import Ionicons from "@react-native-vector-icons/ionicons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Redirect, Tabs } from "expo-router";
import { useEffect } from "react";
import { Platform, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LoadingView } from "@/src/components/ui";
import { useAuth } from "@/src/lib/auth";
import { font, motion, radius, useTheme } from "@/src/theme";

const TABS: { name: string; title: string; icon: string }[] = [
  { name: "index", title: "Нүүр", icon: "home" },
  { name: "categories", title: "Бүлэг", icon: "albums" },
  { name: "exam", title: "Шалгалт", icon: "school" },
  { name: "stats", title: "Статистик", icon: "stats-chart" },
  { name: "profile", title: "Профайл", icon: "person" },
];

/** Icon that pops, with a soft pill sliding in behind the active tab. */
function TabIcon({
  name,
  color,
  size,
  focused,
}: {
  name: string;
  color: string;
  size: number;
  focused: boolean;
}) {
  const { colors } = useTheme();
  const v = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    v.value = focused
      ? withTiming(1, { ...motion.bouncy, easing: Easing.out(Easing.back(2)) })
      : withTiming(0, { duration: 160 });
  }, [focused, v]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + v.value * 0.12 }, { translateY: -v.value * 2 }],
  }));
  const pillStyle = useAnimatedStyle(() => ({
    opacity: v.value * 0.16,
    transform: [{ scale: 0.6 + v.value * 0.4 }],
  }));

  return (
    <View style={{ width: 56, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={[
          {
            position: "absolute",
            width: 48,
            height: 30,
            borderRadius: radius.pill,
            backgroundColor: colors.brandPrimary,
          },
          pillStyle,
        ]}
      />
      <Animated.View style={iconStyle}>
        <Ionicons name={(focused ? name : `${name}-outline`) as any} size={size} color={color} />
      </Animated.View>
    </View>
  );
}

export default function TabsLayout() {
  const { colors, scheme } = useTheme();
  const { user, loading } = useAuth();
  const insets = useSafeAreaInsets();

  if (loading) return <LoadingView />;
  if (!user) return <Redirect href="/" />;
  if (!user.profileName) return <Redirect href="/" />;

  const bottomPad = Platform.OS === "web" ? 8 : Math.max(insets.bottom, 8);
  const canBlur = Platform.OS === "ios" || Platform.OS === "android";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        // Content scrolls behind a translucent bar; screens add
        // useBottomTabBarHeight() padding so nothing hides underneath.
        tabBarStyle: {
          position: "absolute",
          backgroundColor: canBlur ? "transparent" : colors.surfaceSecondary,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: (Platform.OS === "web" ? 64 : 58) + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 8,
          elevation: 0,
        },
        tabBarBackground: canBlur
          ? () => (
              <BlurView
                intensity={scheme === "dark" ? 55 : 75}
                tint={scheme === "dark" ? "dark" : "light"}
                experimentalBlurMethod="dimezisBlurView"
                style={{
                  flex: 1,
                  backgroundColor:
                    scheme === "dark" ? "rgba(11,17,32,0.62)" : "rgba(255,255,255,0.62)",
                }}
              />
            )
          : undefined,
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontFamily: font.semibold, fontSize: 11 },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          listeners={{
            tabPress: () => {
              Haptics.selectionAsync().catch(() => {});
            },
          }}
          options={{
            title: t.title,
            tabBarIcon: ({ color, size, focused }) => (
              <TabIcon name={t.icon} color={color as string} size={size} focused={focused} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
