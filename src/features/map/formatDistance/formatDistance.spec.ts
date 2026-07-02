// src/features/map/formatDistance.spec.ts
// 거리(m) → 표기 문자열 순수 포맷 단위 테스트 (plan §4·§5-1 formatDistance).
//   <1000 "{n}m" / ≥1000 "{km}km"(소수1, 정수 km는 .0 생략) / null → ''.
import { formatDistance } from './formatDistance';

describe('formatDistance', () => {
  it('0m', () => expect(formatDistance({ distance: 0 })).toBe('0m'));
  it('999m', () => expect(formatDistance({ distance: 999 })).toBe('999m'));
  it('1000m → 1km(정수 km는 .0 생략)', () =>
    expect(formatDistance({ distance: 1000 })).toBe('1km'));
  it('1500m → 1.5km(소수1)', () => expect(formatDistance({ distance: 1500 })).toBe('1.5km'));
  it('2340m → 2.3km(반올림 소수1)', () =>
    expect(formatDistance({ distance: 2340 })).toBe('2.3km'));
  it('null → 빈 문자열(거리 결측)', () => expect(formatDistance({ distance: null })).toBe(''));
});
