// src/navigation/screens/AuthErrorView.tsx
// 익명 세션 확보 실패 화면. 에러 메시지 + 재시도 버튼(무한 로딩 금지).
import React from 'react';

import { Button, Screen, Text } from '@/components';
import { useTheme } from '@/theme';

export function AuthErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  const theme = useTheme();
  return (
    <Screen center>
      <Text variant="h2" color="fg" style={{ textAlign: 'center' }}>
        연결에 문제가 있어요
      </Text>
      <Text
        variant="body"
        color="fgWeak"
        style={{ textAlign: 'center', marginTop: theme.spacing[8], marginBottom: theme.spacing[24] }}
      >
        {message}
      </Text>
      <Button title="다시 시도" onPress={onRetry} />
    </Screen>
  );
}
