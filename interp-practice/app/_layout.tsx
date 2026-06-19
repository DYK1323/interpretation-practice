import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { initDB } from "../src/db/schema";
import { requestAllPermissions } from "../src/utils/permissions";
import * as Updates from "expo-updates";

async function checkAndApplyUpdate() {
  try {
    const result = await Updates.checkForUpdateAsync();
    if (result.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  } catch {
    // 업데이트 서버 연결 실패 등 — 무시하고 계속
  }
}

export default function RootLayout() {
  useEffect(() => {
    initDB().catch(console.error);
    requestAllPermissions().catch(console.error);
    if (!__DEV__) {
      checkAndApplyUpdate();
    }
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
