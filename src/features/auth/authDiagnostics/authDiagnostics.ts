// src/features/auth/authDiagnostics/authDiagnostics.ts
// ⚠️ 임시 진단 도구 — 원인 확정 후 삭제한다(AUTH_DIAGNOSTICS_ENABLED=false 면 완전 no-op).
//
// 왜 화면에 찍나:
//   preview 빌드는 네이티브/플로우 오류를 조용히 삼키고(2026-06-26 교훈), QR 설치라 adb logcat 도 못 쓴다.
//   OAuth 실패 지점이 넷 중 어디인지(리다이렉트 URL / 브라우저 결과 / code 유무 / 교환 오류)를
//   기기 화면에서 바로 읽을 수 있어야 추측 빌드를 반복하지 않는다.

/** 진단 표시 스위치. 릴리스 전 반드시 false(또는 모듈째 삭제). */
export const AUTH_DIAGNOSTICS_ENABLED = true;

// 최근 트레이스(최대 MAX_LINES). 모듈 싱글턴 — 앱 재시작 시 자연히 비워진다.
const MAX_LINES = 12;
let lines: string[] = [];

// 구독자(화면). 비동기로 늦게 추가되는 줄도 즉시 보이게 하려면 재렌더를 직접 깨워야 한다 —
// 상태 전이 없이 추가되는 줄(포그라운드 복귀 트레이스 등)은 구독 없이는 화면에 영영 안 나타난다.
let listeners: (() => void)[] = [];

/** 트레이스 변경 구독. 반환값은 해제 함수. */
export const subscribeAuthTrace = ({ onChange }: { onChange: () => void }): (() => void) => {
  listeners = [...listeners, onChange];
  return function unsubscribeAuthTrace() {
    listeners = listeners.filter((listener) => listener !== onChange);
  };
};

/** 트레이스 1줄 기록. 비활성 시 no-op. */
export const traceAuth = ({ line }: { line: string }): void => {
  if (!AUTH_DIAGNOSTICS_ENABLED) return;
  lines = [...lines, line].slice(-MAX_LINES);
  // logcat/Metro 로 함께 흘린다(케이블 연결 시 병행 확인용).
  console.log(`[authDiag] ${line}`);
  listeners.forEach((notify) => notify());
};

/** 기록된 트레이스 전체(오래된 순). */
export const readAuthTrace = (): string[] => lines;

/** 트레이스 초기화(재시도 전 호출). */
export const clearAuthTrace = (): void => {
  lines = [];
};
