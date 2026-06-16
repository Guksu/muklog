// src/components/Toast.spec.tsx
// 하단 플로팅 토스트(프리젠테이셔널) — 킷 .mk-toast(index.html:37-42). 렌더 분기·tone·자동 사라짐 타이머 검증.
import React from 'react';
import { act, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { Toast } from './Toast';

describe('Toast', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
  });

  it('visible=false면 아무것도 렌더하지 않는다', () => {
    renderWithTheme(<Toast visible={false} message="담았어요" />);
    expect(screen.queryByText('담았어요')).toBeNull();
  });

  it('visible=true면 메시지를 표시한다', () => {
    renderWithTheme(<Toast visible message="위시리스트에 담았어요 📍" />);
    expect(screen.getByText('위시리스트에 담았어요 📍')).toBeTruthy();
  });

  it('tone="positive"면 ✓ 체크를 앞에 표시한다(킷 .mk-toast.pos)', () => {
    renderWithTheme(<Toast visible tone="positive" message="담았어요" />);
    expect(screen.getByText('✓')).toBeTruthy();
  });

  it('tone="neutral"(기본)이면 ✓를 표시하지 않는다', () => {
    renderWithTheme(<Toast visible message="삭제했어요" />);
    expect(screen.queryByText('✓')).toBeNull();
  });

  it('durationMs 경과 시 onHide를 호출한다(자동 사라짐, 킷 2200ms)', () => {
    const onHide = jest.fn();
    renderWithTheme(<Toast visible message="담았어요" durationMs={2200} onHide={onHide} />);
    expect(onHide).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(2200));
    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it('durationMs 이전에는 onHide를 호출하지 않는다', () => {
    const onHide = jest.fn();
    renderWithTheme(<Toast visible message="담았어요" durationMs={2200} onHide={onHide} />);
    act(() => jest.advanceTimersByTime(2199));
    expect(onHide).not.toHaveBeenCalled();
  });
});
