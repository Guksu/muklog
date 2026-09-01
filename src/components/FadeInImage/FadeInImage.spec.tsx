// src/components/FadeInImage/FadeInImage.spec.tsx
// 사진 로드 페이드인 — plan §5-1 T5. props 통과 + 이벤트에 대한 최종 렌더 상태만 본다.
//   핵심 계약은 fail-visible이다: 로드에 실패해도 "영원히 투명한 빈칸"이 되면 안 된다(T5-3).
import React from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { MOTION_DURATION } from '@/theme';

import { FadeInImage } from './FadeInImage';

const PHOTO_URI = 'https://example.com/muklog.jpg';

const imageOpacity = () =>
  (StyleSheet.flatten(screen.getByTestId('photo').props.style) as { opacity: number }).opacity;

const settle = () => {
  act(() => jest.advanceTimersByTime(MOTION_DURATION.photoFade + 50));
};

describe('FadeInImage', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('Image props를 그대로 통과시킨다', () => {
    renderWithTheme(
      <FadeInImage
        testID="photo"
        source={{ uri: PHOTO_URI }}
        accessibilityLabel="먹로그 사진"
        resizeMode="cover"
        style={{ width: 100, height: 62 }}
      />,
    );
    const image = screen.getByTestId('photo');
    expect(image.props.source).toEqual({ uri: PHOTO_URI });
    expect(image.props.accessibilityLabel).toBe('먹로그 사진');
    expect(image.props.resizeMode).toBe('cover');
    const flat = StyleSheet.flatten(image.props.style) as Record<string, unknown>;
    expect(flat.width).toBe(100);
    expect(flat.height).toBe(62);
  });

  it('load 이벤트 후 소비처 onLoad를 호출하고 최종 불투명도가 1이 된다', () => {
    const onLoad = jest.fn();
    renderWithTheme(
      <FadeInImage testID="photo" source={{ uri: PHOTO_URI }} onLoad={onLoad} />,
    );
    fireEvent(screen.getByTestId('photo'), 'load');
    expect(onLoad).toHaveBeenCalledTimes(1);
    settle();
    expect(imageOpacity()).toBe(1);
  });

  it('error 이벤트에서도 결국 보인다(fail-visible) — 소비처 onError도 호출한다', () => {
    const onError = jest.fn();
    renderWithTheme(
      <FadeInImage testID="photo" source={{ uri: PHOTO_URI }} onError={onError} />,
    );
    fireEvent(screen.getByTestId('photo'), 'error');
    expect(onError).toHaveBeenCalledTimes(1);
    settle();
    expect(imageOpacity()).toBe(1);
  });

  it('load가 두 번 와도 상태가 흔들리지 않는다', () => {
    renderWithTheme(<FadeInImage testID="photo" source={{ uri: PHOTO_URI }} />);
    fireEvent(screen.getByTestId('photo'), 'load');
    settle();
    fireEvent(screen.getByTestId('photo'), 'load');
    settle();
    expect(imageOpacity()).toBe(1);
  });

  it('이벤트 전에도 Image가 렌더되고 레이아웃 스타일이 적용된다', () => {
    renderWithTheme(
      <FadeInImage testID="photo" source={{ uri: PHOTO_URI }} style={{ aspectRatio: 16 / 10 }} />,
    );
    const flat = StyleSheet.flatten(screen.getByTestId('photo').props.style) as Record<
      string,
      unknown
    >;
    expect(flat.aspectRatio).toBeCloseTo(1.6, 5);
  });

  // qa-logic S2: 옛 단언(`console.error` 미호출)은 React 18.3.1에 "언마운트 후 setState" 경고가 아예 없어
  //   아무것도 잠그지 못했고, 무관한 act 경고에 걸려 거짓 실패까지 낼 수 있었다.
  //   관찰 가능한 것(예외 없음 · 트리에서 사라짐)만 단언한다. `mountedRef` 가드는 다른 렌더러·React 19를 위한
  //   방어 코드로 **유지**하되, 이 테스트가 그 가드의 회귀 가드는 아니라는 사실을 여기 적어 둔다.
  it('언마운트 후 페이드가 끝나는 시점을 지나도 예외 없이 정리된다(E7 스모크)', () => {
    const view = renderWithTheme(<FadeInImage testID="photo" source={{ uri: PHOTO_URI }} />);
    fireEvent(screen.getByTestId('photo'), 'load');
    view.unmount();
    expect(() => settle()).not.toThrow();
    expect(view.toJSON()).toBeNull(); // 트리에 남은 것이 없다
  });
});

describe('FadeInImage — 감소 모션', () => {
  afterEach(() => jest.restoreAllMocks());

  it('감소 모션에서도 페이드는 유지되고 결국 보인다(크로스페이드는 권장 대체)', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(Promise.resolve(true));
    renderWithTheme(<FadeInImage testID="photo" source={{ uri: PHOTO_URI }} />);
    fireEvent(screen.getByTestId('photo'), 'load');
    await waitFor(() => expect(imageOpacity()).toBe(1));
  });
});
