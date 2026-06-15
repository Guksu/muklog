// src/lib/env.ts
// 환경변수 단일 검증 지점. 누락 시 "빈 문자열로 조용히 통과"하지 않고 명확히 throw 한다.
// EXPO_PUBLIC_ 프리픽스는 Expo가 클라이언트 번들에 값을 주입하기 위한 필수 규칙이다.
// 주의: process.env.EXPO_PUBLIC_* 는 Expo 빌드 시 정적 치환되므로, 동적 키 접근이 아닌
//       리터럴 키로 읽어야 번들에 인라인된다.

function required(key: string, value: string | undefined): string {
  if (value == null || value.trim() === '') {
    throw new Error(
      `[env] 필수 환경변수 누락: ${key}\n` +
        `→ 프로젝트 루트의 .env 파일에 ${key} 를 설정하세요(.env.example 참고).\n` +
        `→ EXPO_PUBLIC_ 프리픽스가 정확한지, 값을 바꾼 뒤 dev 서버를 재시작했는지 확인하세요.`,
    );
  }
  return value;
}

// 선택 환경변수 — 누락 시 throw하지 않고 빈 문자열을 반환한다(소비처가 부재를 분기 처리).
function optional(value: string | undefined): string {
  return value == null ? '' : value;
}

export const env = {
  SUPABASE_URL: required('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),
  SUPABASE_ANON_KEY: required('EXPO_PUBLIC_SUPABASE_ANON_KEY', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
  // Google OAuth 클라이언트 ID(public — 시크릿 아님). GoogleSignin.configure에 주입.
  //   Web client ID: Supabase가 idToken 검증 시 audience로 사용(가장 중요).
  //   iOS client ID: iOS 네이티브 로그인용. (app.json의 reversed URL scheme은 별도 — env 아님)
  GOOGLE_WEB_CLIENT_ID: required(
    'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  ),
  GOOGLE_IOS_CLIENT_ID: required(
    'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  ),
  // Kakao JavaScript 키(map-tab 지도 렌더용). 도메인 화이트리스트로 보호되는 공개키 성격이나
  //   번들 직박힘을 피해 env로 주입한다(키 값은 코드/문서 미기록 — 이름만). 미설정 시 빈 문자열 →
  //   지도뷰가 "지도를 불러오지 못했어요"로 분기(앱 부팅은 막지 않음, 다른 탭 정상).
  KAKAO_JS_KEY: optional(process.env.EXPO_PUBLIC_KAKAO_JS_KEY),
} as const;
