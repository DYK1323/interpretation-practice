import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { initDB } from "../src/db/schema";
import { cleanupDrafts } from "../src/db/sentences";
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
    initDB().then(() => cleanupDrafts()).catch(console.error);
    requestAllPermissions().catch(console.error);
    if (!__DEV__) {
      checkAndApplyUpdate();
    }
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="library-edit/[id]" options={{ presentation: "modal", headerShown: false }} />
      </Stack>
    </>
  );
}
