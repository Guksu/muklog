// src/features/profile/avatarDefault.ts
// 결정적 디폴트 아바타 유틸 (plan §3.2, A5 / 리더 결정 2026-06-11 — 무백엔드 UI-only).
//   avatarUrl 없는 프로필에 userId(또는 createdBy uuid)를 결정적 해시 → 안정적 이모지+컬러를 부여한다.
//   DB 저장/복원 없음(파생값). 같은 userId는 항상 같은 결과 → 빈 화면/드리프트 없음(엣지: 디폴트 드리프트 §6).
//
// 소비자: Avatar.tsx(A5)가 url 없을 때 내부 파생(plan §3.4 — 호출부는 userId만 넘김).
//   MuklogCard는 createdBy를 userId로 넘겨 작성자별 안정적 익명 아바타를 얻는다(§3.3).
//
// ⚠️ 컬러 팔레트는 "테마 토큰"이 아니라 **아바타 도메인 데이터**(categories grad와 동급)이므로 raw hex 허용(plan §3.2).
//    theme/tokens.ts의 raw-hex 금지 규칙은 테마 색에만 적용되며 이 도메인 팔레트엔 무관하다.

/** 디폴트 아바타 이모지 팔레트(킷 MkAvatar 동물 페이스 계열 — mk-data.js me/partner 예: 🐰/🐻). */
export const AVATAR_EMOJIS = [
  '🐰',
  '🐻',
  '🐱',
  '🐶',
  '🦊',
  '🐨',
  '🐼',
  '🐯',
  '🦁',
  '🐸',
  '🐧',
  '🍓',
] as const;

/** 디폴트 아바타 컬러 팔레트(AVATAR_EMOJIS와 같은 인덱스로 페어링). 킷 예: 🐰 #FF6B5E, 🐻 #5B8DEF. */
export const AVATAR_COLORS = [
  '#FF6B5E',
  '#5B8DEF',
  '#F4A259',
  '#3FAE7D',
  '#E07A5F',
  '#9A86C4',
  '#5FA8D3',
  '#E8A23D',
  '#E4A11B',
  '#4FB6A3',
  '#7B8FA1',
  '#E86A92',
] as const;

/**
 * 문자열 키를 결정적 32비트 해시로 변환한다(비음수). 같은 키 → 같은 값.
 * @param key 해시 대상 문자열(userId/createdBy 등)
 * @returns 0 이상의 정수 해시
 */
const hashKey = ({ key }: { key: string }): number => {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    // 31진 다항 해시 + |0 으로 32비트 정수 유지(결정적·플랫폼 무관).
    hash = (hash * 31 + key.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
};

/**
 * userId(또는 임의 안정 키)를 결정적으로 디폴트 아바타(이모지+컬러)에 매핑한다.
 * @param userId 안정 키(userId/createdBy). 빈/null/undefined면 팔레트 0번으로 폴백(throw 없음).
 * @returns 팔레트에서 선택된 { emoji, color }(이모지·컬러는 같은 인덱스 페어)
 */
export const defaultAvatar = ({
  userId,
}: {
  userId?: string | null;
}): { emoji: string; color: string } => {
  // 빈/falsy 키 → 결정적 폴백(0번). 익명/미인증 경계에서도 안전.
  if (!userId) {
    return { emoji: AVATAR_EMOJIS[0], color: AVATAR_COLORS[0] };
  }
  const paletteIndex = hashKey({ key: userId }) % AVATAR_EMOJIS.length;
  return { emoji: AVATAR_EMOJIS[paletteIndex], color: AVATAR_COLORS[paletteIndex] };
};
