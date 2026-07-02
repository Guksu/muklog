// src/features/room/LeaveLogSheets.tsx
// 로그 나가기 메뉴 + 확인 시트 — room-lifecycle(킷 비종속) (plan §4·D7).
//   디자인 출처: 킷에 나가기 UI 없음 → MuklogDetail(mk-log:195-217)의 ⋯메뉴 + danger 확인 시트 패턴 재사용.
//   메뉴 = 단일 danger 행("로그 나가기", trash). 확인 = 카피 분기(커플 24h 유예 / 솔로 즉시 삭제) + danger/ghost.
//   presentational: open/close는 부모가 제어(menuVisible/confirmVisible), leaveRoom RPC·성공 후 nav/refresh는 developer.
//   ⋯ 진입 버튼은 LogScreen 헤더(developer 배선) — 이 컴포넌트는 시트 2종만 소유. 스타일=토큰만(raw hex 0).
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button, Icon, IconName, Sheet, Text } from '@/components';
import { useTheme } from '@/theme';
import type { ColorToken } from '@/theme';

// 카피(퍼블리싱 SSOT) — plan §4. 커플=24h 유예 안내 / 솔로=즉시 삭제 경고.
const MENU_RENAME_LABEL = '로그 이름 변경';
const MENU_LEAVE_LABEL = '로그 나가기';
const COUPLE_TITLE = '로그에서 나갈까요?';
const COUPLE_BODY = '이 로그가 24시간 뒤 삭제돼요. 그 전에 다시 들어와 취소할 수 있어요.\n(상대의 기록도 함께 사라져요.)';
const COUPLE_CONFIRM_LABEL = '나가기';
const SOLO_TITLE = '로그를 삭제할까요?';
const SOLO_BODY = '이 로그와 모든 기록이 사라져요.\n되돌릴 수 없어요.';
const SOLO_CONFIRM_LABEL = '삭제하기';
const CANCEL_LABEL = '취소';

export type LeaveLogSheetsProps = {
  /** ⋯ 메뉴 시트 표시(부모: LogScreen 헤더 ⋯ 버튼이 open). */
  menuVisible: boolean;
  /** 나가기 확인 시트 표시(부모: 메뉴 "로그 나가기" → open / 성공·취소 시 close). */
  confirmVisible: boolean;
  /** 커플(memberCount>=2)이면 유예 카피, 솔로면 즉시 삭제 카피. */
  isCouple: boolean;
  /** 메뉴 딤/요청 닫기. */
  onCloseMenu: () => void;
  /** 메뉴 "로그 이름 변경" 탭 — 부모가 메뉴 닫고 RenameDialog open(타이틀 탭 대체, 사용자 요청). */
  onSelectRename: () => void;
  /** 메뉴 "로그 나가기" 탭 — 부모가 메뉴 닫고 확인 시트 open. */
  onSelectLeave: () => void;
  /** 확인 시트 딤/"취소" 닫기. */
  onCloseConfirm: () => void;
  /** 확인 danger 버튼 탭 — developer가 leaveRoom 실행을 연결(성공 시 커플=refresh·솔로=goBack). */
  onConfirmLeave: () => void;
  /** 나가기 진행 중(useLeaveRoom.loading) — danger 버튼 비활성/로딩. */
  leaving?: boolean;
  /** 나가기 실패 메시지(useLeaveRoom.error) — 확인 시트 인라인(재시도 가능). */
  leaveError?: string | null;
};

export const LeaveLogSheets = ({
  menuVisible,
  confirmVisible,
  isCouple,
  onCloseMenu,
  onSelectRename,
  onSelectLeave,
  onCloseConfirm,
  onConfirmLeave,
  leaving = false,
  leaveError = null,
}: LeaveLogSheetsProps) => {
  const theme = useTheme();

  const title = isCouple ? COUPLE_TITLE : SOLO_TITLE;
  const body = isCouple ? COUPLE_BODY : SOLO_BODY;
  const confirmLabel = isCouple ? COUPLE_CONFIRM_LABEL : SOLO_CONFIRM_LABEL;

  return (
    <>
      {/* ⋯ 메뉴 시트 — MuklogDetail mk-log:195-202 패턴. 이름 변경(일반) + 나가기(danger) 2행. */}
      <Sheet visible={menuVisible} onClose={onCloseMenu}>
        <View style={styles.menuList}>
          <MenuRow
            icon={IconName.Pencil}
            label={MENU_RENAME_LABEL}
            accessibilityLabel={MENU_RENAME_LABEL}
            onPress={onSelectRename}
          />
          <MenuRow
            icon={IconName.Trash}
            label={MENU_LEAVE_LABEL}
            accessibilityLabel={MENU_LEAVE_LABEL}
            danger
            onPress={onSelectLeave}
          />
        </View>
      </Sheet>

      {/* 나가기 확인 시트 — MuklogDetail mk-log:204-217 danger 확인 패턴. 카피 분기·negative/ghost. */}
      <Sheet visible={confirmVisible} onClose={onCloseConfirm} title={title}>
        <Text
          variant="bodySm"
          color="fgMuted"
          style={[styles.confirmBody, { marginBottom: theme.spacing[18] }]}
        >
          {body}
        </Text>
        {leaveError ? (
          <Text
            variant="bodySm"
            color="error"
            style={[styles.confirmBody, { marginBottom: theme.spacing[12] }]}
          >
            {leaveError}
          </Text>
        ) : null}
        <View style={{ gap: theme.spacing[10] }}>
          {/* danger 버튼(status-negative) — 확인 시트는 닫지 않음(developer가 성공 시 close/goBack). */}
          <Pressable
            testID="leave-confirm"
            accessibilityRole="button"
            accessibilityLabel={confirmLabel}
            accessibilityState={{ disabled: leaving, busy: leaving }}
            disabled={leaving}
            onPress={onConfirmLeave}
            style={({ pressed }) => [
              styles.dangerBtn,
              {
                backgroundColor: theme.color.negative,
                borderRadius: theme.radius.control,
                paddingVertical: theme.spacing[14],
                opacity: leaving ? 0.45 : pressed ? 0.85 : 1,
              },
            ]}
          >
            {leaving ? (
              <ActivityIndicator color={theme.color.negativeFg} />
            ) : (
              <Text variant="button" color="negativeFg">
                {confirmLabel}
              </Text>
            )}
          </Pressable>
          <Button
            title={CANCEL_LABEL}
            accessibilityLabel={CANCEL_LABEL}
            variant="ghost"
            full
            disabled={leaving}
            onPress={onCloseConfirm}
          />
        </View>
      </Sheet>
    </>
  );
};

// ── 액션시트 메뉴 한 줄 (MuklogDetail MenuRow mk-log:223-234 패턴 재사용) ───────────────
//   아이콘(21) + 라벨(600/16). danger면 negative 토큰.
const MenuRow = ({
  icon,
  label,
  accessibilityLabel,
  danger,
  onPress,
}: {
  icon: IconName;
  label: string;
  accessibilityLabel: string;
  danger?: boolean;
  onPress: () => void;
}) => {
  const theme = useTheme();
  const tint: ColorToken = danger ? 'negative' : 'fg';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuRow,
        {
          gap: theme.spacing[14],
          paddingVertical: theme.spacing[14],
          paddingHorizontal: theme.spacing[8],
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <Icon name={icon} size={21} color={tint} />
      <Text variant="body" color={tint}>
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  menuList: { gap: 4 },
  menuRow: { flexDirection: 'row', alignItems: 'center' },
  confirmBody: { textAlign: 'center' },
  dangerBtn: { alignItems: 'center', justifyContent: 'center' },
});
