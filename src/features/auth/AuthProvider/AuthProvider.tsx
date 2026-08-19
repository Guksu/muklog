// src/features/auth/AuthProvider.tsx
// 소셜 인증 상태머신(social-auth). 익명 자동 발급을 폐기하고 Google/Apple 소셜 로그인 전용으로 전환.
//
// 상태(AuthState, plan §3.1):
//   loading        부트스트랩(getSession) 진행 중
//   unauthenticated 세션 없음 → LoginScreen 노출(자동 로그인 안 함)
//   authenticating  소셜 로그인 진행 중(해당 provider 버튼 로딩)
//   authenticated   userId 확보(★ userId:string 계약 보존 — 모든 소비처 회귀 0)
//   error           부트스트랩 자체 실패(앱이 못 뜸) — 전체화면 + 재시도
//
// 생산자: 이 Provider가 AuthState/loginError/메서드를 context로 노출.
// 소비자: AuthGate(5분기), LoginScreen(authenticating/loginError/onGoogle/onApple), ProfileScreen(signOut).
//
// 취소 ≠ 에러(plan §3.1):
//   OAuth 취소 → unauthenticated + loginError=null(전체 error 화면 금지).
//   OAuth 실패(네트워크/토큰) → unauthenticated + loginError=인라인 메시지.
//   부트스트랩 실패 → error(전체화면 AuthErrorView).
//
// OAuth 콜백 딥링크 복구(Android singleTop 회귀 대비 — oauthCallback.ts 참고):
//   커스텀탭 리다이렉트가 JS 를 재시작시켜 openAuthSessionAsync promise 가 유실되면 로그인 성공이 증발한다.
//   부트스트랩의 초기 URL(콜드) + 'url' 이벤트 구독(웜) 두 경로로 code 를 잡아 세션을 복구한다.
//   복구가 먼저 끝난 뒤 도착하는 늦은 실패/취소 결과는 authenticatedRef 가드로 무시한다(failLogin).
//
// 익명 잔재 강등(E8): 세션의 user.is_anonymous===true면 signOut→unauthenticated(AsyncStorage 잔존 익명 폐기).
// profiles 본인 행 보장(ensureProfileAndAuth): upsert {id} onConflict id ignoreDuplicates → FK 무결성 선행.
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';

import { unregisterDeviceToken, useRegisterPushToken } from '@/features/notif/useRegisterPushToken';

import { AuthErrorToken, messageForAuthError } from '../errors';
import { recoverOAuthSessionFromInitialUrl, subscribeOAuthCallback } from '../oauthCallback';
import { signInWithGoogleOAuth } from '../oauthSignIn';
import { signInWithAppleNative, type NativeSignInResult } from '../socialSignIn';

export type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticating'; provider: 'google' | 'apple' }
  | { status: 'authenticated'; userId: string }
  | { status: 'error'; message: string };

// signInWithIdToken에 넘기는 provider 문자열(supabase 계약).
const IdTokenProvider = {
  google: 'google',
  apple: 'apple',
} as const;

type AuthContextValue = {
  state: AuthState;
  /** Google 소셜 로그인 시도. authenticating(google) → OAuth 웹 플로우 → exchangeCodeForSession. */
  signInWithGoogle: () => Promise<void>;
  /** Apple 소셜 로그인 시도(iOS 전용). authenticating(apple) → identityToken → signInWithIdToken. */
  signInWithApple: () => Promise<void>;
  /** 로그아웃. supabase.auth.signOut() → unauthenticated, profileEnsuredRef 리셋. */
  signOut: () => Promise<void>;
  /** 로그인 시도 실패 인라인 메시지(취소 시 null 유지). 전체 error 화면이 아님. */
  loginError: string | null;
  /** error 상태에서 재시도. 다시 loading → 부트스트랩 수행. */
  retry: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const [loginError, setLoginError] = useState<string | null>(null);
  // retry 트리거. 값이 바뀌면 부트스트랩 effect 재실행.
  const [attempt, setAttempt] = useState(0);
  const mountedRef = useRef(true);
  // 동일 userId에 대해 profiles upsert를 1회만 수행하기 위한 가드(토큰 갱신 시 중복 upsert 방지).
  // signOut 시 리셋 → 재로그인 시 upsert 재실행(plan E11).
  const profileEnsuredRef = useRef<string | null>(null);
  // 이미 authenticated 인지(비동기 클로저에서 state 대신 참조). 딥링크 복구 경로가 먼저 로그인을 끝낸 뒤
  // 뒤늦게 도착한 브라우저 취소/실패 결과가 로그인 상태를 unauthenticated 로 덮어쓰는 것을 막는다
  // (Android singleTop 재시작 시 openAuthSessionAsync 가 dismiss 로 늦게 resolve 될 수 있다).
  const authenticatedRef = useRef(false);

  // 푸시 디바이스 토큰 등록(push-notifications S1, T4). authenticated 진입(userId 확보) 시 1회 구동.
  //   authenticated 외 상태에선 userId='' → 훅이 no-op(폴링 없음, 중복은 훅 내부 ref 가드).
  const activeUserId = state.status === 'authenticated' ? state.userId : '';
  useRegisterPushToken({ userId: activeUserId });

  const retry = () => {
    setState({ status: 'loading' });
    setLoginError(null);
    setAttempt((n) => n + 1);
  };

  // profiles 본인 행 보장 → 성공 후 authenticated 전이(FK 무결성 선행). 실패 시 throw.
  const ensureProfileAndAuth = async ({ userId }: { userId: string }) => {
    if (profileEnsuredRef.current !== userId) {
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: userId }, { onConflict: 'id', ignoreDuplicates: true });
      if (error) throw error;
      profileEnsuredRef.current = userId;
    }
    authenticatedRef.current = true;
    if (mountedRef.current) {
      setState({ status: 'authenticated', userId });
    }
  };

  // 로그인 시도 실패 → unauthenticated + 인라인 메시지. 단, 이미 로그인이 끝난 뒤 뒤늦게 도착한
  // 실패/취소 결과는 무시한다(딥링크 복구가 먼저 성공한 경우 — 상태를 되돌리면 안 된다).
  const failLogin = ({ token }: { token: AuthErrorToken }) => {
    if (!mountedRef.current || authenticatedRef.current) return;
    setState({ status: 'unauthenticated' });
    setLoginError(messageForAuthError({ token }));
  };

  // Apple 네이티브 결과를 상태 전이로 매핑.
  //   ok        → signInWithIdToken → onAuthStateChange가 ensureProfileAndAuth→authenticated 수행.
  //   cancelled → unauthenticated + loginError=null.
  //   실패      → unauthenticated + loginError=메시지.
  const runSocialSignIn = async ({
    provider,
    nativeResult,
  }: {
    provider: 'google' | 'apple';
    nativeResult: NativeSignInResult;
  }) => {
    if (!nativeResult.ok) {
      failLogin({ token: nativeResult.token });
      return;
    }
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: IdTokenProvider[provider],
      token: nativeResult.token,
    });
    if (error || !data.user) {
      failLogin({ token: AuthErrorToken.TokenExchangeFailed });
      return;
    }
    // 성공: onAuthStateChange(SIGNED_IN)가 ensureProfileAndAuth→authenticated를 처리.
    //   리스너가 도는 사이를 대비해 여기서도 직접 보장(중복은 profileEnsuredRef 가드로 무해).
    setLoginError(null);
    await ensureProfileAndAuth({ userId: data.user.id });
  };

  const signInWithGoogle = async () => {
    setLoginError(null);
    setState({ status: 'authenticating', provider: 'google' });
    const result = await signInWithGoogleOAuth();
    if (!result.ok) {
      failLogin({ token: result.token });
      return;
    }
    // exchangeCodeForSession이 세션을 설정 → onAuthStateChange가 처리하지만, 일관성을 위해 직접 보장.
    setLoginError(null);
    await ensureProfileAndAuth({ userId: result.userId });
  };

  const signInWithApple = async () => {
    setLoginError(null);
    setState({ status: 'authenticating', provider: 'apple' });
    const nativeResult = await signInWithAppleNative();
    await runSocialSignIn({ provider: 'apple', nativeResult });
  };

  const signOut = async () => {
    // 로그아웃 전 현재 기기 토큰 폐기(T6, 오배달 방지). auth.uid() 유효 구간에서 delete(RLS 본인 토큰).
    //   best-effort: 토큰 미보유/실패는 무해 흡수 → 로그아웃 흐름 차단 0.
    await unregisterDeviceToken({ userId: activeUserId });
    await supabase.auth.signOut();
    profileEnsuredRef.current = null;
    authenticatedRef.current = false;
    if (mountedRef.current) {
      setState({ status: 'unauthenticated' });
      setLoginError(null);
    }
  };

  useEffect(
    function bootstrapAuth() {
      mountedRef.current = true;

      async function bootstrap() {
        try {
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;

          const user = sessionData.session?.user ?? null;

          // 익명 세션 잔재 강등(E8): 익명이면 폐기 → unauthenticated(로그인 화면 노출).
          if (user?.is_anonymous === true) {
            await supabase.auth.signOut();
            if (mountedRef.current) setState({ status: 'unauthenticated' });
            return;
          }

          const userId = user?.id ?? null;
          if (!userId) {
            // 세션 없음 → OAuth 콜백 딥링크로 앱이 뜬 경우인지 먼저 확인한다.
            //   Android singleTop 은 커스텀탭 리다이렉트에 MainActivity 새 인스턴스를 띄워 JS 를 재시작시키고,
            //   그러면 openAuthSessionAsync promise 가 유실돼 로그인 성공이 그대로 증발한다.
            //   PKCE verifier 는 SecureStore 에 남아 있으므로 초기 URL 의 code 만으로 세션 복구가 가능하다.
            const recoveredUserId = await recoverOAuthSessionFromInitialUrl();
            if (recoveredUserId) {
              await ensureProfileAndAuth({ userId: recoveredUserId });
              return;
            }
            // 진짜 세션 없음 → 자동 로그인 안 함(익명 발급 제거).
            if (mountedRef.current) setState({ status: 'unauthenticated' });
            return;
          }

          // 소셜 세션 복원: profiles 보장 후 authenticated.
          await ensureProfileAndAuth({ userId });
        } catch (err) {
          // 부트스트랩 자체 실패만 error(전체화면). 로그인 시도 실패와 구분.
          const message = err instanceof Error ? err.message : '알 수 없는 인증 오류';
          if (mountedRef.current) setState({ status: 'error', message });
        }
      }

      bootstrap();

      // 세션 변화(로그인 성공/갱신/로그아웃) 반영.
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!mountedRef.current) return;
        const userId = session?.user?.id;
        if (userId) {
          // 소셜 로그인 성공/토큰 갱신 → profiles 보장 후 authenticated(가드로 중복 upsert 없음).
          ensureProfileAndAuth({ userId }).catch((err) => {
            // 리스너 경로의 프로필 보장 실패는 로그인 시도 실패로 취급(전체 error 화면 금지).
            const message = err instanceof Error ? err.message : '프로필 초기화에 실패했습니다.';
            if (mountedRef.current && !authenticatedRef.current) {
              setState({ status: 'unauthenticated' });
              setLoginError(message);
            }
          });
        }
        // userId 없음(SIGNED_OUT 등)은 signOut/부트스트랩이 처리 → 여기선 강제 전이하지 않음(error 금지).
      });

      // 실행 중 도착하는 OAuth 콜백 딥링크(웜 복귀) — 브라우저 promise 와 무관하게 세션을 확보한다.
      //   같은 code 의 중복 교환은 exchangeOAuthCode 가 막으므로 정상 경로와 겹쳐도 무해하다.
      const unsubscribeCallback = subscribeOAuthCallback({
        onUserId: ({ userId }) => {
          setLoginError(null);
          ensureProfileAndAuth({ userId }).catch(() => {
            failLogin({ token: AuthErrorToken.TokenExchangeFailed });
          });
        },
      });

      return function cleanupAuth() {
        mountedRef.current = false;
        sub.subscription.unsubscribe();
        unsubscribeCallback();
      };
    },
    [attempt],
  );

  return (
    <AuthContext.Provider
      value={{ state, signInWithGoogle, signInWithApple, signOut, loginError, retry }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/** Provider 바깥 호출 시 명확히 throw. */
export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error('useAuth()는 <AuthProvider> 트리 안에서만 호출할 수 있습니다.');
  }
  return ctx;
};
