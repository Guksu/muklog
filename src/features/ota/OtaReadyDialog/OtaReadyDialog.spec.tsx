// src/features/ota/OtaReadyDialog/OtaReadyDialog.spec.tsx
// OTA 적용 안내 다이얼로그(expo-updates-ota T7) — 프리젠테이션 단위 검증.
//   UpdateSuggestModal 셸(딤·중앙카드·상단 hairline 2버튼 행)을 그대로 승계한 "입력 없는 확인형".
//   배선(reloadAsync·dismiss 상태)은 developer(T8) — 여기선 표시·콜백(지금 적용/나중에·딤 탭)만 본다.
import React from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { OtaReadyDialog } from './OtaReadyDialog';

const noop = () => {};

describe('OtaReadyDialog', () => {
  it('visible=false면 아무것도 렌더하지 않는다', () => {
    renderWithTheme(<OtaReadyDialog visible={false} onApply={noop} onDismiss={noop} />);
    expect(screen.queryByTestId('ota-ready-card')).toBeNull();
    expect(screen.queryByText('개선사항을 받아뒀어요')).toBeNull();
  });

  it('visible=true면 제목·본문과 나중에/지금 적용 버튼을 렌더한다', () => {
    renderWithTheme(<OtaReadyDialog visible onApply={noop} onDismiss={noop} />);
    expect(screen.getByText('개선사항을 받아뒀어요')).toBeTruthy();
    expect(screen.getByTestId('ota-dismiss')).toBeTruthy();
    expect(screen.getByTestId('ota-apply')).toBeTruthy();
  });

  it('본문이 작성 중인 내용 저장을 안내한다(적용 시 새로고침으로 입력 유실 방지)', () => {
    renderWithTheme(<OtaReadyDialog visible onApply={noop} onDismiss={noop} />);
    expect(screen.getByText(/작성 중인 내용은 저장해 주세요/)).toBeTruthy();
  });

  it('지금 적용 탭 시 onApply를 1회 호출한다', () => {
    const onApply = jest.fn();
    const onDismiss = jest.fn();
    renderWithTheme(<OtaReadyDialog visible onApply={onApply} onDismiss={onDismiss} />);
    fireEvent.press(screen.getByTestId('ota-apply'));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('나중에 탭 시 onDismiss를 1회 호출한다', () => {
    const onApply = jest.fn();
    const onDismiss = jest.fn();
    renderWithTheme(<OtaReadyDialog visible onApply={onApply} onDismiss={onDismiss} />);
    fireEvent.press(screen.getByTestId('ota-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
  });

  it('딤 배경 탭 시 onDismiss를 1회 호출한다(닫기 가능)', () => {
    const onDismiss = jest.fn();
    renderWithTheme(<OtaReadyDialog visible onApply={noop} onDismiss={onDismiss} />);
    fireEvent.press(screen.getByTestId('ota-ready-backdrop'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('카드를 탭해도 닫히지 않는다(딤 전파 차단)', () => {
    const onDismiss = jest.fn();
    renderWithTheme(<OtaReadyDialog visible onApply={noop} onDismiss={onDismiss} />);
    fireEvent.press(screen.getByTestId('ota-ready-card'));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('스토어 업데이트 모달과 문구가 겹치지 않는다(두 축 혼동 방지)', () => {
    renderWithTheme(<OtaReadyDialog visible onApply={noop} onDismiss={noop} />);
    // 스토어 축(UpdateSuggestModal) 문구가 여기 나타나면 안 된다.
    expect(screen.queryByText('새 버전이 나왔어요')).toBeNull();
    expect(screen.queryByText('업데이트')).toBeNull();
  });

  it('raw hex 색을 소스에 하드코딩하지 않는다(토큰만 사용)', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const source: string = require('fs').readFileSync(`${__dirname}/OtaReadyDialog.tsx`, 'utf8');
    const code = source
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('//'))
      .join('\n');
    expect(code).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(code).not.toMatch(/rgba?\(/);
  });
});

// ── 프레스 치환 A6·A7(motion-press-sweep T3 / ui-spec §2-2·§3-1) ────────────────────────
//   seam = testID로 조회한 노드의 (a) flatten style의 transform/opacity 키 유무.
//   pressedOpacity 실값·Animated 궤적은 검증하지 않는다(plan §9-2).
describe('OtaReadyDialog — 액션 눌림 피드백(motion-press-sweep A6·A7)', () => {
  const mockReduceMotion = ({ enabled }: { enabled: boolean }) => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockReturnValue(Promise.resolve(enabled));
  };

  afterEach(() => jest.restoreAllMocks());

  const flatten = ({ testId }: { testId: string }) =>
    StyleSheet.flatten(screen.getByTestId(testId).props.style) as Record<string, unknown>;

  it('A6 나중에 — 감소 모션 OFF: transform이 부착된다', async () => {
    mockReduceMotion({ enabled: false });
    renderWithTheme(<OtaReadyDialog visible onApply={noop} onDismiss={noop} />);
    await waitFor(() => expect(flatten({ testId: 'ota-dismiss' }).transform).toBeDefined());
  });

  it('A6 나중에 — 감소 모션 ON: transform 없이 opacity만 남는다', async () => {
    mockReduceMotion({ enabled: true });
    renderWithTheme(<OtaReadyDialog visible onApply={noop} onDismiss={noop} />);
    await waitFor(() => expect(flatten({ testId: 'ota-dismiss' }).opacity).toBeDefined());
    expect(flatten({ testId: 'ota-dismiss' }).transform).toBeUndefined();
  });

  it('A7 지금 적용 — 감소 모션 OFF: transform이 부착된다', async () => {
    mockReduceMotion({ enabled: false });
    renderWithTheme(<OtaReadyDialog visible onApply={noop} onDismiss={noop} />);
    await waitFor(() => expect(flatten({ testId: 'ota-apply' }).transform).toBeDefined());
  });

  it('A7 지금 적용 — 감소 모션 ON: transform 없이 opacity만 남는다', async () => {
    mockReduceMotion({ enabled: true });
    renderWithTheme(<OtaReadyDialog visible onApply={noop} onDismiss={noop} />);
    await waitFor(() => expect(flatten({ testId: 'ota-apply' }).opacity).toBeDefined());
    expect(flatten({ testId: 'ota-apply' }).transform).toBeUndefined();
  });

  it('렌더 시 console.warn 0건(정적 opacity 계약 위반 없음)', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    renderWithTheme(<OtaReadyDialog visible onApply={noop} onDismiss={noop} />);
    expect(warn).not.toHaveBeenCalled();
  });
});
