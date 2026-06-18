import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { initDB } from "../src/db/schema";
import { requestAllPermissions } from "../src/utils/permissions";

export default function RootLayout() {
  useEffect(() => {
    initDB().catch(console.error);
    requestAllPermissions().catch(console.error);
  }, []);

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}
