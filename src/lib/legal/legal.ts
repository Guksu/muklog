// src/lib/legal.ts
// 약관/개인정보 URL 단일 출처 — LoginScreen(로그인 전) + ProfileScreen(로그인 후) 공용.
//   App Store Connect 메타데이터의 개인정보 처리방침 URL과 동일 페이지를 쓴다.
//   외부 링크는 expo-web-browser 인앱 브라우저로 연다(OAuth와 동일 패턴).
export const TERMS_URL = 'https://guksu.github.io/muklog-privacy/terms.html';
export const PRIVACY_URL = 'https://guksu.github.io/muklog-privacy/privacy.html';
