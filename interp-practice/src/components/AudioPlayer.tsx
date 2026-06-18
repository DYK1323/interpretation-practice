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

interface Props {
  /** Source: uri for file playback, or text for TTS */
  source: { type: "file"; uri: string } | { type: "tts"; text: string; language?: string };
  speed?: number;
  onPlayEnd?: () => void;
}

export function AudioPlayer({ source, speed = 1.0, onPlayEnd }: Props) {
  const player = useAudioPlayer(
    source.type === "file" ? { uri: source.uri } : null
  );
  const status = useAudioPlayerStatus(player);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const onPlayEndRef = useRef(onPlayEnd);
  onPlayEndRef.current = onPlayEnd;

  useEffect(() => {
    if (source.type === "file" && status.didJustFinish) {
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
        player.seekTo(0);
        player.play();
      }
    }
  };

  const isActive =
    source.type === "tts" ? ttsPlaying : status.playing;
  const isLoading = source.type === "file" && !status.isLoaded;

  return (
    <TouchableOpacity
      style={[styles.button, isActive && styles.buttonActive]}
      onPress={handlePress}
      disabled={isLoading}
    >
      {isLoading ? (
        <ActivityIndicator color="#1A56DB" size="small" />
      ) : (
        <Text style={[styles.icon, isActive && styles.iconActive]}>
          {isActive ? "⏸" : "▶"}
        </Text>
      )}
      <Text style={[styles.label, isActive && styles.labelActive]}>
        {isActive ? "재생 중..." : "듣기"}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
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
  icon: {
    fontSize: 18,
    color: "#1A56DB",
  },
  iconActive: {
    color: "#1A56DB",
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1A56DB",
  },
  labelActive: {
    color: "#1A56DB",
  },
});
