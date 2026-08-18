// src/features/muklog/MuklogEditor/memoBoxHeight.ts
// 메모 입력 박스의 고정 높이 계산(memo-max-height plan §4-2).
//   킷 mk-log.jsx:452 <textarea rows={4}> + lk.textarea(:645) resize:none = "고정 4줄 + 내부 스크롤".
//   RN에는 rows가 없어 픽셀 높이로 번역해야 하고, RN box model은 height가 padding·border를 포함한다.
//   높이 계약의 단일 출처 — 화면은 이 함수를 호출해 minHeight/maxHeight에 같은 값을 넣는다(하드코딩 금지).

/** 메모 입력이 보여줄 줄 수 — 킷 <textarea rows={4}>. */
export const MEMO_INPUT_LINES = 4;

/**
 * 고정 줄 수 기준 입력 박스의 전체 높이를 계산한다(RN box model: padding·border 포함).
 * @param lineHeight 한 줄 높이(px) — 타이포 토큰의 lineHeight
 * @param lines 보여줄 줄 수
 * @param paddingVertical 상/하 각각의 안쪽 여백(px)
 * @param borderWidth 상/하 각각의 테두리 두께(px) — 플랫폼별 hairline 폭 반영
 * @returns 박스 높이(px)
 */
export const memoBoxHeight = ({
  lineHeight,
  lines,
  paddingVertical,
  borderWidth,
}: {
  lineHeight: number;
  lines: number;
  paddingVertical: number;
  borderWidth: number;
}): number => lineHeight * lines + paddingVertical * 2 + borderWidth * 2;
