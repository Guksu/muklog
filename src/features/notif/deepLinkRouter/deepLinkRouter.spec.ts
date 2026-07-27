// src/features/notif/deepLinkRouter/deepLinkRouter.spec.ts
// 딥링크 라우팅 디스패처 단위 테스트 (push-receive-ux plan §3.4 · T3 AC8~AC9 · T5 AC18~AC20).
//   navigateToTarget: ready→navigate / not-ready→대기 큐. consumePendingDeepLink: ready+pending→소비·navigate.
//   navigationRef(SDK ref)만 모킹, pendingDeepLink는 실 싱글턴 사용(디스패처↔큐 실 통합 검증).
import { navigationRef } from '@/navigation/navigationRef';

import { navigateToTarget, consumePendingDeepLink } from './deepLinkRouter';
import { peekPending, takePending } from '../pendingDeepLink';
import type { NotificationTarget } from '../notificationTarget';

jest.mock('@/navigation/navigationRef', () => ({
  navigationRef: { isReady: jest.fn(), navigate: jest.fn() },
}));

const isReadyMock = navigationRef.isReady as jest.Mock;
const navigateMock = navigationRef.navigate as jest.Mock;

const muklogTarget: NotificationTarget = { screen: 'MuklogDetail', params: { muklogId: 'm1' } };
const logTarget: NotificationTarget = { screen: 'LogScreen', params: { roomId: 'r1' } };

beforeEach(() => {
  isReadyMock.mockReset();
  navigateMock.mockReset();
  takePending(); // 싱글턴 큐 리셋.
});

describe('navigateToTarget (T3)', () => {
  it('AC8: ready=true → navigate(screen, params) 1회, 큐 비어있음', () => {
    isReadyMock.mockReturnValue(true);
    navigateToTarget({ target: muklogTarget });
    expect(navigateMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith('MuklogDetail', { muklogId: 'm1' });
    expect(peekPending()).toBeNull();
  });

  it('AC8: LogScreen 목적지도 정확한 라우트명·params로 navigate', () => {
    isReadyMock.mockReturnValue(true);
    navigateToTarget({ target: logTarget });
    expect(navigateMock).toHaveBeenCalledWith('LogScreen', { roomId: 'r1' });
  });

  it('AC9: ready=false → navigate 미호출, 대기 큐에 저장', () => {
    isReadyMock.mockReturnValue(false);
    navigateToTarget({ target: muklogTarget });
    expect(navigateMock).not.toHaveBeenCalled();
    expect(peekPending()).toEqual(muklogTarget);
  });
});

describe('consumePendingDeepLink (T5)', () => {
  it('AC19: ready=true + 대기 존재 → navigate 1회 + 큐 비움', () => {
    isReadyMock.mockReturnValue(false);
    navigateToTarget({ target: muklogTarget }); // 저장
    expect(peekPending()).toEqual(muklogTarget);

    isReadyMock.mockReturnValue(true);
    consumePendingDeepLink();
    expect(navigateMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith('MuklogDetail', { muklogId: 'm1' });
    expect(peekPending()).toBeNull();
  });

  it('AC18/AC20 근거: ready=false면 소비 안 함(큐 유지, navigate 미호출)', () => {
    isReadyMock.mockReturnValue(false);
    navigateToTarget({ target: logTarget });
    consumePendingDeepLink();
    expect(navigateMock).not.toHaveBeenCalled();
    expect(peekPending()).toEqual(logTarget); // 유지.
  });

  it('AC20: 대기 없음 + ready=true → navigate 미호출(no-op)', () => {
    isReadyMock.mockReturnValue(true);
    consumePendingDeepLink();
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
