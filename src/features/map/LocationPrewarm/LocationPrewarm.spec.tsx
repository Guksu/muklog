// src/features/map/LocationPrewarm/LocationPrewarm.spec.tsx
// 위치 선취득 프리워머 단위 테스트 (map-initial-location plan §3.3·§5-1 T3).
//   deferred 전 0회 / 후 정확히 1회 / 리렌더에도 1회 / enabled=false면 0회 / 렌더 산출물 null(UI 영향 0).
import React from 'react';
import { render } from '@testing-library/react-native';

// useDeferredFlag 모킹 — 기본 즉시 true. 지연값(delayMs) 인자도 캡처해 400ms 계약을 검증한다.
const mockDeferredFlag = jest.fn<boolean, [unknown]>(() => true);
jest.mock('@/features/map/useDeferredFlag', () => ({
  useDeferredFlag: (args: unknown) => mockDeferredFlag(args),
}));

// lastKnownLocation 모듈 모킹 — 워밍 호출 횟수만 본다(권한 게이트·매핑은 모듈 단위 테스트가 검증).
const mockWarm = jest.fn().mockResolvedValue(null);
jest.mock('@/features/map/lastKnownLocation', () => ({
  warmLastKnownLocation: () => mockWarm(),
}));

import { LOCATION_PREWARM_DELAY_MS, LocationPrewarm } from './LocationPrewarm';

beforeEach(() => {
  mockWarm.mockClear();
  mockDeferredFlag.mockReset();
  mockDeferredFlag.mockReturnValue(true);
});

describe('LocationPrewarm', () => {
  it('deferred 전(첫 페인트 전)에는 워밍하지 않는다 — 콜드스타트 비경합', () => {
    mockDeferredFlag.mockReturnValue(false);
    render(<LocationPrewarm />);
    expect(mockWarm).not.toHaveBeenCalled();
  });

  it('deferred 경과 후 정확히 1회 워밍한다', () => {
    render(<LocationPrewarm />);
    expect(mockWarm).toHaveBeenCalledTimes(1);
  });

  it('리렌더가 여러 번 일어나도 워밍은 1회다', () => {
    const { rerender } = render(<LocationPrewarm />);
    rerender(<LocationPrewarm />);
    rerender(<LocationPrewarm />);
    expect(mockWarm).toHaveBeenCalledTimes(1);
  });

  it('deferred가 false→true로 전환될 때만 1회 워밍한다', () => {
    mockDeferredFlag.mockReturnValue(false);
    const { rerender } = render(<LocationPrewarm />);
    expect(mockWarm).not.toHaveBeenCalled();

    mockDeferredFlag.mockReturnValue(true);
    rerender(<LocationPrewarm />);
    rerender(<LocationPrewarm />);
    expect(mockWarm).toHaveBeenCalledTimes(1);
  });

  it('enabled=false면 워밍하지 않는다(킬 스위치)', () => {
    render(<LocationPrewarm enabled={false} />);
    expect(mockWarm).not.toHaveBeenCalled();
  });

  it('enabled 기본값(미지정)은 true다', () => {
    render(<LocationPrewarm />);
    expect(mockWarm).toHaveBeenCalledTimes(1);
  });

  it('렌더 산출물이 없다(null — 지도 탭/홈 렌더 트리 영향 0)', () => {
    const { toJSON } = render(<LocationPrewarm />);
    expect(toJSON()).toBeNull();
  });

  it('useDeferredFlag에 400ms 지연을 넘긴다(MapPrewarm 1200ms와 프레임 분리 — E15)', () => {
    render(<LocationPrewarm />);
    expect(LOCATION_PREWARM_DELAY_MS).toBe(400);
    expect(mockDeferredFlag).toHaveBeenCalledWith({ delayMs: 400 });
  });
});
