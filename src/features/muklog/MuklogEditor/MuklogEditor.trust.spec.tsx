import React from 'react';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderWithTheme } from '@/test/renderWithTheme';
import { MuklogEditor, type MuklogEditorExitGuardProps } from './MuklogEditor';
import { type MuklogEditInitial } from '../types';

const mockToast = jest.fn();
jest.mock('@/components', () => ({ ...jest.requireActual('@/components'), useToastController: () => ({ showToast: mockToast }) }));
const mockCreate = jest.fn();
jest.mock('../useCreateMuklog', () => ({ useCreateMuklog: () => ({ createMuklog: mockCreate, loading: false, error: null }) }));
const initial: MuklogEditInitial = {
  muklogId: 'm1', roomId: 'r1', placeName: '보나', category: 'pasta', area: null,
  rating: 4, memo: '', visitedAt: '2026-02-14',
  photos: [{ storagePath: 'r1/m1/a.jpg', uri: 'https://signed/a', orderIndex: 0 }],
};
let latestGuard: MuklogEditorExitGuardProps;
const GuardProbe = (props: MuklogEditorExitGuardProps) => { latestGuard = props; return null; };
const onBack = jest.fn();
const onSaved = jest.fn();
beforeEach(() => { jest.clearAllMocks(); mockCreate.mockReset().mockResolvedValue({ id: 'm1' }); });

describe('에디터 저장 신뢰의 데이터 경계', () => {
  it('같은 오류의 연속 실패도 매번 토스트하고 재시도 입력을 유지한다', async () => {
    mockCreate.mockRejectedValue(new Error('network'));
    renderWithTheme(<MuklogEditor roomId="r1" onBack={onBack} onSaved={onSaved} ExitGuard={GuardProbe} />);
    fireEvent.changeText(screen.getByLabelText('장소 이름'), '보나');
    fireEvent.press(screen.getByLabelText('별점 4점'));
    await act(async () => fireEvent.press(screen.getByLabelText('저장')));
    await act(async () => fireEvent.press(screen.getByLabelText('저장')));
    expect(mockToast).toHaveBeenCalledTimes(2);
    expect(mockToast).toHaveBeenLastCalledWith({ message: '저장에 실패했어요. 다시 시도해 주세요.', tone: 'neutral' });
    expect(latestGuard.dirty).toBe(true);
    expect(latestGuard.isSaving).toBe(false);
    expect(screen.getByLabelText('장소 이름').props.value).toBe('보나');
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('위시 자동 프리필은 clean이며 주소만 변경되어도 dirty다', () => {
    const props = { roomId: 'r1', onBack, onSaved, ExitGuard: GuardProbe };
    const selectedPlace = { placeName: '보나', category: 'pasta', address: '서울', lat: 37, lng: 127 };
    const { rerender } = renderWithTheme(<MuklogEditor {...props} selectedPlace={selectedPlace} />);
    expect(latestGuard.dirty).toBe(false);
    rerender(<MuklogEditor {...props} selectedPlace={{ ...selectedPlace, address: '인천' }} />);
    expect(latestGuard.dirty).toBe(true);
    rerender(<MuklogEditor {...props} selectedPlace={selectedPlace} />);
    expect(latestGuard.dirty).toBe(false);
  });

  it('편집 프리필은 clean이며 카테고리와 별점 변경을 복원하면 clean이다', () => {
    renderWithTheme(<MuklogEditor roomId="r1" onBack={onBack} onSaved={onSaved} initial={initial} ExitGuard={GuardProbe} />);
    expect(latestGuard.dirty).toBe(false);
    fireEvent.press(screen.getByLabelText('카테고리 이자카야'));
    expect(latestGuard.dirty).toBe(true);
    fireEvent.press(screen.getByLabelText('카테고리 파스타·양식'));
    expect(latestGuard.dirty).toBe(false);
    fireEvent.press(screen.getByLabelText('별점 5점'));
    expect(latestGuard.dirty).toBe(true);
    fireEvent.press(screen.getByLabelText('별점 4점'));
    expect(latestGuard.dirty).toBe(false);
  });

  it('사진 추가/순서 변경/제거를 감지하고 원래 순서 복원은 clean이다', () => {
    const props = { roomId: 'r1', onBack, onSaved, ExitGuard: GuardProbe, onAddPhoto: jest.fn() };
    const photos = [{ uri: 'file://a' }, { uri: 'file://b' }];
    const { rerender } = renderWithTheme(<MuklogEditor {...props} photos={photos} />);
    expect(latestGuard.dirty).toBe(false);
    rerender(<MuklogEditor {...props} photos={[photos[1], photos[0]]} />);
    expect(latestGuard.dirty).toBe(true);
    rerender(<MuklogEditor {...props} photos={[]} />);
    expect(latestGuard.dirty).toBe(true);
    rerender(<MuklogEditor {...props} photos={photos} />);
    expect(latestGuard.dirty).toBe(false);
  });

  it('별점 없는 레거시 편집은 내용을 유지하고 별점을 선택하면 빈 메모로 저장한다', async () => {
    const submit = jest.fn().mockResolvedValue({ id: 'm1' });
    renderWithTheme(<MuklogEditor roomId="r1" onBack={onBack} onSaved={onSaved} initial={{ ...initial, rating: null }} onSubmit={submit} />);
    expect(screen.getByLabelText('수정').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByLabelText('장소 이름').props.value).toBe('보나');
    fireEvent.press(screen.getByLabelText('별점 4점'));
    await act(async () => fireEvent.press(screen.getByLabelText('수정')));
    expect(submit).toHaveBeenCalledWith({ input: expect.objectContaining({ rating: 4, memo: '', placeName: '보나' }) });
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('성공 후 비동기 위시 후처리가 대기해도 두 번째 제출을 막는다', async () => {
    const saved = jest.fn(() => new Promise<void>(() => {}));
    renderWithTheme(<MuklogEditor roomId="r1" onBack={onBack} onSaved={saved} ExitGuard={GuardProbe} />);
    fireEvent.changeText(screen.getByLabelText('장소 이름'), '보나');
    fireEvent.press(screen.getByLabelText('별점 4점'));
    await act(async () => fireEvent.press(screen.getByLabelText('저장')));
    fireEvent.press(screen.getByLabelText('저장'));
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(saved).toHaveBeenCalledTimes(1);
    expect(latestGuard.dirty).toBe(false);
    expect(latestGuard.isSaving).toBe(false);
  });
});
