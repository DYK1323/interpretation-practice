import { Tabs } from "expo-router";
import { Text } from "react-native";

function Icon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: "#1A56DB",
        tabBarInactiveTintColor: "#9CA3AF",
        tabBarStyle: { borderTopColor: "#E5E7EB", height: 64, paddingBottom: 10, paddingTop: 8 },
        headerStyle: { backgroundColor: "#FFFFFF" },
        headerTitleStyle: { fontWeight: "700", fontSize: 18 },
      }}
    >
      <Tabs.Screen
        name="practice"
        options={{
          title: "연습",
          headerTitle: "통역 연습",
          tabBarIcon: ({ focused }) => <Icon emoji="🎙️" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "라이브러리",
          headerTitle: "문장 라이브러리",
          tabBarIcon: ({ focused }) => <Icon emoji="📚" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "히스토리",
          headerTitle: "학습 기록",
          tabBarIcon: ({ focused }) => <Icon emoji="📋" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "설정",
          headerTitle: "설정",
          tabBarIcon: ({ focused }) => <Icon emoji="⚙️" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
