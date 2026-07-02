// src/features/notif/pushToken.spec.ts
// 푸시 토큰 순수 유틸(T2) — 권한 결정/페이로드 구성/실기기 판정/플랫폼 매핑.
//   외부 SDK 미접촉(순수 함수)이라 단위 테스트 대상. 정상/경계/실패 케이스를 모두 덮는다.
import {
  buildDeviceTokenUpsert,
  isPushCapable,
  PushPermissionDecision,
  resolveDevicePlatform,
  resolvePermissionDecision,
} from './pushToken';

describe('resolvePermissionDecision', () => {
  it('정상: 이미 granted면 granted(재요청 불필요)', () => {
    expect(resolvePermissionDecision({ existingStatus: 'granted', canAskAgain: true })).toBe(
      PushPermissionDecision.Granted,
    );
  });

  it('경계: undetermined & 재요청 가능 → ask', () => {
    expect(resolvePermissionDecision({ existingStatus: 'undetermined', canAskAgain: true })).toBe(
      PushPermissionDecision.Ask,
    );
  });

  it('실패: denied & 재요청 불가 → denied(재요청 안 함)', () => {
    expect(resolvePermissionDecision({ existingStatus: 'denied', canAskAgain: false })).toBe(
      PushPermissionDecision.Denied,
    );
  });

  it('경계: undetermined지만 canAskAgain=false → denied(요청 금지)', () => {
    expect(resolvePermissionDecision({ existingStatus: 'undetermined', canAskAgain: false })).toBe(
      PushPermissionDecision.Denied,
    );
  });
});

describe('buildDeviceTokenUpsert', () => {
  it('정상: 필드가 1:1 매핑되고 platform이 좁혀진다', () => {
    const payload = buildDeviceTokenUpsert({
      userId: 'u1',
      token: 'ExponentPushToken[abc]',
      platform: 'ios',
      deviceName: 'iPhone 15',
      nowIso: '2026-06-17T00:00:00.000Z',
    });
    expect(payload).toEqual({
      user_id: 'u1',
      expo_push_token: 'ExponentPushToken[abc]',
      platform: 'ios',
      device_name: 'iPhone 15',
      updated_at: '2026-06-17T00:00:00.000Z',
    });
  });

  it('경계: deviceName 누락(null) → device_name null', () => {
    const payload = buildDeviceTokenUpsert({
      userId: 'u1',
      token: 'ExponentPushToken[abc]',
      platform: 'android',
      deviceName: null,
      nowIso: '2026-06-17T00:00:00.000Z',
    });
    expect(payload.device_name).toBeNull();
    expect(payload.platform).toBe('android');
  });
});

describe('isPushCapable', () => {
  it('정상: 실기기 → true', () => {
    expect(isPushCapable({ isDevice: true })).toBe(true);
  });

  it('실패: 시뮬레이터/에뮬레이터(isDevice=false) → false(토큰 취득 진입 금지)', () => {
    expect(isPushCapable({ isDevice: false })).toBe(false);
  });
});

describe('resolveDevicePlatform', () => {
  it('정상: ios → ios', () => {
    expect(resolveDevicePlatform({ os: 'ios' })).toBe('ios');
  });

  it('정상: android → android', () => {
    expect(resolveDevicePlatform({ os: 'android' })).toBe('android');
  });

  it('실패: 그 외(web/windows/macos) → null(미지원·skip)', () => {
    expect(resolveDevicePlatform({ os: 'web' })).toBeNull();
    expect(resolveDevicePlatform({ os: 'macos' })).toBeNull();
  });
});
