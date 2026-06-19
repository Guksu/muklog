// src/features/map/components/MuklogMiniMap.tsx
// 먹로그 상세 "위치" 미니맵 — 좌표+KAKAO_JS_KEY가 있으면 단일 핀 정적 지도(WebView), 없으면 텍스트 폴백 박스.
//   map-tab WebView 인프라(MapWebView + Kakao SDK) 재사용. 자기완결 HTML(muklogMiniMapHtml)이라 핸드셰이크 없음.
//   ⚠️ KAKAO_JS_KEY 미설정(예: 키 없는 환경/테스트) 시 지도 대신 폴백(주소/안내 텍스트) — 앱은 안 깨짐.
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, IconName, Text } from '@/components';
import { env } from '@/lib/env';
import { useTheme } from '@/theme';

import { muklogMiniMapHtml } from '../muklogMiniMapHtml';
import { MapWebView } from './MapWebView';

const MINIMAP_HEIGHT = 150; // 킷 MiniMap height 150.
const noop = () => {};

export type MuklogMiniMapProps = {
  /** 위도(null이면 지도 미표시 → 폴백). */
  lat: number | null;
  /** 경도(null이면 지도 미표시 → 폴백). */
  lng: number | null;
  /** 좌표/키 없을 때 박스에 표시할 텍스트(주소 또는 안내 메시지). */
  fallbackText: string;
  /** true면 폴백 아이콘 primary(정보 있음), false면 fgAssistive(미보유 톤). */
  fallbackHasInfo?: boolean;
};

export const MuklogMiniMap = ({ lat, lng, fallbackText, fallbackHasInfo = false }: MuklogMiniMapProps) => {
  const theme = useTheme();

  // 좌표 + JS 키가 모두 있어야 지도 렌더(키 없으면 빈 지도라 폴백이 낫다). 인라인 null 체크로 lat/lng를 number로 좁힘.
  if (lat !== null && lng !== null && env.KAKAO_JS_KEY.length > 0) {
    const html = muklogMiniMapHtml({ lat, lng, jsKey: env.KAKAO_JS_KEY });
    return (
      <View testID="muklog-detail-minimap" style={[styles.box, { borderRadius: theme.radius.action }]}>
        <MapWebView html={html} onMessage={noop} />
      </View>
    );
  }

  return (
    <View
      testID="muklog-detail-map-stub"
      style={[
        styles.box,
        styles.fallback,
        { borderRadius: theme.radius.action, backgroundColor: theme.color.surfaceAlt, gap: theme.spacing[6] },
      ]}
    >
      <Icon name={IconName.Location} size={26} color={fallbackHasInfo ? 'primary' : 'fgAssistive'} />
      <Text variant="bodySm" color="fgMuted" style={styles.fallbackText}>
        {fallbackText}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  box: { height: MINIMAP_HEIGHT, overflow: 'hidden' },
  fallback: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  fallbackText: { textAlign: 'center' },
});
