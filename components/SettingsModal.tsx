import {
  defaultTTSSettings,
  saveTTSSettings,
  type TTSSettings,
} from "@/src/atoms/tts-settings";
import Slider from "@react-native-community/slider";
import * as Speech from "expo-speech";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  useColorScheme,
  View,
} from "react-native";

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  currentSettings: TTSSettings;
  onSettingsChange: (settings: TTSSettings) => void;
}

export function SettingsModal({
  visible,
  onClose,
  currentSettings,
  onSettingsChange,
}: SettingsModalProps) {
  const [rate, setRate] = useState(currentSettings.rate);
  const [pitch, setPitch] = useState(currentSettings.pitch);
  const [voice, setVoice] = useState<string | null>(currentSettings.voice);
  const [pauseBetweenParagraphsMs, setPauseBetweenParagraphsMs] = useState(
    currentSettings.pauseBetweenParagraphsMs
  );
  const [voices, setVoices] = useState<Speech.Voice[]>([]);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const trackColor = isDark ? "#F5F5F5" : "#1A1A1A";
  const thumbColor = isDark ? "#F5F5F5" : "#1A1A1A";
  const maxTrackColor = isDark ? "#475569" : "#E2E8F0";

  const DEBOUNCE_MS = 80;
  const rateTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const pitchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const setRateDebounced = useCallback((value: number) => {
    clearTimeout(rateTimeoutRef.current);
    rateTimeoutRef.current = setTimeout(() => setRate(value), DEBOUNCE_MS);
  }, []);

  const setPitchDebounced = useCallback((value: number) => {
    clearTimeout(pitchTimeoutRef.current);
    pitchTimeoutRef.current = setTimeout(() => setPitch(value), DEBOUNCE_MS);
  }, []);

  const handleRateChange = useCallback(
    (value: number) => setRateDebounced(value),
    [setRateDebounced]
  );

  const handleRateComplete = useCallback((value: number) => {
    clearTimeout(rateTimeoutRef.current);
    setRate(value);
  }, []);

  const handlePitchChange = useCallback(
    (value: number) => setPitchDebounced(value),
    [setPitchDebounced]
  );

  const handlePitchComplete = useCallback((value: number) => {
    clearTimeout(pitchTimeoutRef.current);
    setPitch(value);
  }, []);

  const handlePauseChange = useCallback((value: number) => {
    setPauseBetweenParagraphsMs(Math.round(value));
  }, []);

  const handlePauseComplete = useCallback((value: number) => {
    setPauseBetweenParagraphsMs(Math.round(value));
  }, []);

  useEffect(() => {
    return () => {
      clearTimeout(rateTimeoutRef.current);
      clearTimeout(pitchTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (visible) {
      setRate(currentSettings.rate);
      setPitch(currentSettings.pitch);
      setVoice(currentSettings.voice);
      setPauseBetweenParagraphsMs(currentSettings.pauseBetweenParagraphsMs);
      Speech.getAvailableVoicesAsync().then((v) => {
        setVoices(v.filter((x) => x.language.startsWith("vi")));
      });
    }
  }, [visible, currentSettings]);

  const handleSave = useCallback(async () => {
    const settings: TTSSettings = {
      ...defaultTTSSettings,
      rate,
      pitch,
      voice,
      pauseBetweenParagraphsMs,
    };
    onSettingsChange(settings);
    await saveTTSSettings(settings);
    onClose();
  }, [rate, pitch, voice, pauseBetweenParagraphsMs, onSettingsChange, onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 justify-end bg-black/50" onPress={onClose}>
        <Pressable
          className="max-h-[80%] rounded-t-2xl bg-[#FDFBF7] dark:bg-[#1A1A1A]"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="flex-row items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <View className="flex-row items-center gap-2">
              <Ionicons name="settings" size={24} color="#64748B" />
              <Text className="text-lg font-semibold text-[#1A1A1A] dark:text-[#F5F5F5]">
                Cài đặt đọc
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              className="p-2"
              accessibilityLabel="Đóng"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={24} color="#64748B" />
            </Pressable>
          </View>

          <ScrollView className="max-h-96 px-4 py-4">
            <View className="mb-4">
              <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Tốc độ: {rate.toFixed(1)}x
              </Text>
              <Slider
                value={rate}
                onValueChange={handleRateChange}
                onSlidingComplete={handleRateComplete}
                minimumValue={0.5}
                maximumValue={2}
                step={0.1}
                minimumTrackTintColor={trackColor}
                maximumTrackTintColor={maxTrackColor}
                thumbTintColor={thumbColor}
              />
            </View>

            <View className="mb-4">
              <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Thời gian nghỉ giữa các đoạn: {(pauseBetweenParagraphsMs / 1000).toFixed(1)}s
              </Text>
              <Slider
                value={pauseBetweenParagraphsMs}
                onValueChange={handlePauseChange}
                onSlidingComplete={handlePauseComplete}
                minimumValue={0}
                maximumValue={3000}
                step={100}
                minimumTrackTintColor={trackColor}
                maximumTrackTintColor={maxTrackColor}
                thumbTintColor={thumbColor}
              />
            </View>

            <View className="mb-4">
              <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Độ cao: {pitch.toFixed(1)}
              </Text>
              <Slider
                value={pitch}
                onValueChange={handlePitchChange}
                onSlidingComplete={handlePitchComplete}
                minimumValue={0.5}
                maximumValue={1.5}
                step={0.05}
                minimumTrackTintColor={trackColor}
                maximumTrackTintColor={maxTrackColor}
                thumbTintColor={thumbColor}
              />
            </View>

            {voices.length > 0 && (
              <View className="mb-4">
                <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Giọng đọc
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={() => setVoice(null)}
                      className={`rounded-lg px-3 py-2 ${
                        voice === null
                          ? "bg-[#1A1A1A] dark:bg-[#F5F5F5]"
                          : "bg-gray-200 dark:bg-gray-700"
                      }`}
                    >
                      <Text
                        className={`text-sm ${
                          voice === null
                            ? "text-white dark:text-[#1A1A1A]"
                            : "text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        Mặc định
                      </Text>
                    </Pressable>
                    {voices.map((v) => (
                      <Pressable
                        key={v.identifier}
                        onPress={() => setVoice(v.identifier)}
                        className={`rounded-lg px-3 py-2 ${
                          voice === v.identifier
                            ? "bg-[#1A1A1A] dark:bg-[#F5F5F5]"
                            : "bg-gray-200 dark:bg-gray-700"
                        }`}
                      >
                        <Text
                          className={`text-sm ${
                            voice === v.identifier
                              ? "text-white dark:text-[#1A1A1A]"
                              : "text-gray-700 dark:text-gray-300"
                          }`}
                          numberOfLines={1}
                        >
                          {v.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}
          </ScrollView>

          <View className="border-t border-gray-200 px-4 py-3 dark:border-gray-700 mb-4">
            <Pressable
              onPress={handleSave}
              className="rounded-lg bg-[#1A1A1A] py-3 dark:bg-[#F5F5F5]"
              accessibilityLabel="Lưu cài đặt"
              accessibilityRole="button"
            >
              <Text className="text-center font-medium text-white dark:text-[#1A1A1A]">
                Lưu
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
