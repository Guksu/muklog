// src/lib/queryClient/cacheGuardrails.spec.ts
// 캐시 계층 비용 가드레일 소스 스캔 (query-cache plan T5 AC5-2 · T6 AC6-3, harness-rules 규칙 8).
//   imagePickerPermissions.spec / otaConfig.spec의 "설정 계약을 파일로 단언" 패턴을 따른다 —
//   "코드에 없어야 하는 것"은 동작 테스트로 증명할 수 없으므로 소스를 읽어 단언한다.
//
// 왜 이 세 가지인가:
//   invalidateQueries — 신선도 트리거는 화면 포커스가 단독 소유한다(Q1=(A)). 추가하면 저장 1회당 조회 2회.
//   focusManager/onlineManager — AppState·NetInfo 연동은 앱이 앞으로 올 때마다 조회를 유발한다(폴링에 준함).
//   refetchInterval — 폴링 그 자체.
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const REPO_ROOT = join(__dirname, '../../..');
const SRC_ROOT = join(REPO_ROOT, 'src');

/** 스캔에서 제외할 파일: spec과 테스트 전용 하네스(프로덕션 코드가 아니다). */
const isProductionFile = ({ entry }: { entry: string }): boolean => {
  if (!/\.tsx?$/.test(entry)) return false;
  if (/\.spec\.tsx?$/.test(entry)) return false;
  if (entry === 'testQueryWrapper.tsx') return false; // 테스트 전용 하네스(프로덕션 배럴에서 미export).
  if (entry === 'jest.setup.ts') return false; // 테스트 부팅 스크립트.
  return true;
};

/** 스캔 대상: 프로덕션 소스(.ts/.tsx)에서 spec/테스트 하네스를 뺀 것. */
const collectProductionSources = ({ dir }: { dir: string }): string[] => {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...collectProductionSources({ dir: full }));
      continue;
    }
    if (!isProductionFile({ entry })) continue;
    files.push(full);
  }
  return files;
};

/**
 * 레포 루트 최상위 파일(App.tsx·index.ts)도 스캔한다 — 하위 디렉토리는 내려가지 않는다.
 *   focusManager.setEventListener(AppState 연동)는 react-query RN 통합을 켤 때 관례적으로 App.tsx에 심는다.
 *   즉 위반이 들어올 확률이 가장 높은 자리라 src/ 만 보면 가드에 사각지대가 생긴다(qa-logic S1).
 */
const collectRootSources = (): string[] =>
  readdirSync(REPO_ROOT)
    .filter((entry) => !statSync(join(REPO_ROOT, entry)).isDirectory() && isProductionFile({ entry }))
    .map((entry) => join(REPO_ROOT, entry));

const sources = [...collectRootSources(), ...collectProductionSources({ dir: SRC_ROOT })].map((path) => ({
  path,
  code: readFileSync(path, 'utf8'),
}));

/** 주석을 제외한 실제 코드에서만 찾는다(계약 표·설명 주석은 위반이 아니다). */
const findUsages = ({ token }: { token: string }): string[] =>
  sources
    .filter(({ code }) =>
      code
        .split('\n')
        .some((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*') && line.includes(token)),
    )
    .map(({ path }) => path.slice(REPO_ROOT.length + 1));

describe('조회 캐시 비용 가드레일 (소스 스캔)', () => {
  it('AC5-2: 프로덕션 코드에 invalidateQueries 호출이 0회다(신선도 트리거는 포커스가 단독 소유)', () => {
    expect(findUsages({ token: 'invalidateQueries' })).toEqual([]);
  });

  it('AC6-3: focusManager·onlineManager를 쓰지 않는다(AppState·NetInfo 기반 재조회 미도입)', () => {
    expect(findUsages({ token: 'focusManager' })).toEqual([]);
    expect(findUsages({ token: 'onlineManager' })).toEqual([]);
  });

  it('AC1-2: refetchInterval을 설정하는 코드가 없다(폴링 0)', () => {
    expect(findUsages({ token: 'refetchInterval' })).toEqual([]);
  });

  it('스캔이 실제로 소스를 읽고 있다(가드가 빈 배열을 무조건 통과시키지 않는지 확인)', () => {
    expect(sources.length).toBeGreaterThan(100);
    expect(findUsages({ token: 'useCachedQuery' }).length).toBeGreaterThan(0);
    // 레포 루트 App.tsx가 실제로 스캔 대상에 들어왔는지(가드 사각지대 회귀 방지).
    expect(sources.map(({ path }) => path.slice(REPO_ROOT.length + 1))).toContain('App.tsx');
  });
});
