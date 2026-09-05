// src/features/muklog/PhotoPickerGrid.tsx
// 사진 입력 그리드 — 킷 mk-log.jsx:319-339 MuklogEditor 사진 필드 재현(plan §5 ⑤ / §4).
//   선택 썸네일 N개(최대 5, 72×72 radius 14) + 각 우상단 ×(삭제) + 5장 미만일 때 "추가" 타일
//   (점선 보더 + 카메라 아이콘 + "추가"). hint `N/5`는 Field label 행에 표시(소비처가 렌더).
//
// 경계(plan): 데이터/업로드는 props로만 노출. 실제 picker 호출·Storage 업로드·삭제 반영은
//   developer가 onAdd/onRemove에 연결한다(이 컴포넌트는 프레젠테이션·콜백 트리거만).
//   썸네일 source는 로컬 자산 uri(업로드 전 미리보기). signed URL 주입은 카드(MuklogCard) 몫.
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { Icon, IconName, MotionPressable, Text } from '@/components';
import { useTheme } from '@/theme';

import { type PickedPhoto } from '../types';

export type PhotoPickerGridProps = {
  /** 선택된 사진 0~max장(선택 순서 = order_index). 로컬 uri 미리보기. */
  photos: PickedPhoto[];
  /** 추가 타일 탭 — developer가 expo-image-picker 호출을 연결. */
  onAdd: () => void;
  /** 썸네일 ×탭 — developer가 해당 index 제거를 반영. */
  onRemove: ({ index }: { index: number }) => void;
  /** 최대 장수. 킷 5(plan 0~5). */
  max?: number;
  /** 업로드/처리 중이면 추가·삭제 비활성(시트 저장 진행 중). */
  uploading?: boolean;
  /** 필드 라벨(킷 Field label="사진"). 미지정 시 라벨 행 숨김(소비처가 자체 라벨 사용). */
  label?: string;
};

// 킷 mk-log.jsx:324 썸네일 72×72 / radius 14(--mk-radius-btn). photoX 22×22, offset -6.
const THUMB_SIZE = 72;
const REMOVE_SIZE = 22;
const REMOVE_OFFSET = -6;
const PHOTO_MAX_DEFAULT = 5;

// 부여 판정: IconButton sm/0.6 승계(motion-press-c §2 C10)
const PHOTO_REMOVE_PRESSED_OPACITY = 0.6;
// 부여 판정: Button md/0.85 승계 — 라벨 가진 블록 버튼(motion-press-c §2 C11)
const PHOTO_ADD_PRESSED_OPACITY = 0.85;

export const PhotoPickerGrid = ({
  photos,
  onAdd,
  onRemove,
  max = PHOTO_MAX_DEFAULT,
  uploading = false,
  label,
}: PhotoPickerGridProps) => {
  const theme = useTheme();
  const canAdd = photos.length < max;
  // 킷 Field hint=`${photos}/5` — 라벨 행 우측. 라벨 없이도 hint는 항상 노출(자족적 그리드).
  const hint = `${photos.length}/${max}`;

  return (
    <View>
      {/* 킷 Field 라벨 행(mk-log.jsx:369-379): label(800/15) + hint(600/12.5, marginLeft auto). */}
      <View style={[styles.labelRow, { marginBottom: theme.spacing[10] }]}>
        {label ? (
          <Text variant="sectionTitle" color="fg" style={styles.label}>
            {label}
          </Text>
        ) : null}
        <Text variant="meta" color="fgMuted">
          {hint}
        </Text>
      </View>

      <View style={[styles.grid, { gap: theme.spacing[8] }]}>
      {photos.map((p, index) => (
        <View key={`${p.uri}-${index}`} testID={`photo-thumb-${index}`} style={styles.thumbWrap}>
          <Image
            source={{ uri: p.uri }}
            accessibilityLabel={`선택한 사진 ${index + 1}`}
            style={[styles.thumb, { borderRadius: theme.radius.control }]}
          />
          <MotionPressable
            testID={`photo-remove-${index}`}
            accessibilityRole="button"
            accessibilityLabel={`사진 ${index + 1} 삭제`}
            disabled={uploading}
            onPress={() => onRemove({ index })}
            pressSize="sm"
            pressedOpacity={PHOTO_REMOVE_PRESSED_OPACITY}
            style={[
              styles.remove,
              {
                // 킷 photoX: ink 배경 + bg색 2px 보더(썸네일 위 떠보이게). 토큰만.
                backgroundColor: theme.color.fg,
                borderColor: theme.color.bg,
                borderRadius: theme.radius.full,
              },
            ]}
          >
            <Icon name={IconName.Close} size={12} color="primaryFg" />
          </MotionPressable>
        </View>
      ))}

      {canAdd ? (
        <MotionPressable
          testID="photo-add-tile"
          accessibilityRole="button"
          accessibilityLabel="사진 추가"
          accessibilityState={{ disabled: uploading }}
          disabled={uploading}
          onPress={onAdd}
          pressSize="md"
          pressedOpacity={PHOTO_ADD_PRESSED_OPACITY}
          style={[
            styles.addTile,
            {
              // 킷 addPhoto: 2px dashed accentLine 보더 + accentWeak 배경.
              borderColor: theme.color.accentLine,
              backgroundColor: theme.color.primaryWeak,
              borderRadius: theme.radius.control,
            },
          ]}
        >
          <Icon name={IconName.Camera} size={24} color="primary" />
          <Text variant="caption" color="accentStrong" style={styles.addLabel}>
            추가
          </Text>
        </MotionPressable>
      ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  label: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  thumbWrap: { position: 'relative', width: THUMB_SIZE, height: THUMB_SIZE },
  thumb: { width: THUMB_SIZE, height: THUMB_SIZE },
  remove: {
    position: 'absolute',
    top: REMOVE_OFFSET,
    right: REMOVE_OFFSET,
    width: REMOVE_SIZE,
    height: REMOVE_SIZE,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTile: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    // 킷 2px dashed. RN dashed 보더는 플랫폼 차이 있으나 근사(ui-spec 기록).
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  addLabel: { fontSize: 11 },
});
