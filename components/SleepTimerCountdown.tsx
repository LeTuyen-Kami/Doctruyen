import React, { useEffect, useState } from "react";
import { Text } from "react-native";

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface SleepTimerCountdownProps {
  endTime: number | null;
  className?: string;
}

/**
 * Component riêng để đếm ngược - chỉ component này re-render mỗi giây,
 * không làm re-render parent (ReaderScreen).
 */
export function SleepTimerCountdown({ endTime, className }: SleepTimerCountdownProps) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (endTime == null) {
      setRemaining(null);
      return;
    }
    const tick = () => {
      const r = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setRemaining(r);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTime]);

  if (remaining == null) return null;
  return (
    <Text className={className ?? "min-w-[36] text-sm font-medium text-amber-600 dark:text-amber-400"}>
      {formatCountdown(remaining)}
    </Text>
  );
}
