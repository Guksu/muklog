// src/navigation/screens/MuklogDetailRoute.tsx
// 먹로그 상세 컨테이너(얇은 배선) — plan §3·§4, ui-spec §2·§4 경계.
//   useRoute로 muklogId → useMuklog(조회) → MuklogDetailScreen(순수 표시)에 state/콜백 주입.
//   작성자 라벨/아바타 파생용 meId(useAuth) + meAvatarUrl(본인 useProfile). 파트너 실프로필 OUT(RLS, plan §3.4).
//   비주얼은 MuklogDetailScreen 소유 — 여기서는 데이터/네비 배선만(비주얼 변경 금지).
//
// 편집·삭제(muklog-edit):
//   canManage = createdBy===meId(작성자만 more 노출, RLS 최종 방어) → onEdit(에디터 라우트 이동) / onConfirmDelete(삭제).
//   ⚠️ FLAG-1: 편집이 시트(MuklogEntrySheet) 오버레이 → 풀스크린 에디터 라우트(MuklogEditor)로 전환.
//     onEdit → navigate(MuklogEditor, { roomId, muklogId }). 저장은 에디터에서, 복귀 시 포커스 refresh로 상세 갱신.
//   삭제: useDeleteMuklog(Storage remove → muklogs delete) — photoPaths = useMuklog.photoStoragePaths(추가 쿼리 0).
//         성공 시 navigation.goBack(리스트 복귀, 목록은 MuklogList 포커스 refresh로 갱신, plan §4.3).
import React, { useRef } from 'react';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from '@react-navigation/native';

import { useToastController } from '@/components';
import { useAuth } from '@/features/auth';
import { useProfileContext } from '@/features/profile';
import { useDeleteMuklog, useMuklog } from '@/features/muklog';
import { useRoomMembers } from '@/features/room';

import { Routes, type AppStackParamList } from '../../routes';
import { MuklogDetailScreen } from '../MuklogDetailScreen';

export const MuklogDetailRoute = () => {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, typeof Routes.MuklogDetail>>();
  // 잘못된 param(누락)은 빈 문자열 → 0행 → notFound로 안전(plan §7 muklogId 누락).
  const muklogId = route.params?.muklogId ?? '';

  const { state: authState } = useAuth();
  // 작성자 라벨 파생용 uid. 이 화면은 AuthGate authenticated 하에만 진입하나 미인증도 빈 문자열로 안전.
  const meId = authState.status === 'authenticated' ? authState.userId : '';

  // ⚠️ 훅은 조건부 호출 불가 → muklogId/meId가 비어도 안전한 값으로 호출하고 결과로 분기.
  const { state, refresh } = useMuklog({ muklogId });
  // #2: 공유 프로필 context — 아바타 변경이 내 작성 먹로그 상세에도 즉시 전파.
  const { state: profileState } = useProfileContext();
  const meAvatarUrl = profileState.status === 'ready' ? profileState.profile.avatarUrl : null;

  // 작성자 실 닉/아바타 매핑용 멤버 목록(members-display S5b). roomId는 먹로그 로드 후 확정 → 그 전엔 '' (빈 배열 폴백).
  //   상세 진입 1회 조회(폴링 0). 미로드/에러면 [] → resolveAuthor가 me/partner 폴백 카피(회귀 0, plan §3.3).
  //   ⚠️ 멤버 소스 택1(plan §3.3): 리스트 전달 대신 상세가 useRoomMembers 자체 호출 —
  //     상세는 리스트 외(지도·딥링크)에서도 진입해 members context 가 없을 수 있어 자체 페치가 안전(+1 RPC/진입, useRoom 정책).
  const detailRoomId = state.status === 'ready' ? state.muklog.roomId : '';
  const { state: membersState } = useRoomMembers({ roomId: detailRoomId });
  const members = membersState.status === 'ready' ? membersState.members : [];

  const { deleteMuklog, loading: deleting, error: deleteError } = useDeleteMuklog();
  // 삭제 성공 토스트 — 전역 컨트롤러(루트 단일 <Toast>). goBack 직전에 show → 복귀한 LogScreen 위에서 표시(킷 SPEC §5).
  const { showToast } = useToastController();

  // 에디터에서 편집 저장 후 복귀(재포커스) 시 상세 재조회(폴링 아님, plan §4.3). 첫 포커스(마운트 로드)는 건너뜀.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const hasFocusedRef = useRef(false);
  const handleFocus = React.useCallback(function refreshOnRefocus() {
    if (!hasFocusedRef.current) {
      hasFocusedRef.current = true; // 첫 포커스 = 마운트 로드 → 중복 조회 가드.
      return;
    }
    void refreshRef.current();
  }, []);
  useFocusEffect(handleFocus);

  const muklog = state.status === 'ready' ? state.muklog : null;
  // 작성자만 관리(편집/삭제) 가능 — more 버튼 노출 분기(RLS가 최종 방어, plan §5 ⑤ a).
  const canManage = muklog !== null && muklog.createdBy === meId;

  const handleBack = () => navigation.goBack();
  const handleRetry = () => void refresh();

  // 편집 — 풀스크린 에디터 라우트로 이동(muklogId 동반 → 편집 모드 프리필). FLAG-1.
  const handleEdit = () => {
    if (!muklog) return;
    navigation.navigate(Routes.MuklogEditor, { roomId: muklog.roomId, muklogId: muklog.id });
  };

  // 삭제 확인 "삭제하기" — Storage 정리 → row 삭제 → 성공 시 goBack. 실패는 deleteError로 인라인(시트 유지).
  const handleConfirmDelete = async () => {
    if (!muklog) return;
    try {
      await deleteMuklog({
        muklogId: muklog.id,
        roomId: muklog.roomId,
        photoPaths: muklog.photoStoragePaths,
      });
      // 성공 시에만 토스트(킷 SPEC §5 positive). 전역이라 goBack 직전 show → 복귀한 LogScreen 위에서 보인다.
      showToast({ message: '먹로그를 삭제했어요', tone: 'positive' });
      navigation.goBack();
    } catch {
      // 에러는 deleteError로 확인 시트에 인라인 표시(재시도 가능). 화면 유지. 토스트 없음.
    }
  };

  // useMuklog state(plan §3.3)와 화면 state(ui-spec §3)는 표시 필드 1:1 → 그대로 전달(photoStoragePaths는 무시됨).
  return (
    <MuklogDetailScreen
      state={state}
      meId={meId}
      meAvatarUrl={meAvatarUrl}
      members={members}
      onBack={handleBack}
      onRetry={handleRetry}
      canManage={canManage}
      onEdit={handleEdit}
      onConfirmDelete={() => void handleConfirmDelete()}
      deleting={deleting}
      deleteError={deleteError}
    />
  );
};
