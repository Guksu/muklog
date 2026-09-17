import React from 'react';
import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';
import { MuklogEditor } from '@/features/muklog/MuklogEditor';
import { NativeEditorExitGuard } from './NativeEditorExitGuard';

let mockPrevent = false;
let mockOnRemove: ((event: { data: { action: { type: string } } }) => void) | undefined;
const mockCompletedExit = jest.fn();
const mockSetOptions = jest.fn();
const mockDispatch = jest.fn(() => mockCompletedExit());
const mockNavigation = { dispatch: mockDispatch, setOptions: mockSetOptions };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  usePreventRemove: (prevent: boolean, callback: typeof mockOnRemove) => {
    mockPrevent = prevent;
    mockOnRemove = callback;
  },
}));
const mockCreate = jest.fn();
jest.mock('@/features/muklog/useCreateMuklog', () => ({
  useCreateMuklog: () => ({ createMuklog: mockCreate, loading: false, error: null }),
}));
const requestBack = () => {
  if (mockPrevent) mockOnRemove?.({ data: { action: { type: 'GO_BACK' } } });
  else mockCompletedExit();
};
const search = { query: '', onChangeQuery: jest.fn(), status: 'idle' as const, results: [] };
const renderEditor = () => renderWithTheme(
  <MuklogEditor roomId="r1" onBack={requestBack} onSaved={requestBack} ExitGuard={NativeEditorExitGuard} placeSearch={search} />,
);
beforeEach(() => {
  jest.clearAllMocks();
  mockPrevent = false;
  mockCreate.mockReset().mockResolvedValue({ id: 'm1' });
});

describe('네이티브 에디터 이탈 경계', () => {
  it('clean 라우트는 즉시 나가고 dirty 라우트는 원래 액션을 확인 후 한 번 수행한다', () => {
    renderEditor();
    expect(mockPrevent).toBe(false);
    fireEvent.changeText(screen.getByLabelText('메모'), '맛');
    expect(mockPrevent).toBe(true);
    act(requestBack);
    act(requestBack);
    expect(screen.getAllByText('저장하지 않고 나갈까요?')).toHaveLength(1);
    expect(mockCompletedExit).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText('계속 작성하기'));
    expect(screen.getByLabelText('메모').props.value).toBe('맛');
    act(requestBack);
    fireEvent.press(screen.getByLabelText('나가기'));
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'GO_BACK' });
    expect(mockCompletedExit).toHaveBeenCalledTimes(1);
  });

  it('헤더 확인 후 새로운 goBack이 재차 확인창을 열지 않는다', () => {
    renderEditor();
    fireEvent.changeText(screen.getByLabelText('메모'), '맛');
    fireEvent.press(screen.getByLabelText('뒤로 가기'));
    fireEvent.press(screen.getByLabelText('나가기'));
    expect(mockCompletedExit).toHaveBeenCalledTimes(1);
    expect(mockPrevent).toBe(false);
  });

  it('검색 중 OS 뒤로는 폼 복귀이며 gesture는 비활성이다', () => {
    renderEditor();
    fireEvent.press(screen.getByLabelText('장소 검색하기'));
    expect(mockSetOptions).toHaveBeenLastCalledWith({ gestureEnabled: false });
    act(requestBack);
    expect(screen.getByLabelText('장소 검색하기')).toBeTruthy();
    expect(mockCompletedExit).not.toHaveBeenCalled();
    expect(screen.queryByText('저장하지 않고 나갈까요?')).toBeNull();
    expect(mockSetOptions).toHaveBeenLastCalledWith({ gestureEnabled: true });
  });

  it('저장 pending에는 OS 제거를 막고 성공 시 보호 해제 후 복귀한다', async () => {
    let resolveSave!: () => void;
    mockCreate.mockReturnValue(new Promise<void>((resolve) => { resolveSave = resolve; }));
    renderWithTheme(<MuklogEditor roomId="r1" onBack={requestBack} onSaved={requestBack} ExitGuard={NativeEditorExitGuard} />);
    fireEvent.changeText(screen.getByLabelText('장소 이름'), '보나');
    fireEvent.press(screen.getByLabelText('별점 5점'));
    fireEvent.press(screen.getByLabelText('저장'));
    act(requestBack);
    expect(mockCompletedExit).not.toHaveBeenCalled();
    expect(screen.queryByText('저장하지 않고 나갈까요?')).toBeNull();
    await act(async () => resolveSave());
    expect(mockPrevent).toBe(false);
    expect(mockCompletedExit).toHaveBeenCalledTimes(1);
  });
});
