// src/components/AppMark.tsx
// 브랜드 마크(공용 로고 프리미티브) — 킷 mk-auth.jsx:8-26 AppMark(「먹 핀」)를 RN으로 이식. (brand-coral §1, HANDOFF-2026-06-30 §1)
//   코럴 스퀘어클(세로 그라데이션 rect #FF7E63→#FF4D6D) + 흰 위치핀 + 핀 안 브랜드 글자 "먹".
//   "다녀온 자리를 기록" 의미. 빈상태/스플래시/로그인/(차후)헤더에서 재사용.
//   web→RN 변환: <svg viewBox 0 0 100 100> 좌표계 보존, rect rx는 viewBox 좌표(0~100)로 환산(변의 22.5%).
//     bg=false(모노)면 배경 rect 제거 + 핀/글자를 tint로 칠한다(킷 주석 "핀+글자만, 배경 투명").
//   ⚠️ "먹" 글자 = react-native-svg <Text> 대신 RN <Text> 오버레이로 근사 렌더(미재현/근사):
//     · 킷은 SVG <text>지만 (1) react-native-svg의 한글 <Text>는 기기·폰트 로드 의존이 강하고
//       (HANDOFF §1이 직접 경고), (2) jest 환경에서 svg Text export가 undefined라 테스트 불가.
//     · 그래서 Svg(스퀘어클+핀) 위에 절대배치 RN <Text>로 "먹"을 겹쳐 그린다 — 폰트·렌더 안정성↑.
//       viewBox 중앙 (x50,y39.5) → 컨테이너 비율 좌표(left 50%·top 39.5%, transform 중앙정렬)로 환산.
//       fontSize는 viewBox 27/100 비율 → size×0.27. 폰트 미로드 시 시스템 폰트 폴백(형태·위치 유지).
//   색: 코럴 그라데이션은 brandGradient 토큰, 글자색은 brandMarkGlyph 토큰 경유(raw hex 회피, 킷 mk-auth:14-15,23).
import React from 'react';
import { StyleSheet, Text as RNText, View, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { brandGradient, useTheme } from '@/theme';

export type AppMarkProps = {
  /** 한 변 길이(px). 기본 96(킷 기본). */
  size?: number;
  /** 모서리 반경(px). 미지정 시 size×0.225(킷 「먹 핀」 스퀘어클 = 변의 22.5%). */
  radius?: number;
  /** 코럴 스퀘어클 배경 표시. false면 모노(핀+글자만, tint색). 기본 true. */
  bg?: boolean;
  /** bg=true에서 위치핀 색 / bg=false에서 마크 전체(핀+글자) 색. 기본 흰색(킷 tint). */
  tint?: string;
  style?: ViewStyle;
};

// 킷 viewBox = 0 0 100 100. 그라데이션 id는 size별 고유(킷 "mkg"+size 정합).
const VIEWBOX = '0 0 100 100';
// 킷 rect rx = 변의 22.5%(mk-auth:18 rx="22.5", viewBox 0~100 좌표 = 변의 22.5%).
const DEFAULT_RX_RATIO = 0.225;
// 흰 위치핀 path(킷 mk-auth:20, viewBox 0 0 100 100) — 「먹 핀」 신규 형태.
const PIN_PATH =
  'M50 14C34 14 23 25.5 23 40C23 57 44 72 48.2 82a2 2 0 0 0 3.6 0C56 72 77 57 77 40C77 25.5 66 14 50 14Z';
// "먹" 글자 — 킷 mk-auth:22-23. 핀 머리 중앙 (x50,y39.5)/100, weight 900, size 27/100, ls -0.5.
//   브랜드 폰트 = SUIT-Bold(앱 최중량 = Wanted Sans 900 대응, fonts.ts).
const GLYPH = '먹';
const GLYPH_CENTER_X_RATIO = 0.5;
const GLYPH_CENTER_Y_RATIO = 0.395;
const GLYPH_FONT_SIZE_RATIO = 0.27;
const GLYPH_FONT_FAMILY = 'SUIT-Bold';

export const AppMark = ({
  size = 96,
  radius,
  bg = true,
  tint = '#FFFFFF',
  style,
}: AppMarkProps) => {
  const theme = useTheme();
  const gradientId = `app-mark-grad-${Math.round(size)}`;
  const rx = radius != null ? (radius / size) * 100 : DEFAULT_RX_RATIO * 100;
  // 핀 색: bg면 tint(흰), 모노면 tint. 글자색: bg면 코럴 brandMarkGlyph, 모노면 tint(핀과 동색).
  const pinFill = tint;
  const glyphFill = bg ? theme.color.brandMarkGlyph : tint;
  const glyphFontSize = size * GLYPH_FONT_SIZE_RATIO;
  // 컨테이너 borderRadius(px) = 마크 스퀘어클 반경 — 소비처 컬러 그림자가 둥근 사각으로 떨어지게(iOS shadowPath 근사).
  const containerRadius = radius != null ? radius : size * DEFAULT_RX_RATIO;

  return (
    <View style={[{ width: size, height: size, borderRadius: containerRadius }, style]}>
      <Svg testID="app-mark" width={size} height={size} viewBox={VIEWBOX}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={brandGradient[0]} />
            <Stop offset="1" stopColor={brandGradient[1]} />
          </LinearGradient>
        </Defs>
        {bg ? (
          <Rect
            testID="app-mark-bg"
            x="0"
            y="0"
            width="100"
            height="100"
            rx={rx}
            fill={`url(#${gradientId})`}
          />
        ) : null}
        {/* 위치핀(킷 mk-auth:20) */}
        <Path testID="app-mark-pin" d={PIN_PATH} fill={pinFill} />
      </Svg>
      {/* 브랜드 글자 "먹" — RN Text 오버레이 근사(킷 mk-auth:22-23 svg text). 핀 머리 중앙 절대배치. */}
      <RNText
        testID="app-mark-glyph"
        allowFontScaling={false}
        style={[
          styles.glyph,
          {
            top: size * GLYPH_CENTER_Y_RATIO - glyphFontSize / 2,
            left: size * GLYPH_CENTER_X_RATIO - glyphFontSize,
            width: glyphFontSize * 2,
            fontSize: glyphFontSize,
            lineHeight: glyphFontSize,
            color: glyphFill,
          },
        ]}
      >
        {GLYPH}
      </RNText>
    </View>
  );
};

const styles = StyleSheet.create({
  // 킷 text-anchor:middle + dominant-baseline:central 근사: 절대배치 + textAlign center + 폭 중앙정렬.
  //   letterSpacing -0.5(킷), fontFamily SUIT-Bold(weight 900 대응).
  glyph: {
    position: 'absolute',
    textAlign: 'center',
    letterSpacing: -0.5,
    fontFamily: GLYPH_FONT_FAMILY,
    includeFontPadding: false,
  },
});
