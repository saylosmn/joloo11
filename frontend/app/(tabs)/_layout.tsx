import Ionicons from "@react-native-vector-icons/ionicons";
import { Redirect, Tabs } from "expo-router";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LoadingView } from "@/src/components/ui";
import { useAuth } from "@/src/lib/auth";
import { font, useTheme } from "@/src/theme";

const TABS: { name: string; title: string; icon: string }[] = [
  { name: "index", title: "Нүүр", icon: "home" },
  { name: "categories", title: "Бүлэг", icon: "albums" },
  { name: "exam", title: "Шалгалт", icon: "school" },
  { name: "stats", title: "Статистик", icon: "stats-chart" },
  { name: "profile", title: "Профайл", icon: "person" },
];

export default function TabsLayout() {
  const { colors } = useTheme();
  const { user, loading } = useAuth();
  const insets = useSafeAreaInsets();

  if (loading) return <LoadingView />;
  if (!user) return <Redirect href="/" />;
  if (!user.profileName) return <Redirect href="/" />;

  const bottomPad = Platform.OS === "web" ? 8 : Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: (Platform.OS === "web" ? 64 : 58) + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 8,
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontFamily: font.semibold, fontSize: 11 },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={(focused ? t.icon : `${t.icon}-outline`) as any}
                size={size}
                color={color}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
