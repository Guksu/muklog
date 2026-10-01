// src/navigation/useRefreshOnPushTap/useRefreshOnPushTap.spec.ts
// 알림 탭으로 같은 화면의 params.pushTapAt 만 바뀌었을 때 refresh 를 1회 부르는 훅 (join-push plan AC20 · R7).
//   같은 로그 화면이 맨 위에 있으면 React Navigation 7 은 params 만 바꾸고 포커스 이벤트를 내지 않는다 — 이 훅이 그 틈을 메운다.
//   seam = 훅 입력(roomId·pushTapAt·refresh)의 렌더 순서 → refresh 호출 횟수.
import { renderHook } from '@testing-library/react-native';

import { useRefreshOnPushTap } from './useRefreshOnPushTap';

type Props = { roomId: string; pushTapAt: number | undefined; refresh: () => void };

const setup = ({ initial }: { initial: Props }) =>
  renderHook((props: Props) => useRefreshOnPushTap(props), { initialProps: initial });

describe('useRefreshOnPushTap', () => {
  it('마운트 값으로는 부르지 않는다(pushTapAt 없음 · 있음 모두 — 마운트 조회와 중복 방지)', () => {
    const refresh = jest.fn();
    setup({ initial: { roomId: 'r1', pushTapAt: undefined, refresh } });
    setup({ initial: { roomId: 'r1', pushTapAt: 100, refresh } });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('목록에서 연 화면(pushTapAt 없음)에 같은 로그 알림 탭이 오면 1회 부른다', () => {
    const refresh = jest.fn();
    const { rerender } = setup({ initial: { roomId: 'r1', pushTapAt: undefined, refresh } });
    rerender({ roomId: 'r1', pushTapAt: 100, refresh });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('같은 roomId 에서 pushTapAt 이 새 값이면 1회 · 같은 값으로 다시 렌더하면 0 · 또 새 값이면 1회 더', () => {
    const refresh = jest.fn();
    const { rerender } = setup({ initial: { roomId: 'r1', pushTapAt: 100, refresh } });
    rerender({ roomId: 'r1', pushTapAt: 200, refresh });
    expect(refresh).toHaveBeenCalledTimes(1);
    rerender({ roomId: 'r1', pushTapAt: 200, refresh });
    expect(refresh).toHaveBeenCalledTimes(1);
    rerender({ roomId: 'r1', pushTapAt: 300, refresh });
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('roomId 와 pushTapAt 이 함께 바뀌면 부르지 않는다(roomId 에 묶인 훅들이 이미 다시 불러온다)', () => {
    const refresh = jest.fn();
    const { rerender } = setup({ initial: { roomId: 'r1', pushTapAt: 100, refresh } });
    rerender({ roomId: 'r2', pushTapAt: 200, refresh });
    expect(refresh).not.toHaveBeenCalled();
    // 바뀐 로그에서 다시 알림 탭 → 1회.
    rerender({ roomId: 'r2', pushTapAt: 300, refresh });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('새 값이 undefined 면 부르지 않는다', () => {
    const refresh = jest.fn();
    const { rerender } = setup({ initial: { roomId: 'r1', pushTapAt: 100, refresh } });
    rerender({ roomId: 'r1', pushTapAt: undefined, refresh });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('refresh 참조가 렌더마다 바뀌어도 가장 최근 refresh 를 부른다', () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = setup({ initial: { roomId: 'r1', pushTapAt: 100, refresh: first } });
    rerender({ roomId: 'r1', pushTapAt: 200, refresh: second });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('refresh 만 바뀐 렌더는 부르지 않는다(pushTapAt 변화만 신호)', () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = setup({ initial: { roomId: 'r1', pushTapAt: 100, refresh: first } });
    rerender({ roomId: 'r1', pushTapAt: 100, refresh: second });
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
  });
});
