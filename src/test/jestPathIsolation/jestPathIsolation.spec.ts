// src/test/jestPathIsolation/jestPathIsolation.spec.ts
// Jest 경로 격리 계약 (timerEnvironment.spec·imagePickerPermissions.spec의 "설정 계약" 가드 패턴).
//   로컬 Claude 세션은 `.claude/worktrees/<이름>/`에 저장소 사본을 만들고, 사본마다 `__mocks__`와
//   `node_modules`(심볼릭 링크가 아닌 실제 디렉터리일 수 있음)를 둔다. CI에는 워크트리가 없어
//   실행으로는 재현되지 않으므로 package.json의 jest 패턴을 Jest와 같은 방식으로 풀어 경로를 판정한다.
//
// 배경(2026-09-28): modulePathIgnorePatterns가 없으면 Jest 모듈 맵이 워크트리의 `__mocks__`까지
//   수집해 루트 수동 mock과 중복된다. 워크트리 쪽 react-native-svg mock이 선택되면 그 사본의
//   초기화되지 않은 `node_modules/react-native`를 불러 스위트가 시작하지 못한다
//   (Invariant Violation: __fbBatchedBridgeConfig is not set).
//   반대로 패턴을 `<rootDir>` 없이 쓰면 워크트리 안에서 실행할 때 절대 경로의 `/.claude/`와 겹쳐
//   모든 테스트가 제외된다. 그래서 같은 규칙을 메인 트리·워크트리 두 루트에서 모두 검사한다.
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '../../..');

type JestPathConfig = {
  modulePathIgnorePatterns?: string[];
  testPathIgnorePatterns?: string[];
};

const readJestConfig = (): JestPathConfig =>
  JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).jest;

// jest-config normalize는 패턴 속 <rootDir>를 문자열 그대로 치환하고, 소비처(모듈 맵·테스트 수집)는
// 패턴들을 '|'로 합친 하나의 정규식으로 절대 경로를 검사한다.
const isIgnoredPath = ({
  patterns,
  rootDir,
  filePath,
}: {
  patterns: string[] | undefined;
  rootDir: string;
  filePath: string;
}): boolean => {
  if (!patterns?.length) return false;
  const ignorePattern = new RegExp(
    patterns.map((pattern) => pattern.replace(/<rootDir>/g, rootDir)).join('|'),
  );
  return ignorePattern.test(filePath);
};

const MAIN_ROOT = '/repo';

const RUN_ROOTS = {
  MAIN_TREE: MAIN_ROOT,
  WORKTREE: `${MAIN_ROOT}/.claude/worktrees/some-session`,
} as const;

describe('Jest 경로 격리 계약', () => {
  const { modulePathIgnorePatterns, testPathIgnorePatterns } = readJestConfig();

  describe.each(Object.entries(RUN_ROOTS))('%s에서 실행할 때', (_label, rootDir) => {
    const otherWorktree = `${rootDir}/.claude/worktrees/other-session`;

    // node_modules 경로는 모듈 맵이 원래 제외하고, 이 패턴은 Node의 경로 탐색에는 쓰이지 않는다.
    // 결함은 워크트리 mock이 모듈 맵에 들어가 선택되는 데서 시작하므로 모듈 맵에 실제로 오르는 파일로 판정한다.
    it.each([
      '__mocks__/react-native-svg.js',
      'package.json',
      'src/components/Icon/Icon.tsx',
    ])('하위 워크트리의 %s는 모듈 맵에서 제외한다', (relativePath) => {
      const filePath = `${otherWorktree}/${relativePath}`;
      expect(isIgnoredPath({ patterns: modulePathIgnorePatterns, rootDir, filePath })).toBe(true);
    });

    it('자기 .claude 폴더의 훅·스킬 파일도 모듈 맵에서 제외한다', () => {
      const filePath = `${rootDir}/.claude/hooks/blockGitMutation.mjs`;
      expect(isIgnoredPath({ patterns: modulePathIgnorePatterns, rootDir, filePath })).toBe(true);
    });

    it('하위 워크트리의 테스트 파일은 수집하지 않는다', () => {
      const filePath = `${otherWorktree}/src/components/Icon/Icon.spec.tsx`;
      expect(isIgnoredPath({ patterns: testPathIgnorePatterns, rootDir, filePath })).toBe(true);
    });

    it.each([
      '__mocks__/react-native-svg.js',
      'package.json',
      'src/components/Icon/Icon.tsx',
    ])('자기 트리의 %s는 모듈로 계속 보인다', (relativePath) => {
      const filePath = `${rootDir}/${relativePath}`;
      expect(isIgnoredPath({ patterns: modulePathIgnorePatterns, rootDir, filePath })).toBe(false);
    });

    it('자기 트리의 테스트 파일은 계속 수집한다', () => {
      const filePath = `${rootDir}/src/components/Icon/Icon.spec.tsx`;
      expect(isIgnoredPath({ patterns: testPathIgnorePatterns, rootDir, filePath })).toBe(false);
    });
  });
});
