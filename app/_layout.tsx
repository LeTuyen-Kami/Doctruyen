import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import { Provider as JotaiProvider } from "jotai";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { migrateDb } from "@/src/db/schema";
import codePush from "@revopush/react-native-code-push";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "../global.css";

export const unstable_settings = {
  anchor: "(tabs)",
};

function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <JotaiProvider>
        <SQLiteProvider databaseName="doctruyen.db" onInit={migrateDb}>
          <ThemeProvider
            value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
          >
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: "#1A1A1A" },
                headerTintColor: "#F5F5F5",
                contentStyle: { backgroundColor: "#1A1A1A" },
              }}
            >
              <Stack.Screen
                name="(tabs)"
                options={{ headerShown: false, title: "Trang chủ" }}
              />
              <Stack.Screen
                name="story/[id]"
                options={{
                  headerShown: true,
                  title: "Chi tiết truyện",
                  gestureEnabled: true,
                  gestureDirection: "horizontal",
                  fullScreenGestureEnabled: true,
                  headerBackTitle: "Quay lại",
                }}
              />
              <Stack.Screen
                name="reader/[id]"
                options={{
                  headerShown: true,
                  title: "Đọc truyện",
                  gestureEnabled: true,
                  gestureDirection: "horizontal",
                  fullScreenGestureEnabled: true,
                }}
              />
              <Stack.Screen
                name="modal"
                options={{ presentation: "modal", title: "Modal" }}
              />
            </Stack>
            <StatusBar style="auto" />
          </ThemeProvider>
        </SQLiteProvider>
      </JotaiProvider>
    </GestureHandlerRootView>
  );
}

let AppComponent = RootLayout;

if (!__DEV__) {
  AppComponent = codePush({
    checkFrequency: codePush.CheckFrequency.ON_APP_RESUME,
    installMode: codePush.InstallMode.IMMEDIATE,
    mandatoryInstallMode: codePush.InstallMode.IMMEDIATE,
    minimumBackgroundDuration: 0,
  })(RootLayout);
}

export default AppComponent;
