import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import * as Speech from "expo-speech";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  source: { type: "file"; uri: string } | { type: "tts"; text: string; language?: string };
  speed?: number;
  onPlayEnd?: () => void;
}

function formatTime(seconds: number): string {
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function AudioPlayer({ source, speed = 1.0, onPlayEnd }: Props) {
  const player = useAudioPlayer(
    source.type === "file" ? { uri: source.uri } : null
  );
  const status = useAudioPlayerStatus(player);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const onPlayEndRef = useRef(onPlayEnd);
  onPlayEndRef.current = onPlayEnd;

  useEffect(() => {
    if (source.type === "file" && status.didJustFinish) {
      setFinished(true);
      onPlayEndRef.current?.();
    }
  }, [status.didJustFinish, source.type]);

  const handlePress = async () => {
    if (source.type === "tts") {
      if (ttsPlaying) {
        Speech.stop();
        setTtsPlaying(false);
        return;
      }
      setTtsPlaying(true);
      Speech.speak(source.text, {
        language: source.language ?? "en-US",
        rate: speed,
        onDone: () => {
          setTtsPlaying(false);
          onPlayEndRef.current?.();
        },
        onStopped: () => setTtsPlaying(false),
        onError: () => setTtsPlaying(false),
      });
    } else {
      if (status.playing) {
        player.pause();
      } else {
        if (finished) {
          player.seekTo(0);
          setFinished(false);
        }
        player.play();
      }
    }
  };

  const isActive = source.type === "tts" ? ttsPlaying : status.playing;
  const isLoading = source.type === "file" && !status.isLoaded;

  const duration = status.duration ?? 0;
  const currentTime = status.currentTime ?? 0;
  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={[styles.button, isActive && styles.buttonActive]}
        onPress={handlePress}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#1A56DB" size="small" />
        ) : (
          <Ionicons name={isActive ? "pause" : "play"} size={18} color="#1A56DB" />
        )}
        <Text style={[styles.label, isActive && styles.labelActive]}>
          {isActive ? "재생 중..." : "듣기"}
        </Text>
      </TouchableOpacity>
      {source.type === "file" && (
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` as any }]} />
          </View>
          <Text style={styles.timeText}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#1A56DB",
    backgroundColor: "#FFFFFF",
  },
  buttonActive: {
    backgroundColor: "#EBF2FF",
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1A56DB",
  },
  labelActive: {
    color: "#1A56DB",
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: 3,
    backgroundColor: "#1A56DB",
    borderRadius: 2,
  },
  timeText: {
    fontSize: 11,
    color: "#9CA3AF",
    fontVariant: ["tabular-nums"],
    minWidth: 72,
    textAlign: "right",
  },
});
