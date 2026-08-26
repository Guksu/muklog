// src/navigation/useStartLogFlow/useStartLogFlow.ts
// 로그 시작(생성/입장) 배선 단일 출처 (ux-entry-trust §3-2, U1 / 결정 D1).
//
// 왜 훅인가: 같은 "새 로그 만들기"가 헤더 +버튼과 목록 화면에 따로 구현돼 있었고, 그 결과
//   경로에 따라 초대코드를 보여주기도 하고 안 보여주기도 했다(U1). 배선을 복사해 고치면 같은 방식으로 또 갈라지므로
//   여기 한 곳만 두고 두 소비처(PlusHeaderButton·LogListScreen)가 호출한다.
//
// 생산자(소비): useCreateRoom(create_room RPC → { roomId, inviteCode }) + useMyLogsContext(refresh) + useNavigation(navigate).
//   ⚠️ 경계면: inviteCode(생성 응답) → code(RoomCreated 라우트 파라미터)로 필드명이 바뀌는 유일한 지점.
import { Alert } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';

import { mapRoomError, useCreateRoom, useMyLogsContext } from '@/features/room';

import { Routes, type AppStackParamList } from '../routes';

export type StartLogFlow = {
  /** 로그 생성 → 목록 갱신 → RoomCreated 축하화면. 실패 시 Alert만(throw 하지 않음 — 호출부 void 안전). */
  createLog: () => Promise<void>;
  /** 초대코드 입력 화면으로 이동. */
  goToJoin: () => void;
  /** 생성 진행 중(useCreateRoom.loading) — 호출부가 CTA/시트 행 비활성에 사용. */
  creating: boolean;
};

/**
 * 로그를 새로 만들거나 초대코드로 들어가는 진입 배선을 제공한다.
 * 어느 경로로 만들든 생성 직후 축하화면을 경유해 초대코드를 반드시 한 번 보여준다.
 * @returns createLog(생성 플로우) · goToJoin(입장 화면 이동) · creating(생성 진행 중)
 */
export const useStartLogFlow = (): StartLogFlow => {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { createRoom, loading: creating } = useCreateRoom();
  const myLogs = useMyLogsContext();

  const createLog = async () => {
    try {
      const { roomId, inviteCode } = await createRoom();
      // 목록 갱신(+1) 후 축하화면으로 이동 — 복귀 시 목록이 최신이고, 초대코드는 공유 수단으로 즉시 노출된다.
      await myLogs.refresh();
      navigation.navigate(Routes.RoomCreated, { roomId, code: inviteCode });
    } catch (err) {
      // 인라인 영역이 없는 진입점(헤더 버튼·시트)이 공통 소비처라 네이티브 Alert로 알린다(navigate/refresh 없음).
      Alert.alert('로그를 만들지 못했어요', mapRoomError({ error: err }));
    }
  };

  const goToJoin = () => navigation.navigate(Routes.JoinLog);

  return { createLog, goToJoin, creating };
};
