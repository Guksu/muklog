// src/navigation/navigationRef/navigationRef.ts
// 전역 네비게이션 ref (push-receive-ux plan §3.4). NavigationContainer(AuthGate authenticated 트리)에 부착.
//   React 트리 밖(알림 리스너)에서 navigate하기 위한 유일한 진입점. isReady()로 준비(=authenticated 트리 렌더) 확인.
//   NavigationContainer는 authenticated에서만 렌더되므로, isReady()=false면 아직 미인증/부팅 중 → 대기 큐로.
import { createNavigationContainerRef } from '@react-navigation/native';

import { type AppStackParamList } from '../routes';

export const navigationRef = createNavigationContainerRef<AppStackParamList>();
