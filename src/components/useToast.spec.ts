// src/components/useToast.spec.ts
// 토스트 표시 상태 훅 — show/hide 상태 전이(프리젠테이셔널 state). 데이터 없음.
import { act, renderHook } from '@testing-library/react-native';

import { useToast } from './useToast';

describe('useToast', () => {
  it('초기 상태는 숨김(visible=false)이다', () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toast.visible).toBe(false);
  });

  it('show({ message })로 토스트를 표시한다(기본 tone neutral)', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.show({ message: '위시리스트에 담았어요 📍' }));
    expect(result.current.toast).toEqual({
      visible: true,
      message: '위시리스트에 담았어요 📍',
      tone: 'neutral',
    });
  });

  it('show에 tone을 주면 반영한다', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.show({ message: '담았어요', tone: 'positive' }));
    expect(result.current.toast.tone).toBe('positive');
  });

  it('hide()로 숨긴다(visible=false)', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.show({ message: '담았어요', tone: 'positive' }));
    act(() => result.current.hide());
    expect(result.current.toast.visible).toBe(false);
  });
});
