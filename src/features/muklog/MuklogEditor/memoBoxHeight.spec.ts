// src/features/muklog/MuklogEditor/memoBoxHeight.spec.ts
// 메모 입력 고정 높이 계약(memo-max-height plan §4-2 / §6-1 U1~U5).
//   킷 <textarea rows={4}> + resize:none = 고정 4줄 박스 → 높이는 lineHeight×lines + padding·border(RN box model).
import { MEMO_INPUT_LINES, memoBoxHeight } from './memoBoxHeight';

describe('memoBoxHeight — 메모 입력 고정 높이 계약', () => {
  it('U1: 킷 실수치(lh 24 × 4줄 + padding 14 + hairline 0.5)가 125다', () => {
    expect(memoBoxHeight({ lineHeight: 24, lines: 4, paddingVertical: 14, borderWidth: 0.5 })).toBe(125);
  });

  it('U2: Android hairline=1이면 126이다 (플랫폼별 border 폭 반영)', () => {
    expect(memoBoxHeight({ lineHeight: 24, lines: 4, paddingVertical: 14, borderWidth: 1 })).toBe(126);
  });

  it('U3: padding·border 0이면 순수 텍스트 높이만 남는다', () => {
    expect(memoBoxHeight({ lineHeight: 24, lines: 1, paddingVertical: 0, borderWidth: 0 })).toBe(24);
  });

  it('U4: 퇴화 입력(lines 0 / lineHeight 0)에도 예외 없이 padding·border만 반환한다', () => {
    expect(memoBoxHeight({ lineHeight: 24, lines: 0, paddingVertical: 14, borderWidth: 0.5 })).toBe(29);
    expect(memoBoxHeight({ lineHeight: 0, lines: 4, paddingVertical: 14, borderWidth: 0.5 })).toBe(29);
  });

  it('U5: 줄 수 상수가 킷 rows={4} 그대로 4다', () => {
    expect(MEMO_INPUT_LINES).toBe(4);
  });
});
