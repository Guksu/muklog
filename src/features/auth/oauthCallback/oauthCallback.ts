// src/features/auth/oauthCallback/oauthCallback.ts
// OAuth 콜백 딥링크(muklog://auth/callback?code=…) 복구 경로 — 브라우저 promise 유실 대비 방어선.
//
// 정상 경로는 oauthSignIn 의 openAuthSessionAsync promise 가 콜백 URL 을 직접 돌려받는 것이다
// (Android 커스텀탭은 createTask:false 로 같은 태스크에 떠야 리다이렉트가 onNewIntent 로 전달된다 —
//  2026-08-19 실기기 확증, oauthSignIn.ts 참고). 이 모듈은 그 promise 가 유실되는 경우의 방어선이다:
//   · 저메모리로 프로세스가 종료됐다 재시작 → 콜드 경로(recoverOAuthSessionFromInitialUrl, 부트스트랩에서 호출)
//   · 액티비티 재생성 등으로 promise 만 유실 → 웜 경로('url' 이벤트)·복귀 경로(AppState 재확인)
//
// 복구 원리:
//   PKCE code verifier 는 supabase 클라이언트의 storage(=SecureStore)에 영속되므로 앱이 재시작돼도 살아있다.
//   따라서 브라우저 promise 와 무관하게 콜백 URL 의 code 만 확보하면 세션 교환이 가능하다.
//   세 경로와 기존 openAuthSessionAsync 경로가 같은 code 로 겹칠 수 있어 exchangeOAuthCode 가 1회 교환을,
//   notifiedCode 가 1회 통지를 보장한다.
import { AppState } from 'react-native';
import * as Linking from 'expo-linking';

import { supabase } from '@/lib/supabase';

// 마지막으로 교환을 시도한 code 와 그 결과 promise. 같은 code 재도착 시 재교환 없이 이 결과를 공유한다.
//   code 는 1회용이라 재교환은 반드시 실패하고, 그 실패가 이미 성공한 로그인을 에러로 덮어쓸 수 있다.
//   직전 1건만 들고 있으므로 누적 없이 경계가 닫힌다(중복 도착은 언제나 최신 code 건이다).
let lastExchange: { code: string; result: Promise<string | null> } | null = null;

// 구독 경로가 이미 통지를 끝낸 code. 포그라운드 복귀 재확인은 같은 인텐트를 반복해서 돌려주므로
// 이 가드가 없으면 로그아웃 뒤 복귀만으로 다시 로그인되어 버린다.
let notifiedCode: string | null = null;

// 실제 교환. 실패·throw 를 모두 null 로 정규화한다(호출부는 "userId 확보 실패"만 알면 된다).
const runExchange = async ({ code }: { code: string }): Promise<string | null> => {
  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return null;
    return data?.session?.user?.id ?? null;
  } catch {
    return null;
  }
};

/**
 * PKCE code 를 세션으로 교환한다. 같은 code 는 몇 번을 호출해도 실제 교환은 1회다.
 * @returns 성공 시 userId, 실패 시 null
 */
export const exchangeOAuthCode = ({ code }: { code: string }): Promise<string | null> => {
  if (lastExchange?.code === code) return lastExchange.result;
  const result = runExchange({ code });
  lastExchange = { code, result };
  return result;
};

// 딥링크 URL 에서 OAuth code 를 뽑는다. 인바운드 딥링크 중 code 를 실은 건 OAuth 콜백뿐이라
// code 유무만으로 식별한다(error=access_denied 리다이렉트는 code 가 없어 자연히 걸러진다).
const codeFromUrl = ({ url }: { url: string }): string | null => {
  const code = Linking.parse(url).queryParams?.code;
  return typeof code === 'string' ? code : null;
};

/**
 * 앱을 띄운 초기 URL 이 OAuth 콜백이면 세션을 복구한다(콜드 재시작 경로).
 * @returns 복구 성공 시 userId, 콜백이 아니거나 실패면 null
 */
export const recoverOAuthSessionFromInitialUrl = async (): Promise<string | null> => {
  const url = await Linking.getInitialURL();
  if (!url) return null;
  const code = codeFromUrl({ url });
  if (!code) return null;
  return exchangeOAuthCode({ code });
};

/**
 * 실행 중 도착하는 OAuth 콜백 딥링크를 구독한다(웜 복귀 경로).
 * @param onUserId 세션 교환 성공 시 userId 통지(실패·비콜백 딥링크는 통지하지 않음)
 * @returns 구독 해제 함수
 */
export const subscribeOAuthCallback = ({
  onUserId,
}: {
  onUserId: (params: { userId: string }) => void;
}): (() => void) => {
  // code 를 확보해 1회만 통지한다. 재확인 경로는 같은 인텐트를 계속 돌려주므로(아래) 중복 통지를 막아야
  // 로그아웃 뒤 포그라운드 복귀가 사용자를 되살리는 사고를 피할 수 있다.
  const notifyOnce = async ({ code }: { code: string }): Promise<void> => {
    if (notifiedCode === code) return;
    notifiedCode = code;
    const userId = await exchangeOAuthCode({ code });
    if (userId) onUserId({ userId });
  };

  const linkSubscription = Linking.addEventListener('url', async ({ url }: { url: string }) => {
    const code = codeFromUrl({ url });
    if (code) await notifyOnce({ code });
  });

  // 복귀 경로: 액티비티가 재생성되면 RN 'url' 이벤트(onNewIntent 전용)가 발생하지 않고 콜백이 새 액티비티의
  //   인텐트 안에 갇힐 수 있다. getInitialURL()은 현재 액티비티의 인텐트를 읽으므로 포그라운드 복귀 때
  //   재확인하면 회수된다. 같은 인텐트가 반복 반환되므로 notifyOnce 가드가 필수다.
  const appStateSubscription = AppState.addEventListener('change', async (state: string) => {
    if (state !== 'active') return;
    const url = await Linking.getInitialURL();
    if (!url) return;
    const code = codeFromUrl({ url });
    if (code) await notifyOnce({ code });
  });

  return function unsubscribeOAuthCallback() {
    linkSubscription.remove();
    appStateSubscription.remove();
  };
};
