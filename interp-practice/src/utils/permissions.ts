import { Alert } from "react-native";
import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";
import { requestRecordingPermissionsAsync } from "expo-audio";

export async function requestAllPermissions(): Promise<boolean> {
  const micResult = await requestRecordingPermissionsAsync();
  if (micResult.status !== "granted") {
    Alert.alert(
      "마이크 권한 필요",
      "통역 녹음을 위해 마이크 접근이 필요합니다. 설정에서 권한을 허용해주세요."
    );
    return false;
  }

  const sttResult = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
  if (sttResult.status !== "granted") {
    Alert.alert(
      "음성 인식 권한 필요",
      "재통역 내용을 텍스트로 변환하기 위해 음성 인식 접근이 필요합니다."
    );
    return false;
  }

  return true;
}

export async function checkSTTLocale(locale: string): Promise<boolean> {
  try {
    const result = await ExpoSpeechRecognitionModule.getSupportedLocales({
      androidRecognitionServicePackage: "com.google.android.googlequicksearchbox",
    });
    return result.locales.includes(locale) || result.installedLocales.includes(locale);
  } catch {
    return true;
  }
}
