// src/features/appVersion/compareVersion/compareVersion.ts
// semver 3자리("x.y.z") 수치 비교 순수 유틸 (app-version-gate plan §3.3).
//   생산자: resolveVersionGate(게이트 판정). 빌드번호(iOS buildNumber/Android versionCode)는 게이팅 미사용 — 3자리만.
//   결측/형불량(비"x.y.z"·NaN·음수)은 null(비교 불가 → 호출부 fail-open).

/** "x.y.z" 형식만 통과(3자리 정수). 앞뒤 공백·접두 v·prerelease 태그는 형불량으로 간주(엄격). */
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

/**
 * semver 3자리("x.y.z")를 major→minor→patch 순으로 비교한다.
 * @param a 비교 대상 A(현재 버전 등)
 * @param b 비교 대상 B(min/latest 등)
 * @returns -1(a<b) | 0(a==b) | 1(a>b) | null(어느 쪽이든 형불량/결측 → 비교 불가)
 */
export const compareVersion = ({ a, b }: { a: string; b: string }): -1 | 0 | 1 | null => {
  if (!SEMVER_PATTERN.test(a) || !SEMVER_PATTERN.test(b)) return null;
  const partsA = a.split('.').map((part) => Number(part));
  const partsB = b.split('.').map((part) => Number(part));
  for (let i = 0; i < 3; i += 1) {
    if (partsA[i] > partsB[i]) return 1;
    if (partsA[i] < partsB[i]) return -1;
  }
  return 0;
};
