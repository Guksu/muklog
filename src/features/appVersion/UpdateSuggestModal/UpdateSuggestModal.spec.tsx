// src/features/appVersion/UpdateSuggestModal/UpdateSuggestModal.spec.tsx
// 업데이트 권유 모달(app-version-gate T9) — 프리젠테이션 단위 검증.
//   RenameDialog 셸 패턴(딤·중앙카드·상단 hairline 2버튼 행) 재사용의 "입력 없는 확인형" 변형.
//   배선(Linking·dismissal 저장)은 developer — 여기선 표시·콜백(나중에/업데이트·딤 탭·null=1버튼)만 본다.
import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { UpdateSuggestModal } from './UpdateSuggestModal';

const noop = () => {};

describe('UpdateSuggestModal', () => {
  it('visible=false면 아무것도 렌더하지 않는다', () => {
    renderWithTheme(
      <UpdateSuggestModal visible={false} storeUrl="https://store" onUpdatePress={noop} onDismiss={noop} />,
    );
    expect(screen.queryByTestId('update-suggest-card')).toBeNull();
    expect(screen.queryByText('새 버전이 나왔어요')).toBeNull();
  });

  it('visible=true면 제목·본문과 나중에/업데이트 버튼을 렌더한다', () => {
    renderWithTheme(
      <UpdateSuggestModal visible storeUrl="https://store" onUpdatePress={noop} onDismiss={noop} />,
    );
    expect(screen.getByText('새 버전이 나왔어요')).toBeTruthy();
    expect(screen.getByTestId('update-suggest-dismiss')).toBeTruthy();
    expect(screen.getByTestId('update-suggest-update')).toBeTruthy();
  });

  it('업데이트 탭 시 onUpdatePress를 호출한다', () => {
    const onUpdatePress = jest.fn();
    renderWithTheme(
      <UpdateSuggestModal visible storeUrl="https://store" onUpdatePress={onUpdatePress} onDismiss={noop} />,
    );
    fireEvent.press(screen.getByTestId('update-suggest-update'));
    expect(onUpdatePress).toHaveBeenCalledTimes(1);
  });

  it('나중에 탭 시 onDismiss를 호출한다', () => {
    const onDismiss = jest.fn();
    renderWithTheme(
      <UpdateSuggestModal visible storeUrl="https://store" onUpdatePress={noop} onDismiss={onDismiss} />,
    );
    fireEvent.press(screen.getByTestId('update-suggest-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('딤 배경 탭 시 onDismiss를 호출한다(닫기 가능)', () => {
    const onDismiss = jest.fn();
    renderWithTheme(
      <UpdateSuggestModal visible storeUrl="https://store" onUpdatePress={noop} onDismiss={onDismiss} />,
    );
    fireEvent.press(screen.getByTestId('update-suggest-backdrop'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('storeUrl이 null이면 업데이트 버튼을 숨기고 단일 확인 버튼만 렌더한다', () => {
    const onDismiss = jest.fn();
    renderWithTheme(
      <UpdateSuggestModal visible storeUrl={null} onUpdatePress={noop} onDismiss={onDismiss} />,
    );
    expect(screen.queryByTestId('update-suggest-update')).toBeNull();
    const only = screen.getByTestId('update-suggest-dismiss');
    fireEvent.press(only);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
