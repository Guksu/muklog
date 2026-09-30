// src/navigation/screens/RoomCreatedRoute.tsx
// 로그 생성 완료 축하 컨테이너(얇은 배선) — FLAG-3. RoomCreatedScreen(비주얼)에 네비/파라미터만 주입.
//   진입: useStartLogFlow가 createRoom 성공 시 navigate(RoomCreated, { roomId, code }).
//     소비처는 헤더 +버튼·목록 빈 상태 카드·목록 하단 CTA 시트 — 어느 경로로 만들어도 여기를 거친다(ux-entry-trust U1).
//   "로그 열기"(onEnter) → replace(LogScreen) — 뒤로가기 시 축하화면으로 안 돌아오게 그 로그로 교체.
//   "나중에"/뒤로(onLater) → goBack(홈 목록 복귀). 목록은 useStartLogFlow가 navigate 전에 refresh해 이미 +1 반영.
//   비주얼은 RoomCreatedScreen 소유 — 여기서는 데이터/네비 배선만.
//   invite-share(U72): 카드 "공유" → shareInvite({ code })(OS 공유 시트), "복사" → copyInviteCode({ code })(코드 6자 + 토스트).
//     ⚠️ code = route.params.code(useStartLogFlow가 inviteCode → code로 이름을 바꿔 넘긴다). 화면 이동 없음(축하 화면에 머문다).
import React from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useInviteShare } from '@/features/room';

import { Routes, type AppStackParamList } from '../../routes';
import { RoomCreatedScreen } from '../RoomCreatedScreen';

export const RoomCreatedRoute = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, typeof Routes.RoomCreated>>();
  const { roomId, code } = route.params;
  const { shareInvite, copyInviteCode } = useInviteShare();

  const handleEnter = () => navigation.replace(Routes.LogScreen, { roomId });
  const handleLater = () => navigation.goBack();
  // 두 함수는 throw하지 않는다(실패는 전역 토스트) — 결과를 기다리지 않고 버린다.
  const handleShare = () => void shareInvite({ code });
  const handleCopy = () => void copyInviteCode({ code });

  return (
    <RoomCreatedScreen
      inviteCode={code}
      onEnter={handleEnter}
      onLater={handleLater}
      onShare={handleShare}
      onCopy={handleCopy}
    />
  );
};
