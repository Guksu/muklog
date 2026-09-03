// src/features/appVersion/AppVersionRow/AppVersionRow.tsx
// Profile 앱 버전 행(app-update-actions T3) — 표시 + 상태별 업데이트 액션.
//   킷 비종속 신설 보조 UI. 킷 톤 정합: caption/fgMuted 보조 텍스트(ProfileScreen 회원탈퇴 행과 동일 약톤),
//   업데이트 액션은 UpdateSuggestModal "업데이트"와 동일 accentStrong + 회원탈퇴 행 언더라인 어포던스.
//   눌림은 공용 MotionPressable(lg/0.6) — 불투명도 0.6은 치환 전 로컬 styles.pressed 값 승계이고,
//   UpdateSuggestModal도 자기 파일에 같은 값의 별도 로컬 스타일을 갖는다(공유 아님, motion-press-final A1).
//   버전·업데이트 상태는 props(값 배선=developer/useAppUpdateStatus·expo-linking). 여기선 비주얼·분기·콜백만 소유.
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { MotionPressable, Text } from '@/components';
import { useTheme } from '@/theme';

// 상태 유니온 단일 출처 = useAppUpdateStatus(producer, plan §3.2). 여기선 렌더 분기용으로 type-only import(중복 정의 금지).
import type { AppUpdateStatus } from '../useAppUpdateStatus';

export type AppVersionRowProps = {
  /** 표시할 앱 버전 문자열(예: "1.2.0"). developer가 getCurrentAppVersion 값으로 주입. */
  version: string;
  /**
   * 업데이트 상태 — 렌더 분기. developer가 useAppUpdateStatus에서 주입.
   *   미지정 시 checking(버전만) — 기존 소비처 후방호환(값 배선 전 회귀 0).
   */
  status?: AppUpdateStatus;
  /** "업데이트하기" 탭 콜백 — 스토어 Linking 배선은 ProfileScreen(expo-linking). */
  onUpdatePress?: () => void;
};

const CHECKING_STATUS: AppUpdateStatus = { kind: 'checking' };

// 눌림 불투명도 — 치환 전 로컬 styles.pressed 실값 승계(비주얼 회귀 0). 등급은 lg(캡션 텍스트 행).
const APP_VERSION_ACTION_PRESSED_OPACITY = 0.6;

export const AppVersionRow = ({
  version,
  status = CHECKING_STATUS,
  onUpdatePress,
}: AppVersionRowProps) => {
  const theme = useTheme();

  return (
    <View testID="app-version-row" style={styles.row}>
      <Text variant="caption" color="fgMuted">
        앱 버전 {version}
      </Text>

      {status.kind === 'available' && status.storeUrl ? (
        // 최신 아님 + 열 스토어 있음 → 업데이트 액션(accentStrong·언더라인 어포던스).
        <MotionPressable
          testID="app-version-update"
          accessibilityRole="button"
          accessibilityLabel="업데이트하기"
          onPress={onUpdatePress}
          pressSize="lg"
          pressedOpacity={APP_VERSION_ACTION_PRESSED_OPACITY}
          style={[styles.action, { marginTop: theme.spacing[6] }]}
        >
          <Text variant="caption" color="accentStrong" style={styles.actionLabel}>
            업데이트하기
          </Text>
        </MotionPressable>
      ) : status.kind === 'latest' ? (
        // 최신(ok) → passive 확인 라벨(액션 아님, fgMuted 약톤 유지).
        <Text
          variant="caption"
          color="fgMuted"
          style={{ marginTop: theme.spacing[6] }}
        >
          최신 버전이에요
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  // 회원탈퇴 행(ProfileScreen deleteRow)과 동일한 최하단 보조 행 톤 — 중앙 정렬·비-pressable 컨테이너.
  row: { paddingVertical: 12, alignItems: 'center' },
  action: { alignItems: 'center' },
  // 탭 가능 어포던스 — 회원탈퇴 행 언더라인(ProfileScreen deleteLabel)과 동일 패턴, 색만 accentStrong.
  actionLabel: { textDecorationLine: 'underline' },
});
