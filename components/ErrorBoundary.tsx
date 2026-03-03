import React, { type ErrorInfo, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (__DEV__) {
      console.error("ErrorBoundary caught:", error, errorInfo);
    }
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <View className="flex-1 items-center justify-center bg-[#FDFBF7] p-6 dark:bg-[#1A1A1A]">
          <Text className="mb-2 text-center text-lg font-semibold text-[#1A1A1A] dark:text-[#F5F5F5]">
            Đã xảy ra lỗi
          </Text>
          <Text className="mb-4 text-center text-gray-600 dark:text-gray-400">
            Vui lòng cập nhật app lên phiên bản mới nhất từ App Store.
          </Text>
          <Pressable
            onPress={() => this.setState({ hasError: false, error: null })}
            className="rounded-lg bg-[#1A1A1A] px-4 py-2 dark:bg-[#F5F5F5]"
          >
            <Text className="font-medium text-white dark:text-gray-900">
              Thử lại
            </Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}
