// src/features/auth/AuthProvider.tsx
// 익명 세션 부트스트랩. 앱 진입 시 세션이 없으면 signInAnonymously()로 익명 사용자를 확보한다.
// 세션은 AsyncStorage에 영속되므로 재실행 시 동일 uid가 복원된다.
//
// 생산자: 이 Provider가 AuthState를 만들어 context로 노출.
// 소비자: AuthGate가 useAuth()로 구독해 loading/authenticated/error 3분기를 렌더.
//
// invite-room: 익명 세션 확보 직후 profiles 본인 행을 upsert하여 FK 무결성을 선행 보장한다.
//   (upsert 성공 후에만 authenticated로 전이 → 이후 create_room/join_room RPC의 FK 위반 0.)
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type AuthState =
  | { status: 'loading' }
  | { status: 'authenticated'; userId: string }
  | { status: 'error'; message: string };

type AuthContextValue = {
  state: AuthState;
  /** error 상태에서 재시도 버튼이 호출. 다시 loading → 부트스트랩 수행. */
  retry: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  // retry 트리거. 값이 바뀌면 부트스트랩 effect 재실행.
  const [attempt, setAttempt] = useState(0);
  const mountedRef = useRef(true);
  // 동일 userId에 대해 profiles upsert를 1회만 수행하기 위한 가드(토큰 갱신 시 중복 upsert 방지).
  const profileEnsuredRef = useRef<string | null>(null);

  const retry = () => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  };

  useEffect(
    function bootstrapAuth() {
      mountedRef.current = true;

      // profiles 본인 행 보장 → 성공 후에만 authenticated 전이.
      //   upsert {id} / onConflict id / ignoreDuplicates(=INSERT ... ON CONFLICT DO NOTHING) → 닉네임/아바타는 NULL 유지.
      //   실패 시 throw → 호출부(bootstrap/listener)가 error 상태로 전이(FK 무결성 보호).
      async function ensureProfileAndAuth({ userId }: { userId: string }) {
        if (profileEnsuredRef.current !== userId) {
          const { error } = await supabase
            .from('profiles')
            .upsert({ id: userId }, { onConflict: 'id', ignoreDuplicates: true });
          if (error) throw error;
          profileEnsuredRef.current = userId;
        }
        if (mountedRef.current) {
          setState({ status: 'authenticated', userId });
        }
      }

      async function bootstrap() {
        try {
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;

          let userId = sessionData.session?.user?.id ?? null;

          if (!userId) {
            // 세션 없음(최초 실행 또는 AsyncStorage 손실) → 익명 발급
            const { data: signInData, error: signInError } = await supabase.auth.signInAnonymously();
            if (signInError) throw signInError;
            userId = signInData.user?.id ?? null;
          }

          if (!userId) {
            throw new Error('익명 세션을 확보하지 못했습니다(userId 없음).');
          }

          // profiles 본인 행 보장 후 authenticated 전이(FK 무결성 선행).
          await ensureProfileAndAuth({ userId });
        } catch (err) {
          const message = err instanceof Error ? err.message : '알 수 없는 인증 오류';
          if (mountedRef.current) {
            setState({ status: 'error', message });
          }
        }
      }

      bootstrap();

      // 세션 변화(갱신/만료/로그아웃) 반영
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!mountedRef.current) return;
        const userId = session?.user?.id;
        if (userId) {
          // 여기서도 profiles 보장 후 authenticated 전이(첫 전이가 upsert를 우회하지 않도록).
          // profileEnsuredRef 가드로 토큰 갱신 시 중복 upsert는 발생하지 않음.
          ensureProfileAndAuth({ userId }).catch((err) => {
            const message = err instanceof Error ? err.message : '프로필 초기화에 실패했습니다.';
            if (mountedRef.current) setState({ status: 'error', message });
          });
        }
        // userId 없음(SIGNED_OUT 등)은 부트스트랩/재시도가 처리하므로 여기선 강제 error 전이하지 않음.
      });

      return function cleanupAuth() {
        mountedRef.current = false;
        sub.subscription.unsubscribe();
      };
    },
    [attempt],
  );

  return <AuthContext.Provider value={{ state, retry }}>{children}</AuthContext.Provider>;
};

/** Provider 바깥 호출 시 명확히 throw. */
export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error('useAuth()는 <AuthProvider> 트리 안에서만 호출할 수 있습니다.');
  }
  return ctx;
};
