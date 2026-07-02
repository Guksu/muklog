// src/features/appVersion/compareVersion/compareVersion.spec.ts
// semver 3자리 비교 단위 테스트 (app-version-gate plan §5 T2·§5-1).
//   정상 3분기 / 경계(patch·두 자리 minor) / 실패(형불량·결측) → null(fail-open 트리거).
import { compareVersion } from './compareVersion';

describe('compareVersion (T2)', () => {
  it('a<b → -1, a==b → 0, a>b → 1', () => {
    expect(compareVersion({ a: '1.0.0', b: '2.0.0' })).toBe(-1);
    expect(compareVersion({ a: '1.2.3', b: '1.2.3' })).toBe(0);
    expect(compareVersion({ a: '2.0.0', b: '1.9.9' })).toBe(1);
  });

  it('patch 단위 차이를 비교한다(1.0.0 < 1.0.1)', () => {
    expect(compareVersion({ a: '1.0.0', b: '1.0.1' })).toBe(-1);
    expect(compareVersion({ a: '1.0.1', b: '1.0.0' })).toBe(1);
  });

  it('두 자리 minor를 수치로 비교한다(1.10.0 > 1.9.0 — 문자열 비교 아님)', () => {
    expect(compareVersion({ a: '1.10.0', b: '1.9.0' })).toBe(1);
    expect(compareVersion({ a: '1.9.0', b: '1.10.0' })).toBe(-1);
  });

  it('형불량/결측이면 null을 반환한다(비교 불가 → fail-open)', () => {
    expect(compareVersion({ a: '1.0', b: '1.0.0' })).toBeNull(); // 2자리
    expect(compareVersion({ a: '1.0.0', b: '1.0' })).toBeNull();
    expect(compareVersion({ a: 'a.b.c', b: '1.0.0' })).toBeNull();
    expect(compareVersion({ a: '', b: '1.0.0' })).toBeNull();
    expect(compareVersion({ a: '1.0.0.0', b: '1.0.0' })).toBeNull(); // 4자리
    expect(compareVersion({ a: 'v1.0.0', b: '1.0.0' })).toBeNull(); // 접두 v
    expect(compareVersion({ a: '1.0.0 ', b: '1.0.0' })).toBeNull(); // 공백
  });
});
