// src/components/useToast.ts
// 토스트 표시 상태 훅(프리젠테이셔널) — Toast 컴포넌트와 짝. show/hide로 visible·message·tone만 관리.
//   소비처: const { toast, show, hide } = useToast();
//           성공 시 show({ message: '위시리스트에 담았어요 📍', tone: 'positive' });
//           렌더: <Toast {...toast} onHide={hide} />  (Toast가 자동 사라짐 타이머 소유)
//   데이터·네트워크 없음 — 트리거(언제 show할지)는 developer.
import { useState } from 'react';

import type { ToastTone } from '../Toast';

export type ToastState = { visible: boolean; message: string; tone: ToastTone };

const HIDDEN: ToastState = { visible: false, message: '', tone: 'neutral' };

export const useToast = () => {
  const [toast, setToast] = useState<ToastState>(HIDDEN);

  const show = ({ message, tone = 'neutral' }: { message: string; tone?: ToastTone }) =>
    setToast({ visible: true, message, tone });

  // 메시지·tone은 보존하고 visible만 내림(페이드아웃 등 후처리 여지).
  const hide = () => setToast((prev) => ({ ...prev, visible: false }));

  return { toast, show, hide };
};
