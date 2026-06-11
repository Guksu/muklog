// src/components/Avatar.tsx
// 원형 아바타 — 킷 mk-ui.jsx:64-77 MkAvatar 정합 (A5 / plan §3.3·§3.4).
//   표시 우선순위: 1) avatarUrl 이미지 → 2) userId 결정적 디폴트(이모지+컬러) → 3) 닉네임 이니셜 → 4) 익명 🙂.
//   디폴트(이모지): bg = color+26 알파, inset ring ≈ borderWidth 2(color+55), 이모지 = size×0.5.
//   emoji/color는 호출부가 직접 안 넘기고 userId에서 defaultAvatar로 내부 파생(결정성·호출부 단순화).
//   defaultAvatar는 모듈 경로로 직접 import(features/profile 배럴의 훅→supabase 결합 회피).
import React from 'react';
import { Image, StyleSheet, Text as RNText, View, type ImageStyle, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import { defaultAvatar } from '@/features/profile/avatarDefault';

import { Text } from './Text';

export type AvatarProps = {
  /** 아바타 공개 URL. 있으면 이미지 우선. */
  url?: string | null;
  /** 결정적 디폴트 파생 키(userId/createdBy). url 없을 때 이모지+컬러 산출. */
  userId?: string | null;
  /** url·userId 모두 없을 때 이니셜 폴백 + 접근성 라벨. */
  nickname?: string | null;
  /** 지름(px). 기본 64. */
  size?: number;
  /** inset ring 표시 여부. 기본 true(킷 MkAvatar ring). */
  ring?: boolean;
};

// #RRGGBB + 2자리 알파 → #RRGGBBAA. 유효한 6자리 hex가 아니면 원색 반환(잘못된 색 안전 흡수).
const withAlpha = ({ hex, alpha }: { hex: string; alpha: string }): string =>
  /^#[0-9A-Fa-f]{6}$/.test(hex) ? `${hex}${alpha}` : hex;

/** 닉네임에서 이니셜(첫 글자, 대문자) 한 글자. 없으면 빈 문자열. */
const initialOf = ({ nickname }: { nickname?: string | null }): string => {
  const trimmed = (nickname ?? '').trim();
  return trimmed.length > 0 ? trimmed[0].toUpperCase() : '';
};

export const Avatar = ({ url, userId, nickname, size = 64, ring = true }: AvatarProps) => {
  const theme = useTheme();
  const accessibilityLabel = nickname ? `${nickname} 아바타` : '아바타';

  // 1) 이미지 — 업로드 URL을 원형으로 표시(ring이면 헤어라인 보더).
  if (url) {
    const imageStyle: ImageStyle = {
      width: size,
      height: size,
      borderRadius: theme.radius.full,
      borderWidth: ring ? 2 : 0,
      borderColor: theme.color.hairline,
    };
    return (
      <Image
        testID="avatar-image"
        accessibilityLabel={accessibilityLabel}
        source={{ uri: url }}
        style={imageStyle}
      />
    );
  }

  const round: ViewStyle = {
    width: size,
    height: size,
    borderRadius: theme.radius.full,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  };

  // 2) 결정적 디폴트 — userId 해시 → 이모지+컬러(color+26 배경 / color+55 ring).
  if (userId) {
    const { emoji, color } = defaultAvatar({ userId });
    const emojiStyle: ViewStyle = {
      ...round,
      backgroundColor: withAlpha({ hex: color, alpha: '26' }),
      borderWidth: ring ? 2 : 0,
      borderColor: withAlpha({ hex: color, alpha: '55' }),
    };
    return (
      <View testID="avatar-default" accessibilityLabel={accessibilityLabel} style={emojiStyle}>
        <RNText style={[styles.emoji, { fontSize: size * 0.5 }]}>{emoji}</RNText>
      </View>
    );
  }

  // 3) 닉네임 이니셜 폴백.
  const initial = initialOf({ nickname });
  if (initial) {
    return (
      <View
        testID="avatar-placeholder"
        accessibilityLabel={accessibilityLabel}
        style={[round, { backgroundColor: theme.color.primaryWeak }]}
      >
        <Text variant="h2" color="fgWeak">
          {initial}
        </Text>
      </View>
    );
  }

  // 4) 익명 🙂 — 셋 다 없을 때(파트너 익명 아바타 등).
  return (
    <View
      testID="avatar-anonymous"
      accessibilityLabel={accessibilityLabel}
      style={[round, { backgroundColor: theme.color.surfaceAlt }]}
    >
      <RNText style={[styles.emoji, { fontSize: size * 0.5 }]}>🙂</RNText>
    </View>
  );
};

const styles = StyleSheet.create({
  emoji: { textAlign: 'center' },
});
