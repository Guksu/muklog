// src/navigation/screens/relativeTimeLabel.spec.ts
// 상대시간 라벨 유틸 — 킷 mk-ui.jsx:256-265 agoLabel 동등(오늘/어제/N일 전/N주 전/N개월 전/N년 전).
//   카드 통계행 "마지막 기록 {상대시간}"(home-fidelity, plan AC3)에서 lastMuklogAt(ISO|null) 표기.
//   now는 테스트 결정성을 위해 주입(미주입 시 Date.now()). 킷 임계값(7/28/365일·30/365 나눗셈) 정합.
import { relativeTimeLabel } from './relativeTimeLabel';

// 기준 시각 고정(2026-06-20T12:00:00Z) — 임계 경계를 결정적으로 검증.
const NOW = '2026-06-20T12:00:00.000Z';
const at = (iso: string) => relativeTimeLabel({ iso, now: NOW });

describe('relativeTimeLabel — 킷 agoLabel 동등(오늘/어제/N일/N주/N개월/N년)', () => {
  it('같은 날(0일)이면 "오늘"', () => {
    expect(at('2026-06-20T09:00:00.000Z')).toBe('오늘');
  });

  it('미래(now 이후)도 "오늘"로 안전 폴백(음수 일수 → days<=0)', () => {
    expect(at('2026-06-21T09:00:00.000Z')).toBe('오늘');
  });

  it('하루 전이면 "어제"', () => {
    expect(at('2026-06-19T12:00:00.000Z')).toBe('어제');
  });

  it('2~6일이면 "N일 전"', () => {
    expect(at('2026-06-18T12:00:00.000Z')).toBe('2일 전');
    expect(at('2026-06-14T12:00:00.000Z')).toBe('6일 전');
  });

  it('7~27일이면 "N주 전"(7로 내림)', () => {
    expect(at('2026-06-13T12:00:00.000Z')).toBe('1주 전'); // 7일
    expect(at('2026-05-30T12:00:00.000Z')).toBe('3주 전'); // 21일
  });

  it('28~364일이면 "N개월 전"(30으로 내림)', () => {
    expect(at('2026-05-23T12:00:00.000Z')).toBe('1개월 전'); // 28일 → floor(28/30)=0? 경계: 킷은 28일부터 개월
  });

  it('명확한 개월 구간을 "N개월 전"으로 표기', () => {
    expect(at('2026-04-21T12:00:00.000Z')).toBe('2개월 전'); // 60일 → floor(60/30)=2
    expect(at('2025-12-22T12:00:00.000Z')).toBe('6개월 전'); // 180일
  });

  it('365일 이상이면 "N년 전"(365로 내림)', () => {
    expect(at('2025-06-20T12:00:00.000Z')).toBe('1년 전'); // 365일
    expect(at('2024-06-20T12:00:00.000Z')).toBe('2년 전'); // 730일
  });

  it('iso가 null이면 빈 문자열(통계행 우측 폴백 처리는 호출부)', () => {
    expect(relativeTimeLabel({ iso: null, now: NOW })).toBe('');
  });

  it('파싱 불가 입력이면 빈 문자열', () => {
    expect(relativeTimeLabel({ iso: 'not-a-date', now: NOW })).toBe('');
  });

  it('now 미주입 시 Date.now() 기준으로 동작(과거 시각은 "전" 라벨)', () => {
    const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
    expect(relativeTimeLabel({ iso: oneDayAgo })).toBe('어제');
  });
});
