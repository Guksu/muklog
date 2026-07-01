// src/features/muklog/MuklogEditor.tsx
// 먹로그 입력 에디터(작성/편집 dual-mode) — 킷 mk-log.jsx MuklogEditor 재현 (FLAG-1 풀스크린 전환).
//   ⚠️ 구조 변경(ui-fidelity FLAG-1): 하단 Sheet(MuklogEntrySheet) → 풀스크린 화면(Screen + SubBar).
//     · SubBar: 좌측 뒤로(onBack) + 타이틀 + 우측 "저장"/"수정" 액션(킷 mk-log:295 right 슬롯).
//     · 저장 버튼이 SubBar.right로 이동(기존 하단 인라인 Button 제거). 폼/저장/사진/장소 로직은 불변.
//   킷 MuklogEditor: isEdit = !!initial → 제목·저장 토스트·초기값 분기(작성/편집 겸용).
//   필드: 장소명(필수)·카테고리(8종 칩)·별점(editable Stars)·메모·방문일(기본 today, 미래 차단).
//   사진(킷 mk-log:319-339): 작성=PickedPhoto[](local) / 편집=EditorPhoto[](existing remote + new local 혼합).
//     existing × 누르면 슬롯 제거(toDelete 후보), 신규 추가는 합산 5장 제한. order = 배열 인덱스.
//   저장 경계: 작성=내부 useCreateMuklog(회귀 유지). 편집=onSubmit(developer가 useUpdateMuklog 연결).
//     검증/저장/사진 reconciliation은 developer(훅)가 담당 — 에디터는 입력 수집·콜백 트리거만.
//   스타일은 토큰만(raw hex 0), 이모지 허용(킷 기준).
//   FLAG-1b: 장소검색 풀스크린 스왑(searching state) — searchBtn/placeChosen+"변경" → PlaceSearchView(ui-publisher 비주얼,
//     킷 mk-log:383-414)로 스왑, 결과 선택/직접입력(§4.2 0건 폴백) 시 폼 복귀. usePlaceSearch 계약·자동채움·payload 불변.
//   ⚠️ 비주얼 폴리시 대기(ui-publisher): searchBtn(mk-log:312)·placeChosen "변경"(mk-log:309). 검색뷰=PlaceSearchView(완료),
//     저장버튼(mk-log:296, 적용완료). 본 패스는 구조/배선(상태머신)만 — accessibilityLabel/계약은 테스트 의존.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DatePickerSheet, Icon, IconName, Screen, Stars, SubBar, Text, useToastController } from '@/components';
import { useTheme } from '@/theme';

import { MUKLOG_CATEGORIES, MUKLOG_CATEGORY_KEYS, type MuklogCategoryKey } from './categories';
import { formatVisitedDate } from './formatVisitedDate';
import { mapMuklogError } from './errors';
import { mapKakaoCategory } from './kakaoCategory';
import { PhotoPickerGrid } from './PhotoPickerGrid';
import { PlaceSearchView } from './PlaceSearchView';
import { PlaceSelectedSummary } from './PlaceSelectedSummary';
import {
  type EditorPhoto,
  type MuklogEditInitial,
  type PickedPhoto,
  type PlaceFields,
  type PlaceSearchItem,
  type PlaceSearchStatus,
} from './types';
import { useCreateMuklog } from './useCreateMuklog';
import { useMuklogPhotoPicker } from './useMuklogPhotoPicker';
import { MEMO_MIN_LENGTH, todayLocalDate } from './validate';

// 결과 항목 → 매핑 카테고리(커버/라벨) 기본 해석. 컨테이너가 resolveCategory 미주입 시 에디터가 자체 제공.
const defaultResolveCategory = ({ item }: { item: PlaceSearchItem }): MuklogCategoryKey | null =>
  mapKakaoCategory({ categoryName: item.categoryName, categoryGroupCode: item.categoryGroupCode });

// 에디터가 저장 payload로 합류하는 place 필드 묶음(좌표/주소/kakaoPlaceId + area). 자동채움·프리필의 단일 보관소.
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

// 저장 성공 토스트 카피(킷 mk-log:397) — 신규(create) / 편집(edit) 분기, positive 톤. §4 토스트 이모지 제거.
const SAVE_TOAST_CREATE = '맛집을 기록했어요';
const SAVE_TOAST_EDIT = '기록을 수정했어요';

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
 *  컨테이너가 placeFieldsFromItem(PlaceSelection) 결과를 그대로 주입 → 에디터가 sync effect로 자동채움. */
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

export type MuklogEditorProps = {
  /** 저장 대상 로그 id. */
  roomId: string;
  /** SubBar 뒤로/취소 — 컨테이너가 navigation.goBack 연결. */
  onBack: () => void;
  /** 저장 성공 시 호출(컨테이너가 goBack + 복귀 화면 refresh). */
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

export const MuklogEditor = ({
  roomId,
  onBack,
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
}: MuklogEditorProps) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // 킷 isEdit = !!initial. 편집 모드 = 저장이 onSubmit(외부 훅), 작성 모드 = 내부 useCreateMuklog.
  const isEdit = initial !== undefined;

  const { createMuklog, loading: createLoading, error: createError } = useCreateMuklog();
  const picker = useMuklogPhotoPicker();
  // 저장 성공 토스트 — 전역 토스트 컨트롤러(루트 단일 <Toast>). 성공 콜백에서만 show, 실패 시 미표시(기존 에러는 인라인 유지).
  //   전역이라 showToast 직후 onSaved(goBack)로 에디터가 언마운트돼도 복귀 화면 위에서 토스트가 유지된다(언마운트 레이스 해소). 킷 mk-log:400.
  const { showToast } = useToastController();

  // 필드 초기값 — 편집이면 initial 프리필, 작성이면 빈값(킷 mk-log:283-288).
  const [placeName, setPlaceName] = useState(initial?.placeName ?? '');
  const [category, setCategory] = useState<MuklogCategoryKey | null>(
    (initial?.category as MuklogCategoryKey | null) ?? null,
  );
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [memo, setMemo] = useState(initial?.memo ?? '');
  const [visitedAt, setVisitedAt] = useState(initial?.visitedAt ?? todayLocalDate());
  // 방문일 캘린더 시트 열림 상태(date-picker T4). 행 탭→열기, 선택/취소→닫기.
  const [dateOpen, setDateOpen] = useState(false);
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
  // 장소검색 풀스크린 스왑(FLAG-1b, 킷 mk-log:293) — true면 에디터 폼 대신 전용 검색뷰를 렌더.
  //   placeSearch 주입 시에만 진입 가능(searchBtn/변경). 결과 선택 또는 직접입력 시 false로 복귀.
  const [searching, setSearching] = useState(false);

  // ── 장소(muklog-place) — 선택 표시는 컨테이너 controlled(selectedPlace prop), payload 합류는 에디터(ui-spec §5) ──
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

  // ── 장소검색 풀스크린 스왑(FLAG-1b) ──────────────────────────────────────────────────
  const openSearch = () => setSearching(true);

  // 검색뷰 결과 선택 → 컨테이너에 전달(selectedPlace 세팅 → sync effect 자동채움) 후 폼 복귀.
  const handlePickInSearch = ({ item }: { item: PlaceSearchItem }) => {
    onSelectPlace?.({ item });
    setSearching(false);
  };

  // 검색 0건/실패 시 "직접 입력"(§4.2 폴백) — 검색어를 장소명으로 채택(좌표 없음) 후 폼 복귀.
  const handleUseManual = () => {
    const name = (placeSearch?.query ?? '').trim();
    if (name.length === 0) return;
    onClearPlace?.(); // 컨테이너 selectedPlace=null(수동 입력엔 kakao 데이터 없음).
    setPlaceName(name.slice(0, PLACE_NAME_MAX));
    setPlaceData({ ...EMPTY_PLACE_DATA });
    setSearching(false);
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

  // 저장 가능: 장소명 + 메모 최소 5자(필수, 사용자 요청) + 저장 중 아님.
  const memoLongEnough = memo.trim().length >= MEMO_MIN_LENGTH;
  const canSave = placeName.trim().length > 0 && memoLongEnough && !loading;

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
        // 성공 시에만 토스트(킷 mk-log:400). onSaved(goBack)와 겹쳐도 직전 화면에서 보이도록 show 후 onSaved.
        showToast({ message: SAVE_TOAST_EDIT, tone: 'positive' });
        onSaved();
      } catch {
        // 에러는 submitError(부모 useUpdateMuklog.error)로 인라인 표시. 화면 유지(입력 보존).
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
      // 성공 시에만 토스트(킷 mk-log:400). 실패 경로(catch)엔 토스트 없음 — 기존 에러 인라인 유지.
      showToast({ message: SAVE_TOAST_CREATE, tone: 'positive' });
      onSaved();
    } catch {
      // 에러는 useCreateMuklog가 error 상태로 노출 → 아래 인라인 표시. 화면 유지.
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

  const saveLabel = isEdit ? '수정' : '저장';
  // SubBar 우측 저장 액션 — 킷 mk-log:296: font 800/16(=button), 활성 accent-strong / 비활성 text-disable(fgDisabled).
  const saveAction = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={saveLabel}
      accessibilityState={{ disabled: !canSave, busy: loading }}
      disabled={!canSave}
      onPress={() => void handleSave()}
      hitSlop={theme.spacing[8]}
      style={styles.saveAction}
    >
      {loading ? (
        <ActivityIndicator testID="editor-save-spinner" color={theme.color.accentStrong} />
      ) : (
        <Text variant="button" color={canSave ? 'accentStrong' : 'fgDisabled'}>
          {saveLabel}
        </Text>
      )}
    </Pressable>
  );

  // ── 장소검색 풀스크린뷰(FLAG-1b) — searching일 때 폼 대신 PlaceSearchView(ui-publisher 비주얼, 킷 mk-log:383-414)로 스왑 ──
  //   결과 선택=handlePickInSearch(자동채움+복귀) / "직접 입력"(0건 폴백, §4.2)=handleUseManual(검색어 채택+복귀) / 뒤로=복귀.
  if (searching && placeSearch) {
    return (
      <PlaceSearchView
        query={placeSearch.query}
        onChangeQuery={placeSearch.onChangeQuery}
        status={placeSearch.status}
        results={placeSearch.results}
        errorMessage={placeSearch.errorMessage}
        resolveCategory={placeSearch.resolveCategory ?? defaultResolveCategory}
        onSelectResult={handlePickInSearch}
        onUseManualInput={handleUseManual}
        onBack={() => setSearching(false)}
        backLabel="검색 취소"
      />
    );
  }

  return (
    <Screen edges={['left', 'right']} style={styles.screen}>
      {/* 'top' 제외: SubBar가 insets.top을 직접 처리(LogScreen/Join/Profile/RoomCreated 동일 패턴). 포함 시 top inset 이중 적용.
          'bottom' 제외: 비-GNB 엣지투엣지에서 하단 빈 띠 방지 — 배경은 화면 끝까지, 콘텐츠는 contentContainer paddingBottom+insets.bottom으로 인디케이터 클리어. */}
      <SubBar title={isEdit ? '먹로그 편집' : '새 먹로그'} onBack={onBack} right={saveAction} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={styles.scroll}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing[20],
          paddingTop: theme.spacing[8],
          paddingBottom: theme.spacing[28] + insets.bottom,
        }}
      >
        {/* 장소 (필수) — 킷 mk-log MuklogEditor place 필드. 선택됨이면 요약카드, 아니면 검색+수동입력(ui-spec §5.1). */}
        {/* 킷 mk-log:373-374 라벨 + accent "*"(필수). */}
        <Text variant="fieldLabel" color="fg" style={styles.label}>
          어디서 먹었나요? <Text variant="fieldLabel" color="primary">*</Text>
        </Text>
        {selectedPlace ? (
          // 선택됨(검색 결과) — 킷 placeChosen 요약카드. 우상단 "변경"=재검색 진입(단일 액션, 사용자 요청).
          <PlaceSelectedSummary
            placeName={selectedPlace.placeName}
            category={selectedPlace.category}
            roadAddress={selectedPlace.roadAddress}
            area={selectedPlace.area}
            onChange={openSearch}
          />
        ) : placeSearch ? (
          placeName.trim().length > 0 ? (
            // 장소명만 있음(편집 프리필 / 직접입력) — manual-chosen 카드. 우상단 "변경"=재검색 진입.
            <PlaceSelectedSummary
              placeName={placeName}
              category={category}
              roadAddress={placeData.roadAddress}
              area={placeData.area}
              onChange={openSearch}
            />
          ) : (
            // 미선택 — 킷 searchBtn(돋보기 + "맛집 이름을 검색해요", mk-log:418) → 풀스크린 검색뷰 진입.
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="장소 검색하기"
              onPress={openSearch}
              style={[
                styles.searchBtn,
                {
                  borderColor: theme.color.hairline,
                  backgroundColor: theme.color.surface,
                  // 킷 lk.searchBtn(mk-log:497): radius 16(xl), border 1.5, padding 15/16.
                  borderRadius: theme.radius.xl,
                  paddingVertical: theme.spacing[14],
                  paddingHorizontal: theme.spacing[16],
                  gap: theme.spacing[8],
                },
              ]}
            >
              <Icon name={IconName.Search} size={20} color="fgMuted" />
              {/* 킷 mk-log:418 검색 버튼 라벨 500/15 → memoBody(500/15) 정합. */}
              <Text variant="memoBody" color="fgMuted">
                맛집 이름을 검색해요
              </Text>
            </Pressable>
          )
        ) : (
          // placeSearch 미주입(방어/회귀 안전) — 수동 입력만.
          <TextInput
            accessibilityLabel="장소 이름"
            value={placeName}
            onChangeText={setPlaceName}
            maxLength={PLACE_NAME_MAX}
            placeholder="장소 이름을 입력하세요"
            placeholderTextColor={theme.color.fgMuted}
            style={[styles.input, fieldInput]}
          />
        )}

        {/* 카테고리 (8종 칩) */}
        <Text variant="fieldLabel" color="fg" style={[styles.label, { marginTop: theme.spacing[22] }]}>
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
        <View style={{ marginTop: theme.spacing[22] }}>
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
        <Text variant="fieldLabel" color="fg" style={[styles.label, { marginTop: theme.spacing[22] }]}>
          별점
        </Text>
        {/* 별점 + 보조 텍스트(킷 mk-log:449) — 선택 시 "n.0"(fg) / 미선택 시 "어땠어요?"(fgAssistive). 순수 표시. */}
        <View style={styles.ratingRow}>
          <Stars value={rating} size={32} editable onChange={setRating} />
          <Text variant="ratingNum" color={rating > 0 ? 'fg' : 'fgAssistive'}>
            {rating > 0 ? rating.toFixed(1) : '어땠어요?'}
          </Text>
        </View>

        {/* 메모 */}
        <Text variant="fieldLabel" color="fg" style={[styles.label, { marginTop: theme.spacing[22] }]}>
          메모
        </Text>
        <TextInput
          accessibilityLabel="메모"
          value={memo}
          onChangeText={setMemo}
          maxLength={MEMO_MAX}
          multiline
          numberOfLines={4}
          placeholder="무엇을 먹었고 어땠는지 그날의 기록을 남겨보세요"
          placeholderTextColor={theme.color.fgMuted}
          style={[styles.input, styles.memo, fieldInput]}
        />
        {/* 메모 필수·최소 5자 안내(사용자 요청). 미달 시 강조 톤. */}
        <Text
          testID="memo-hint"
          variant="caption"
          color={memoLongEnough ? 'fgMuted' : 'accentStrong'}
          style={{ marginTop: theme.spacing[6] }}
        >
          {`메모는 최소 ${MEMO_MIN_LENGTH}자 이상 입력해 주세요.`}
        </Text>

        {/* 방문일 (기본 today, 미래 차단은 검증이 최종 방어) — 탭형 행→DatePickerSheet(킷 mk-log:416-420). */}
        <Text variant="fieldLabel" color="fg" style={[styles.label, { marginTop: theme.spacing[22] }]}>
          방문일
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`방문일 ${formatVisitedDate({ visitedAt, withDow: true })}, 선택`}
          onPress={() => setDateOpen(true)}
          style={[styles.dateRow, { borderColor: theme.color.hairline, backgroundColor: theme.color.surface }]}
        >
          <Icon name={IconName.Calendar} size={19} color="primary" />
          <Text variant="dateRowValue" color="fg" style={{ flex: 1 }}>
            {formatVisitedDate({ visitedAt, withDow: true })}
          </Text>
          <Icon name={IconName.ChevronDown} size={18} color="fgAssistive" />
        </Pressable>
        <DatePickerSheet
          visible={dateOpen}
          value={visitedAt}
          onClose={() => setDateOpen(false)}
          onSelect={({ date }) => {
            setVisitedAt(date);
            setDateOpen(false);
          }}
        />

        {error ? (
          <Text variant="bodySm" color="error" style={{ marginTop: theme.spacing[12] }}>
            {error}
          </Text>
        ) : null}
      </ScrollView>
      {/* 저장 성공 토스트는 전역(ToastProvider 루트 <Toast>)에서 렌더 — 화면별 <Toast> 없음(이관, 킷 mk-log:400). */}
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: { padding: 0 },
  scroll: { flex: 1 },
  label: { marginBottom: 10 },
  input: { borderWidth: StyleSheet.hairlineWidth },
  memo: { minHeight: 96, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // 별점 + 보조 텍스트 행(킷 mk-log:447 gap 12).
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chip: { borderWidth: StyleSheet.hairlineWidth },
  saveAction: { paddingVertical: 8, paddingHorizontal: 6, minWidth: 44, alignItems: 'flex-end' },
  // FLAG-1b: 장소 검색 진입 버튼(킷 searchBtn mk-log:497, border 1.5). 검색뷰=PlaceSearchView. "변경"은 요약카드 내부 액션으로 일원화.
  searchBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5 },
  // 방문일 진입 행(킷 lk.dateRow mk-log:602) — gap 10·padding 14/16·radius 16·border 1.5 line.
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
  },
});
