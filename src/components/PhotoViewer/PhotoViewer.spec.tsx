import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderWithTheme } from '@/test/renderWithTheme';
import { PhotoViewer } from './PhotoViewer';
const photos = [{ uri: 'https://signed/a', orderIndex: 2 }, { uri: 'https://signed/b', orderIndex: 4 }];
const onClose = jest.fn();
const props = { visible: true, photos, initialIndex: 1, placeName: '보나', onClose };
beforeEach(() => jest.clearAllMocks());
const load = () => fireEvent(screen.getByTestId('photo-viewer-photo'), 'load', { nativeEvent: { source: { width: 1200, height: 800 } } });
describe('사진 전체화면', () => {
  it('누른 배열 index로 열고 원 URI 하나만 표시한다', () => {
    renderWithTheme(<PhotoViewer {...props} />);
    expect(screen.getByText('2 / 2')).toBeTruthy();
    expect(screen.getByTestId('photo-viewer-photo').props.source).toEqual({ uri: photos[1].uri });
    expect(screen.getAllByTestId('photo-viewer-photo')).toHaveLength(1);
  });
  it('로딩 중 확대를 막고 로드 후 확대/축소와 페이지 reset을 제공한다', async () => {
    renderWithTheme(<PhotoViewer {...props} />);
    expect(screen.getByText('사진을 불러오는 중이에요')).toBeTruthy();
    expect(screen.getByLabelText('확대').props.accessibilityState.disabled).toBe(true);
    load();
    fireEvent.press(screen.getByLabelText('확대'));
    expect(screen.getByText('2배')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('이전 사진'));
    await waitFor(() => expect(screen.getByText('1 / 2')).toBeTruthy());
    expect(screen.getByText('1배')).toBeTruthy();
    expect(screen.getByLabelText('이전 사진').props.accessibilityState.disabled).toBe(true);
  });
  it('오류 후에도 이동 가능하고 닫을 수 있다', async () => {
    renderWithTheme(<PhotoViewer {...props} />);
    fireEvent(screen.getByTestId('photo-viewer-photo'), 'error');
    expect(screen.getByText('사진을 불러오지 못했어요')).toBeTruthy();
    expect(screen.getByLabelText('확대').props.accessibilityState.disabled).toBe(true);
    fireEvent(screen.getByTestId('photo-viewer-modal'), 'requestClose');
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
  it('열린 세션은 사진 props 변경을 무시하고 재열면 최신 배열을 사용한다', () => {
    const { rerender } = renderWithTheme(<PhotoViewer {...props} />);
    rerender(<PhotoViewer {...props} photos={[photos[0]]} />);
    expect(screen.getByText('2 / 2')).toBeTruthy();
    rerender(<PhotoViewer {...props} visible={false} />);
    expect(screen.queryByTestId('photo-viewer-photo')).toBeNull();
    rerender(<PhotoViewer {...props} photos={[photos[0]]} />);
    expect(screen.getByText('1 / 1')).toBeTruthy();
  });
  it('사진이 없으면 modal을 열지 않는다', () => {
    renderWithTheme(<PhotoViewer {...props} photos={[]} />);
    expect(screen.queryByTestId('photo-viewer-modal')).toBeNull();
  });
});
