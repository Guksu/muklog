// src/components/MkSwitch.spec.tsx
// iOS 스타일 토글 스위치(공용 프리미티브) — 킷 mk-extra.jsx:9-19 재현. 트랙 색·노브·press·a11y·disabled 검증.
//   비주얼 수치(51×31 트랙·27 노브·left 2↔22·.22s 슬라이드)는 디바이스 스모크 영역(렌더 픽셀) — 단위는 계약·동작.
import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';
import { themes } from '@/theme';

import { MkSwitch } from './MkSwitch';

describe('MkSwitch', () => {
  // 노브 슬라이드 Animated.timing 타이머를 제어해 act() 경고를 막는다(Toast.spec 패턴).
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
  });

  it('on(value=true)이면 트랙 배경이 primary 토큰이다(킷 --mk-accent)', () => {
    renderWithTheme(<MkSwitch value onValueChange={jest.fn()} />);
    const track = StyleSheet.flatten(screen.getByTestId('mk-switch').props.style);
    expect(track.backgroundColor).toBe(themes.light.color.primary);
  });

  it('off(value=false)이면 트랙 배경이 lineStrong 토큰이다(킷 --line-strong)', () => {
    renderWithTheme(<MkSwitch value={false} onValueChange={jest.fn()} />);
    const track = StyleSheet.flatten(screen.getByTestId('mk-switch').props.style);
    expect(track.backgroundColor).toBe(themes.light.color.lineStrong);
  });

  it('탭하면 onValueChange(!value)를 호출한다 — off→true', () => {
    const onValueChange = jest.fn();
    renderWithTheme(<MkSwitch value={false} onValueChange={onValueChange} />);
    fireEvent.press(screen.getByTestId('mk-switch'));
    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it('탭하면 onValueChange(!value)를 호출한다 — on→false', () => {
    const onValueChange = jest.fn();
    renderWithTheme(<MkSwitch value onValueChange={onValueChange} />);
    fireEvent.press(screen.getByTestId('mk-switch'));
    expect(onValueChange).toHaveBeenCalledWith(false);
  });

  it('disabled면 탭해도 onValueChange를 호출하지 않는다', () => {
    const onValueChange = jest.fn();
    renderWithTheme(<MkSwitch value={false} disabled onValueChange={onValueChange} />);
    fireEvent.press(screen.getByTestId('mk-switch'));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('accessibilityRole="switch"이고 accessibilityState.checked가 value와 같다', () => {
    renderWithTheme(<MkSwitch value onValueChange={jest.fn()} />);
    const node = screen.getByTestId('mk-switch');
    expect(node.props.accessibilityRole).toBe('switch');
    expect(node.props.accessibilityState.checked).toBe(true);
  });

  it('disabled면 accessibilityState.disabled가 true다', () => {
    renderWithTheme(<MkSwitch value={false} disabled onValueChange={jest.fn()} />);
    expect(screen.getByTestId('mk-switch').props.accessibilityState.disabled).toBe(true);
  });

  it('accessibilityLabel을 전달하면 라벨로 조회된다', () => {
    renderWithTheme(<MkSwitch value onValueChange={jest.fn()} accessibilityLabel="새 먹로그 알림" />);
    expect(screen.getByLabelText('새 먹로그 알림')).toBeTruthy();
  });

  it('노브 배경은 switchKnob 토큰(흰색)이다(킷 #fff)', () => {
    renderWithTheme(<MkSwitch value onValueChange={jest.fn()} />);
    const knob = StyleSheet.flatten(screen.getByTestId('mk-switch-knob').props.style);
    expect(knob.backgroundColor).toBe(themes.light.color.switchKnob);
  });
});
