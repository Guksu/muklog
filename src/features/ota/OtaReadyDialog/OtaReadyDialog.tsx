// src/features/ota/OtaReadyDialog/OtaReadyDialog.tsx
// OTA 적용 안내 다이얼로그(expo-updates-ota T7) — 다운로드가 끝난 JS 번들을 "지금 적용"할지 묻는 유일한 사용자 접점.
//   킷 templates/muklog에 OTA 시안이 없다 → 킷 비종속 신설. 셸은 UpdateSuggestModal(= RenameDialog 셸의
//   "입력 없는 확인형" 변형)을 값까지 그대로 승계한다: 딤 fg+0.34, 카드 84%/max320·radius.sheet(20)·shadow.dialog,
//   상단 hairline + buttonPadding 14 + divider 1, 수직 정중앙(입력 없음 → 키보드 오프셋 불요).
//   UpdateSuggestModal과 합치지 않는 이유: 두 축(스토어 바이너리 / OTA)의 의미가 달라 한쪽 문구·조건 변경이
//   다른 쪽으로 새면 안 된다(plan §3.6·§4). 셸만 공유하고 컴포넌트는 분리한다.
//   배선(reloadAsync·dismiss·suggest 억제)은 developer(T8) — 여기선 비주얼·콜백(onApply/onDismiss)만 소유.
import React from 'react';
import { Modal, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { MotionPressable, Text } from '@/components';
import { useTheme } from '@/theme';

// 딤 배경(킷 rgba(20,12,8,.34)) — 웜 잉크 위 투명도 근사(UpdateSuggestModal·RenameDialog와 동일 접근·값).
const BACKDROP_OPACITY = 0.34;
// 눌림 불투명도 — 치환 전 로컬 styles.pressed 실값 승계(비주얼 회귀 0). 등급은 md(라벨 버튼). ui-spec §2-2 A6·A7.
const DIALOG_ACTION_PRESSED_OPACITY = 0.6;
// 셸 레이아웃 수치(UpdateSuggestModal.tsx:19-24와 동기 — 킷 verbatim, 4px 그리드 밖이라 토큰화 안 함).
const DIALOG_LAYOUT = {
  cardWidth: '84%' as const,
  cardMaxWidth: 320,
  buttonPadding: 14,
  dividerWidth: 1,
} as const;

export type OtaReadyDialogProps = {
  /** 표시 여부. false면 미렌더. */
  visible: boolean;
  /** "지금 적용" 탭 — reloadAsync 배선은 developer(T8). */
  onApply: () => void;
  /** "나중에"/딤 탭 — dismiss 배선은 developer(T8). */
  onDismiss: () => void;
};

export const OtaReadyDialog = ({ visible, onApply, onDismiss }: OtaReadyDialogProps) => {
  const theme = useTheme();
  if (!visible) return null;

  const card: ViewStyle = {
    maxWidth: DIALOG_LAYOUT.cardMaxWidth,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.sheet,
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={onDismiss}>
      {/* 딤 배경 — 탭하면 닫힘(적용은 강제가 아님) */}
      <Pressable
        testID="ota-ready-backdrop"
        accessibilityRole="button"
        accessibilityLabel="닫기"
        onPress={onDismiss}
        style={[styles.backdrop, { backgroundColor: theme.color.fg, opacity: BACKDROP_OPACITY }]}
      />
      {/* 수직 정중앙 배치(입력 없음 → 오프셋 불요). 카드 밖 터치는 box-none으로 딤에 전달 */}
      <View style={styles.wrap} pointerEvents="box-none">
        {/* 카드 — 탭해도 닫히지 않음(전파 차단) */}
        <Pressable
          testID="ota-ready-card"
          onPress={() => {}}
          style={[styles.card, card, theme.shadow.dialog]}
        >
          <View
            style={[
              styles.body,
              {
                paddingTop: theme.spacing[20],
                paddingHorizontal: theme.spacing[18],
                paddingBottom: theme.spacing[16],
              },
            ]}
          >
            <Text variant="dialogTitle" color="fg" style={styles.center}>
              개선사항을 받아뒀어요
            </Text>
            <Text
              variant="dialogSubtitle"
              color="fgMuted"
              style={[styles.center, { marginTop: theme.spacing[6] }]}
            >
              앱을 다시 켜면 저절로 적용돼요.{'\n'}지금 적용하면 화면이 새로고침되니, 작성 중인
              내용은 저장해 주세요.
            </Text>
          </View>

          {/* iOS 알림 버튼 행 — 상단 hairline. 나중에 │ 지금 적용(primary). */}
          <View style={[styles.actions, { borderTopColor: theme.color.hairlineAlt }]}>
            <MotionPressable
              testID="ota-dismiss"
              accessibilityRole="button"
              accessibilityLabel="나중에"
              onPress={onDismiss}
              pressSize="md"
              pressedOpacity={DIALOG_ACTION_PRESSED_OPACITY}
              style={styles.action}
            >
              <Text variant="dialogInput" color="fgWeak">
                나중에
              </Text>
            </MotionPressable>
            <View style={[styles.divider, { backgroundColor: theme.color.hairlineAlt }]} />
            <MotionPressable
              testID="ota-apply"
              accessibilityRole="button"
              accessibilityLabel="지금 적용"
              onPress={onApply}
              pressSize="md"
              pressedOpacity={DIALOG_ACTION_PRESSED_OPACITY}
              style={styles.action}
            >
              <Text variant="button" color="accentStrong">
                지금 적용
              </Text>
            </MotionPressable>
          </View>
        </Pressable>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject },
  // 수직 정중앙(UpdateSuggestModal과 동일 — 입력이 없어 키보드 회피 오프셋 불요).
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { width: DIALOG_LAYOUT.cardWidth, overflow: 'hidden' },
  body: {},
  center: { textAlign: 'center' },
  actions: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  action: {
    flex: 1,
    paddingVertical: DIALOG_LAYOUT.buttonPadding,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { width: DIALOG_LAYOUT.dividerWidth },
});
