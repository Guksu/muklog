// src/navigation/screens/MuklogEditorRoute.tsx
// 먹로그 에디터 컨테이너(얇은 배선) — FLAG-1 풀스크린 전환. 작성/편집을 muklogId 유무로 분기.
//   진입: MuklogList FAB → navigate(MuklogEditor, { roomId })(작성) / MuklogDetail 편집 → navigate(MuklogEditor, { roomId, muklogId })(편집).
//   비주얼은 MuklogEditor 소유 — 여기서는 데이터/네비 배선만(usePlaceSearch·usePlaceSelection·useMuklog·useUpdateMuklog).
//   저장 성공(onSaved) → goBack. 복귀 화면(LogList/MuklogDetail)은 포커스 refresh로 갱신(폴링 아님).
//
// 작성: 내부 useCreateMuklog(MuklogEditor) + 장소검색/선택 controlled 주입.
// 편집: useMuklog(프리필 조회) → MuklogEditInitial 매핑 → MuklogEditor(initial/onSubmit=useUpdateMuklog).
//   조회 loading/error/notFound는 컨테이너가 SubBar+상태 화면으로 처리(에디터는 ready일 때만 마운트).
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';

import { Button, Screen, SubBar, Text } from '@/components';
import {
  MuklogEditor,
  useMuklog,
  usePlaceSearch,
  usePlaceSelection,
  useUpdateMuklog,
  type MuklogEditInitial,
  type MuklogEditSubmitInput,
} from '@/features/muklog';
import { useTheme } from '@/theme';

import { Routes, type AppStackParamList } from '../routes';

export const MuklogEditorRoute = () => {
  const route = useRoute<RouteProp<AppStackParamList, typeof Routes.MuklogEditor>>();
  const { roomId, muklogId } = route.params;
  // muklogId 유무로 작성/편집 분기. 각 서브 컨테이너가 자신에게 필요한 훅만 호출(조건부 훅 호출 방지).
  if (muklogId !== undefined) {
    return <EditEditorRoute roomId={roomId} muklogId={muklogId} />;
  }
  return <CreateEditorRoute roomId={roomId} />;
};

// ── 작성 ──────────────────────────────────────────────────────────────────────────
const CreateEditorRoute = ({ roomId }: { roomId: string }) => {
  const navigation = useNavigation();
  // 장소검색(muklog-place) — 컨테이너가 검색·선택 상태 소유, 에디터에 controlled 주입.
  const placeSearch = usePlaceSearch();
  const { selectedPlace, selectPlace, clearPlace } = usePlaceSelection();

  const handleBack = () => navigation.goBack();
  // 저장 성공 → 목록으로 복귀(LogList가 포커스 refresh로 +1 반영).
  const handleSaved = () => navigation.goBack();

  return (
    <MuklogEditor
      roomId={roomId}
      onBack={handleBack}
      onSaved={handleSaved}
      placeSearch={{
        query: placeSearch.query,
        onChangeQuery: placeSearch.setQuery,
        status: placeSearch.status,
        results: placeSearch.results,
        errorMessage: placeSearch.errorMessage,
      }}
      selectedPlace={selectedPlace}
      onSelectPlace={selectPlace}
      onClearPlace={clearPlace}
    />
  );
};

// ── 편집 ──────────────────────────────────────────────────────────────────────────
const EditEditorRoute = ({ roomId, muklogId }: { roomId: string; muklogId: string }) => {
  const navigation = useNavigation();
  const { state } = useMuklog({ muklogId });
  const { updateMuklog, loading: updating, error: updateError } = useUpdateMuklog();
  const placeSearch = usePlaceSearch();
  const { selectedPlace, selectPlace, clearPlace } = usePlaceSelection();

  const handleBack = () => navigation.goBack();
  const muklog = state.status === 'ready' ? state.muklog : null;

  // 프리필 조회 loading/error/notFound — 에디터는 muklog ready일 때만 마운트. SubBar는 동일 골격 유지.
  if (state.status === 'loading') {
    return (
      <Screen edges={['top', 'left', 'right', 'bottom']} style={styles.screen}>
        <SubBar title="먹로그 편집" onBack={handleBack} />
        <View style={styles.center}>
          <ActivityIndicator testID="editor-prefill-loading" />
        </View>
      </Screen>
    );
  }
  if (!muklog) {
    return (
      <Screen edges={['top', 'left', 'right', 'bottom']} style={styles.screen}>
        <SubBar title="먹로그 편집" onBack={handleBack} />
        <View style={styles.center}>
          <Text variant="body" color="error" style={styles.centerText}>
            {state.status === 'error' ? state.message : '먹로그를 찾을 수 없어요.'}
          </Text>
          <Button title="돌아가기" accessibilityLabel="돌아가기" variant="secondary" onPress={handleBack} />
        </View>
      </Screen>
    );
  }

  // 편집 프리필 — useMuklog 결과를 MuklogEditInitial로 매핑(필드 + existing 사진 슬롯, muklog-edit §6).
  const editInitial: MuklogEditInitial = {
    muklogId: muklog.id,
    roomId: muklog.roomId,
    placeName: muklog.placeName,
    category: muklog.category,
    area: muklog.area,
    rating: muklog.rating,
    memo: muklog.memo,
    visitedAt: muklog.visitedAt,
    kakaoPlaceId: muklog.kakaoPlaceId,
    address: muklog.address,
    roadAddress: muklog.roadAddress,
    lat: muklog.lat,
    lng: muklog.lng,
    photos: muklog.photos.map((p) => ({
      storagePath: p.storagePath,
      orderIndex: p.orderIndex,
      uri: p.uri,
    })),
  };

  // 편집 저장 — 에디터 EditorPhoto 최종 배열 + 프리필 사진으로 reconcile(useUpdateMuklog).
  const handleSubmit = async ({ input }: { input: MuklogEditSubmitInput }): Promise<void> => {
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
        kakaoPlaceId: input.kakaoPlaceId,
        address: input.address,
        roadAddress: input.roadAddress,
        lat: input.lat,
        lng: input.lng,
      },
      initialPhotos: editInitial.photos,
    });
  };

  // 저장 성공 → 상세로 복귀(MuklogDetail이 포커스 refresh로 갱신).
  const handleSaved = () => navigation.goBack();

  return (
    <MuklogEditor
      roomId={roomId}
      initial={editInitial}
      onBack={handleBack}
      onSaved={handleSaved}
      onSubmit={handleSubmit}
      submitting={updating}
      submitError={updateError}
      placeSearch={{
        query: placeSearch.query,
        onChangeQuery: placeSearch.setQuery,
        status: placeSearch.status,
        results: placeSearch.results,
        errorMessage: placeSearch.errorMessage,
      }}
      selectedPlace={selectedPlace}
      onSelectPlace={selectPlace}
      onClearPlace={clearPlace}
    />
  );
};

const styles = StyleSheet.create({
  screen: { padding: 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 20 },
  centerText: { textAlign: 'center' },
});
