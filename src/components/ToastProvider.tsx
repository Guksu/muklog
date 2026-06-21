// src/components/ToastProvider.tsx
// 앱 전역 토스트 인프라 — 루트에서 단일 <Toast>를 렌더하고 컨텍스트로 showToast({ message, tone })를 제공한다.
//   왜 전역인가: 화면별 <Toast>는 showToast 직후 goBack()으로 트리거 화면이 언마운트되면 토스트가 사라진다(언마운트 레이스).
//     루트(네비게이터 바깥)에 두면 화면 전환·언마운트와 무관히 토스트가 유지된다.
//   내부 상태/타이머: 기존 useToast(visible/message/tone) + Toast(자동 사라짐 타이머) 그대로 재사용 — 표시층만 끌어올림.
//   배치(App.tsx): SafeArea/Theme 안(토큰·하단 inset 사용), Auth/AuthGate·네비게이터 바깥.
import React, { createContext, useContext } from 'react';

import { Toast, type ToastTone } from './Toast';
import { useToast } from './useToast';

/** showToast 인자 — Toast와 동일 계약(message 필수, tone 기본 neutral). */
export type ShowToastInput = { message: string; tone?: ToastTone };

type ToastController = {
  /** 전역 토스트 표시(루트 <Toast>가 화면 마운트와 무관히 노출). */
  showToast: (input: ShowToastInput) => void;
};

const ToastContext = createContext<ToastController | null>(null);

export type ToastProviderProps = { children: React.ReactNode };

export const ToastProvider = ({ children }: ToastProviderProps) => {
  // 기존 프리젠테이셔널 상태 훅 재사용 — show/hide로 visible·message·tone 관리(타이머는 Toast 소유).
  const { toast, show, hide } = useToast();
  // show는 useToast가 매 렌더 새로 만들지만, 컨텍스트 값으로 그대로 노출(useCallback 지양 — 컨벤션).
  const controller: ToastController = { showToast: show };

  return (
    <ToastContext.Provider value={controller}>
      {children}
      {/* 루트 단일 토스트 — children(네비게이터/화면) 바깥에서 렌더돼 화면 전환과 독립적으로 표시된다. */}
      <Toast {...toast} onHide={hide} />
    </ToastContext.Provider>
  );
};

/**
 * 전역 토스트 컨트롤러({ showToast })를 반환.
 * Provider 바깥에서 호출하면 명확히 throw 한다(런타임 무동작 방지·개발 가드).
 */
export const useToastController = (): ToastController => {
  const ctx = useContext(ToastContext);
  if (ctx === null) {
    throw new Error('useToastController()는 <ToastProvider> 트리 안에서만 호출할 수 있습니다.');
  }
  return ctx;
};
