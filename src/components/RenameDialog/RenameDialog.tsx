// src/components/RenameDialog.tsx
// 공용 이름변경 다이얼로그(중앙 iOS 알림형) — 킷 mk-extra.jsx:24-64 RenameDialog RN 번역 (rename-dialog plan §4.2·§4.3).
//   로그명·닉네임 편집의 단일 공용 프리미티브. controlled(value/onChange는 부모 소유) 프리젠테이션 전담.
//   검증·정규화·RPC·draft 소유는 developer(LogScreen/ProfileScreen) 몫 — 여기선 비주얼 + 콜백만.
//
// 킷→RN 번역 근사(ui-spec 기록):
//   · 딤 rgba(20,12,8,.34) → theme.color.fg(웜 잉크) + opacity 0.34 (토큰엔 동일 색 없음, Sheet와 동일 패턴).
//   · 상단~중앙 배치 paddingTop=ESP+70 → insets.top + DIALOG_LAYOUT.topOffset(키보드 미가림, 킷 의도).
//   · box-shadow 0 20px 50px → shadow.dialog 근사. backdrop blur/animation은 RN 제약으로 생략(Modal fade).
//   · error 인라인은 킷에 없는 RN 확장(서버 검증 표시용) — 킷 레이아웃 비파괴 위치(입력 하단)에 최소 스타일.
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

import { Icon, IconName } from '../Icon';
import { MotionPressable } from '../MotionPressable';
import { Text } from '../Text';

// 딤 배경(킷 rgba(20,12,8,.34)) — 웜 잉크 위 투명도로 근사(토큰 동일 색 부재, Sheet와 동일 접근).
const BACKDROP_OPACITY = 0.34;

// 눌림 불투명도 — 치환 전 로컬 styles.pressed 실값 승계(비주얼 회귀 0). 등급은 md(라벨 버튼). ui-spec §2-2 A1·A2.
const DIALOG_ACTION_PRESSED_OPACITY = 0.6;

// 컨트롤 내부 레이아웃 수치(킷 verbatim) — 4px 그리드 밖이라 토큰화하지 않는다(Button.BUTTON_SIZE 선례).
const DIALOG_LAYOUT = {
  topOffset: 70, // 킷 ESP+70 (상단~중앙 배치, 키보드 미가림)
  cardWidth: '84%' as const, // 킷 width 84%
  cardMaxWidth: 320, // 킷 maxWidth 320
  inputBorderWidth: 1.5, // 킷 1.5px accent 보더
  inputPaddingVertical: 11, // 킷 입력(input) padding 11px 0
  containerPaddingVertical: 2, // 킷 컨테이너 padding 상/하 2 (mk-extra:42 "2px 4px 2px 14px")
  inputPaddingLeft: 14, // 킷 컨테이너 padding-left 14
  inputPaddingRight: 4, // 킷 컨테이너 padding-right 4
  inputMarginTop: 15, // 킷 입력 컨테이너 marginTop 15
  clearSize: 24, // 킷 X 버튼 24×24
  clearIconSize: 12, // 킷 close 아이콘 12
  clearMarginRight: 6, // 킷 X 버튼 marginRight 6
  buttonPadding: 14, // 킷 버튼 행 padding 14
  dividerWidth: 1, // 킷 중앙 divider 1px
} as const;

export type RenameDialogProps = {
  /** 표시 여부. false면 미렌더(Modal children 마운트 안 함). */
  open: boolean;
  /** 다이얼로그 제목(가운데). 예: "로그 이름" · "닉네임". */
  title: string;
  /** 제목 아래 보조문(선택). 예: "비워두면 기본 이름으로 돌아가요". */
  subtitle?: string;
  /** 입력 현재값(controlled). 부모가 소유. */
  value: string;
  /** 입력 변경 콜백(controlled). */
  onChange: (next: string) => void;
  /** 취소(딤 탭 포함). 닫기·draft 폐기는 부모. */
  onCancel: () => void;
  /** 저장 탭(또는 Enter). 정규화·RPC는 부모/훅. */
  onSave: () => void;
  /** 입력 placeholder. */
  placeholder?: string;
  /** 입력 차단 길이(기본 20, C-LEN). */
  maxLength?: number;
  /** 입력 하단 추가 슬롯(킷 extra). 로그명+솔로일 때만 InviteCodeCard compact. */
  extra?: React.ReactNode;
  /** 저장 진행 중 — 저장 버튼 로딩/비활성. 기본 false. */
  saving?: boolean;
  /** 인라인 에러(서버 검증 등). 없으면 미노출. */
  error?: string | null;
  /** 검증 실패 시 저장 비활성(닉네임 canSave). 기본 false. */
  saveDisabled?: boolean;
};

export const RenameDialog = ({
  open,
  title,
  subtitle,
  value,
  onChange,
  onCancel,
  onSave,
  placeholder,
  maxLength = 20,
  extra,
  saving = false,
  error,
  saveDisabled = false,
}: RenameDialogProps) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  if (!open) return null;

  const isSaveDisabled = saving || saveDisabled;
  const handleSave = () => {
    if (isSaveDisabled) return;
    onSave();
  };

  const inputRow: ViewStyle = {
    borderColor: theme.color.primary,
    borderWidth: DIALOG_LAYOUT.inputBorderWidth,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.color.bg,
    paddingVertical: DIALOG_LAYOUT.containerPaddingVertical,
    paddingLeft: DIALOG_LAYOUT.inputPaddingLeft,
    paddingRight: DIALOG_LAYOUT.inputPaddingRight,
    marginTop: DIALOG_LAYOUT.inputMarginTop,
  };
  const inputStyle: TextStyle = {
    ...theme.typography.dialogInput,
    color: theme.color.fg,
    paddingVertical: DIALOG_LAYOUT.inputPaddingVertical,
  };
  const clearStyle: ViewStyle = {
    backgroundColor: theme.color.hairlineAlt,
    marginRight: DIALOG_LAYOUT.clearMarginRight,
  };

  return (
    // animationType="none": fade면 닫히는 모달이 페이드아웃되는 동안 이전 팝업 내용이 잔상으로 보임. none으로 즉시 전환.
    <Modal visible transparent animationType="none" onRequestClose={onCancel}>
      {/* 딤 배경 — 탭하면 취소(킷 onClick={cancel}) */}
      <Pressable
        testID="rename-dialog-backdrop"
        accessibilityRole="button"
        accessibilityLabel="닫기"
        onPress={onCancel}
        style={[styles.backdrop, { backgroundColor: theme.color.fg, opacity: BACKDROP_OPACITY }]}
      />
      {/* 상단~중앙 배치 래퍼 — 카드 밖 터치는 box-none으로 딤에 전달 */}
      <View
        style={[styles.wrap, { paddingTop: insets.top + DIALOG_LAYOUT.topOffset }]}
        pointerEvents="box-none"
      >
        {/* 카드 — 탭해도 닫히지 않음(전파 차단, 킷 stopPropagation) */}
        <Pressable
          testID="rename-dialog-card"
          onPress={() => {}}
          style={[
            styles.card,
            {
              maxWidth: DIALOG_LAYOUT.cardMaxWidth,
              backgroundColor: theme.color.surface,
              borderRadius: theme.radius.sheet,
            },
            theme.shadow.dialog,
          ]}
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
              {title}
            </Text>
            {subtitle ? (
              <Text
                variant="dialogSubtitle"
                color="fgMuted"
                style={[styles.center, { marginTop: theme.spacing[6] }]}
              >
                {subtitle}
              </Text>
            ) : null}

            {/* 입력 행 — 1.5px accent 보더 + X 클리어 */}
            <View style={[styles.inputRow, inputRow]}>
              <TextInput
                testID="rename-dialog-input"
                accessibilityLabel={title}
                value={value}
                onChangeText={onChange}
                onSubmitEditing={handleSave}
                placeholder={placeholder}
                placeholderTextColor={theme.color.fgMuted}
                maxLength={maxLength}
                autoFocus
                returnKeyType="done"
                style={[styles.input, inputStyle]}
              />
              {value ? (
                <Pressable
                  testID="rename-dialog-clear"
                  accessibilityRole="button"
                  accessibilityLabel="지우기"
                  onPress={() => onChange('')}
                  style={[styles.clear, clearStyle]}
                >
                  <Icon name={IconName.Close} size={DIALOG_LAYOUT.clearIconSize} color="fgMuted" />
                </Pressable>
              ) : null}
            </View>

            {error ? (
              <Text
                variant="caption"
                color="error"
                style={[styles.center, { marginTop: theme.spacing[8] }]}
              >
                {error}
              </Text>
            ) : null}

            {extra ? <View style={{ marginTop: theme.spacing[14] }}>{extra}</View> : null}
          </View>

          {/* iOS 알림 버튼 행 — 상단 hairline + 취소 │ 저장 분할 */}
          <View style={[styles.actions, { borderTopColor: theme.color.hairlineAlt }]}>
            <MotionPressable
              testID="rename-dialog-cancel"
              accessibilityRole="button"
              accessibilityLabel="취소"
              onPress={onCancel}
              pressSize="md"
              pressedOpacity={DIALOG_ACTION_PRESSED_OPACITY}
              style={styles.action}
            >
              <Text variant="dialogInput" color="fgWeak">
                취소
              </Text>
            </MotionPressable>
            <View style={[styles.divider, { backgroundColor: theme.color.hairlineAlt }]} />
            <MotionPressable
              testID="rename-dialog-save"
              accessibilityRole="button"
              accessibilityLabel="저장"
              accessibilityState={{ disabled: isSaveDisabled, busy: saving }}
              disabled={isSaveDisabled}
              onPress={handleSave}
              pressSize="md"
              pressedOpacity={DIALOG_ACTION_PRESSED_OPACITY}
              style={[styles.action, isSaveDisabled ? styles.actionDisabled : null]}
            >
              {saving ? (
                <ActivityIndicator testID="rename-dialog-saving" color={theme.color.accentStrong} />
              ) : (
                <Text variant="button" color="accentStrong">
                  저장
                </Text>
              )}
            </MotionPressable>
          </View>
        </Pressable>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject },
  // 상단~중앙: 세로 위쪽 정렬 + 가로 중앙(킷 alignItems center / justifyContent flex-start).
  wrap: { flex: 1, alignItems: 'center' },
  card: { width: DIALOG_LAYOUT.cardWidth, overflow: 'hidden' },
  body: {},
  center: { textAlign: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, minWidth: 0, padding: 0 },
  clear: {
    width: DIALOG_LAYOUT.clearSize,
    height: DIALOG_LAYOUT.clearSize,
    borderRadius: DIALOG_LAYOUT.clearSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  action: { flex: 1, paddingVertical: DIALOG_LAYOUT.buttonPadding, alignItems: 'center', justifyContent: 'center' },
  actionDisabled: { opacity: 0.45 },
  divider: { width: DIALOG_LAYOUT.dividerWidth },
});
