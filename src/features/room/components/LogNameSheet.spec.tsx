// src/features/room/components/LogNameSheet.spec.tsx
// 로그 이름 편집 시트(log-name, plan §4.2 / T6) — 프리젠테이션 전담.
//   킷 mk-log:91-102 재현: 공용 Sheet + 단일 입력(autoFocus·maxLength 20) + 힌트 + 저장 버튼.
//   검증/정규화/RPC 없음 — onSave에 입력 원문(draft)을 그대로 전달(정규화는 developer/서버).
import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { LogNameSheet } from './LogNameSheet';

const INPUT_LABEL = '로그 이름';
const SAVE_LABEL = '저장';

describe('LogNameSheet', () => {
  it('open=false면 아무것도 렌더하지 않는다', () => {
    renderWithTheme(
      <LogNameSheet
        open={false}
        initialValue=""
        placeholder="민의 기록"
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );
    expect(screen.queryByText('로그 이름')).toBeNull();
  });

  it('시트 제목 "로그 이름"과 placeholder·힌트를 노출한다', () => {
    renderWithTheme(
      <LogNameSheet
        open
        initialValue=""
        placeholder="민의 기록"
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );
    // 시트 타이틀
    expect(screen.getByText('로그 이름')).toBeTruthy();
    // placeholder = 폴백명
    expect(screen.getByPlaceholderText('민의 기록')).toBeTruthy();
    // 킷 힌트 카피(mk-log:98)
    expect(
      screen.getByText('우리만의 이름을 지어보세요. 비워두면 기본 이름으로 돌아가요.'),
    ).toBeTruthy();
  });

  it('initialValue를 입력 초기값으로 표시한다', () => {
    renderWithTheme(
      <LogNameSheet
        open
        initialValue="우리 맛집"
        placeholder="민의 기록"
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );
    expect(screen.getByDisplayValue('우리 맛집')).toBeTruthy();
  });

  it('입력에 maxLength=20을 적용한다', () => {
    renderWithTheme(
      <LogNameSheet
        open
        initialValue=""
        placeholder="민의 기록"
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );
    expect(screen.getByLabelText(INPUT_LABEL).props.maxLength).toBe(20);
  });

  it('저장 탭 시 현재 draft 원문을 onSave에 그대로 전달한다(정규화 안 함)', () => {
    const onSave = jest.fn();
    renderWithTheme(
      <LogNameSheet
        open
        initialValue=""
        placeholder="민의 기록"
        onClose={jest.fn()}
        onSave={onSave}
      />,
    );
    // 앞뒤 공백 포함 — 정규화하지 않고 원문 그대로 전달돼야 한다.
    fireEvent.changeText(screen.getByLabelText(INPUT_LABEL), '  우리 맛집 ');
    fireEvent.press(screen.getByLabelText(SAVE_LABEL));
    expect(onSave).toHaveBeenCalledWith('  우리 맛집 ');
  });

  it('saving=true면 저장 버튼이 비활성(busy)이고 탭해도 onSave를 호출하지 않는다', () => {
    const onSave = jest.fn();
    renderWithTheme(
      <LogNameSheet
        open
        initialValue="X"
        placeholder="민의 기록"
        onClose={jest.fn()}
        onSave={onSave}
        saving
      />,
    );
    const saveBtn = screen.getByLabelText(SAVE_LABEL);
    expect(saveBtn.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(saveBtn);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('error가 있으면 inline 에러 메시지를 노출한다', () => {
    renderWithTheme(
      <LogNameSheet
        open
        initialValue=""
        placeholder="민의 기록"
        onClose={jest.fn()}
        onSave={jest.fn()}
        error="이름은 20자까지 쓸 수 있어요."
      />,
    );
    expect(screen.getByText('이름은 20자까지 쓸 수 있어요.')).toBeTruthy();
  });

  it('error가 없으면 에러 메시지를 노출하지 않는다', () => {
    renderWithTheme(
      <LogNameSheet
        open
        initialValue=""
        placeholder="민의 기록"
        onClose={jest.fn()}
        onSave={jest.fn()}
        error={null}
      />,
    );
    expect(screen.queryByText('이름은 20자까지 쓸 수 있어요.')).toBeNull();
  });
});
