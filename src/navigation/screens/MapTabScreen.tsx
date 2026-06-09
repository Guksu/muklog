// src/navigation/screens/MapTabScreen.tsx
// 지도 탭 자리 (placeholder). Kakao Map SDK 연동은 map-tab 스프린트.
import React from 'react';

import { Screen, Text } from '@/components';

export const MapTabScreen = () => {
  return (
    <Screen center>
      <Text variant="h3" color="fgWeak" style={{ textAlign: 'center' }}>
        지도가 여기 표시됩니다
      </Text>
    </Screen>
  );
}
