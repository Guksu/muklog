// src/features/auth/oauthCallback/oauthCallback.ts
// OAuth 콜백 딥링크(muklog://auth/callback?code=…) 복구 경로.
//
// 왜 필요한가:
//   Android MainActivity 가 launchMode="singleTop"(plugins/withAndroidLaunchMode — 사진 picker hang 우회)이라
//   커스텀탭이 위에 떠 있는 동안 도착한 리다이렉트 인텐트가 기존 액티비티의 onNewIntent 로 가지 않고
//   MainActivity 새 인스턴스를 띄운다. 그러면 JS 컨텍스트째 재시작되어 oauthSignIn 의
//   openAuthSessionAsync promise 가 통째로 유실되고 → 로그인 성공했는데 로그인 화면으로 되돌아온다.
//   (실패 경로를 탄 게 아니므로 loginError 도 안 뜬다.)
//
// 복구 원리:
//   PKCE code verifier 는 supabase 클라이언트의 storage(=SecureStore)에 영속되므로 앱이 재시작돼도 살아있다.
//   따라서 브라우저 promise 와 무관하게 콜백 URL 의 code 만 확보하면 세션 교환이 가능하다.
//     · 콜드 재시작 → Linking.getInitialURL()  (recoverOAuthSessionFromInitialUrl)
//     · 웜 복귀     → Linking 'url' 이벤트      (subscribeOAuthCallback)
//   두 경로와 기존 openAuthSessionAsync 경로가 같은 code 로 겹칠 수 있어 exchangeOAuthCode 가 1회 교환을 보장한다.
import { AppState } from 'react-native';
import * as Linking from 'expo-linking';

import { supabase } from '@/lib/supabase';

import { traceAuth } from '../authDiagnostics';

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
    // ④ 교환 오류 — "code verifier should be non-empty" 류면 SecureStore 에서 verifier 유실.
    if (error) {
      traceAuth({ line: `교환 실패: ${error.message}` });
      return null;
    }
    const userId = data?.session?.user?.id ?? null;
    if (!userId) traceAuth({ line: '교환 응답에 세션 없음' });
    return userId;
  } catch (err) {
    traceAuth({ line: `교환 예외: ${err instanceof Error ? err.message : String(err)}` });
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
  // 앱이 재시작됐다면 여기에 콜백 URL 이 있어야 한다. null 이면 리다이렉트가 앱까지 오지 않은 것.
  traceAuth({ line: `initialUrl=${url ? url.slice(0, 120) : '없음'}` });
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

  // Android singleTop 실측 경로(2026-08-19):
  //   커스텀탭 리다이렉트가 MainActivity 새 인스턴스를 만들지만 JS 컨텍스트는 프로세스 단위라 살아남는다.
  //   RN 은 'url' 이벤트를 onNewIntent 에서만 발행하므로 새 액티비티(onCreate 인텐트)에서는 이벤트가 없고,
  //   부트스트랩도 이미 끝나 재실행되지 않는다 → 콜백이 인텐트 안에 갇힌다.
  //   getInitialURL()은 현재 액티비티의 인텐트를 읽으므로, 포그라운드 복귀 때 다시 확인하면 회수된다.
  const appStateSubscription = AppState.addEventListener('change', async (state: string) => {
    if (state !== 'active') return;
    const url = await Linking.getInitialURL();
    traceAuth({ line: `복귀 initialUrl=${url ? url.slice(0, 120) : '없음'}` });
    if (!url) return;
    const code = codeFromUrl({ url });
    if (code) await notifyOnce({ code });
  });

  return function unsubscribeOAuthCallback() {
    linkSubscription.remove();
    appStateSubscription.remove();
  };
};
