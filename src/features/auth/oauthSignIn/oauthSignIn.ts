// src/features/auth/oauthSignIn.ts
// Google 로그인을 Supabase OAuth 웹 플로우(PKCE)로 수행한다.
//   네이티브 google-signin은 GIDSignIn이 idToken에 자동으로 심는 nonce를 노출/제어하지 못해
//   Supabase signInWithIdToken의 nonce 검증을 통과할 수 없었다(라이브러리 한계). 그래서 idToken을
//   거치지 않는 OAuth 리다이렉트 방식으로 전환한다.
//   흐름: signInWithOAuth(provider URL 생성) → openAuthSessionAsync(인앱 브라우저) →
//         리다이렉트(muklog://auth/callback?code=…) → exchangeCodeForSession(code) → 세션 설정.
//   세션이 설정되면 AuthProvider의 onAuthStateChange가 authenticated 전이를 처리한다.
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '@/lib/supabase';

import { AuthErrorToken } from '../errors';
import { traceAuth } from '../authDiagnostics';
import { exchangeOAuthCode } from '../oauthCallback';

// 인앱 브라우저 리다이렉트 복귀를 정리한다(모듈 로드 시 1회).
WebBrowser.maybeCompleteAuthSession();

export type OAuthSignInResult =
  | { ok: true; userId: string }
  | { ok: false; cancelled: boolean; token: AuthErrorToken };

/**
 * Google OAuth 웹 플로우(PKCE)로 로그인한다.
 * @returns 성공 시 { ok:true, userId }, 취소/실패는 AuthErrorToken으로 정규화한 결과
 */
export const signInWithGoogleOAuth = async (): Promise<OAuthSignInResult> => {
  // 앱 스킴 기반 리다이렉트 URL(예: muklog://auth/callback). Supabase 리다이렉트 허용목록에 등록 필요.
  const redirectTo = Linking.createURL('auth/callback');
  // ① 실제 리다이렉트 URL — 스킴이 muklog://auth/callback 인지, Supabase 허용목록과 같은 문자열인지 확인.
  traceAuth({ line: `redirectTo=${redirectTo}` });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data?.url) {
    traceAuth({ line: `signInWithOAuth 실패: ${error?.message ?? 'url 없음'}` });
    return { ok: false, cancelled: false, token: AuthErrorToken.NetworkFailed };
  }

  // Android 커스텀탭 옵션(2026-08-19 실기기 확증):
  //   expo-web-browser 폴리필은 커스텀탭을 FLAG_ACTIVITY_NEW_TASK(별도 태스크)로 띄우는데, 별도 태스크에서는
  //   Supabase 302 → muklog:// 리다이렉트 인텐트가 MainActivity에 전달되지 않아 로그인이 dismiss로 끝난다
  //   (일반 Chrome 탭·직접 링크 탭에서는 동일 스킴이 정상 전달됨 — 커스텀탭 태스크 분리만이 변인).
  //   createTask:false = 같은 태스크에 열어 리다이렉트가 onNewIntent로 도달, showInRecents:true = 백그라운드
  //   전환 시 태스크 정리로 플로우가 끊기는 것 방지. iOS는 네이티브 ASWebAuthenticationSession 경로라 무시.
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, {
    createTask: false,
    showInRecents: true,
  });
  // ② 브라우저 결과 — success 면 리다이렉트 회수 성공, cancel/dismiss 면 앱으로 URL이 안 돌아온 것.
  traceAuth({ line: `browser=${result.type}` });
  if (result.type === 'cancel' || result.type === 'dismiss') {
    return { ok: false, cancelled: true, token: AuthErrorToken.GoogleCancelled };
  }
  if (result.type !== 'success') {
    return { ok: false, cancelled: false, token: AuthErrorToken.NetworkFailed };
  }

  // 리다이렉트 URL의 PKCE code 추출 → 세션 교환.
  //   교환은 oauthCallback.exchangeOAuthCode에 위임한다 — 딥링크 복구 경로와 같은 code가 겹쳐도
  //   실제 교환은 1회만 일어나고(code는 1회용), 뒤늦은 재교환 실패가 성공을 덮어쓰지 않는다.
  const code = Linking.parse(result.url).queryParams?.code;
  // ③ code 유무 — 없으면 Supabase 가 앱이 아닌 SITE_URL 로 튕긴 것(허용목록 미등록 1순위).
  if (typeof code !== 'string') {
    traceAuth({ line: `code 없음. url=${result.url.slice(0, 120)}` });
    return { ok: false, cancelled: false, token: AuthErrorToken.TokenExchangeFailed };
  }

  const userId = await exchangeOAuthCode({ code });
  if (!userId) {
    return { ok: false, cancelled: false, token: AuthErrorToken.TokenExchangeFailed };
  }
  traceAuth({ line: `로그인 성공 userId=${userId.slice(0, 8)}` });
  return { ok: true, userId };
};
