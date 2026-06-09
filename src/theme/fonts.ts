// src/theme/fonts.ts
// expo-font 등록용 폰트 맵. 키(패밀리명)는 tokens.ts의 typography.*.fontFamily 와 정확히 일치해야 한다.
// (RN은 fontWeight만으로 커스텀 두께가 안 잡히는 경우가 많아 weight별 fontFamily를 직접 지정한다.)
//
// 경계면 B4: 아래 4개 키 ↔ typography fontFamily 문자열이 1:1 대응.
//   Pretendard-Regular / Pretendard-Medium / Pretendard-SemiBold / Pretendard-Bold
export const fontMap = {
  'Pretendard-Regular': require('../../assets/fonts/Pretendard-Regular.ttf'),
  'Pretendard-Medium': require('../../assets/fonts/Pretendard-Medium.ttf'),
  'Pretendard-SemiBold': require('../../assets/fonts/Pretendard-SemiBold.ttf'),
  'Pretendard-Bold': require('../../assets/fonts/Pretendard-Bold.ttf'),
} as const;
