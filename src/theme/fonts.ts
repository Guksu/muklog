// src/theme/fonts.ts
// expo-font 등록용 폰트 맵. 키(패밀리명)는 tokens.ts의 typography.*.fontFamily 와 정확히 일치해야 한다.
// (RN은 fontWeight만으로 커스텀 두께가 안 잡히는 경우가 많아 weight별 fontFamily를 직접 지정한다.)
//
// 기본 글꼴 = SUIT(sun-typeface SUIT@2, SIL OFL). 디자인 킷(SSOT)의 --font-sans(SUIT 우선)에 정합.
//   가변폰트 축(weight) 동적 적용이 RN/Expo에서 불안정해 정적 weight 4종을 사용(Pretendard와 동일 정책).
// 경계면 B4: 아래 4개 키 ↔ typography fontFamily 문자열이 1:1 대응.
//   SUIT-Regular / SUIT-Medium / SUIT-SemiBold / SUIT-Bold
// (Pretendard .ttf는 자산으로 보존하되 미참조 → expo-font 번들 제외. 추후 사용자가 정리 가능.)
export const fontMap = {
  'SUIT-Regular': require('../../assets/fonts/SUIT-Regular.ttf'),
  'SUIT-Medium': require('../../assets/fonts/SUIT-Medium.ttf'),
  'SUIT-SemiBold': require('../../assets/fonts/SUIT-SemiBold.ttf'),
  'SUIT-Bold': require('../../assets/fonts/SUIT-Bold.ttf'),
} as const;
