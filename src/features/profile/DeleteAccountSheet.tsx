// src/features/profile/DeleteAccountSheet.tsx
// 회원 탈퇴 확인 시트 — 파괴 확인(되돌릴 수 없음) (plan §4, AC5). Apple 5.1.1(v) 인앱 계정 삭제 동선.
//   디자인 출처: 킷에 탈퇴 UI 없음(앱 정책 UI) → MuklogDetail(mk-log:204-217) / LeaveLogSheets 의
//   danger 확인 시트 패턴 재사용(Sheet + status-negative 버튼 + ghost 취소). 카피로 "되돌릴 수 없음" 명확화.
//   presentational: open/close·deleteAccount 실행·성공 후 signOut 은 부모(ProfileScreen)가 소유.
//   진행 중(deleting)이면 danger 버튼 비활성(중복 실행 차단), 실패(error)는 인라인(세션 유지·재시도). 스타일=토큰만.
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button, Sheet, Text } from '@/components';
import { useTheme } from '@/theme';

// 카피(퍼블리싱 SSOT) — plan §4. 되돌릴 수 없음 + 상대방 기록 보존 안내를 명확히.
const TITLE = '정말 탈퇴할까요?';
const BODY = '계정과 내 정보가 삭제돼요. 되돌릴 수 없어요.\n함께 만든 기록은 상대방에게 남아요.';
const CONFIRM_LABEL = '탈퇴하기';
const CANCEL_LABEL = '취소';

export type DeleteAccountSheetProps = {
  /** 확인 시트 표시(부모: "회원 탈퇴" 행 탭 → open / 취소·성공 시 close). */
  visible: boolean;
  /** 딤/"취소" 닫기. */
  onClose: () => void;
  /** danger "탈퇴하기" 탭 — 부모가 deleteAccount 실행을 연결(성공 시 signOut). */
  onConfirm: () => void;
  /** 탈퇴 진행 중(useDeleteAccount.loading) — danger 버튼 비활성/로딩(중복 실행 차단). */
  deleting?: boolean;
  /** 탈퇴 실패 메시지(useDeleteAccount.error) — 시트 인라인(재시도 가능, 세션 유지). */
  error?: string | null;
};

export const DeleteAccountSheet = ({
  visible,
  onClose,
  onConfirm,
  deleting = false,
  error = null,
}: DeleteAccountSheetProps) => {
  const theme = useTheme();

  // 진행 중이면 danger 탭을 무시(중복 실행 차단). disabled prop 과 이중 방어.
  const handleConfirm = () => {
    if (deleting) return;
    onConfirm();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={TITLE}>
      <Text
        variant="bodySm"
        color="fgMuted"
        style={[styles.body, { marginBottom: theme.spacing[18] }]}
      >
        {BODY}
      </Text>
      {error ? (
        <Text
          testID="delete-account-error"
          variant="bodySm"
          color="error"
          style={[styles.body, { marginBottom: theme.spacing[12] }]}
        >
          {error}
        </Text>
      ) : null}
      <View style={{ gap: theme.spacing[10] }}>
        {/* danger 버튼(status-negative) — LeaveLogSheets 패턴과 동일. 성공 시 close/signOut 은 부모. */}
        <Pressable
          testID="delete-account-confirm"
          accessibilityRole="button"
          accessibilityLabel={CONFIRM_LABEL}
          accessibilityState={{ disabled: deleting, busy: deleting }}
          disabled={deleting}
          onPress={handleConfirm}
          style={({ pressed }) => [
            styles.dangerBtn,
            {
              backgroundColor: theme.color.negative,
              borderRadius: theme.radius.control,
              paddingVertical: theme.spacing[14],
              opacity: deleting ? 0.45 : pressed ? 0.85 : 1,
            },
          ]}
        >
          {deleting ? (
            <ActivityIndicator color={theme.color.negativeFg} />
          ) : (
            <Text variant="button" color="negativeFg">
              {CONFIRM_LABEL}
            </Text>
          )}
        </Pressable>
        <Button
          title={CANCEL_LABEL}
          accessibilityLabel={CANCEL_LABEL}
          variant="ghost"
          full
          disabled={deleting}
          onPress={onClose}
        />
      </View>
    </Sheet>
  );
};

const styles = StyleSheet.create({
  body: { textAlign: 'center' },
  dangerBtn: { alignItems: 'center', justifyContent: 'center' },
});
