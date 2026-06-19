import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from "react-native";
import { useAudioRecorder, RecordingPresets, setAudioModeAsync } from "expo-audio";

interface Props {
  onRecordingComplete: (uri: string) => void;
  onRecordingStart?: () => void;
}

export function RecordButton({ onRecordingComplete, onRecordingStart }: Props) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const pulse = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    });
  }, []);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      pulse.stopAnimation();
      pulse.setValue(1);
      setElapsed(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording, pulse]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handlePress = async () => {
    if (isRecording) {
      await recorder.stop();
      setIsRecording(false);
      const uri = recorder.uri;
      if (uri) {
        onRecordingComplete(uri);
      }
    } else {
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
      onRecordingStart?.();
    }
  };

  return (
    <View style={styles.container}>
      {isRecording && (
        <Text style={styles.timer}>{formatTime(elapsed)}</Text>
      )}
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <TouchableOpacity
          style={[styles.button, isRecording && styles.buttonRecording]}
          onPress={handlePress}
          activeOpacity={0.8}
        >
          <Text style={styles.icon}>{isRecording ? "■" : "●"}</Text>
        </TouchableOpacity>
      </Animated.View>
      <Text style={styles.label}>
        {isRecording ? "탭하여 완료" : "탭하여 녹음 시작"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 12,
  },
  timer: {
    fontSize: 32,
    fontWeight: "300",
    color: "#EF4444",
    fontVariant: ["tabular-nums"],
  },
  button: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#1A56DB",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1A56DB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonRecording: {
    backgroundColor: "#EF4444",
    shadowColor: "#EF4444",
  },
  icon: {
    fontSize: 28,
    color: "#FFFFFF",
  },
  label: {
    fontSize: 14,
    color: "#6B7280",
  },
});
