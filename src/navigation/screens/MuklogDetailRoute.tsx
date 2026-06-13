// src/navigation/screens/MuklogDetailRoute.tsx
// 먹로그 상세 컨테이너(얇은 배선) — plan §3·§4, ui-spec §2·§4 경계.
//   useRoute로 muklogId → useMuklog(조회) → MuklogDetailScreen(순수 표시)에 state/콜백 주입.
//   작성자 라벨/아바타 파생용 meId(useAuth) + meAvatarUrl(본인 useProfile). 파트너 실프로필 OUT(RLS, plan §3.4).
//   비주얼은 MuklogDetailScreen/MuklogEntrySheet 소유 — 여기서는 데이터/네비 배선만(비주얼 변경 금지).
//
// 편집·삭제(muklog-edit):
//   canManage = createdBy===meId(작성자만 more 노출, RLS 최종 방어) → onEdit(편집 시트 open) / onConfirmDelete(삭제).
//   편집: MuklogEntrySheet dual-mode(initial=현재 먹로그) → onSubmit=useUpdateMuklog(planPhotoReconcile) → 성공 시 닫기 + refresh.
//   삭제: useDeleteMuklog(Storage remove → muklogs delete) — photoPaths = useMuklog.photoStoragePaths(추가 쿼리 0).
//         성공 시 navigation.goBack(리스트 복귀, 목록은 MuklogList 포커스 refresh로 갱신, plan §4.3).
import React, { useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';

import { useAuth } from '@/features/auth';
import { useProfile } from '@/features/profile';
import {
  MuklogEntrySheet,
  useDeleteMuklog,
  useMuklog,
  useUpdateMuklog,
  type MuklogEditInitial,
  type MuklogEditSubmitInput,
} from '@/features/muklog';

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

  const { updateMuklog, loading: updating, error: updateError } = useUpdateMuklog();
  const { deleteMuklog, loading: deleting, error: deleteError } = useDeleteMuklog();

  // 편집 시트 열림 상태(상세 위 오버레이, plan §4.1).
  const [editOpen, setEditOpen] = useState(false);

  const muklog = state.status === 'ready' ? state.muklog : null;
  // 작성자만 관리(편집/삭제) 가능 — more 버튼 노출 분기(RLS가 최종 방어, plan §5 ⑤ a).
  const canManage = muklog !== null && muklog.createdBy === meId;

  // 편집 프리필 — useMuklog 결과를 MuklogEditInitial로 매핑(필드 + existing 사진 슬롯).
  const editInitial: MuklogEditInitial | undefined = muklog
    ? {
        muklogId: muklog.id,
        roomId: muklog.roomId,
        placeName: muklog.placeName,
        category: muklog.category,
        area: muklog.area,
        rating: muklog.rating,
        memo: muklog.memo,
        visitedAt: muklog.visitedAt,
        // existing 사진: 각 photo가 자신의 storagePath를 보유(useMuklog가 zip) → 인덱스 산술 없이 그대로 매핑.
        //   order_index 갭(reindex 실패 등)에도 안전. 발급 실패 슬롯은 photos에서 빠지나 path 기준 reconcile는 정확.
        photos: muklog.photos.map((p) => ({
          storagePath: p.storagePath,
          orderIndex: p.orderIndex,
          uri: p.uri,
        })),
      }
    : undefined;

  const handleBack = () => navigation.goBack();
  const handleRetry = () => void refresh();

  const handleEdit = () => setEditOpen(true);

  // 편집 저장 — 시트 EditorPhoto 최종 배열 + 현재 사진(initial)으로 reconcile. 성공 시 닫기 + refresh.
  const handleSubmitEdit = async ({ input }: { input: MuklogEditSubmitInput }): Promise<void> => {
    await updateMuklog({
      input: {
        muklogId: input.muklogId,
        roomId: input.roomId,
        placeName: input.placeName,
        category: input.category,
        area: input.area,
        rating: input.rating,
        memo: input.memo,
        visitedAt: input.visitedAt,
        photos: input.photos,
      },
      initialPhotos: editInitial?.photos ?? [],
    });
  };

  const handleEditSaved = () => {
    setEditOpen(false);
    void refresh();
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
      navigation.goBack();
    } catch {
      // 에러는 deleteError로 확인 시트에 인라인 표시(재시도 가능). 화면 유지.
    }
  };

  // useMuklog state(plan §3.3)와 화면 state(ui-spec §3)는 표시 필드 1:1 → 그대로 전달(photoStoragePaths는 무시됨).
  return (
    <>
      <MuklogDetailScreen
        state={state}
        meId={meId}
        meAvatarUrl={meAvatarUrl}
        onBack={handleBack}
        onRetry={handleRetry}
        canManage={canManage}
        onEdit={handleEdit}
        onConfirmDelete={() => void handleConfirmDelete()}
        deleting={deleting}
        deleteError={deleteError}
      />
      {/* 편집 시트(상세 위 오버레이) — 작성자만 진입(canManage). initial 주입 시 편집 모드. */}
      {editInitial ? (
        <MuklogEntrySheet
          visible={editOpen}
          roomId={editInitial.roomId}
          initial={editInitial}
          onClose={() => setEditOpen(false)}
          onSaved={handleEditSaved}
          onSubmit={handleSubmitEdit}
          submitting={updating}
          submitError={updateError}
        />
      ) : null}
    </>
  );
};
