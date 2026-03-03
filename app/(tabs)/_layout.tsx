import { Tabs } from "expo-router";
import React from "react";
import { Ionicons } from "@expo/vector-icons";

import { HapticTab } from "@/components/haptic-tab";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Truyện",
          tabBarIcon: ({ color }) => <Ionicons name="book-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="import"
        options={{
          title: "Import",
          tabBarIcon: ({ color }) => <Ionicons name="cloud-upload-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="todo"
        options={{
          title: "Todo",
          tabBarIcon: ({ color }) => <Ionicons name="checkbox-outline" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
