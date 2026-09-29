# 로컬 워크트리가 Jest 모듈 맵을 오염시키던 문제 수정

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-09-28 |
| 브랜치 | chore/jest-ignore-claude-worktrees |
| PR | https://github.com/Guksu/muklog/pull/39 |
| 관련 경로 | package.json, src/test/jestPathIsolation/jestPathIsolation.spec.ts, docs/testing-strategy.md |

## 1. 개요

로컬 Claude 워크트리가 있어도 테스트가 깨지지 않도록 Jest 설정에서 `.claude/` 폴더를 모듈 맵과 테스트 수집 양쪽에서 제외했다. 워크트리는 Claude 세션이 `.claude/worktrees/<이름>/`에 만드는 저장소 사본이고, 모듈 맵(haste map)은 Jest가 수동 mock과 모듈 위치를 모아 두는 색인이다. 워크트리에 실제 `node_modules`가 있으면 메인 트리의 Jest가 워크트리 쪽 mock을 골라 스위트가 시작조차 못 했다. 조사 중 같은 원인의 두 번째 결함도 확인해 함께 고쳤다: 기존 제외 패턴이 루트에 고정되지 않아 워크트리 안에서 `npm test`를 실행하면 테스트가 0개 수집됐다. 앱 코드는 변경하지 않았다.

## 2. 작업 내용

- `package.json`
  - `jest.modulePathIgnorePatterns: ["<rootDir>/\\.claude/"]`를 신설했다. 워크트리의 `__mocks__`·`package.json`·소스를 포함한 `.claude/` 하위 전체가 모듈 맵에서 빠진다.
  - `jest.testPathIgnorePatterns`의 `/\\.claude/`를 `<rootDir>/\\.claude/`로 바꿨다. 워크트리 안에서 실행할 때는 절대 경로 자체에 `/.claude/`가 있어 기존 패턴이 모든 테스트를 제외했다.
- `src/test/jestPathIsolation/jestPathIsolation.spec.ts`(신설): CI에는 워크트리가 없어 실행으로 재현할 수 없으므로, `package.json`의 두 패턴을 Jest와 같은 방식(`<rootDir>` 문자열 치환 → `|`로 결합한 정규식)으로 풀어 경로를 판정한다. 메인 트리 루트와 워크트리 루트 두 경우에서 다음을 검사한다(18건).
  - 하위 워크트리의 mock·`package.json`·소스는 모듈 맵에서 제외, 테스트는 수집 제외
  - 루트 자신의 `.claude/`(훅·스킬)도 모듈 맵에서 제외
  - 자기 트리의 mock·`package.json`·소스는 모듈로 유지, 테스트는 수집 유지
  - 처음에는 `node_modules` 경로도 판정했지만 독립 QA 권고로 뺐다. 모듈 맵은 `/node_modules/`가 들어간 경로를 원래 제외하고(`jest-haste-map` `_ignore`), 이 패턴은 Node의 경로 탐색에는 쓰이지 않아 해당 케이스는 하중이 없었다. 오히려 `/node_modules/`를 더하는 무해한 변경에 거짓 실패를 냈다.
- `docs/testing-strategy.md`: "로컬 워크트리와 경로 격리" 절을 추가했다. 두 패턴의 역할, `<rootDir>` 고정 이유, `.claude/` 아래 파일을 테스트에서 import하지 않는다는 제약을 적었다.
- 사전 확인: 테스트·소스에서 `.claude/`를 참조하는 곳은 `src/theme/tokens/tokens.ts`의 주석 1건뿐이다. `.claude/scripts/*.mjs`를 import하는 테스트는 없다.
- 원인 상세
  - 수정 전에는 워크트리 5개 × 루트 mock 3종이 같은 이름으로 중복 등록됐다(중복 mock 경고 15건). 워크트리 `package.json`의 같은 패키지 이름 충돌 경고도 1건 있었다.
  - 이름이 같은 mock은 나중에 처리된 파일이 이긴다(`jest-haste-map`의 `mocks.set`). 새 캐시로 처음부터 크롤링하면 루트 mock이 선택돼 통과했다. 하지만 기존 캐시가 증분 갱신될 때는 새로 바뀐 워크트리 mock이 루트 mock을 덮어써 실패했다. 워크트리를 새로 만들거나 편집한 직후에만 간헐적으로 드러난 이유다.
  - 선택된 워크트리 mock은 자기 위치에서 `react-native`를 찾으므로 워크트리의 `node_modules`(초기화되지 않은 두 번째 사본)로 간다. 따라서 고칠 지점은 mock이 모듈 맵에 오르는 것 자체다.
  - 워크트리 `node_modules`가 심볼릭 링크일 때 경고에 그친 것은 링크가 루트 `node_modules`로 풀려 이미 초기화된 같은 `react-native`를 공유하기 때문으로 추정한다(직접 검증하지 않음).
- 브랜치: 세션 기본 브랜치 `claude/intelligent-tesla-3524c9`는 금지된 프리픽스라 사용자 지시에 따라 `git switch -c chore/jest-ignore-claude-worktrees`로 옮겨 작업했다.

## 3. 검증 결과

이 워크트리는 `.claude/worktrees/` 아래에 있고 실제 `node_modules` 디렉터리를 가진 재현 조건 그 자체다. 메인 트리(`/Users/kimjongmin/dev/muklog`)에도 실제 `node_modules`를 가진 워크트리 3개가 있었다. 메인 트리는 다른 세션이 쓰는 체크아웃(`fix/memo-keyboard-visibility`)이라 파일을 고치지 않고, 이 브랜치의 jest 설정 블록에 `rootDir`만 더해 `--config`로 주입했다.

| 검증 | 명령 | 결과 |
|------|------|------|
| 증상 재현(수정 전) | 메인 트리에서 `npx jest src/features/muklog/MuklogEditor/MuklogEditor.spec.tsx` | fail — `Invariant Violation: __fbBatchedBridgeConfig is not set`, 워크트리 `__mocks__/react-native-svg.js` 경유 |
| Red | `npx jest src/test/jestPathIsolation --testPathIgnorePatterns '/node_modules/'` (수정 전 설정, 워크트리 안이라 수집 패턴만 CLI로 덮어씀) | fail — 14건 중 5건 실패(모듈 맵 제외 4, 워크트리 안 수집 1) |
| Green | `npx jest src/test/jestPathIsolation` (CLI 덮어쓰기 없음) | pass — 14/14, QA 권고 반영 후 18/18 |
| 뮤테이션 7종(최종 spec) | `package.json` 패턴을 변형해 spec 실행, 매회 원복 후 `cmp`로 확인 | 모듈 패턴 제거 8 fail / 모듈 패턴 비고정 3 / 수집 패턴 비고정 1 / 수집 패턴에서 `.claude` 제거 2 / 과잉 `<rootDir>/` 6 / `.claude/worktrees/`로 좁히기 2 — 모두 검출. 무해한 `/node_modules/` 추가는 0 fail(거짓 실패 없음) |
| 전체(워크트리 안) | `npm test` (CLI 덮어쓰기 없음) | pass — 첫 실행 234 suites / 2656 tests(31.1초), QA 반영 후 234 suites / 2660 tests(12.3초). 수정 전에는 같은 위치에서 수집 0개 |
| 타입 | `npx tsc --noEmit` | pass |
| 공백 | `git diff --check` | pass |
| A/B 새 캐시(메인 트리 배치) | 수정 전/후 설정 주입, 실행마다 새 `--cacheDirectory` | 수정 전 pass 3/3이지만 매번 중복 경고 15건 / 수정 후 pass 2/2, 경고 0 |
| A/B 증분 갱신(메인 트리 배치) | 같은 캐시에서 워크트리 mock 파일의 수정 시각만 갱신 후 재실행 | 수정 전 fail(Invariant, 워크트리 mock 선택) / 수정 후 pass, 경고 0 |
| 전체(메인 트리 배치) | 수정 후 설정 주입, `npx jest` 전체 | pass — 233 suites / 2651 tests, 중복 경고 0, 로그에 워크트리 경로 0건 |
| 독립 QA | qa-logic 읽기 전용 검토(스펙·컨벤션 2축) | 차단 이슈 0. 스펙 축 권고 1(`node_modules` 케이스 무하중 → 반영), 참고 4(아래 §5에 반영). 컨벤션 축 위반 0. 실제 Jest API(`readConfig`·`Runtime.createHasteMap`·`SearchSource`)로 스크래치 가짜 저장소에서 수정 전 실패·수정 후 정상을 독립 재현 |
| PR 병합 가능 여부 | `gh pr view 39`(앱 PR 상태 포함) | MERGEABLE / CLEAN, 충돌 없음. 저장소에 설정된 CI 검사 0건 |
| main 병합 상태 | PR 생성 시점 `origin/main`(이 브랜치보다 6커밋 앞섬, 겹치는 파일 0)에 이 브랜치 변경 4파일을 얹어 스크래치에서 `npx jest` 전체·`npx tsc --noEmit` | pass — 237 suites / 2849 tests, 타입 검사 통과 |

테스트 수 차이(2660 대 2651)는 두 체크아웃의 소스 차이다. 이 브랜치에는 신규 spec 18건이 있고, 메인 트리 브랜치에는 이 브랜치에 없는 커밋이 있다. 메인 트리 배치 전체 실행은 spec 수정 전에 했지만, 주입한 jest 설정은 이후 바뀌지 않았다.

## 4. 확인 필요 · 후속

- 커밋·푸시·PR 생성은 사용자 요청으로 대행했다. PR 병합은 사용자가 한다. 메인 트리는 이 변경이 main에 병합된 뒤 브랜치를 갱신하면 적용된다. 설정이 바뀌면 Jest 캐시 키가 달라져 새 모듈 맵을 만들므로 캐시 삭제는 필요 없다.
- 후속(범위 밖): `testPathIgnorePatterns`의 `/supabase/`도 루트에 고정되지 않았다. 목적은 Deno로 도는 `supabase/functions/` 테스트 제외인데, 지금 패턴은 `src/lib/supabase/` 아래 spec도 조용히 제외한다. 현재 그 폴더에 spec이 없어 피해는 없다. 그곳에 테스트를 추가하는 작업에서 `<rootDir>/supabase/`로 고정한다.

## 5. 주의사항

- 두 패턴은 반드시 `<rootDir>`로 시작해야 한다. `/\.claude/`로 되돌리면 워크트리 안에서 테스트가 0개 수집되고, 모듈 패턴을 그렇게 쓰면 워크트리 안에서 모든 모듈이 보이지 않는다.
- `.claude/` 아래 파일은 이제 Jest 모듈 로더에서 보이지 않는다. 테스트가 그 아래 스크립트를 써야 하면 `src/`로 옮긴다.
- 루트에 고정했기 때문에 루트가 아닌 곳의 `.claude/` 폴더(예: `src/어딘가/.claude/`)는 이제 수집·모듈 맵 대상이다. 현재 저장소에 그런 폴더는 없다.
- 수집 패턴의 `.claude` 항목은 모듈 패턴과 겹치는 이중 방어다. 테스트 수집은 모듈 맵에 있는 파일만 보기 때문이다. 한쪽이 지워져도 버티도록 둘 다 유지하고 spec도 따로 검사한다.
- Jest는 `<rootDir>` 경로를 정규식 이스케이프 없이 끼워 넣는다. 저장소 경로에 `(`·`+`·`[` 같은 문자가 들어가면 패턴이 조용히 맞지 않게 된다(Jest 자체 한계, 현재 경로에는 해당 없음).
- 회귀 spec은 Jest 29의 패턴 해석 방식(`jest-config` normalize의 `<rootDir>` 문자열 치환, 소비처의 `|` 결합 정규식)을 따라 판정한다. Jest 메이저 업그레이드로 해석 방식이 바뀌면 spec의 `isIgnoredPath`를 다시 대조한다.
- 진단 중 이 워크트리의 `__mocks__/react-native-svg.js` 수정 시각을 갱신했다(내용 불변, git 변경 없음). 진단용 캐시·로그는 세션 스크래치 경로에만 두었고 저장소 설정에 계측 코드를 넣지 않았다.
