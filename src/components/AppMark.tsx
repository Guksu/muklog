// src/components/AppMark.tsx
// 브랜드 마크(공용 로고 프리미티브) — 킷 mk-auth.jsx:8-37 AppMark를 react-native-svg로 이식.
//   블루 스퀘어클(세로 그라데이션 rect #5B85FF→#2A55E6) + 흰 위치핀 + 포크/스푼(#2A55E6).
//   "맛집을 핀으로 기록" 의미. 빈상태/스플래시/로그인/(차후)헤더에서 재사용.
//   web→RN 변환: <svg viewBox 0 0 100 100> 좌표계 보존, rect rx는 viewBox 좌표(0~100)로 환산.
//     bg=false(모노)면 배경 rect 제거 + 핀/유틸을 tint로 칠한다(킷 주석 "핀+유틸만").
//   색: 브랜드 그라데이션은 brandGradient 토큰 경유(raw hex 회피, 출처 = 킷 mk-auth:15-16).
import React from 'react';
import { type ViewStyle } from 'react-native';
import Svg, {
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

import { brandGradient } from '@/theme';

export type AppMarkProps = {
  /** 한 변 길이(px). 기본 96(킷 기본). */
  size?: number;
  /** 모서리 반경(px). 미지정 시 size×0.26(킷 기본 스퀘어클). */
  radius?: number;
  /** 블루 스퀘어클 배경 표시. false면 모노(핀+유틸만, tint색). 기본 true. */
  bg?: boolean;
  /** bg=true에서 위치핀 색 / bg=false에서 마크 전체 색. 기본 흰색(킷 tint). */
  tint?: string;
  style?: ViewStyle;
};

// 킷 viewBox = 0 0 100 100. 그라데이션 id는 size별 고유(킷 "mkg"+size 정합).
const VIEWBOX = '0 0 100 100';
// 킷 rect rx = radius/size*100 (radius 미지정 시 size*0.26 → viewBox 좌표 26).
const DEFAULT_RX = 26;

export const AppMark = ({
  size = 96,
  radius,
  bg = true,
  tint = '#FFFFFF',
  style,
}: AppMarkProps) => {
  const gradientId = `app-mark-grad-${Math.round(size)}`;
  const rx = radius != null ? (radius / size) * 100 : DEFAULT_RX;
  // 핀 색: bg면 tint(흰), 모노면 tint. 포크/스푼 색: bg면 그라데이션 하단 블루, 모노면 tint.
  const pinFill = tint;
  const utensilFill = bg ? brandGradient[1] : tint;

  return (
    <Svg testID="app-mark" width={size} height={size} viewBox={VIEWBOX} style={style}>
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
      {/* 위치핀(킷 mk-auth:21-22) */}
      <Path
        d="M50 20c-13.3 0-23 9.7-23 22 0 15.5 18.9 33.4 22.0 36.2a1.5 1.5 0 0 0 2.0 0C56.1 75.4 73 57.5 73 42c0-12.3-9.7-22-23-22Z"
        fill={pinFill}
      />
      {/* 포크 살 + 포크 + 스푼(킷 mk-auth:25-34) */}
      <Rect x="40.5" y="31" width="2.4" height="9" rx="1.2" fill={utensilFill} />
      <Rect x="44.4" y="31" width="2.4" height="9" rx="1.2" fill={utensilFill} />
      <Rect x="48.3" y="31" width="2.4" height="9" rx="1.2" fill={utensilFill} />
      <Path
        d="M40.5 39h10.2c0 2.6-1.6 4.2-3.6 4.6l.5 9.4a1.9 1.9 0 0 1-3.8 0l.5-9.4c-2.1-.4-3.8-2-3.8-4.6Z"
        fill={utensilFill}
      />
      <Ellipse cx="58.8" cy="36.2" rx="3.6" ry="5" fill={utensilFill} />
      <Path
        d="M57.6 41.5h2.4l-.4 11.5a0.8 0.8 0 0 1-1.6 0Z"
        fill={utensilFill}
      />
    </Svg>
  );
};
