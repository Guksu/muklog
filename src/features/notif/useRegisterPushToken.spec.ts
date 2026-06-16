// src/features/notif/useRegisterPushToken.spec.ts
// 디바이스 토큰 등록 훅 + 로그아웃 폐기(T3·T6) — expo-notifications/expo-device/expo-constants/supabase 모킹.
//   외부 SDK·DB는 단위 대상 아님 → 호출 시그니처·횟수·페이로드·best-effort(throw 없음)만 검증.
//   ⚠️ expo 네이티브 모듈은 팩토리 내부 jest.fn 정의 + named import + requireMock 제어로 모킹한다
//      (import * as 네임스페이스 interop이 jest에서 깨지고, 외부 변수 참조 팩토리는 타이밍에 취약).
import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
}));
jest.mock('expo-device', () => ({ isDevice: true, deviceName: 'iPhone 15' }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'proj-1' } } } },
}));

// supabase 모킹: from().upsert / from().delete().eq (AuthProvider.spec 패턴 — 외부 변수 사전 선언).
const mockFrom = jest.fn();
const mockUpsert = jest.fn();
const mockDelete = jest.fn();
const mockEq = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...a: unknown[]) => {
      mockFrom(...a);
      return {
        upsert: (...u: unknown[]) => mockUpsert(...u),
        delete: (...d: unknown[]) => {
          mockDelete(...d);
          return { eq: (...e: unknown[]) => mockEq(...e) };
        },
      };
    },
  },
}));

import { unregisterDeviceToken, useRegisterPushToken } from './useRegisterPushToken';

const notif = jest.requireMock('expo-notifications') as {
  getPermissionsAsync: jest.Mock;
  requestPermissionsAsync: jest.Mock;
  getExpoPushTokenAsync: jest.Mock;
};
const device = jest.requireMock('expo-device') as { isDevice: boolean; deviceName: string | null };

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  device.isDevice = true;
  device.deviceName = 'iPhone 15';
  notif.getPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: true });
  notif.requestPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: true });
  notif.getExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[xyz]' });
  mockUpsert.mockResolvedValue({ error: null });
  mockEq.mockResolvedValue({ error: null });
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  (console.warn as jest.Mock).mockRestore();
});

describe('useRegisterPushToken — 등록(T3)', () => {
  it('AC4 정상: 실기기+granted → 토큰 1회 취득 후 §3.3 페이로드 + onConflict로 upsert 1회', async () => {
    renderHook(() => useRegisterPushToken({ userId: 'u1' }));
    await waitFor(() => expect(mockUpsert).toHaveBeenCalledTimes(1));

    expect(notif.getExpoPushTokenAsync).toHaveBeenCalledTimes(1);
    expect(notif.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'proj-1' });
    expect(mockFrom).toHaveBeenCalledWith('device_tokens');
    expect(mockUpsert).toHaveBeenCalledWith(
      {
        user_id: 'u1',
        expo_push_token: 'ExponentPushToken[xyz]',
        platform: 'ios',
        device_name: 'iPhone 15',
        updated_at: expect.any(String),
      },
      { onConflict: 'expo_push_token' },
    );
  });

  it('AC4-b: undetermined+canAskAgain → requestPermissions 후 granted면 토큰 취득', async () => {
    notif.getPermissionsAsync.mockResolvedValue({ status: 'undetermined', canAskAgain: true });
    renderHook(() => useRegisterPushToken({ userId: 'u1' }));
    await waitFor(() => expect(mockUpsert).toHaveBeenCalledTimes(1));
    expect(notif.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('AC5 권한 거부: denied → 토큰 취득·upsert 미호출, throw 없음', async () => {
    notif.getPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: false });
    renderHook(() => useRegisterPushToken({ userId: 'u1' }));
    await flush();
    expect(notif.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(notif.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('AC6 시뮬레이터: isDevice=false → 권한 요청·토큰·upsert 미호출', async () => {
    device.isDevice = false;
    renderHook(() => useRegisterPushToken({ userId: 'u1' }));
    await flush();
    expect(notif.getPermissionsAsync).not.toHaveBeenCalled();
    expect(notif.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('AC7 멱등: 동일 userId 리렌더 시 upsert가 중복 호출되지 않는다', async () => {
    const { rerender } = renderHook(({ userId }) => useRegisterPushToken({ userId }), {
      initialProps: { userId: 'u1' },
    });
    await waitFor(() => expect(mockUpsert).toHaveBeenCalledTimes(1));
    rerender({ userId: 'u1' });
    rerender({ userId: 'u1' });
    await flush();
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(notif.getExpoPushTokenAsync).toHaveBeenCalledTimes(1);
  });

  it('AC8 네트워크 실패: upsert가 error 반환 → warn, throw 없음', async () => {
    mockUpsert.mockResolvedValue({ error: new Error('network') });
    renderHook(() => useRegisterPushToken({ userId: 'u1' }));
    await waitFor(() => expect(console.warn).toHaveBeenCalled());
  });

  it('AC8-b: upsert가 throw해도 흡수(warn)한다', async () => {
    mockUpsert.mockRejectedValue(new Error('boom'));
    renderHook(() => useRegisterPushToken({ userId: 'u1' }));
    await waitFor(() => expect(console.warn).toHaveBeenCalled());
  });

  it('AC9 userId 없음: 빈 userId → 아무 SDK·upsert 미호출', async () => {
    renderHook(() => useRegisterPushToken({ userId: '' }));
    await flush();
    expect(notif.getPermissionsAsync).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('로그아웃 후 재로그인(userId ""→"u1") 시 재등록한다', async () => {
    const { rerender } = renderHook(({ userId }) => useRegisterPushToken({ userId }), {
      initialProps: { userId: 'u1' },
    });
    await waitFor(() => expect(mockUpsert).toHaveBeenCalledTimes(1));
    rerender({ userId: '' });
    await flush();
    rerender({ userId: 'u1' });
    await waitFor(() => expect(mockUpsert).toHaveBeenCalledTimes(2));
  });
});

describe('unregisterDeviceToken — 로그아웃 폐기(T6)', () => {
  it('AC14 정상: granted+토큰 → 해당 expo_push_token 행 delete', async () => {
    await unregisterDeviceToken({ userId: 'u1' });
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockEq).toHaveBeenCalledWith('expo_push_token', 'ExponentPushToken[xyz]');
  });

  it('권한 요청을 띄우지 않는다(로그아웃 시 다이얼로그 금지): undetermined → delete 미호출', async () => {
    notif.getPermissionsAsync.mockResolvedValue({ status: 'undetermined', canAskAgain: true });
    await unregisterDeviceToken({ userId: 'u1' });
    expect(notif.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('시뮬레이터(isDevice=false) → delete 미호출, throw 없음', async () => {
    device.isDevice = false;
    await expect(unregisterDeviceToken({ userId: 'u1' })).resolves.toBeUndefined();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('delete가 error 반환 → warn, throw 없음(로그아웃 차단 0)', async () => {
    mockEq.mockResolvedValue({ error: new Error('offline') });
    await expect(unregisterDeviceToken({ userId: 'u1' })).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalled();
  });

  it('빈 userId → 아무 동작 안 함', async () => {
    await unregisterDeviceToken({ userId: '' });
    expect(notif.getPermissionsAsync).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });
});

describe('네이티브 모듈 미탑재 안전성(Dev Client 재빌드 전 크래시 방지)', () => {
  // 회귀: expo-device/expo-notifications 네이티브 모듈이 없으면(재빌드 전) SDK 접근이 throw.
  //   등록/폐기 경로가 이를 흡수해 앱을 죽이지 않고 조용히 skip해야 한다(best-effort).
  it('SDK 접근이 throw해도 등록/폐기는 throw 없이 skip하고 DB 호출을 하지 않는다', async () => {
    // isDevice 접근 시 "Cannot find native module 'ExpoDevice'" 흉내(throwing getter).
    Object.defineProperty(device, 'isDevice', {
      configurable: true,
      get() {
        throw new Error("Cannot find native module 'ExpoDevice'");
      },
    });

    // 등록 경로(authenticated 진입) — 예외 흡수, upsert 미호출.
    renderHook(() => useRegisterPushToken({ userId: 'u1' }));
    await flush();
    expect(mockUpsert).not.toHaveBeenCalled();

    // 폐기 경로(로그아웃) — throw 없이 resolve, delete 미호출.
    await expect(unregisterDeviceToken({ userId: 'u1' })).resolves.toBeUndefined();
    expect(mockDelete).not.toHaveBeenCalled();

    // 정리: 다음 테스트의 beforeEach 할당(device.isDevice = true)이 가능하도록 data 속성으로 복원.
    Object.defineProperty(device, 'isDevice', { configurable: true, writable: true, value: true });
  });
});
