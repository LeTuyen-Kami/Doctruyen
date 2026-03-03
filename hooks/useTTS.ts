import {
  defaultTTSSettings,
  loadTTSSettings,
  type TTSSettings,
} from "@/src/atoms/tts-settings";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useRef, useState } from "react";

export interface UseTTSParams {
  onStopped?: () => void;
}

export interface UseTTSResult {
  speak: (text: string, onComplete?: () => void) => void;
  stop: () => void;
  isPlaying: boolean;
  setPlaying: (playing: boolean) => void;
  settings: TTSSettings;
  setSettings: (s: TTSSettings) => void;
  isStoppedManuallyRef: React.MutableRefObject<boolean>;
}

export function useTTS(params?: UseTTSParams): UseTTSResult {
  const { onStopped } = params ?? {};
  const [isPlaying, setIsPlaying] = useState(false);
  const [settings, setSettings] = useState<TTSSettings>(defaultTTSSettings);
  const isStoppedManuallyRef = useRef(false);

  useEffect(() => {
    loadTTSSettings().then(setSettings);
  }, []);

  const speak = useCallback(
    (text: string, onComplete?: () => void) => {
      if (!text.trim()) {
        onComplete?.();
        return;
      }
      Speech.speak(text, {
        rate: settings.rate,
        pitch: settings.pitch,
        voice: settings.voice ?? undefined,
        language: settings.language,
        onDone: () => {
          if (isStoppedManuallyRef.current) {
            isStoppedManuallyRef.current = false;
            return;
          }
          onComplete?.();
        },
        onStopped: () => {
          setIsPlaying(false);
          onStopped?.();
        },
      });
      setIsPlaying(true);
    },
    [settings, onStopped]
  );

  const stop = useCallback(() => {
    isStoppedManuallyRef.current = true;
    Speech.stop();
    setIsPlaying(false);
  }, []);

  return {
    speak,
    stop,
    isPlaying,
    setPlaying: setIsPlaying,
    settings,
    setSettings,
    isStoppedManuallyRef,
  };
}
