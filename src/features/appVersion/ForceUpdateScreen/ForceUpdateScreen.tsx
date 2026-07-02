// src/features/appVersion/ForceUpdateScreen/ForceUpdateScreen.tsx
// 강제 업데이트 차단 화면(app-version-gate T8) — 앱을 계속 쓸 수 없는 전면 차단.
//   킷 비종속 신설이나 프리미티브(Screen center·AppMark·Text·Button)와 킷 톤으로 정합:
//     · 브랜드 「먹 핀」 코럴 마크(AppMark) = 킷 코럴 톤 캐리어(인앱 액센트 블루와 분리, tokens brandGrad*).
//     · 해요체 카피(사용자 주어·이득 먼저), 헤어라인/토큰만(raw hex 0).
//   닫기·뒤로 없음: 네비게이션에 얹지 않고 자식 대신 렌더(AppVersionGate). Android 하드웨어백 no-op은
//     동작(BackHandler) 영역 → developer 배선(ui-spec §디바이스 스모크). 여기선 비주얼·CTA 콜백만 소유.
//   storeUrl null(미출시=스토어 URL 미설정)이면 버튼 대신 안내문(차단은 유지) — plan §4.2·§6.
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppMark, Button, Screen, Text } from '@/components';
import { useTheme } from '@/theme';

export type ForceUpdateScreenProps = {
  /** 플랫폼 스토어 URL. null이면 버튼 숨김 + 안내문(미출시). Linking 호출은 developer(onUpdatePress). */
  storeUrl: string | null;
  /** "업데이트하러 가기" 탭 콜백 — Linking.openURL 배선은 developer(T11). */
  onUpdatePress: () => void;
};

const BRAND_MARK_SIZE = 72;
const CONTENT_MAX_WIDTH = 320;

export const ForceUpdateScreen = ({ storeUrl, onUpdatePress }: ForceUpdateScreenProps) => {
  const theme = useTheme();
  return (
    <Screen center>
      <View style={[styles.content, { maxWidth: CONTENT_MAX_WIDTH }]}>
        <AppMark size={BRAND_MARK_SIZE} />
        <Text
          variant="emptyTitle"
          color="fg"
          style={[styles.center, { marginTop: theme.spacing[20] }]}
        >
          업데이트가 필요해요
        </Text>
        <Text
          testID="force-update-body"
          variant="body"
          color="fgWeak"
          style={[styles.center, { marginTop: theme.spacing[10] }]}
        >
          먹로그를 계속 사용하려면{'\n'}최신 버전으로 업데이트해 주세요.
        </Text>
        {storeUrl ? (
          <Button
            testID="force-update-button"
            title="업데이트하러 가기"
            variant="primary"
            size="lg"
            full
            onPress={onUpdatePress}
            style={{ marginTop: theme.spacing[28] }}
          />
        ) : (
          <Text
            testID="force-update-guidance"
            variant="bodySm"
            color="fgMuted"
            style={[styles.center, { marginTop: theme.spacing[28] }]}
          >
            앱스토어에서 먹로그를 최신 버전으로{'\n'}업데이트해 주세요.
          </Text>
        )}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: { width: '100%', alignItems: 'center' },
  center: { textAlign: 'center' },
});
