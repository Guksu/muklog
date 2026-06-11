// src/features/muklog/MuklogEntrySheet.tsx
// 최소 입력 시트 — mk-log.jsx MuklogEditor에서 Kakao/사진/영상을 제거한 최소판 (plan §6.3 / §5 T9, AC2·AC3·AC12).
//   Sheet(공용) 기반. 필드: 장소명(필수)·카테고리(8종 칩)·별점(editable Stars)·메모·방문일(기본 today, 미래 차단).
//   저장: 장소명 비면 비활성 → createMuklog → 성공 시 onSaved(refresh+닫기는 부모가) / 실패 시 인라인 에러(입력 보존).
//   Kakao·사진·영상 없음(OUT). 스타일은 토큰만(raw hex 0), 이모지 허용.
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Button, Sheet, Stars, Text } from '@/components';
import { useTheme } from '@/theme';

import { MUKLOG_CATEGORIES, MUKLOG_CATEGORY_KEYS, type MuklogCategoryKey } from './categories';
import { useCreateMuklog } from './useCreateMuklog';
import { todayLocalDate } from './validate';

const PLACE_NAME_MAX = 60;
const MEMO_MAX = 500;

export type MuklogEntrySheetProps = {
  /** 표시 여부. false면 미렌더. */
  visible: boolean;
  /** 저장 대상 로그 id. */
  roomId: string;
  /** 딤/취소 시 닫기. */
  onClose: () => void;
  /** 저장 성공 시 호출(부모가 refresh + 닫기). */
  onSaved: () => void;
};

export const MuklogEntrySheet = ({ visible, roomId, onClose, onSaved }: MuklogEntrySheetProps) => {
  const theme = useTheme();
  const { createMuklog, loading, error } = useCreateMuklog();

  const [placeName, setPlaceName] = useState('');
  const [category, setCategory] = useState<MuklogCategoryKey | null>(null);
  const [rating, setRating] = useState(0);
  const [memo, setMemo] = useState('');
  const [visitedAt, setVisitedAt] = useState(todayLocalDate());

  const canSave = placeName.trim().length > 0 && !loading;

  const handleSave = async () => {
    try {
      await createMuklog({
        input: { roomId, placeName, category, area: null, rating, memo, visitedAt },
      });
      onSaved();
    } catch {
      // 에러는 useCreateMuklog가 error 상태로 노출 → 아래 인라인 표시. 시트는 유지(입력 보존).
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="새 먹로그 🍽️">
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
          style={[
            styles.input,
            {
              color: theme.color.fg,
              backgroundColor: theme.color.surface,
              borderColor: theme.color.hairline,
              borderRadius: theme.radius.control,
              paddingHorizontal: theme.spacing[16],
              paddingVertical: theme.spacing[14],
            },
          ]}
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
          style={[
            styles.input,
            styles.memo,
            {
              color: theme.color.fg,
              backgroundColor: theme.color.surface,
              borderColor: theme.color.hairline,
              borderRadius: theme.radius.control,
              paddingHorizontal: theme.spacing[16],
              paddingVertical: theme.spacing[14],
            },
          ]}
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
          style={[
            styles.input,
            {
              color: theme.color.fg,
              backgroundColor: theme.color.surface,
              borderColor: theme.color.hairline,
              borderRadius: theme.radius.control,
              paddingHorizontal: theme.spacing[16],
              paddingVertical: theme.spacing[14],
            },
          ]}
        />

        {error ? (
          <Text variant="bodySm" color="error" style={{ marginTop: theme.spacing[12] }}>
            {error}
          </Text>
        ) : null}

        <Button
          title="저장"
          accessibilityLabel="저장"
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
