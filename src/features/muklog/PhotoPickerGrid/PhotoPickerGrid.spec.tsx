// src/features/muklog/PhotoPickerGrid.spec.tsx
// 사진 입력 그리드 — 킷 mk-log.jsx:319-339 MuklogEditor 사진 필드 재현(plan §5 ⑤, AC).
//   N장 썸네일 + 각 우상단 ×(onRemove) + 5장 미만일 때 "추가" 타일(onAdd) + hint `N/5`.
//   데이터/업로드는 props(photos·onAdd·onRemove) — picker 호출은 developer가 onAdd에 연결.
import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

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
