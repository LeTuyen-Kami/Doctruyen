import { cn } from "@/src/utils/cn";
import { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import Animated, {
  interpolate,
  runOnJS,
  SharedValue,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

interface AnimatedSliderProps {
  value: SharedValue<number>;
  contentHeight: SharedValue<number>;
  viewportHeight: SharedValue<number>;
  color: string;
}

const THROTTLE_MS = 80;
const HIDE_AFTER_MS = 1500;

const AnimatedSlider = ({
  value,
  contentHeight,
  viewportHeight,
  color,
}: AnimatedSliderProps) => {
  const [displayProgress, setDisplayProgress] = useState(0);
  const textScale = useSharedValue(1);
  const textOpacity = useSharedValue(0);
  const lastUpdateRef = useRef(0);
  const pendingRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const throttledSetProgress = useCallback((current: number) => {
    pendingRef.current = current;
    const now = Date.now();

    // Show text when scroll, reset hide timer
    textOpacity.value = withTiming(1);
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    hideTimeoutRef.current = setTimeout(() => {
      hideTimeoutRef.current = null;
      textOpacity.value = withTiming(0);
    }, HIDE_AFTER_MS);

    if (now - lastUpdateRef.current >= THROTTLE_MS) {
      lastUpdateRef.current = now;
      setDisplayProgress(current);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        setDisplayProgress(pendingRef.current);
        lastUpdateRef.current = Date.now();
      }, THROTTLE_MS);
    } else if (!timeoutRef.current) {
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        setDisplayProgress(pendingRef.current);
        lastUpdateRef.current = Date.now();
      }, THROTTLE_MS - (now - lastUpdateRef.current));
    }
  }, []);

  const progress = useDerivedValue(() => {
    const max = Math.max(0, contentHeight.value - viewportHeight.value);
    if (max <= 0) return 0;
    return interpolate(value.value, [0, max], [0, 100]);
  });

  useAnimatedReaction(
    () => Math.round(progress.value),
    (current) => {
      textScale.value = withSequence(
        withSpring(1.2, { damping: 12 }),
        withSpring(1)
      );
      runOnJS(throttledSetProgress)(current);
    }
  );

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    },
    []
  );

  const progressStyle = useAnimatedStyle(() => ({
    width: `${Math.min(100, Math.max(0, progress.value))}%`,
    backgroundColor: color,
  }));

  const textContainerStyle = useAnimatedStyle(() => ({
    position: "absolute" as const,
    left: `${Math.min(93, Math.max(0, progress.value))}%`,
    transform: [
      { translateX: -4 },
      { translateY: -20 },
      { scale: textScale.value },
    ],
    opacity: textOpacity.value,
  }));

  return (
    <View className="absolute left-0 -bottom-2 right-0 z-100">
      <View className="relative">
        <View className="h-2 rounded-full overflow-hidden">
          <Animated.View style={progressStyle} className="h-full" />
        </View>
        <Animated.View style={textContainerStyle} pointerEvents="none">
          <Text
            className={cn(
              "text-xs font-medium",
              displayProgress === 0 && "hidden"
            )}
            style={{ color }}
          >
            {displayProgress}%
          </Text>
        </Animated.View>
      </View>
    </View>
  );
};

export const useScroll = () => {
  const offsetY = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  const viewportHeight = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    offsetY.value = event.contentOffset.y;
    viewportHeight.value = event.layoutMeasurement?.height ?? 0;
  });

  return {
    offsetY,
    contentHeight,
    viewportHeight,
    scrollHandler,
  };
};

export default AnimatedSlider;
