// src/features/muklog/MuklogEntrySheet.tsx
// 먹로그 입력 시트(작성/편집 dual-mode) — 킷 mk-log.jsx MuklogEditor 재현 (plan §3.5 / §5 ④).
//   킷 MuklogEditor: isEdit = !!initial → 제목·저장 토스트·초기값 분기(작성/편집 겸용).
//   필드: 장소명(필수)·카테고리(8종 칩)·별점(editable Stars)·메모·방문일(기본 today, 미래 차단).
//   사진(킷 mk-log:319-339): 작성=PickedPhoto[](local) / 편집=EditorPhoto[](existing remote + new local 혼합).
//     existing × 누르면 슬롯 제거(toDelete 후보), 신규 추가는 합산 5장 제한. order = 배열 인덱스.
//   저장 경계: 작성=내부 useCreateMuklog(회귀 유지). 편집=onSubmit(developer가 useUpdateMuklog 연결).
//     검증/저장/사진 reconciliation은 developer(훅)가 담당 — 시트는 입력 수집·콜백 트리거만.
//   스타일은 토큰만(raw hex 0), 이모지 허용(킷 기준).
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Button, Sheet, Stars, Text } from '@/components';
import { useTheme } from '@/theme';

import { MUKLOG_CATEGORIES, MUKLOG_CATEGORY_KEYS, type MuklogCategoryKey } from './categories';
import { mapMuklogError } from './errors';
import { PhotoPickerGrid } from './PhotoPickerGrid';
import { type EditorPhoto, type MuklogEditInitial, type PickedPhoto } from './types';
import { useCreateMuklog } from './useCreateMuklog';
import { useMuklogPhotoPicker } from './useMuklogPhotoPicker';
import { todayLocalDate } from './validate';

const PLACE_NAME_MAX = 60;
const MEMO_MAX = 500;
const PHOTO_MAX = 5;

// 편집 모드 submit 결과(developer useUpdateMuklog 반환과 정합). 성공 판정만 쓰므로 최소형.
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
            area: initial.area,
            rating,
            memo,
            visitedAt,
            photos: editorPhotos,
          },
        });
        onSaved();
      } catch {
        // 에러는 submitError(부모 useUpdateMuklog.error)로 인라인 표시. 시트 유지(입력 보존).
      }
      return;
    }
    // 작성 — 내부 useCreateMuklog(회귀 유지).
    try {
      await createMuklog({
        input: { roomId, placeName, category, area: null, rating, memo, visitedAt, photos: createPhotos },
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
        {/* 장소명 (필수) */}
        <Text variant="bodySm" color="fg" style={styles.label}>
          어디서 먹었나요? *
        </Text>
        <TextInput
          accessibilityLabel="장소 이름"
          value={placeName}
          onChangeText={setPlaceName}
          maxLength={PLACE_NAME_MAX}
          placeholder="장소 이름을 입력하세요"
          placeholderTextColor={theme.color.fgMuted}
          style={[styles.input, fieldInput]}
        />

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
