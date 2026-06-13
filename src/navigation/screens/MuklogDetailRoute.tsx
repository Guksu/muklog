// src/navigation/screens/MuklogDetailRoute.tsx
// 먹로그 상세 컨테이너(얇은 배선) — plan §3·§4, ui-spec §2 경계.
//   useRoute로 muklogId → useMuklog(조회) → MuklogDetailScreen(순수 표시)에 state/콜백 주입.
//   작성자 라벨/아바타 파생용 meId(useAuth) + meAvatarUrl(본인 useProfile). 파트너 실프로필 OUT(RLS, plan §3.4).
//   비주얼은 MuklogDetailScreen 소유 — 여기서는 데이터/네비 배선만(비주얼 변경 금지).
//
// 생산자(소비): useMuklog(state)·useAuth(meId)·useProfile(meAvatarUrl) → MuklogDetailScreen props.
//   useMuklog의 MuklogDetailState는 화면 MuklogDetailState와 필드 1:1(plan §3.3 ↔ ui-spec §3) → 그대로 전달.
import React from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';

import { useAuth } from '@/features/auth';
import { useProfile } from '@/features/profile';
import { useMuklog } from '@/features/muklog';

import { Routes, type AppStackParamList } from '../routes';
import { MuklogDetailScreen } from './MuklogDetailScreen';

export const MuklogDetailRoute = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<AppStackParamList, typeof Routes.MuklogDetail>>();
  // 잘못된 param(누락)은 빈 문자열 → 0행 → notFound로 안전(plan §7 muklogId 누락).
  const muklogId = route.params?.muklogId ?? '';

  const { state: authState } = useAuth();
  // 작성자 라벨 파생용 uid. 이 화면은 AuthGate authenticated 하에만 진입하나 미인증도 빈 문자열로 안전.
  const meId = authState.status === 'authenticated' ? authState.userId : '';

  // ⚠️ 훅은 조건부 호출 불가 → muklogId/meId가 비어도 안전한 값으로 호출하고 결과로 분기.
  const { state, refresh } = useMuklog({ muklogId });
  const { state: profileState } = useProfile({ userId: meId });
  const meAvatarUrl = profileState.status === 'ready' ? profileState.profile.avatarUrl : null;

  const handleBack = () => navigation.goBack();
  const handleRetry = () => void refresh();

  // useMuklog state(plan §3.3)와 화면 state(ui-spec §3)는 필드 1:1 → 그대로 전달.
  return (
    <MuklogDetailScreen
      state={state}
      meId={meId}
      meAvatarUrl={meAvatarUrl}
      onBack={handleBack}
      onRetry={handleRetry}
    />
  );
};
