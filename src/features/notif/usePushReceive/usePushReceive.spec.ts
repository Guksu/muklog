// src/features/notif/usePushReceive/usePushReceive.spec.ts
// 푸시 수신 훅 단위 테스트 (push-receive-ux plan §5 T4 · AC11~AC17).
//   expo-notifications/expo-modules-core 모킹(S1 requireMock/probe 패턴). deepLinkRouter.navigateToTarget 모킹.
//   외부 SDK 동작은 검증 대상 아님 — 우리 코드의 호출/매핑/라우팅/언마운트/미탑재 안전만 본다.
import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(),
}));
// 네이티브 가용성 probe — 기본 탑재됨({}≠null). 미탑재 케이스(AC17)는 테스트에서 null로 오버라이드.
jest.mock('expo-modules-core', () => ({ requireOptionalNativeModule: jest.fn(() => ({})) }));
// 라우팅 디스패처는 별도 유닛에서 검증 → 여기선 호출/인자만 관찰.
jest.mock('../deepLinkRouter', () => ({ navigateToTarget: jest.fn() }));

import { usePushReceive } from './usePushReceive';
import { navigateToTarget } from '../deepLinkRouter';

const notif = jest.requireMock('expo-notifications') as {
  setNotificationHandler: jest.Mock;
  addNotificationResponseReceivedListener: jest.Mock;
  getLastNotificationResponseAsync: jest.Mock;
};
const modulesCore = jest.requireMock('expo-modules-core') as {
  requireOptionalNativeModule: jest.Mock;
};
const navigateMock = navigateToTarget as jest.Mock;

const responseWith = ({ data }: { data: unknown }) => ({
  notification: { request: { content: { data } } },
});

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

beforeEach(() => {
  notif.setNotificationHandler.mockReset();
  notif.addNotificationResponseReceivedListener.mockReset();
  notif.addNotificationResponseReceivedListener.mockReturnValue({ remove: jest.fn() });
  notif.getLastNotificationResponseAsync.mockReset();
  notif.getLastNotificationResponseAsync.mockResolvedValue(null); // 기본 콜드스타트 없음.
  navigateMock.mockReset();
  modulesCore.requireOptionalNativeModule.mockReset();
  modulesCore.requireOptionalNativeModule.mockReturnValue({}); // 기본 탑재.
});

describe('usePushReceive (T4)', () => {
  it('AC11: 마운트 시 setNotificationHandler 1회 + 핸들러가 배너 노출 반환(shouldSetBadge=false)', async () => {
    renderHook(() => usePushReceive());
    await flush();
    expect(notif.setNotificationHandler).toHaveBeenCalledTimes(1);

    const handler = notif.setNotificationHandler.mock.calls[0][0] as {
      handleNotification: () => Promise<Record<string, unknown>>;
    };
    const behavior = await handler.handleNotification();
    expect(behavior.shouldShowAlert).toBe(true); // 배너 노출.
    expect(behavior.shouldSetBadge).toBe(false); // 뱃지 OUT(§3.5).
  });

  it('AC12: 백그라운드 탭(muklogId) → navigateToTarget(MuklogDetail)', async () => {
    renderHook(() => usePushReceive());
    await flush();
    const listener = notif.addNotificationResponseReceivedListener.mock.calls[0][0] as (
      r: unknown,
    ) => void;
    act(() => listener(responseWith({ data: { muklogId: 'm1', roomId: 'r1' } })));
    expect(navigateMock).toHaveBeenCalledWith({
      target: { screen: 'MuklogDetail', params: { muklogId: 'm1' } },
    });
  });

  it('AC12: 백그라운드 탭(muklogId 빈값) → LogScreen 폴백', async () => {
    renderHook(() => usePushReceive());
    await flush();
    const listener = notif.addNotificationResponseReceivedListener.mock.calls[0][0] as (
      r: unknown,
    ) => void;
    act(() => listener(responseWith({ data: { roomId: 'r1', muklogId: '' } })));
    expect(navigateMock).toHaveBeenCalledWith({
      target: { screen: 'LogScreen', params: { roomId: 'r1' } },
    });
  });

  it('AC13: 콜드스타트 응답 있으면 동일 라우팅', async () => {
    notif.getLastNotificationResponseAsync.mockResolvedValue(
      responseWith({ data: { muklogId: 'm2' } }),
    );
    renderHook(() => usePushReceive());
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith({
        target: { screen: 'MuklogDetail', params: { muklogId: 'm2' } },
      }),
    );
  });

  it('AC13: 콜드스타트 응답 null → no-op(navigate 미호출)', async () => {
    notif.getLastNotificationResponseAsync.mockResolvedValue(null);
    renderHook(() => usePushReceive());
    await flush();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('AC14: 판정 불가(data에 id 없음) → navigate 미호출', async () => {
    renderHook(() => usePushReceive());
    await flush();
    const listener = notif.addNotificationResponseReceivedListener.mock.calls[0][0] as (
      r: unknown,
    ) => void;
    act(() => listener(responseWith({ data: {} })));
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('AC15: 언마운트 시 리스너 remove 호출(누수 방지)', async () => {
    const remove = jest.fn();
    notif.addNotificationResponseReceivedListener.mockReturnValue({ remove });
    const { unmount } = renderHook(() => usePushReceive());
    await flush();
    unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('AC16: 단일 마운트 내 setNotificationHandler·리스너 등록은 1회씩(중복 폭주 없음)', async () => {
    const { rerender } = renderHook(() => usePushReceive());
    await flush();
    rerender({});
    await flush();
    expect(notif.setNotificationHandler).toHaveBeenCalledTimes(1);
    expect(notif.addNotificationResponseReceivedListener).toHaveBeenCalledTimes(1);
    expect(notif.getLastNotificationResponseAsync).toHaveBeenCalledTimes(1);
  });

  it('AC17: 네이티브 미탑재(probe null) → SDK 미접촉·throw 0', async () => {
    modulesCore.requireOptionalNativeModule.mockReturnValue(null);
    expect(() => renderHook(() => usePushReceive())).not.toThrow();
    await flush();
    expect(notif.setNotificationHandler).not.toHaveBeenCalled();
    expect(notif.addNotificationResponseReceivedListener).not.toHaveBeenCalled();
    expect(notif.getLastNotificationResponseAsync).not.toHaveBeenCalled();
  });
});
