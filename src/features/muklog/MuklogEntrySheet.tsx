// src/features/muklog/MuklogEntrySheet.tsx
// 먹로그 입력 시트(작성/편집 dual-mode) — 킷 mk-log.jsx MuklogEditor 재현 (plan §3.5 / §5 ④).
//   킷 MuklogEditor: isEdit = !!initial → 제목·저장 토스트·초기값 분기(작성/편집 겸용).
//   필드: 장소명(필수)·카테고리(8종 칩)·별점(editable Stars)·메모·방문일(기본 today, 미래 차단).
//   사진(킷 mk-log:319-339): 작성=PickedPhoto[](local) / 편집=EditorPhoto[](existing remote + new local 혼합).
//     existing × 누르면 슬롯 제거(toDelete 후보), 신규 추가는 합산 5장 제한. order = 배열 인덱스.
//   저장 경계: 작성=내부 useCreateMuklog(회귀 유지). 편집=onSubmit(developer가 useUpdateMuklog 연결).
//     검증/저장/사진 reconciliation은 developer(훅)가 담당 — 시트는 입력 수집·콜백 트리거만.
//   스타일은 토큰만(raw hex 0), 이모지 허용(킷 기준).
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Button, Sheet, Stars, Text } from '@/components';
import { useTheme } from '@/theme';

import { MUKLOG_CATEGORIES, MUKLOG_CATEGORY_KEYS, type MuklogCategoryKey } from './categories';
import { mapMuklogError } from './errors';
import { mapKakaoCategory } from './kakaoCategory';
import { PhotoPickerGrid } from './PhotoPickerGrid';
import { PlaceSearchField, type PlaceSearchStatus } from './PlaceSearchField';
import { PlaceSelectedSummary } from './PlaceSelectedSummary';
import {
  type EditorPhoto,
  type MuklogEditInitial,
  type PickedPhoto,
  type PlaceFields,
  type PlaceSearchItem,
} from './types';
import { useCreateMuklog } from './useCreateMuklog';
import { useMuklogPhotoPicker } from './useMuklogPhotoPicker';
import { todayLocalDate } from './validate';

// 결과 항목 → 매핑 카테고리(커버/라벨) 기본 해석. 컨테이너가 resolveCategory 미주입 시 시트가 자체 제공.
const defaultResolveCategory = ({ item }: { item: PlaceSearchItem }): MuklogCategoryKey | null =>
  mapKakaoCategory({ categoryName: item.categoryName, categoryGroupCode: item.categoryGroupCode });

// 시트가 저장 payload로 합류하는 place 필드 묶음(좌표/주소/kakaoPlaceId + area). 자동채움·프리필의 단일 보관소.
type SheetPlaceData = {
  area: string | null;
  address: string | null;
  roadAddress: string | null;
  kakaoPlaceId: string | null;
  lat: number | null;
  lng: number | null;
};
const EMPTY_PLACE_DATA: SheetPlaceData = {
  area: null,
  address: null,
  roadAddress: null,
  kakaoPlaceId: null,
  lat: null,
  lng: null,
};

const PLACE_NAME_MAX = 60;
const MEMO_MAX = 500;
const PHOTO_MAX = 5;

// 편집 모드 submit 결과(developer useUpdateMuklog 반환과 정합). 성공 판정만 쓰므로 최소형.
//   place 필드(muklog-place §3.8·§6): 편집 진입 프리필 좌표를 그대로 싣어 재검색 없이 저장해도 손실 0.
export type MuklogEditSubmitInput = {
  muklogId: string;
  roomId: string;
  placeName: string;
  category: string | null;
  area: string | null;
  rating: number | null;
  memo: string | null;
  visitedAt: string;
  /** existing(유지) + new(신규)가 섞인 최종 순서 = 새 order_index(0..N-1). */
  photos: EditorPhoto[];
} & PlaceFields;

// ── 장소검색(muklog-place) controlled 골격 props (plan §4 / ui-spec §5) ───────────────
//   비주얼 골격(ui-publisher)만 — query/results/status/error/선택 등은 developer가 usePlaceSearch·자동채움으로 주입.

/** 장소검색 컨트롤(usePlaceSearch 출력 연결). 미지정 시 검색 영역 비표시(수동 입력만 — 회귀 안전). */
export type MuklogPlaceSearchControl = {
  /** 검색어(usePlaceSearch.query). */
  query: string;
  /** 입력 변경 → 디바운스 트리거(usePlaceSearch.setQuery). */
  onChangeQuery: (text: string) => void;
  /** 검색 상태(plan §4.2). */
  status: PlaceSearchStatus;
  /** 최신 결과(빈 배열 = 0건/미검색). */
  results: PlaceSearchItem[];
  /** error 상태 인라인 안내(usePlaceSearch.errorMessage). */
  errorMessage?: string | null;
  /** 결과 항목 → 매핑 카테고리(커버/라벨). developer가 mapKakaoCategory 주입. */
  resolveCategory?: ({ item }: { item: PlaceSearchItem }) => MuklogCategoryKey | string | null;
};

/** 선택된 장소(있으면 검색/수동입력 대신 요약카드 — 킷 place?placeChosen:searchBtn 토글).
 *  표시 필드(placeName/category/roadAddress/area) + payload 합류 좌표(address/kakaoPlaceId/lat/lng).
 *  컨테이너가 placeFieldsFromItem(PlaceSelection) 결과를 그대로 주입 → 시트가 sync effect로 자동채움. */
export type MuklogSelectedPlace = {
  placeName: string;
  category?: MuklogCategoryKey | string | null;
  roadAddress?: string | null;
  area?: string | null;
  address?: string | null;
  kakaoPlaceId?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export type MuklogEntrySheetProps = {
  /** 표시 여부. false면 미렌더. */
  visible: boolean;
  /** 저장 대상 로그 id. */
  roomId: string;
  /** 딤/취소 시 닫기. */
  onClose: () => void;
  /** 저장 성공 시 호출(부모가 refresh + 닫기). */
  onSaved: () => void;
  // ── 편집 모드 (plan §3.5) ────────────────────────────────────────────────────────
  /** 주어지면 편집 모드(킷 isEdit = !!initial). 없으면 작성 모드(기존 동작). */
  initial?: MuklogEditInitial;
  /** 편집 저장 콜백 — developer가 useUpdateMuklog.updateMuklog를 연결. 성공 resolve / 실패 reject. */
  onSubmit?: ({ input }: { input: MuklogEditSubmitInput }) => Promise<unknown>;
  /** 편집 저장 진행 중 표시(developer useUpdateMuklog.loading). */
  submitting?: boolean;
  /** 편집 저장 에러 메시지(developer useUpdateMuklog.error). 인라인 표시. */
  submitError?: string | null;
  // ── 작성 모드 사진(plan §4 ⑤) — controlled 주입(있으면 우선) 또는 내부 picker 훅(기본) ──────
  /** 선택된 로컬 사진(controlled, 작성 모드). 미지정 시 내부 picker 훅이 관리. */
  photos?: PickedPhoto[];
  /** 사진 추가 타일 탭(controlled, 작성 모드). 미지정 시 내부 picker가 동작. */
  onAddPhoto?: () => void;
  /** 썸네일 ×탭(controlled, 작성 모드). 미지정 시 내부 picker가 index 제거. */
  onRemovePhoto?: ({ index }: { index: number }) => void;
  // ── 장소검색(muklog-place, plan §4) — controlled 비주얼 골격. 미지정 시 검색 영역 비표시(수동 입력만) ──
  /** 장소검색 컨트롤(usePlaceSearch 연결). 미지정 시 검색 영역 미표시. */
  placeSearch?: MuklogPlaceSearchControl;
  /** 결과 선택 → developer 자동채움(placeName/category/coords + selectedPlace 세팅). */
  onSelectPlace?: ({ item }: { item: PlaceSearchItem }) => void;
  /** 선택된 장소 요약(있으면 요약카드 모드 — 검색/수동입력 대체). */
  selectedPlace?: MuklogSelectedPlace | null;
  /** 선택 해제(plan D2 — developer가 좌표 NULL 리셋, 장소명 유지). */
  onClearPlace?: () => void;
};

export const MuklogEntrySheet = ({
  visible,
  roomId,
  onClose,
  onSaved,
  initial,
  onSubmit,
  submitting = false,
  submitError = null,
  photos: photosProp,
  onAddPhoto,
  onRemovePhoto,
  placeSearch,
  onSelectPlace,
  selectedPlace = null,
  onClearPlace,
}: MuklogEntrySheetProps) => {
  const theme = useTheme();
  // 킷 isEdit = !!initial. 편집 모드 = 저장이 onSubmit(외부 훅), 작성 모드 = 내부 useCreateMuklog.
  const isEdit = initial !== undefined;

  const { createMuklog, loading: createLoading, error: createError } = useCreateMuklog();
  const picker = useMuklogPhotoPicker();

  // 필드 초기값 — 편집이면 initial 프리필, 작성이면 빈값(킷 mk-log:283-288).
  const [placeName, setPlaceName] = useState(initial?.placeName ?? '');
  const [category, setCategory] = useState<MuklogCategoryKey | null>(
    (initial?.category as MuklogCategoryKey | null) ?? null,
  );
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [memo, setMemo] = useState(initial?.memo ?? '');
  const [visitedAt, setVisitedAt] = useState(initial?.visitedAt ?? todayLocalDate());
  // 편집 사진 슬롯(existing+new 혼합). initial 사진을 existing 슬롯으로 시드(킷 mk-log:287).
  const [editorPhotos, setEditorPhotos] = useState<EditorPhoto[]>(
    () =>
      initial?.photos.map((p) => ({
        kind: 'existing' as const,
        storagePath: p.storagePath,
        uri: p.uri,
      })) ?? [],
  );
  // 내부 picker 권한 거부 등 사진 단계 에러(작성 uncontrolled일 때만 발생).
  const [photoError, setPhotoError] = useState<string | null>(null);

  // ── 장소(muklog-place) — 선택 표시는 컨테이너 controlled(selectedPlace prop), payload 합류는 시트(ui-spec §5) ──
  //   placeData = 저장 payload로 합류하는 place 필드의 단일 보관소.
  //     · 편집 진입 시 initial 프리필 → 재검색 없이 저장해도 좌표 손실 0(§6).
  //     · selectedPlace 주입(검색 선택) 시 sync effect가 갱신(자동채움 §5.4·D1).
  //     · 선택 해제(handleClearPlace) 시 좌표/주소/kakaoPlaceId NULL 리셋(D2, area는 유지).
  const [placeData, setPlaceData] = useState<SheetPlaceData>(() => ({
    area: initial?.area ?? null,
    address: initial?.address ?? null,
    roadAddress: initial?.roadAddress ?? null,
    kakaoPlaceId: initial?.kakaoPlaceId ?? null,
    lat: initial?.lat ?? null,
    lng: initial?.lng ?? null,
  }));

  // selectedPlace(컨테이너 선택) → 장소명/카테고리 칩/placeData 자동채움(§5.4·D1). 선택 식별값 변화 시 1회.
  useEffect(
    function syncFromSelectedPlace() {
      if (!selectedPlace) return;
      setPlaceName(selectedPlace.placeName.slice(0, PLACE_NAME_MAX));
      // D1: 매핑 성공 시 카테고리 칩 자동선택(덮어쓰기), null이면 기존 선택 보존.
      if (selectedPlace.category != null) {
        setCategory(selectedPlace.category as MuklogCategoryKey);
      }
      setPlaceData({
        area: selectedPlace.area ?? null,
        address: selectedPlace.address ?? null,
        roadAddress: selectedPlace.roadAddress ?? null,
        kakaoPlaceId: selectedPlace.kakaoPlaceId ?? null,
        lat: selectedPlace.lat ?? null,
        lng: selectedPlace.lng ?? null,
      });
    },
    [
      selectedPlace?.placeName,
      selectedPlace?.category,
      selectedPlace?.kakaoPlaceId,
      selectedPlace?.lat,
      selectedPlace?.lng,
    ],
  );

  // 결과 행 탭 → 컨테이너로 전달(컨테이너가 selectedPlace 세팅 → sync effect가 자동채움). 시트는 선택 표시 state 미보유.
  const handleSelectPlace = ({ item }: { item: PlaceSearchItem }) => {
    onSelectPlace?.({ item });
  };

  // 선택 해제(plan D2) — 컨테이너에 알리고(selectedPlace=null), 시트의 placeData 좌표/주소/kakaoPlaceId NULL 리셋(area 유지).
  const handleClearPlace = () => {
    onClearPlace?.();
    setPlaceData((prev) => ({ ...EMPTY_PLACE_DATA, area: prev.area }));
  };

  // 작성 모드 사진: controlled(onAddPhoto 주입) 우선, 아니면 내부 picker 훅.
  const controlled = onAddPhoto !== undefined;
  const createPhotos = controlled ? (photosProp ?? []) : picker.photos;
  // 그리드가 표시할 사진(uri만 필요) — 편집은 editorPhotos, 작성은 createPhotos.
  const gridPhotos: PickedPhoto[] = isEdit
    ? editorPhotos.map((p) => ({ uri: p.uri }))
    : createPhotos;

  const loading = isEdit ? submitting : createLoading;
  const error = isEdit ? submitError : createError;

  const handleAddPhoto = async () => {
    if (gridPhotos.length >= PHOTO_MAX) return;
    if (isEdit) {
      // 편집 신규 추가 — 내부 picker로 local 사진 선택해 new 슬롯 append(합산 5장 컷).
      setPhotoError(null);
      try {
        const picked = await picker.pickPhotoAssets({ remaining: PHOTO_MAX - editorPhotos.length });
        if (picked.length > 0) {
          setEditorPhotos((prev) => [...prev, ...picked.map((a) => ({ kind: 'new' as const, uri: a.uri }))]);
        }
      } catch (err) {
        setPhotoError(mapMuklogError({ error: err }));
      }
      return;
    }
    if (controlled) {
      onAddPhoto?.();
      return;
    }
    setPhotoError(null);
    try {
      await picker.addPhotos();
    } catch (err) {
      setPhotoError(mapMuklogError({ error: err }));
    }
  };

  const handleRemovePhoto = ({ index }: { index: number }) => {
    if (isEdit) {
      // existing × → 슬롯 제거(toDelete 후보) / new × → 미업로드분 제거(킷 mk-log:325).
      setEditorPhotos((prev) => prev.filter((_, i) => i !== index));
      return;
    }
    if (controlled) {
      onRemovePhoto?.({ index });
      return;
    }
    picker.removePhoto({ index });
  };

  const canSave = placeName.trim().length > 0 && !loading;

  const handleSave = async () => {
    if (isEdit) {
      // 편집 — developer onSubmit(useUpdateMuklog). initial 보장(isEdit). 검증/reconcile은 훅.
      if (!onSubmit || !initial) return;
      try {
        await onSubmit({
          input: {
            muklogId: initial.muklogId,
            roomId,
            placeName,
            category,
            area: placeData.area,
            rating,
            memo,
            visitedAt,
            photos: editorPhotos,
            // place 필드(muklog-place §3.8·§6) — 프리필/선택 좌표 합류(재검색 없이 저장해도 보존).
            kakaoPlaceId: placeData.kakaoPlaceId,
            address: placeData.address,
            roadAddress: placeData.roadAddress,
            lat: placeData.lat,
            lng: placeData.lng,
          },
        });
        onSaved();
      } catch {
        // 에러는 submitError(부모 useUpdateMuklog.error)로 인라인 표시. 시트 유지(입력 보존).
      }
      return;
    }
    // 작성 — 내부 useCreateMuklog(회귀 유지). 선택/자동채움 place 필드를 payload에 합류(plan §3.8 / T9).
    try {
      await createMuklog({
        input: {
          roomId,
          placeName,
          category,
          area: placeData.area,
          rating,
          memo,
          visitedAt,
          photos: createPhotos,
          kakaoPlaceId: placeData.kakaoPlaceId,
          address: placeData.address,
          roadAddress: placeData.roadAddress,
          lat: placeData.lat,
          lng: placeData.lng,
        },
      });
      if (!controlled) picker.reset();
      onSaved();
    } catch {
      // 에러는 useCreateMuklog가 error 상태로 노출 → 아래 인라인 표시. 시트 유지.
    }
  };

  const fieldInput = {
    color: theme.color.fg,
    backgroundColor: theme.color.surface,
    borderColor: theme.color.hairline,
    borderRadius: theme.radius.control,
    paddingHorizontal: theme.spacing[16],
    paddingVertical: theme.spacing[14],
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={isEdit ? '먹로그 편집' : '새 먹로그 🍽️'}>
      <ScrollView keyboardShouldPersistTaps="handled">
        {/* 장소 (필수) — 킷 mk-log MuklogEditor place 필드. 선택됨이면 요약카드, 아니면 검색+수동입력(ui-spec §5.1). */}
        <Text variant="bodySm" color="fg" style={styles.label}>
          어디서 먹었나요? *
        </Text>
        {selectedPlace ? (
          // 선택 후 — 킷 placeChosen(요약카드). 검색 pill·수동입력 대체. (컨테이너 controlled selectedPlace)
          <PlaceSelectedSummary
            placeName={selectedPlace.placeName}
            category={selectedPlace.category}
            roadAddress={selectedPlace.roadAddress}
            area={selectedPlace.area}
            onClear={handleClearPlace}
          />
        ) : (
          <>
            {/* 검색 영역(controlled) — placeSearch 주입 시만. 미주입 시 수동 입력만(회귀 안전). */}
            {placeSearch ? (
              <View style={{ marginBottom: theme.spacing[10] }}>
                <PlaceSearchField
                  query={placeSearch.query}
                  onChangeQuery={placeSearch.onChangeQuery}
                  status={placeSearch.status}
                  results={placeSearch.results}
                  errorMessage={placeSearch.errorMessage}
                  resolveCategory={placeSearch.resolveCategory ?? defaultResolveCategory}
                  onSelectResult={handleSelectPlace}
                />
              </View>
            ) : null}
            {/* 수동 입력(폴백) — 선택 결과 자동채움 대상이자 직접 입력 경로. */}
            <TextInput
              accessibilityLabel="장소 이름"
              value={placeName}
              onChangeText={setPlaceName}
              maxLength={PLACE_NAME_MAX}
              placeholder="장소 이름을 입력하세요"
              placeholderTextColor={theme.color.fgMuted}
              style={[styles.input, fieldInput]}
            />
          </>
        )}

        {/* 카테고리 (8종 칩) */}
        <Text variant="bodySm" color="fg" style={[styles.label, { marginTop: theme.spacing[16] }]}>
          카테고리
        </Text>
        <View style={styles.chipRow}>
          {MUKLOG_CATEGORY_KEYS.map((key) => {
            const selected = category === key;
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={`카테고리 ${MUKLOG_CATEGORIES[key].label}`}
                accessibilityState={{ selected }}
                onPress={() => setCategory(selected ? null : key)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected ? theme.color.primary : theme.color.surface,
                    borderColor: selected ? theme.color.primary : theme.color.hairline,
                    borderRadius: theme.radius.full,
                    paddingVertical: theme.spacing[8],
                    paddingHorizontal: theme.spacing[12],
                  },
                ]}
              >
                <Text variant="bodySm" color={selected ? 'primaryFg' : 'fgWeak'}>
                  {MUKLOG_CATEGORIES[key].emoji} {MUKLOG_CATEGORIES[key].label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* 사진 (0~5) — 킷 mk-log.jsx:319-339. 편집은 existing+new 혼합 슬롯. */}
        <View style={{ marginTop: theme.spacing[16] }}>
          <PhotoPickerGrid
            label="사진"
            photos={gridPhotos}
            uploading={loading}
            onAdd={() => void handleAddPhoto()}
            onRemove={(arg) => handleRemovePhoto(arg)}
          />
          {photoError ? (
            <Text variant="bodySm" color="error" style={{ marginTop: theme.spacing[8] }}>
              {photoError}
            </Text>
          ) : null}
        </View>

        {/* 별점 */}
        <Text variant="bodySm" color="fg" style={[styles.label, { marginTop: theme.spacing[16] }]}>
          별점
        </Text>
        <Stars value={rating} size={32} editable onChange={setRating} />

        {/* 메모 */}
        <Text variant="bodySm" color="fg" style={[styles.label, { marginTop: theme.spacing[16] }]}>
          메모
        </Text>
        <TextInput
          accessibilityLabel="메모"
          value={memo}
          onChangeText={setMemo}
          maxLength={MEMO_MAX}
          multiline
          numberOfLines={4}
          placeholder="무엇을 먹었고 어땠는지 남겨보세요 💕"
          placeholderTextColor={theme.color.fgMuted}
          style={[styles.input, styles.memo, fieldInput]}
        />

        {/* 방문일 (기본 today, 미래 차단은 검증이 최종 방어) */}
        <Text variant="bodySm" color="fg" style={[styles.label, { marginTop: theme.spacing[16] }]}>
          방문일
        </Text>
        <TextInput
          accessibilityLabel="방문일"
          value={visitedAt}
          onChangeText={setVisitedAt}
          maxLength={10}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={theme.color.fgMuted}
          style={[styles.input, fieldInput]}
        />

        {error ? (
          <Text variant="bodySm" color="error" style={{ marginTop: theme.spacing[12] }}>
            {error}
          </Text>
        ) : null}

        <Button
          title={isEdit ? '수정' : '저장'}
          accessibilityLabel={isEdit ? '수정' : '저장'}
          loading={loading}
          disabled={!canSave}
          onPress={() => void handleSave()}
          style={{ marginTop: theme.spacing[20] }}
        />
      </ScrollView>
    </Sheet>
  );
};

const styles = StyleSheet.create({
  label: { marginBottom: 10 },
  input: { borderWidth: StyleSheet.hairlineWidth },
  memo: { minHeight: 96, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: StyleSheet.hairlineWidth },
});
