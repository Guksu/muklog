// src/theme/useReduceMotion/useReduceMotion.spec.ts
// 기기 "동작 줄이기" 구독 훅 — plan §5-1 T2 + qa-logic S1(구독 싱글톤)·S2(껍데기 단언 제거).
//   AccessibilityInfo는 외부 SDK라 모킹 경계(testing-strategy). 값은 앱 전역에서 하나이므로
//   **구독도 하나**여야 한다 — 이 파일이 그 계약을 잠근다.
import { AccessibilityInfo } from 'react-native';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useReduceMotion } from './useReduceMotion';

type ReduceMotionListener = (enabled: boolean) => void;

const mockRemove = jest.fn();
let capturedEventName: string | null = null;
let capturedListener: ReduceMotionListener | null = null;

const mockSubscription = ({ enabled }: { enabled: boolean | Promise<boolean> }) => {
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockReturnValue(enabled instanceof Promise ? enabled : Promise.resolve(enabled));
  jest
    .spyOn(AccessibilityInfo, 'addEventListener')
    .mockImplementation((eventName: string, listener: unknown) => {
      capturedEventName = eventName;
      capturedListener = listener as ReduceMotionListener;
      return { remove: mockRemove } as never;
    });
};

describe('useReduceMotion', () => {
  beforeEach(() => {
    // spyOn은 이미 목인 RN 메서드를 재사용하므로 호출 이력이 파일 전체에 누적된다 — 매 테스트 초기화.
    jest.clearAllMocks();
    capturedEventName = null;
    capturedListener = null;
  });
  // 모듈 스토어는 마지막 소비자가 떠날 때 스스로 정리된다 — RTL 자동 cleanup이 매 테스트 뒤 그 상태를 만든다.
  afterEach(() => jest.restoreAllMocks());

  it('감소 모션이 꺼져 있으면 false를 준다', async () => {
    mockSubscription({ enabled: false });
    const { result } = renderHook(() => useReduceMotion());
    await waitFor(() => expect(result.current).toBe(false));
  });

  it('감소 모션이 켜져 있으면 조회 결과가 도착한 뒤 true가 된다', async () => {
    mockSubscription({ enabled: true });
    const { result } = renderHook(() => useReduceMotion());
    expect(result.current).toBe(false); // 비동기 조회 전 초기값(E2 — 구조적 한계로 허용)
    await waitFor(() => expect(result.current).toBe(true));
  });

  it("'reduceMotionChanged' 이벤트로 값이 갱신된다(앱 실행 중 토글 — E3)", async () => {
    mockSubscription({ enabled: false });
    const { result } = renderHook(() => useReduceMotion());
    await waitFor(() => expect(capturedListener).not.toBeNull());
    expect(capturedEventName).toBe('reduceMotionChanged');
    act(() => capturedListener?.(true));
    expect(result.current).toBe(true);
  });

  it('조회가 실패해도 throw 없이 false를 유지한다(E4)', async () => {
    mockSubscription({ enabled: Promise.reject(new Error('unsupported')) });
    const { result } = renderHook(() => useReduceMotion());
    await waitFor(() => expect(capturedListener).not.toBeNull());
    expect(result.current).toBe(false);
  });

  it('마지막 소비자가 언마운트되면 구독을 해제한다', async () => {
    mockSubscription({ enabled: false });
    const { unmount } = renderHook(() => useReduceMotion());
    await waitFor(() => expect(capturedListener).not.toBeNull());
    unmount();
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });

  // S1 — 화면 하나에 이 훅을 쓰는 컴포넌트가 수십 개 뜬다(리스트의 카드·칩). 값은 기기 설정 하나이므로
  //   네이티브 구독과 브리지 조회도 하나여야 한다.
  it('소비자가 몇 개든 살아 있는 네이티브 구독은 1개뿐이다', async () => {
    mockSubscription({ enabled: false });
    // 살아 있는 구독 수 = 등록 횟수 - 해제 횟수. 소비자 수에 비례하면 안 된다.
    const liveSubscriptions = () =>
      (AccessibilityInfo.addEventListener as unknown as jest.Mock).mock.calls.length -
      mockRemove.mock.calls.length;

    const first = renderHook(() => useReduceMotion());
    const second = renderHook(() => useReduceMotion());
    const third = renderHook(() => useReduceMotion());
    expect(liveSubscriptions()).toBe(1);
    // 브리지 조회도 구독을 여는 시점에만 일어난다(소비자 수와 무관).
    expect((AccessibilityInfo.isReduceMotionEnabled as unknown as jest.Mock).mock.calls.length).toBe(
      (AccessibilityInfo.addEventListener as unknown as jest.Mock).mock.calls.length,
    );

    first.unmount();
    second.unmount();
    expect(liveSubscriptions()).toBe(1); // 아직 소비자가 남아 있다

    third.unmount();
    expect(liveSubscriptions()).toBe(0); // 마지막 소비자가 떠나면 닫힌다
  });

  it('여러 소비자가 같은 값을 공유한다(구독자 한 명이 받은 변경이 전원에게 전파된다)', async () => {
    mockSubscription({ enabled: false });
    const first = renderHook(() => useReduceMotion());
    const second = renderHook(() => useReduceMotion());
    await waitFor(() => expect(capturedListener).not.toBeNull());

    act(() => capturedListener?.(true));
    expect(first.result.current).toBe(true);
    expect(second.result.current).toBe(true);
  });

  // S2 — 옛 단언(`console.error`가 호출되지 않았다)은 React 18에 해당 경고가 없어 아무것도 잠그지 못했다.
  //   언마운트 가드를 **관찰 가능한 계약**으로 바꾼다: 늦게 도착한 조회 결과가 다음 구독에 새어들지 않는다.
  it('언마운트 뒤 도착한 조회 결과는 다음 구독에 새어들지 않는다(E7)', async () => {
    let resolveStaleQuery: ((enabled: boolean) => void) | null = null;
    mockSubscription({
      enabled: new Promise<boolean>((resolve) => {
        resolveStaleQuery = resolve;
      }),
    });
    const { unmount } = renderHook(() => useReduceMotion());
    await waitFor(() => expect(capturedListener).not.toBeNull());
    unmount();

    // 떠난 화면의 조회가 뒤늦게 true로 응답한다.
    await act(async () => {
      resolveStaleQuery?.(true);
    });

    // 다음 화면은 자기 조회 결과만 본다(캐시가 오염되지 않았다).
    mockSubscription({ enabled: false });
    const { result } = renderHook(() => useReduceMotion());
    expect(result.current).toBe(false);
    await waitFor(() => expect(result.current).toBe(false));
  });
});
