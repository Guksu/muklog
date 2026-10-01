// supabase/functions/_shared/captureWarnings.ts
// 테스트 전용 도우미 — console.warn 호출을 잠시 가로채 인자를 모은다(오류 로그 내용 검증, join-push 리더 지시 R3).
//   ⚠️ 함수 코드(handler·index·_shared 본체)는 이 파일을 import 하지 않는다 → 함수 배포 묶음에 들어가지 않는다.

/**
 * run 을 실행하는 동안 console.warn 호출 인자를 모아 돌려준다. 끝나면(실패해도) 원래 console.warn 으로 되돌린다.
 * @param run 경고를 남길 수 있는 작업
 * @returns console.warn 호출마다의 인자 배열(호출 순서대로)
 */
export const captureWarnings = async ({ run }: { run: () => Promise<unknown> }): Promise<unknown[][]> => {
  const original = console.warn;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => {
    calls.push(args);
  };
  try {
    await run();
  } finally {
    console.warn = original;
  }
  return calls;
};
