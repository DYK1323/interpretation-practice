import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { SessionStep } from "../types";
import { STEP_LABELS, getStepIndex } from "../features/session/sessionMachine";

const STEPS: SessionStep[] = [
  "LISTEN_RECORD",
  "PLAYBACK_BACK",
  "COMPARE",
];

interface Props {
  currentStep: SessionStep;
}

export function StepIndicator({ currentStep }: Props) {
  const currentIdx = getStepIndex(currentStep);

  return (
    <View style={styles.container}>
      {STEPS.map((step, idx) => {
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        return (
          <React.Fragment key={step}>
            <View style={styles.stepWrapper}>
              <View
                style={[
                  styles.circle,
                  done && styles.circleDone,
                  active && styles.circleActive,
                ]}
              >
                <Text
                  style={[
                    styles.circleText,
                    (done || active) && styles.circleTextActive,
                  ]}
                >
                  {idx + 1}
                </Text>
              </View>
              <Text
                style={[styles.label, active && styles.labelActive]}
                numberOfLines={1}
              >
                {STEP_LABELS[step]}
              </Text>
            </View>
            {idx < STEPS.length - 1 && (
              <View style={[styles.line, done && styles.lineDone]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  stepWrapper: {
    alignItems: "center",
    width: 44,
  },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  circleDone: {
    backgroundColor: "#1A56DB",
  },
  circleActive: {
    backgroundColor: "#1A56DB",
  },
  circleText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9CA3AF",
  },
  circleTextActive: {
    color: "#FFFFFF",
  },
  label: {
    fontSize: 10,
    color: "#9CA3AF",
    marginTop: 4,
  },
  labelActive: {
    color: "#1A56DB",
    fontWeight: "600",
  },
  line: {
    flex: 1,
    height: 2,
    backgroundColor: "#E5E7EB",
    marginBottom: 14,
  },
  lineDone: {
    backgroundColor: "#1A56DB",
  },
});
