// main의 공개 API/접근성/인덱스/모달 회귀를 유지한다.
// ScrollView 오프셋·전체 Image 선렌더는 단일 활성 사진 + 버튼/gesture 동작으로 대체했다.
import React from 'react';
import { AccessibilityInfo, Modal, StatusBar, StyleSheet } from 'react-native';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { PhotoViewer as BarrelPhotoViewer } from '@/components';
import { renderWithTheme } from '@/test/renderWithTheme';
import { themes } from '@/theme';
import { PhotoViewer, PHOTO_VIEWER_ENTER_SCALE, type PhotoViewerPhoto } from './PhotoViewer';
const photos: PhotoViewerPhoto[] = Array.from({ length: 5 }, (_, index) => ({ uri: `https://cdn.test/p${index}.jpg` }));
const onClose = jest.fn();
const advance = () => act(() => jest.advanceTimersByTime(300));
beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); });
afterEach(() => { act(() => jest.runOnlyPendingTimers()); jest.useRealTimers(); jest.restoreAllMocks(); });

describe('main PhotoViewer 공개 계약 통합', () => {
  it.each([[-1, 1], [9, 5], [2, 3], [2.9, 3], [NaN, 1], [Infinity, 1]])('초기 index %s를 %s번째 사진으로 제한한다', (initialIndex, position) => {
    renderWithTheme(<PhotoViewer visible photos={photos} initialIndex={initialIndex} onClose={onClose} />);
    expect(screen.getByLabelText(`5장 중 ${position}번째 사진`)).toBeTruthy();
    expect(screen.getByTestId('photo-viewer-photo').props.source.uri).toBe(photos[position - 1].uri);
  });
  it('optional initialIndex/placeName/orderIndex 없이 배럴 API로 첫 사진을 연다', () => {
    renderWithTheme(<BarrelPhotoViewer visible photos={photos} onClose={onClose} />);
    expect(screen.getByText('1 / 5')).toBeTruthy();
    expect(screen.getByTestId('photo-viewer-photo').props.accessibilityLabel).toBe('사진 1');
  });
  it('닫힌 뷰어와 빈 배열은 표면을 만들지 않는다', () => {
    const { rerender } = renderWithTheme(<PhotoViewer visible={false} photos={photos} onClose={onClose} />);
    expect(screen.queryByTestId('photo-viewer-backdrop')).toBeNull();
    rerender(<PhotoViewer visible photos={[]} onClose={onClose} />);
    expect(screen.queryByTestId('photo-viewer-close')).toBeNull();
  });
  it('처음 선택한 URI는 부모 재렌더나 초기 index 변경으로 되감기지 않는다', () => {
    const { rerender } = renderWithTheme(<PhotoViewer visible photos={photos} initialIndex={2} onClose={onClose} />);
    fireEvent.press(screen.getByLabelText('다음 사진')); advance();
    rerender(<PhotoViewer visible photos={photos} initialIndex={0} onClose={onClose} />);
    expect(screen.getByText('4 / 5')).toBeTruthy();
    expect(screen.getByTestId('photo-viewer-photo').props.source.uri).toBe(photos[3].uri);
  });
  it('사진 추가·삭제는 현재 세션의 사진을 바꾸지 않고 재열 때 적용된다', () => {
    const { rerender } = renderWithTheme(<PhotoViewer visible photos={photos} initialIndex={4} onClose={onClose} />);
    rerender(<PhotoViewer visible photos={photos.slice(0, 3)} initialIndex={4} onClose={onClose} />);
    expect(screen.getByLabelText('5장 중 5번째 사진')).toBeTruthy();
    expect(screen.getByTestId('photo-viewer-photo').props.source.uri).toBe(photos[4].uri);
    rerender(<PhotoViewer visible={false} photos={photos.slice(0, 3)} onClose={onClose} />);
    rerender(<PhotoViewer visible photos={photos.slice(0, 3)} initialIndex={4} onClose={onClose} />);
    expect(screen.getByLabelText('3장 중 3번째 사진')).toBeTruthy();
  });
  it('한 장은 승인된 새 정책에 따라 1/1 안내와 양쪽 이동 비활성을 제공한다', () => {
    renderWithTheme(<PhotoViewer visible photos={photos.slice(0, 1)} onClose={onClose} />);
    expect(screen.getByText('1 / 1')).toBeTruthy();
    for (const label of ['이전 사진', '다음 사진']) expect(screen.getByLabelText(label).props.accessibilityState.disabled).toBe(true);
  });
  it('처음/끝 경계에서 순환하거나 카운터를 초과하지 않는다', () => {
    renderWithTheme(<PhotoViewer visible photos={photos} initialIndex={4} onClose={onClose} />);
    fireEvent.press(screen.getByLabelText('다음 사진')); advance();
    expect(screen.getByText('5 / 5')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('이전 사진')); advance();
    expect(screen.getByText('4 / 5')).toBeTruthy();
  });
  it('사진별 접근성 라벨과 기본 사진 번호를 그대로 읽는다', () => {
    renderWithTheme(<PhotoViewer visible photos={[{ uri: 'a', accessibilityLabel: '보나 음식 사진' }, { uri: 'b' }]} onClose={onClose} />);
    expect(screen.getByTestId('photo-viewer-photo').props.accessibilityLabel).toBe('보나 음식 사진');
    fireEvent.press(screen.getByLabelText('다음 사진')); advance();
    expect(screen.getByTestId('photo-viewer-photo').props.accessibilityLabel).toBe('사진 2');
  });
  it.each(['button', 'hardware'])('닫기 %s 경로가 중복 요청에도 한 번만 통지한다', (path) => {
    renderWithTheme(<PhotoViewer visible photos={photos} onClose={onClose} />);
    const requestClose = () => path === 'button' ? fireEvent.press(screen.getByTestId('photo-viewer-close')) : fireEvent(screen.UNSAFE_getByType(Modal), 'requestClose');
    requestClose(); requestClose(); advance();
    expect(onClose).toHaveBeenCalledTimes(1);
    const button = screen.getByTestId('photo-viewer-close');
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBe('닫기');
  });
  it('Modal은 상태바를 덮고 헤더는 Android 상태바 높이 이상을 피한다', () => {
    renderWithTheme(<PhotoViewer visible photos={photos} onClose={onClose} />);
    expect(screen.UNSAFE_getByType(Modal).props.statusBarTranslucent).toBe(true);
    expect(screen.UNSAFE_getByType(Modal).props.animationType).toBe('none');
    expect(StyleSheet.flatten(screen.getByTestId('photo-viewer-topbar').props.style).paddingTop).toBeGreaterThanOrEqual((StatusBar.currentHeight ?? 0) + themes.light.spacing[8]);
  });
  it('배경은 검정으로 전체를 채우며 스케일되지 않는다', () => {
    renderWithTheme(<PhotoViewer visible photos={photos} onClose={onClose} />);
    const backdrop = StyleSheet.flatten(screen.getByTestId('photo-viewer-backdrop').props.style);
    expect(backdrop.backgroundColor).toBe(themes.light.color.mediaViewerBg);
    expect(backdrop.transform).toBeUndefined();
    expect(screen.getByTestId('photo-viewer-photo').props.resizeMode).toBe('contain');
  });
  it('진입은 main의 0.96 스케일을 유지하고 감소 모션은 스케일 없이 페이드한다', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    renderWithTheme(<PhotoViewer visible photos={photos} onClose={onClose} />);
    expect(PHOTO_VIEWER_ENTER_SCALE).toBe(0.96);
    await waitFor(() => expect(StyleSheet.flatten(screen.getByTestId('photo-viewer-enter-layer').props.style).transform).toBeUndefined());
    expect(StyleSheet.flatten(screen.getByTestId('photo-viewer-enter-layer').props.style).opacity).toBeDefined();
    expect(screen.getAllByTestId('photo-viewer-photo')).toHaveLength(1);
  });
});
