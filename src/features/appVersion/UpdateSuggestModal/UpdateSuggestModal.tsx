// src/features/appVersion/UpdateSuggestModal/UpdateSuggestModal.tsx
// 업데이트 권유 모달(app-version-gate T9) — 닫을 수 있는 비차단 권유.
//   RenameDialog 셸 패턴의 "입력 없는 확인형" 변형. RenameDialog를 일반화/변형하지 않고 신규 컴포넌트로 만든다:
//     · RenameDialog는 TextInput(value/onChange·clear·maxLength)에 강결합 → 확인형까지 흡수하면 API 비대·기존 2 소비처
//       (LogScreen·ProfileScreen) 회귀 위험. 확인형은 입력이 없어 셸(Modal·딤·카드·2버튼 행)만 필요 → 신규가 저위험.
//   셸 값은 RenameDialog와 동기 유지(킷 mk-extra RenameDialog 정합): 딤 rgba(20,12,8,.34)≈fg+0.34,
//     카드 84%/max320·radius.sheet(20)·shadow.dialog, 상단 hairline + buttonPadding 14 + divider 1(RenameDialog.tsx:29-48).
//   차이: 입력이 없어 상단~중앙 오프셋(topOffset 70, 키보드 회피용) 불요 → 수직 정중앙 배치.
//   배선(Linking·dismissal 저장)은 developer — 여기선 비주얼·콜백(onUpdatePress/onDismiss)만 소유.
import React from 'react';
import { Modal, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { MotionPressable, Text } from '@/components';
import { useTheme } from '@/theme';

// 딤 배경(킷 rgba(20,12,8,.34)) — 웜 잉크 위 투명도 근사(RenameDialog와 동일 접근·값).
const BACKDROP_OPACITY = 0.34;
// 눌림 불투명도 — 치환 전 로컬 styles.pressed 실값 승계(비주얼 회귀 0). 등급은 md(라벨 버튼). ui-spec §2-2 A3·A4·A5.
const DIALOG_ACTION_PRESSED_OPACITY = 0.6;
// 셸 레이아웃 수치(RenameDialog.tsx:33-48와 동기 — 킷 verbatim, 4px 그리드 밖이라 토큰화 안 함).
const DIALOG_LAYOUT = {
  cardWidth: '84%' as const,
  cardMaxWidth: 320,
  buttonPadding: 14,
  dividerWidth: 1,
} as const;

export type UpdateSuggestModalProps = {
  /** 표시 여부. false면 미렌더. */
  visible: boolean;
  /** 플랫폼 스토어 URL. null이면 "업데이트" 버튼 숨김 + 단일 "확인"(닫기)만. Linking 배선은 developer. */
  storeUrl: string | null;
  /** "업데이트" 탭 콜백 — Linking.openURL 배선은 developer(T11). */
  onUpdatePress: () => void;
  /** "나중에"/"확인"/딤 탭 — dismissSuggest(버전당 1회 기록)는 developer 배선. */
  onDismiss: () => void;
};

export const UpdateSuggestModal = ({
  visible,
  storeUrl,
  onUpdatePress,
  onDismiss,
}: UpdateSuggestModalProps) => {
  const theme = useTheme();
  if (!visible) return null;

  const card: ViewStyle = {
    maxWidth: DIALOG_LAYOUT.cardMaxWidth,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.sheet,
  };

  return (
    // statusBarTranslucent: Android에서 딤이 상태바까지 덮는다(U57). 카드는 수직 정중앙이라 보정 불요 —
    //   컨테이너가 위로만 커지므로(RN WindowUtil이 top inset만 0으로) 카드 중심은 위로 ~12dp 이동,
    //   인지 임계(화면 높이 1.5%) 아래 + 광학 중심 방향이라 보정하지 않음(plan §4.1 M4, qa-visual 수용).
    //   하단 시스템 내비바는 RN 0.76.9에 수단이 없어 미커버(리더 결정 D2-A, Sheet.tsx 주석 참조).
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onDismiss}>
      {/* 딤 배경 — 탭하면 닫힘(권유는 닫기 가능) */}
      <Pressable
        testID="update-suggest-backdrop"
        accessibilityRole="button"
        accessibilityLabel="닫기"
        onPress={onDismiss}
        style={[styles.backdrop, { backgroundColor: theme.color.fg, opacity: BACKDROP_OPACITY }]}
      />
      {/* 수직 정중앙 배치(입력 없음 → 오프셋 불요). 카드 밖 터치는 box-none으로 딤에 전달 */}
      <View style={styles.wrap} pointerEvents="box-none">
        {/* 카드 — 탭해도 닫히지 않음(전파 차단) */}
        <Pressable
          testID="update-suggest-card"
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
              새 버전이 나왔어요
            </Text>
            <Text
              variant="dialogSubtitle"
              color="fgMuted"
              style={[styles.center, { marginTop: theme.spacing[6] }]}
            >
              더 좋아진 먹로그를 만나보세요.{'\n'}지금 업데이트할까요?
            </Text>
          </View>

          {/* iOS 알림 버튼 행 — 상단 hairline. storeUrl 있으면 나중에 │ 업데이트, 없으면 단일 확인. */}
          {storeUrl ? (
            <View style={[styles.actions, { borderTopColor: theme.color.hairlineAlt }]}>
              <MotionPressable
                testID="update-suggest-dismiss"
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
                testID="update-suggest-update"
                accessibilityRole="button"
                accessibilityLabel="업데이트"
                onPress={onUpdatePress}
                pressSize="md"
                pressedOpacity={DIALOG_ACTION_PRESSED_OPACITY}
                style={styles.action}
              >
                <Text variant="button" color="accentStrong">
                  업데이트
                </Text>
              </MotionPressable>
            </View>
          ) : (
            <View style={[styles.actions, { borderTopColor: theme.color.hairlineAlt }]}>
              <MotionPressable
                testID="update-suggest-dismiss"
                accessibilityRole="button"
                accessibilityLabel="확인"
                onPress={onDismiss}
                pressSize="md"
                pressedOpacity={DIALOG_ACTION_PRESSED_OPACITY}
                style={styles.action}
              >
                <Text variant="button" color="accentStrong">
                  확인
                </Text>
              </MotionPressable>
            </View>
          )}
        </Pressable>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject },
  // 수직 정중앙(RenameDialog는 topOffset로 상단~중앙, 여기선 입력 없어 정중앙).
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { width: DIALOG_LAYOUT.cardWidth, overflow: 'hidden' },
  body: {},
  center: { textAlign: 'center' },
  actions: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  action: { flex: 1, paddingVertical: DIALOG_LAYOUT.buttonPadding, alignItems: 'center', justifyContent: 'center' },
  divider: { width: DIALOG_LAYOUT.dividerWidth },
});
