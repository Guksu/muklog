// src/features/auth/oauthCallback/oauthCallback.spec.ts
// OAuth 콜백 딥링크 복구 — Android singleTop 회귀(앱 재시작으로 openAuthSessionAsync promise 유실) 대비.
//   expo-linking / supabase를 모킹해 code 추출·교환·중복 방지·구독 경로를 검증한다.

// expo-linking: parse(콜백 URL에서 code 추출) + getInitialURL(콜드 재시작 복구) + addEventListener(웜 복귀).
const mockParse = jest.fn();
const mockGetInitialURL = jest.fn();
const mockAddEventListener = jest.fn();
jest.mock('expo-linking', () => ({
  parse: (...a: unknown[]) => mockParse(...a),
  getInitialURL: (...a: unknown[]) => mockGetInitialURL(...a),
  addEventListener: (...a: unknown[]) => mockAddEventListener(...a),
}));

// react-native AppState: 포그라운드 복귀 감지(Android 새 액티비티 인텐트 회수 경로).
const mockAppStateAdd = jest.fn();
jest.mock('react-native', () => ({
  AppState: { addEventListener: (...a: unknown[]) => mockAppStateAdd(...a) },
}));

// supabase: exchangeCodeForSession(PKCE code → 세션). verifier는 SecureStore에 남아 재시작 후에도 유효.
const mockExchangeCode = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { exchangeCodeForSession: (...a: unknown[]) => mockExchangeCode(...a) } },
}));

import {
  exchangeOAuthCode,
  recoverOAuthSessionFromInitialUrl,
  subscribeOAuthCallback,
} from './oauthCallback';

// code별 1회 교환 메모가 모듈 상태이므로 테스트마다 고유 code를 쓴다(교차 오염 방지).
let codeSeq = 0;
const nextCode = () => `code-${(codeSeq += 1)}`;

beforeEach(() => {
  jest.clearAllMocks();
  mockExchangeCode.mockResolvedValue({ data: { session: { user: { id: 'gid' } } }, error: null });
  mockAddEventListener.mockReturnValue({ remove: jest.fn() });
  mockAppStateAdd.mockReturnValue({ remove: jest.fn() });
  mockGetInitialURL.mockResolvedValue(null);
});

// AppState 'active' 핸들러를 꺼낸다(구독 등록 순서 무관하게 이름으로 찾음).
const takeAppStateHandler = (): ((state: string) => void) => {
  const call = mockAppStateAdd.mock.calls.find(([event]) => event === 'change');
  return call?.[1] as (state: string) => void;
};

describe('exchangeOAuthCode', () => {
  it('code를 교환해 userId를 반환한다', async () => {
    const code = nextCode();
    await expect(exchangeOAuthCode({ code })).resolves.toBe('gid');
    expect(mockExchangeCode).toHaveBeenCalledWith(code);
  });

  it('같은 code로 다시 호출해도 교환은 1회만 수행하고 같은 결과를 준다(중복 교환 방지)', async () => {
    const code = nextCode();
    const [first, second] = await Promise.all([
      exchangeOAuthCode({ code }),
      exchangeOAuthCode({ code }),
    ]);
    expect(mockExchangeCode).toHaveBeenCalledTimes(1);
    expect(first).toBe('gid');
    expect(second).toBe('gid');
  });

  it('교환 실패 시 null을 반환한다', async () => {
    mockExchangeCode.mockResolvedValue({ data: { session: null }, error: { message: 'used' } });
    await expect(exchangeOAuthCode({ code: nextCode() })).resolves.toBeNull();
  });

  it('교환이 throw해도 null로 흡수한다(전체 error 화면 금지)', async () => {
    mockExchangeCode.mockRejectedValue(new Error('network'));
    await expect(exchangeOAuthCode({ code: nextCode() })).resolves.toBeNull();
  });
});

describe('recoverOAuthSessionFromInitialUrl', () => {
  it('초기 URL의 code를 교환해 userId를 반환한다(콜드 재시작 복구)', async () => {
    const code = nextCode();
    mockGetInitialURL.mockResolvedValue(`muklog://auth/callback?code=${code}`);
    mockParse.mockReturnValue({ queryParams: { code } });

    await expect(recoverOAuthSessionFromInitialUrl()).resolves.toBe('gid');
    expect(mockExchangeCode).toHaveBeenCalledWith(code);
  });

  it('초기 URL이 없으면 교환하지 않고 null을 반환한다', async () => {
    mockGetInitialURL.mockResolvedValue(null);
    await expect(recoverOAuthSessionFromInitialUrl()).resolves.toBeNull();
    expect(mockExchangeCode).not.toHaveBeenCalled();
  });

  it('code 없는 딥링크는 교환하지 않는다(OAuth 콜백이 아님)', async () => {
    mockGetInitialURL.mockResolvedValue('muklog://room/abc');
    mockParse.mockReturnValue({ queryParams: { roomId: 'abc' } });

    await expect(recoverOAuthSessionFromInitialUrl()).resolves.toBeNull();
    expect(mockExchangeCode).not.toHaveBeenCalled();
  });

  it('error 리다이렉트(code 없음)도 교환하지 않는다', async () => {
    mockGetInitialURL.mockResolvedValue('muklog://auth/callback?error=access_denied');
    mockParse.mockReturnValue({ queryParams: { error: 'access_denied' } });

    await expect(recoverOAuthSessionFromInitialUrl()).resolves.toBeNull();
    expect(mockExchangeCode).not.toHaveBeenCalled();
  });
});

describe('subscribeOAuthCallback', () => {
  it('url 이벤트의 code를 교환해 onUserId로 통지한다(웜 복귀)', async () => {
    const code = nextCode();
    mockParse.mockReturnValue({ queryParams: { code } });
    const onUserId = jest.fn();

    subscribeOAuthCallback({ onUserId });
    const handler = mockAddEventListener.mock.calls[0][1] as (e: { url: string }) => void;
    expect(mockAddEventListener.mock.calls[0][0]).toBe('url');

    await handler({ url: `muklog://auth/callback?code=${code}` });
    // 핸들러 내부 교환 프라미스 소진 대기.
    await Promise.resolve();
    await Promise.resolve();

    expect(onUserId).toHaveBeenCalledWith({ userId: 'gid' });
  });

  it('code 없는 딥링크는 통지하지 않는다', async () => {
    mockParse.mockReturnValue({ queryParams: {} });
    const onUserId = jest.fn();

    subscribeOAuthCallback({ onUserId });
    const handler = mockAddEventListener.mock.calls[0][1] as (e: { url: string }) => void;
    await handler({ url: 'muklog://room/abc' });
    await Promise.resolve();

    expect(onUserId).not.toHaveBeenCalled();
  });

  it('교환 실패 시 통지하지 않는다', async () => {
    mockParse.mockReturnValue({ queryParams: { code: nextCode() } });
    mockExchangeCode.mockResolvedValue({ data: { session: null }, error: { message: 'used' } });
    const onUserId = jest.fn();

    subscribeOAuthCallback({ onUserId });
    const handler = mockAddEventListener.mock.calls[0][1] as (e: { url: string }) => void;
    await handler({ url: 'muklog://auth/callback?code=x' });
    await Promise.resolve();
    await Promise.resolve();

    expect(onUserId).not.toHaveBeenCalled();
  });

  it('구독 해제는 url·AppState 리스너를 모두 remove 한다', () => {
    const removeUrl = jest.fn();
    const removeAppState = jest.fn();
    mockAddEventListener.mockReturnValue({ remove: removeUrl });
    mockAppStateAdd.mockReturnValue({ remove: removeAppState });

    const unsubscribe = subscribeOAuthCallback({ onUserId: jest.fn() });
    unsubscribe();

    expect(removeUrl).toHaveBeenCalled();
    expect(removeAppState).toHaveBeenCalled();
  });
});

// Android singleTop 실측 경로: 커스텀탭 리다이렉트가 새 MainActivity 인스턴스를 만들지만 JS 컨텍스트는
// 살아남는다. RN은 'url' 이벤트를 onNewIntent 에서만 발행하므로 새 액티비티(onCreate 인텐트)에서는
// 이벤트가 없고, 대신 getInitialURL()이 그 인텐트를 돌려준다 → 포그라운드 복귀 시 재확인해야 한다.
describe('subscribeOAuthCallback — 포그라운드 복귀 재확인', () => {
  it('active 복귀 시 getInitialURL의 code를 교환해 통지한다(url 이벤트 없이)', async () => {
    const code = nextCode();
    mockGetInitialURL.mockResolvedValue(`muklog://auth/callback?code=${code}`);
    mockParse.mockReturnValue({ queryParams: { code } });
    const onUserId = jest.fn();

    subscribeOAuthCallback({ onUserId });
    await takeAppStateHandler()('active');
    await Promise.resolve();
    await Promise.resolve();

    expect(mockExchangeCode).toHaveBeenCalledWith(code);
    expect(onUserId).toHaveBeenCalledWith({ userId: 'gid' });
  });

  it('background 전환에는 아무것도 하지 않는다', async () => {
    mockGetInitialURL.mockResolvedValue('muklog://auth/callback?code=x');
    const onUserId = jest.fn();

    subscribeOAuthCallback({ onUserId });
    await takeAppStateHandler()('background');
    await Promise.resolve();

    expect(mockGetInitialURL).not.toHaveBeenCalled();
    expect(onUserId).not.toHaveBeenCalled();
  });

  it('같은 인텐트로 여러 번 복귀해도 통지는 1회다(로그아웃 후 재인증 방지)', async () => {
    const code = nextCode();
    mockGetInitialURL.mockResolvedValue(`muklog://auth/callback?code=${code}`);
    mockParse.mockReturnValue({ queryParams: { code } });
    const onUserId = jest.fn();

    subscribeOAuthCallback({ onUserId });
    const handler = takeAppStateHandler();
    await handler('active');
    await Promise.resolve();
    await Promise.resolve();
    await handler('active');
    await Promise.resolve();
    await Promise.resolve();

    expect(onUserId).toHaveBeenCalledTimes(1);
  });

  it('초기 URL이 OAuth 콜백이 아니면 통지하지 않는다', async () => {
    mockGetInitialURL.mockResolvedValue('muklog://room/abc');
    mockParse.mockReturnValue({ queryParams: { roomId: 'abc' } });
    const onUserId = jest.fn();

    subscribeOAuthCallback({ onUserId });
    await takeAppStateHandler()('active');
    await Promise.resolve();

    expect(onUserId).not.toHaveBeenCalled();
  });
});
