// src/components/Icon.tsx
// 공용 아이콘 — ui-design currentColor SVG 글리프를 토큰 컬러로 렌더 (plan §4-1, T6).
//   이모지/텍스트 글리프(+,›) 금지(브랜드 규칙) → in-house 아이콘셋만.
//   react-native-svg 의 SvgXml 에 currentColor SVG 를 주입하고 color 로 재색칠한다.
import React from 'react';
import { SvgXml } from 'react-native-svg';

import { useTheme } from '@/theme';
import type { ColorToken } from '@/theme';

import { ICON_SVG } from '../../assets/icons/icons';

// 도메인 식별 문자열은 enum-style 상수로(컨벤션). 값 = assets/icons/icons.ts 키.
export const IconName = {
  Plus: 'plus',
  ChevronRight: 'chevron-right',
  ChevronLeft: 'chevron-left',
  Person: 'person',
  PersonFill: 'person-fill',
  Location: 'location',
  // 장소검색(muklog-place) — 킷 mk-log:313/391 검색 인풋 돋보기(assets/icons/search.svg).
  Search: 'search',
  Bubble: 'bubble',
  BubbleFill: 'bubble-fill',
  Camera: 'camera',
  Star: 'star',
  StarFill: 'star-fill',
  Close: 'close',
  Setting: 'setting',
  Bell: 'bell',
  Heart: 'heart',
  CircleInfo: 'circle-info',
  Link: 'link',
  Calendar: 'calendar',
  // 상세 more 메뉴/삭제(muklog-edit) — 킷 mk-log:144 more-horizontal / mk-log:200 trash.
  MoreHorizontal: 'more-horizontal',
  Trash: 'trash',
} as const;
export type IconName = (typeof IconName)[keyof typeof IconName];

export type IconProps = {
  /** 렌더할 글리프. IconName 상수 사용. */
  name: IconName;
  /** 한 변 길이(px). 기본 24. */
  size?: number;
  /** 시맨틱 컬러 토큰 키. 기본 'fg'. */
  color?: ColorToken;
};

export const Icon = ({ name, size = 24, color = 'fg' }: IconProps) => {
  const theme = useTheme();
  return (
    <SvgXml
      testID={`icon-${name}`}
      xml={ICON_SVG[name]}
      width={size}
      height={size}
      color={theme.color[color]}
    />
  );
};
