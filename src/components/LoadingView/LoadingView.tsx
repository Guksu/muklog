// src/components/LoadingView.tsx
// 전체 화면 로딩 뷰 — <Screen center> + 스피너(원티드 primary). 여러 화면의 loading 조기 반환에서 반복되던 블록 흡수.
//   조기 반환 위치에서 그대로 쓴다: `if (state.status === 'loading') return <LoadingView testID="..." />;` (유니온 내로잉 보존).
import { ActivityIndicator } from 'react-native';

import { useTheme } from '@/theme';

import { Screen } from '../Screen';

/**
 * 화면 중앙 스피너 로딩 뷰.
 * @param testID 스피너 testID(화면별 로딩 식별 — 기존 testID 그대로 전달).
 */
export const LoadingView = ({ testID }: { testID?: string }) => {
  const theme = useTheme();
  return (
    <Screen center>
      <ActivityIndicator testID={testID} color={theme.color.primary} />
    </Screen>
  );
};
