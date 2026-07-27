// src/features/notif/pendingDeepLink/pendingDeepLink.spec.ts
// 대기 딥링크 큐(모듈 싱글턴) 단위 테스트 (push-receive-ux plan §3.4 · T2 · AC5~AC7).
//   nav 준비 전 도착한 목적지를 1건 보관 → authenticated+ready 시 소비. set/peek/take/비움/덮어쓰기/초기 null.
//   ⚠️ 모듈 싱글턴이므로 각 테스트 시작 시 takePending으로 상태를 비운다(테스트 간 격리).
import { peekPending, setPending, takePending } from './pendingDeepLink';
import type { NotificationTarget } from '../notificationTarget';

const targetA: NotificationTarget = { screen: 'MuklogDetail', params: { muklogId: 'm1' } };
const targetB: NotificationTarget = { screen: 'LogScreen', params: { roomId: 'r1' } };

beforeEach(() => {
  // 싱글턴 상태 리셋(이전 테스트 잔여 제거).
  takePending();
});

describe('pendingDeepLink (T2)', () => {
  it('AC7: 초기 상태 takePending()·peekPending()은 null', () => {
    expect(peekPending()).toBeNull();
    expect(takePending()).toBeNull();
  });

  it('AC5: setPending 후 peekPending은 값 유지(비우지 않음), takePending은 값 반환 후 비움', () => {
    setPending({ target: targetA });
    expect(peekPending()).toEqual(targetA);
    // peek는 비우지 않으므로 재조회도 동일.
    expect(peekPending()).toEqual(targetA);

    expect(takePending()).toEqual(targetA);
    // take는 소비 → 이후 null.
    expect(peekPending()).toBeNull();
    expect(takePending()).toBeNull();
  });

  it('AC6: setPending 2회 → 최신값만 유지(1건 큐, 이전 덮어씀)', () => {
    setPending({ target: targetA });
    setPending({ target: targetB });
    expect(peekPending()).toEqual(targetB);
    expect(takePending()).toEqual(targetB);
    expect(peekPending()).toBeNull();
  });
});
