// src/components/ErrorRetryView.tsx
// 전체 화면 에러 뷰 — <Screen center> + 에러 메시지 + "다시 시도" 버튼. 여러 화면의 error 조기 반환에서 반복되던 블록 흡수.
//   조기 반환 위치에서 그대로 쓴다: `if (state.status === 'error') return <ErrorRetryView message={state.message} onRetry={...} />;`.
import { StyleSheet } from 'react-native';

import { useTheme } from '@/theme';

import { Button } from '../Button';
import { Screen } from '../Screen';
import { Text } from '../Text';

const RETRY_LABEL = '다시 시도';

/**
 * 화면 중앙 에러 + 재시도 뷰.
 * @param message 사용자용 에러 메시지(각 훅 state.message).
 * @param onRetry "다시 시도" 콜백(refresh 등).
 */
export const ErrorRetryView = ({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) => {
  const theme = useTheme();
  return (
    <Screen center>
      <Text variant="body" color="error" style={styles.center}>
        {message}
      </Text>
      <Button
        title={RETRY_LABEL}
        accessibilityLabel={RETRY_LABEL}
        variant="secondary"
        onPress={onRetry}
        style={{ marginTop: theme.spacing[16] }}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
});
