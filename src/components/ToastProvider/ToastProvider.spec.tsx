// src/components/ToastProvider.spec.tsx
// 전역 토스트 인프라(ToastProvider + useToastController) — 루트 단일 <Toast> 렌더·컨텍스트 showToast·
//   언마운트 독립(AC1·AC4). Provider 밖 사용 시 명확한 에러(개발 가드).
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text as RNText } from 'react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { ToastProvider, useToastController } from './ToastProvider';

// 토스트를 트리거하는 소비 컴포넌트(임의 깊이). 버튼 탭 시 showToast 호출.
const Trigger = ({ message, tone }: { message: string; tone?: 'neutral' | 'positive' }) => {
  const { showToast } = useToastController();
  return (
    <Pressable
      accessibilityLabel="fire"
      onPress={() => showToast(tone ? { message, tone } : { message })}
    />
  );
};

describe('ToastProvider + useToastController', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
  });

  it('초기에는 토스트가 보이지 않는다', () => {
    renderWithTheme(
      <ToastProvider>
        <Trigger message="담았어요" />
      </ToastProvider>,
    );
    expect(screen.queryByText('담았어요')).toBeNull();
  });

  it('showToast 호출 시 루트 <Toast>가 message로 노출된다 (AC1)', () => {
    renderWithTheme(
      <ToastProvider>
        <Trigger message="위시리스트에 담았어요 📍" />
      </ToastProvider>,
    );
    act(() => {
      fireEvent.press(screen.getByLabelText('fire'));
    });
    expect(screen.getByText('위시리스트에 담았어요 📍')).toBeTruthy();
  });

  it('tone="positive"면 ✓ 체크를 표시한다 (AC1)', () => {
    renderWithTheme(
      <ToastProvider>
        <Trigger message="먹로그를 삭제했어요" tone="positive" />
      </ToastProvider>,
    );
    act(() => {
      fireEvent.press(screen.getByLabelText('fire'));
    });
    expect(screen.getByText('✓')).toBeTruthy();
    expect(screen.getByText('먹로그를 삭제했어요')).toBeTruthy();
  });

  it('자동 사라짐(2200ms) 후 토스트가 사라진다', () => {
    renderWithTheme(
      <ToastProvider>
        <Trigger message="담았어요" />
      </ToastProvider>,
    );
    act(() => {
      fireEvent.press(screen.getByLabelText('fire'));
    });
    expect(screen.getByText('담았어요')).toBeTruthy();
    act(() => jest.advanceTimersByTime(2200));
    expect(screen.queryByText('담았어요')).toBeNull();
  });

  it('트리거 컴포넌트를 언마운트해도 토스트는 유지된다(루트 렌더 독립, AC4)', () => {
    // Trigger를 조건부로 마운트/언마운트하는 래퍼.
    const Host = () => {
      const [mounted, setMounted] = React.useState(true);
      const { showToast } = useToastController();
      return (
        <>
          <Pressable
            accessibilityLabel="show-then-unmount"
            onPress={() => {
              showToast({ message: '먹로그를 삭제했어요', tone: 'positive' });
              setMounted(false);
            }}
          />
          {mounted ? <RNText>트리거-마운트됨</RNText> : null}
        </>
      );
    };
    renderWithTheme(
      <ToastProvider>
        <Host />
      </ToastProvider>,
    );
    act(() => {
      fireEvent.press(screen.getByLabelText('show-then-unmount'));
    });
    // 트리거는 언마운트됐지만 토스트는 루트에서 계속 보인다.
    expect(screen.queryByText('트리거-마운트됨')).toBeNull();
    expect(screen.getByText('먹로그를 삭제했어요')).toBeTruthy();
  });

  it('Provider 밖에서 useToastController 사용 시 명확히 throw 한다(개발 가드)', () => {
    const Orphan = () => {
      useToastController();
      return null;
    };
    // 콘솔 에러 노이즈 억제. Provider 밖을 검증하므로 renderWithTheme(=ToastProvider 래핑) 대신 순수 render.
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Orphan />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });
});
