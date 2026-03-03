import { atom } from "jotai";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const TTS_SETTINGS_KEY = "@doctruyen/tts_settings";

export interface TTSSettings {
  rate: number;
  pitch: number;
  voice: string | null;
  language: string;
  /** Thời gian nghỉ giữa các đoạn (ms) */
  pauseBetweenParagraphsMs: number;
}

export const defaultTTSSettings: TTSSettings = {
  rate: 1,
  pitch: 1,
  voice: null,
  language: "vi-VN",
  pauseBetweenParagraphsMs: 0,
};

export const ttsSettingsAtom = atom<TTSSettings>(defaultTTSSettings);

export async function loadTTSSettings(): Promise<TTSSettings> {
  try {
    const stored = await AsyncStorage.getItem(TTS_SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<TTSSettings>;
      return { ...defaultTTSSettings, ...parsed };
    }
  } catch {
    // ignore
  }
  return defaultTTSSettings;
}

export async function saveTTSSettings(settings: TTSSettings): Promise<void> {
  await AsyncStorage.setItem(TTS_SETTINGS_KEY, JSON.stringify(settings));
}
