import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { State, type PanGesture, type PinchGesture } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { renderWithTheme } from '@/test/renderWithTheme';
import { PhotoViewer } from './PhotoViewer';

const renderViewer = async () => {
  renderWithTheme(<PhotoViewer visible photos={[{ uri: 'a', orderIndex: 0 }, { uri: 'b', orderIndex: 3 }]} initialIndex={0} placeName="보나" onClose={jest.fn()} />);
  fireEvent(screen.getByTestId('viewer-viewport'), 'layout', { nativeEvent: { layout: { width: 300, height: 600 } } });
  fireEvent(screen.getByTestId('photo-viewer-photo'), 'load', { nativeEvent: { source: { width: 600, height: 1200 } } });
  await waitFor(() => expect(getByGestureTestId('photo-viewer-pinch').config.enabled).toBe(true));
};
const flush = async () => { await act(async () => { await new Promise<void>((resolve) => setTimeout(resolve, 300)); }); };
const drag = ({ cancelled = false }: { cancelled?: boolean } = {}) => act(() => fireGestureHandler<PanGesture>(getByGestureTestId('photo-viewer-pan'), [
  { state: State.BEGAN, numberOfPointers: 1, translationX: 0, translationY: 0 },
  { state: State.ACTIVE, numberOfPointers: 1, translationX: -100, translationY: 0 },
  { state: cancelled ? State.CANCELLED : State.END, numberOfPointers: 1, translationX: -100, translationY: 0 },
]));

describe('사진 뷰어 제스처 계약', () => {
  it('1배에서는 좌측 swipe로 다음 사진으로 간다', async () => {
    await renderViewer(); drag(); await flush();
    expect(screen.getByText('2 / 2')).toBeTruthy();
  });
  it('취소된 swipe는 이동하지 않는다', async () => {
    await renderViewer(); drag({ cancelled: true }); await flush();
    expect(screen.getByText('1 / 2')).toBeTruthy();
  });
  it('확대 후 swipe는 사진 내부 이동만 하고 회전 시 1배로 복귀한다', async () => {
    await renderViewer(); fireEvent.press(screen.getByLabelText('확대')); drag(); await flush();
    expect(screen.getByText('1 / 2')).toBeTruthy();
    expect(screen.getByText('2배')).toBeTruthy();
    fireEvent(screen.getByTestId('viewer-viewport'), 'layout', { nativeEvent: { layout: { width: 600, height: 300 } } });
    expect(screen.getByText('1배')).toBeTruthy();
  });
  it.each(['rotation', 'error'])('이동 애니메이션 중단 후 다시 이동할 수 있다: %s', async (cause) => {
    await renderViewer();
    fireEvent.press(screen.getByLabelText('다음 사진'));
    if (cause === 'rotation') fireEvent(screen.getByTestId('viewer-viewport'), 'layout', { nativeEvent: { layout: { width: 600, height: 300 } } });
    else fireEvent(screen.getByTestId('photo-viewer-photo'), 'error');
    await flush();
    expect(screen.getByText('1 / 2')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('다음 사진'));
    await flush();
    expect(screen.getByText('2 / 2')).toBeTruthy();
  });
  it('핀치 배율은 손을 떼도 유지하며 3배를 넘지 않는다', async () => {
    await renderViewer();
    act(() => fireGestureHandler<PinchGesture>(getByGestureTestId('photo-viewer-pinch'), [
      { state: State.BEGAN, scale: 1, numberOfPointers: 2, focalX: 150, focalY: 300 },
      { state: State.ACTIVE, scale: 1, numberOfPointers: 2, focalX: 150, focalY: 300 },
      { state: State.ACTIVE, scale: 4, numberOfPointers: 2, focalX: 150, focalY: 300 },
      { state: State.END, scale: 4, numberOfPointers: 2, focalX: 150, focalY: 300 },
    ]));
    await flush();
    expect(screen.getByText('3배')).toBeTruthy();
    expect(screen.getByLabelText('확대').props.accessibilityState.disabled).toBe(true);
  });
  it('핀치 도중 포인터 수가 바뀌면 기준 배율을 다시 잡는다', async () => {
    await renderViewer();
    act(() => fireGestureHandler<PinchGesture>(getByGestureTestId('photo-viewer-pinch'), [
      { state: State.BEGAN, scale: 1, numberOfPointers: 2, focalX: 150, focalY: 300 },
      { state: State.ACTIVE, scale: 1, numberOfPointers: 2, focalX: 150, focalY: 300 },
      { state: State.ACTIVE, scale: 2, numberOfPointers: 2, focalX: 150, focalY: 300 },
      { state: State.ACTIVE, scale: 3, numberOfPointers: 3, focalX: 220, focalY: 300 },
      { state: State.END, scale: 3, numberOfPointers: 3, focalX: 220, focalY: 300 },
    ]));
    await flush();
    expect(screen.getByText('2배')).toBeTruthy();
  });
});
