// src/features/auth/errors/errors.spec.ts
// 인증 실패 → 사용자 문구 매핑 명세 (ux-entry-trust §5 T11, U3).
//   원문(영어 SDK 메시지)이 화면에 새는 것을 막는 잠금장치. 어떤 unknown이 와도 throw 없이 한국어 문구를 낸다.
import {
  AUTH_ERROR_MESSAGES,
  AuthErrorToken,
  isNetworkAuthError,
  messageForAuthError,
  messageForAuthFailure,
} from './errors';

const NETWORK_MESSAGE = '네트워크 연결을 확인해 주세요.';
const RETRY_MESSAGE = '잠시 후 다시 시도해 주세요.';

describe('isNetworkAuthError — 네트워크 계열 판정', () => {
  it('supabase-js 재시도 가능 fetch 실패(name 일치)를 네트워크로 본다', () => {
    expect(isNetworkAuthError({ error: { name: 'AuthRetryableFetchError', message: 'boom' } })).toBe(
      true,
    );
  });

  it('RN fetch 실패 메시지를 네트워크로 본다', () => {
    expect(isNetworkAuthError({ error: new TypeError('Network request failed') })).toBe(true);
  });

  it('대소문자를 무시한다', () => {
    expect(isNetworkAuthError({ error: new Error('NETWORK REQUEST FAILED') })).toBe(true);
  });

  it('타임아웃도 네트워크로 본다', () => {
    expect(isNetworkAuthError({ error: new Error('Request timed out') })).toBe(true);
  });

  it('네트워크와 무관한 실패는 false', () => {
    expect(isNetworkAuthError({ error: new Error('invalid claim: missing sub claim') })).toBe(false);
  });

  it('비-Error 입력에도 throw 없이 false', () => {
    expect(isNetworkAuthError({ error: null })).toBe(false);
    expect(isNetworkAuthError({ error: undefined })).toBe(false);
    expect(isNetworkAuthError({ error: 'network request failed' })).toBe(false);
    expect(isNetworkAuthError({ error: 42 })).toBe(false);
    expect(isNetworkAuthError({ error: {} })).toBe(false);
  });
});

describe('messageForAuthFailure — 원문 노출 금지', () => {
  it('네트워크 실패는 기존 NetworkFailed 문구를 재사용한다(같은 원인엔 같은 문구)', () => {
    expect(messageForAuthFailure({ error: new TypeError('Network request failed') })).toBe(
      NETWORK_MESSAGE,
    );
    expect(
      messageForAuthFailure({ error: { name: 'AuthRetryableFetchError', message: 'Failed to fetch' } }),
    ).toBe(NETWORK_MESSAGE);
  });

  it('비네트워크 실패는 BootstrapFailed 문구다', () => {
    expect(messageForAuthFailure({ error: new Error('invalid claim: missing sub claim') })).toBe(
      RETRY_MESSAGE,
    );
  });

  it('비-Error 입력도 throw 없이 문구를 낸다("[object Object]"·undefined 노출 금지)', () => {
    for (const error of [null, undefined, 'boom', 42, {}]) {
      expect(messageForAuthFailure({ error })).toBe(RETRY_MESSAGE);
    }
  });

  it('어떤 입력이든 반환값은 AUTH_ERROR_MESSAGES의 값 집합에 속한다(원문 누출 잠금)', () => {
    const allowed = Object.values(AUTH_ERROR_MESSAGES);
    const inputs: unknown[] = [
      new Error('Network request failed'),
      new Error('AuthApiError: invalid_grant'),
      { name: 'AuthRetryableFetchError' },
      '연결 실패',
      null,
      0,
    ];
    for (const error of inputs) {
      expect(allowed).toContain(messageForAuthFailure({ error }));
    }
  });
});

describe('BootstrapFailed 토큰', () => {
  it('토큰과 메시지가 매핑 테이블에 있다', () => {
    expect(AuthErrorToken.BootstrapFailed).toBe('BootstrapFailed');
    expect(AUTH_ERROR_MESSAGES[AuthErrorToken.BootstrapFailed]).toBe(RETRY_MESSAGE);
  });

  it('기존 토큰 문구는 그대로다(범위 밖 화면 회귀 방지)', () => {
    expect(AUTH_ERROR_MESSAGES[AuthErrorToken.NetworkFailed]).toBe(NETWORK_MESSAGE);
    expect(messageForAuthError({ token: AuthErrorToken.TokenExchangeFailed })).toBe(
      '로그인에 실패했어요. 잠시 후 다시 시도해 주세요.',
    );
    expect(messageForAuthError({ token: AuthErrorToken.GoogleCancelled })).toBeNull();
  });

  it('BootstrapFailed는 취소 토큰이 아니라 문구를 낸다', () => {
    expect(messageForAuthError({ token: AuthErrorToken.BootstrapFailed })).toBe(RETRY_MESSAGE);
  });
});
