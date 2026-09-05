// src/features/muklog/PhotoPickerGrid.spec.tsx
// 사진 입력 그리드 — 킷 mk-log.jsx:319-339 MuklogEditor 사진 필드 재현(plan §5 ⑤, AC).
//   N장 썸네일 + 각 우상단 ×(onRemove) + 5장 미만일 때 "추가" 타일(onAdd) + hint `N/5`.
//   데이터/업로드는 props(photos·onAdd·onRemove) — picker 호출은 developer가 onAdd에 연결.
import React from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { PhotoPickerGrid } from './PhotoPickerGrid';

const onAdd = jest.fn();
const onRemove = jest.fn();

const photo = (uri: string) => ({ uri });

const renderGrid = (over?: Partial<React.ComponentProps<typeof PhotoPickerGrid>>) =>
  renderWithTheme(
    <PhotoPickerGrid photos={[]} onAdd={onAdd} onRemove={onRemove} {...over} />,
  );

beforeEach(() => jest.clearAllMocks());

describe('PhotoPickerGrid', () => {
  it('사진 0장이면 썸네일 없이 추가 타일만 렌더하고 hint는 0/5다', () => {
    renderGrid();
    expect(screen.getByTestId('photo-add-tile')).toBeTruthy();
    expect(screen.queryByTestId('photo-thumb-0')).toBeNull();
    expect(screen.getByText('0/5')).toBeTruthy();
  });

  it('N장 썸네일과 각 삭제 버튼을 렌더하고 hint를 N/5로 표시한다', () => {
    renderGrid({ photos: [photo('a'), photo('b'), photo('c')] });
    expect(screen.getByTestId('photo-thumb-0')).toBeTruthy();
    expect(screen.getByTestId('photo-thumb-1')).toBeTruthy();
    expect(screen.getByTestId('photo-thumb-2')).toBeTruthy();
    expect(screen.getByText('3/5')).toBeTruthy();
  });

  it('추가 타일 탭 시 onAdd를 호출한다', () => {
    renderGrid();
    fireEvent.press(screen.getByTestId('photo-add-tile'));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('썸네일 ×탭 시 해당 index로 onRemove를 호출한다', () => {
    renderGrid({ photos: [photo('a'), photo('b')] });
    fireEvent.press(screen.getByTestId('photo-remove-1'));
    expect(onRemove).toHaveBeenCalledWith({ index: 1 });
  });

  it('5장에 도달하면 추가 타일을 숨긴다 (경계)', () => {
    renderGrid({ photos: [photo('a'), photo('b'), photo('c'), photo('d'), photo('e')] });
    expect(screen.queryByTestId('photo-add-tile')).toBeNull();
    expect(screen.getByText('5/5')).toBeTruthy();
  });

  it('uploading이면 추가 타일을 비활성화한다', () => {
    renderGrid({ uploading: true });
    const tile = screen.getByTestId('photo-add-tile');
    expect(tile.props.accessibilityState?.disabled).toBe(true);
  });
});

// ── 프레스 부여 C10·C11(motion-press-c T4 / ui-spec §2) ────────────────────────
//   seam = testID 노드의 flatten style transform/opacity 키 유무 + 콜백 발화.
//   pressedOpacity 실값·Animated 궤적은 검증하지 않는다(plan §8-2).
describe('PhotoPickerGrid — 삭제 ✕·추가 타일 눌림 피드백(motion-press-c C10·C11)', () => {
  const mockReduceMotion = ({ enabled }: { enabled: boolean }) => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockReturnValue(Promise.resolve(enabled));
  };

  afterEach(() => jest.restoreAllMocks());

  const flatten = ({ testId }: { testId: string }) =>
    StyleSheet.flatten(screen.getByTestId(testId).props.style) as Record<string, unknown>;

  const renderWithPhoto = ({ uploading = false }: { uploading?: boolean } = {}) =>
    renderGrid({ photos: [photo('file:///a.jpg')], uploading });

  it('C10 삭제 ✕ — 감소 모션 OFF: transform이 부착된다', async () => {
    mockReduceMotion({ enabled: false });
    renderWithPhoto();
    await waitFor(() => expect(flatten({ testId: 'photo-remove-0' }).transform).toBeDefined());
  });

  it('C10 삭제 ✕ — 감소 모션 ON: transform 없이 opacity만 남는다', async () => {
    mockReduceMotion({ enabled: true });
    renderWithPhoto();
    await waitFor(() => expect(flatten({ testId: 'photo-remove-0' }).opacity).toBeDefined());
    expect(flatten({ testId: 'photo-remove-0' }).transform).toBeUndefined();
  });

  it('C11 추가 타일 — 감소 모션 OFF: transform이 부착된다', async () => {
    mockReduceMotion({ enabled: false });
    renderWithPhoto();
    await waitFor(() => expect(flatten({ testId: 'photo-add-tile' }).transform).toBeDefined());
  });

  it('C11 추가 타일 — 감소 모션 ON: transform 없이 opacity만 남는다', async () => {
    mockReduceMotion({ enabled: true });
    renderWithPhoto();
    await waitFor(() => expect(flatten({ testId: 'photo-add-tile' }).opacity).toBeDefined());
    expect(flatten({ testId: 'photo-add-tile' }).transform).toBeUndefined();
  });

  it('C10·C11 uploading=true — transform 미부착 + 콜백 미발화(E11)', () => {
    mockReduceMotion({ enabled: false });
    renderWithPhoto({ uploading: true });
    expect(flatten({ testId: 'photo-remove-0' }).transform).toBeUndefined();
    expect(flatten({ testId: 'photo-add-tile' }).transform).toBeUndefined();
    fireEvent.press(screen.getByTestId('photo-remove-0'));
    fireEvent.press(screen.getByTestId('photo-add-tile'));
    expect(onRemove).not.toHaveBeenCalled();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('렌더 시 console.warn 0건(정적 opacity 계약 위반 없음)', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    renderWithPhoto();
    expect(warn).not.toHaveBeenCalled();
  });
});
