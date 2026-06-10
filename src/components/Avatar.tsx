// src/components/Avatar.tsx
// 원형 아바타 — url 있으면 이미지, 없으면 닉네임 이니셜/플레이스홀더 (plan §4 / §5-1, T8 / P4).
// 공용 컴포넌트(추후 먹로그 작성자 표시 등 재사용). 스타일은 원티드 토큰만(raw hex 0).
import React from 'react';
import { Image, View, type ImageStyle, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { Text } from './Text';

export type AvatarProps = {
  /** 아바타 공개 URL. 없으면 이니셜/플레이스홀더로 폴백. */
  url?: string | null;
  /** 이니셜 산출용 닉네임. 없으면 빈 플레이스홀더. */
  nickname?: string | null;
  /** 지름(px). 기본 64. */
  size?: number;
};

/** 닉네임에서 이니셜(첫 글자, 대문자) 한 글자를 만든다. 없으면 빈 문자열. */
const initialOf = ({ nickname }: { nickname?: string | null }): string => {
  const trimmed = (nickname ?? '').trim();
  return trimmed.length > 0 ? trimmed[0].toUpperCase() : '';
};

export const Avatar = ({ url, nickname, size = 64 }: AvatarProps) => {
  const theme = useTheme();

  // muklog MkAvatar 정합: inset ring 2px(RN 미지원 → borderWidth 2 + tinted border)로 근사.
  const base: ViewStyle = {
    width: size,
    height: size,
    borderRadius: theme.radius.full,
    borderWidth: 2,
    borderColor: theme.color.hairline,
    backgroundColor: theme.color.surfaceAlt,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  };

  if (url) {
    // base는 ViewStyle 형태지만 Image는 ImageStyle을 요구한다(overflow 유니온 차이). 동일 속성이라 캐스팅으로 합성.
    return <Image testID="avatar-image" source={{ uri: url }} style={base as ImageStyle} />;
  }

  return (
    <View
      testID="avatar-placeholder"
      style={[base, { backgroundColor: theme.color.primaryWeak }]}
    >
      <Text variant="h2" color="fgWeak">
        {initialOf({ nickname })}
      </Text>
    </View>
  );
};
