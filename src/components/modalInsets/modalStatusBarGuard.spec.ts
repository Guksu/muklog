// src/components/modalInsets/modalStatusBarGuard.spec.ts
// 코드베이스 불변식 — RN Modal을 쓰는 모든 곳은 statusBarTranslucent를 켠다(dim-full-cover T5 / TC-D1·D2).
//   왜 소스 스캔인가: 딤이 상태바까지 덮는지는 네이티브 윈도우 동작이라 렌더 트리로 관측되지 않는다.
//   새 Modal을 추가하면서 prop을 빠뜨리면 그 화면만 조용히 예전 증상(상태바 띠만 밝게 남음)으로 돌아간다
//   → 렌더가 아니라 소스에 못 박는다. 선례: Sheet.spec.tsx G2(readFileSync + 정규식 구조 규약).
//   seam: 리포지토리 소스 트리 자체(plan §6 S3).
import { readFileSync, readdirSync } from 'fs';
import { join, relative } from 'path';

const SRC_ROOT = join(__dirname, '..', '..');

/** 이 prop이 없으면 Android에서 Modal 내용이 상태바 아래로 확장되지 않는다(plan §3.1). */
const REQUIRED_MODAL_PROP = 'statusBarTranslucent';

/**
 * JSX 소스의 주석을 공백으로 지운다 — 주석 속 예시 코드가 위반으로 오탐되지 않게.
 *   삭제가 아니라 공백 치환인 이유: 줄바꿈을 보존해야 위반 보고의 줄번호가 실제 파일과 일치한다.
 * @param source 원본 소스 문자열
 * @returns 주석 자리가 공백으로 바뀐, 길이·줄수가 같은 소스
 */
const blankComments = ({ source }: { source: string }): string => {
  const blank = (matched: string) => matched.replace(/[^\n]/g, ' ');
  return source.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/(^|\s)\/\/.*$/gm, blank);
};

/**
 * `<Modal ...>` 여는 태그 중 statusBarTranslucent가 없는 것을 찾는다.
 *   속성값의 중괄호 표현식 안에 `>`가 들어갈 수 있어(예: `onRequestClose={() => x}`) 정규식 한 방이 아니라
 *   중괄호 깊이를 세며 태그의 끝을 찾는다.
 * @param source 검사할 JSX 소스(주석 포함 가능)
 * @param filePath 위반 보고에 쓸 파일 경로
 * @returns 위반 위치 문자열 배열(`경로:줄번호`). 위반이 없으면 빈 배열
 */
export const findModalsMissingStatusBarTranslucent = ({
  source,
  filePath,
}: {
  source: string;
  filePath: string;
}): string[] => {
  const scanned = blankComments({ source });
  const violations: string[] = [];
  const opener = /<Modal\b/g;
  let match = opener.exec(scanned);
  while (match !== null) {
    let depth = 0;
    let cursor = match.index + match[0].length;
    while (cursor < scanned.length) {
      const char = scanned[cursor];
      if (char === '{') depth += 1;
      else if (char === '}') depth -= 1;
      else if (char === '>' && depth === 0) break;
      cursor += 1;
    }
    const tag = scanned.slice(match.index, cursor + 1);
    if (!tag.includes(REQUIRED_MODAL_PROP)) {
      const line = scanned.slice(0, match.index).split('\n').length;
      violations.push(`${filePath}:${line}`);
    }
    match = opener.exec(scanned);
  }
  return violations;
};

/**
 * 디렉토리를 재귀 순회해 spec이 아닌 `.tsx` 파일 경로를 모은다.
 * @param dir 순회 시작 디렉토리(절대 경로)
 * @returns 검사 대상 파일의 절대 경로 배열
 */
const collectSourceFiles = ({ dir }: { dir: string }): string[] => {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return collectSourceFiles({ dir: path });
    if (!entry.name.endsWith('.tsx')) return [];
    if (entry.name.endsWith('.spec.tsx')) return [];
    return [path];
  });
};

describe('Modal statusBarTranslucent 가드', () => {
  // TC-D1
  it('src의 모든 <Modal>이 statusBarTranslucent를 갖는다', () => {
    const violations = collectSourceFiles({ dir: SRC_ROOT }).flatMap((path) =>
      findModalsMissingStatusBarTranslucent({
        source: readFileSync(path, 'utf8'),
        filePath: relative(SRC_ROOT, path),
      }),
    );
    expect(violations).toEqual([]);
  });

  // 가드-the-가드: 스캐너가 아무것도 못 찾아서 통과하는 상황(정규식 오타 등)을 배제한다.
  it('스캐너가 실제로 Modal 사용처를 4곳 이상 발견한다', () => {
    const modalFiles = collectSourceFiles({ dir: SRC_ROOT }).filter((path) =>
      blankComments({ source: readFileSync(path, 'utf8') }).includes('<Modal'),
    );
    expect(modalFiles.length).toBeGreaterThanOrEqual(4);
  });

  // TC-D2
  it('statusBarTranslucent 없는 <Modal>을 위반으로 잡고 위치를 보고한다', () => {
    const source = ['const A = () => (', '  <Modal visible transparent>', '    <View />', '  </Modal>', ');'].join(
      '\n',
    );
    expect(
      findModalsMissingStatusBarTranslucent({ source, filePath: 'features/x/X.tsx' }),
    ).toEqual(['features/x/X.tsx:2']);
  });

  it('중괄호 표현식 안의 `>`가 태그 끝으로 오인되지 않는다', () => {
    const source = '<Modal visible onRequestClose={() => close()} statusBarTranslucent>';
    expect(findModalsMissingStatusBarTranslucent({ source, filePath: 'a.tsx' })).toEqual([]);
  });

  it('주석 속 <Modal> 예시는 위반으로 세지 않는다', () => {
    const source = '// <Modal visible transparent>\nconst x = 1;';
    expect(findModalsMissingStatusBarTranslucent({ source, filePath: 'a.tsx' })).toEqual([]);
  });
});
