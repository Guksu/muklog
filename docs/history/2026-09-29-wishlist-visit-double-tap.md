# 위시 목록 "기록하기" 전환 중 재탭으로 다른 위시가 지워지던 문제 수정

| 항목 | 내용 |
|------|------|
| 날짜 | 2026-09-29 |
| 브랜치 | fix/wishlist-visit-double-tap |
| PR | https://github.com/Guksu/muklog/pull/40 |
| 관련 경로 | src/navigation/screens/LogScreen/, docs/design/architecture.md, docs/ux/ux-backlog.md |

## 1. 개요

UX 백로그 U67을 처리했다(위반 원칙 3·9). 비주얼 변경이 없는 데이터 정합성 버그 수정이다. 위시 목록에서 A 가게의 "기록하기"를 누르고 에디터가 올라오는 사이 B 가게의 "기록하기"를 누르면, 화면에는 A 가게가 채워져 있지만 저장하면 A로 먹로그가 생기고 A 위시는 남은 채 B 위시가 지워질 수 있었다. 직전 스프린트(U12)에서 지도 위시 카드를 설계하며 찾은 문제이고, 같은 방식으로 막았다. 백로그 원문은 "두 번째 위시의 로그로 저장"이라고 적었지만, 같은 로그 안이라 roomId는 같고 어긋나는 것은 보이는 가게와 지울 위시였다(백로그 서술 정정).

## 2. 작업 내용

기획 → (퍼블리싱: 비주얼 변경 없음 확인만) → 구현 → 독립 검증 3종(qa-logic·qa-visual·qa-ux) → 수정 1회 → 재검증 순서로 진행했다. 전 과정은 워크플로 1회로 실행했다.

- 원인(코드 근거):
  - 에디터는 프리필을 마운트 때 한 번만 읽는다(`MuklogEditorRoute.tsx:71-73` → `usePlaceSelection.ts:25`의 `useState(initial)`). 반면 `fromWishlistId`는 렌더마다 route params에서 읽는다(`MuklogEditorRoute.tsx:48,54`).
  - react-navigation 7(routers 7.5.6)에서 같은 이름으로 `navigate`하면 맨 위 라우트를 재사용하고 params를 통째로 바꾼다(`StackRouter.tsx:378-382, 398-411`). 앱은 `getId`를 쓰지 않는다(`AppNavigator.tsx`).
  - 그래서 전환 중 두 번째 탭이 통과하면 화면은 A, params는 B가 되고, 저장 성공 시 B 위시를 지운다(`MuklogEditorRoute.tsx:81-90`).
- `src/navigation/screens/LogScreen/LogScreen.tsx` — `handleVisitWish` 첫 줄에 `if (!navigation.isFocused()) return;`을 넣고 이유 주석을 달았다. 지도 위시 카드(`MapTabScreen.handleVisitWish`, U12)와 같은 가드다. `isFocused()`는 호출 순간의 네비게이션 상태를 읽어 같은 렌더 안의 두 번째 탭도 막고, 상태를 저장하지 않아 돌아오면 저절로 다시 누를 수 있다.
- `src/navigation/screens/LogScreen/LogScreen.spec.tsx`
  - 네비게이션 더블에 `isFocused`를 더했다. `navigate`가 불리면 포커스를 잃고 복귀 헬퍼가 되돌린다(실제 순서 흉내). `push`·`dispatch`는 없다. QA 반영으로 포커스 효과를 훅 자리마다 보관·정리하도록 보강했다.
  - LV1(같은 행 연타 → navigate 1회, 인자 정확 일치), LV2(전환 중 다른 행 → 첫 위시만, 위시 삭제·재조회·토스트 0), LV3(복귀 뒤 다른 행 → 정상 이동)을 더했다. 기존 TC-5는 본문 무수정 통과.
- `docs/design/architecture.md` — §4 WishlistView "기록하기" 불릿에 전환 중 재탭 무시, MuklogEditor 진입 규칙("마운트 때만 읽는 params를 싣는 진입은 `isFocused()` 가드"), §5 스프린트 표에 `wishlist-visit-double-tap` 행.
- `docs/ux/ux-backlog.md` — U67을 완료로 바꾸고 서술을 정정했다. 같은 부류의 다른 경로를 후속 U68로 추가했다(§4).
- 공용 UI 패턴 라이브러리 조회: loading-button 후보의 판단값("진행 중 반복 탭 무시")은 같은 방향이지만, 여기서 진행 신호는 네비게이션 포커스이고 스피너·체크 표시는 비주얼 변경이라 코드는 가져오지 않았다.

**기획 결정 요약**(인계물 폴더는 폐기되므로 여기에 남긴다)

| 번호 | 결정 |
|------|------|
| D1 | 해법은 `isFocused()` 가드다. 기각: 에디터 `getId`(에디터 2장), `fromWishlistId`마다 에디터 재마운트(마지막 탭이 이기고 화면이 튄다, 에디터 변경은 범위 밖), 프리필 재시드(기준 스냅샷이 A라 편집 없이도 나가기 확인창이 뜨고 편집 모드에 영향), ref 잠금(풀 시점 위험), `useIsFocused` 렌더 값(재렌더 전 두 번째 탭을 못 막음 — 실제 라우터로 확인) |
| D2 | 충돌하면 먼저 누른 위시가 이긴다(화면에 이미 A가 올라와 있다) |
| D3 | 무시된 탭에 토스트·햅틱·비활성 표시를 두지 않는다(전환 자체가 즉각 피드백, U12와 같음) |
| D4 | 가드는 "기록하기"에만 둔다. ✕·추가·세그먼트·헤더 뒤로·⋯ 메뉴는 에디터 params 불일치를 만들지 않는다 |
| D5 | 같은 부류의 다른 경로(로그 목록 카드 교차 탭, 공용 조회 훅의 이전 응답)는 원인과 화면이 달라 후속 U68로 넘긴다 |
| D6 | 가드는 위시 조회보다 앞, 함수 첫 줄에 둔다(U12와 같은 순서) |
| D7 | architecture §4에 에디터 진입 규칙 한 줄을 더한다 |
| D8 | 스모크에서 새 위시·저장은 하지 않는다(짝꿍에게 보이는 실데이터) |

## 3. 검증 결과

| 검증 | 명령 | 결과 |
|------|------|------|
| Red→Green | `npx jest src/navigation/screens/LogScreen --modulePathIgnorePatterns '<rootDir>/\.claude/'` | 더블만 바꾼 뒤 69/69(TC-5 포함). 구현 전 LV1~LV3 3건 실패 → 72/72. LV3는 기획에서 "구현 전 통과"로 예상했지만 LV2 단계의 다른 행 탭이 가드 없이 통과해 호출이 3회가 되므로 실패가 맞다(기획 계산 착오, 같은 버그가 원인) |
| 전체 테스트 | `npm test -- --modulePathIgnorePatterns '<rootDir>/\.claude/'` | pass — 236 suites / 2834 tests(리더 재실행, +3) |
| 타입 | `npx tsc --noEmit` | pass |
| diff 검사 | `git diff --check` | pass |
| qa-logic | 교차 검증 + 트리 밖 뮤턴트 + 실제 라우터 스크래치 | pass. 가드 제거·반전·함수 뒤로 이동·`useIsFocused`로 교체·풀지 않는 ref 잠금·`push`·다른 출처의 `fromWishlistId`·무시 경로 토스트 등 뮤턴트가 모두 검출됨. 실제 라우터에서 가드를 빼면 "화면은 w7 시드, params는 w8"로 버그가 재현되고(RQ2), 가드가 있으면 같은 틱 탭·재렌더 뒤 탭·3연타 모두 에디터 1장·w7 유지, `goBack` 뒤에는 다시 누를 수 있음(RQ1·RQ1b·RQ1c·RQ3) |
| qa-visual | 비주얼 diff | pass(스타일·카피·레이아웃 변경 0) |
| qa-ux | 여정 추적 | pass. 1차 발견 1건(테스트 더블이 포커스 효과 정리를 흉내 내지 않음)을 반영해 재검증 통과 |
| iOS 시뮬레이터(iPhone 17 Pro / iOS 26.4) | Metro 8082 | 위시 목록 "기록하기" 연타 → "맛거리"·이자카야 프리필 에디터 1장 → ‹ 한 번에 목록 복귀 → 다시 누르면 정상으로 열림. 다른 위시 교차 탭은 이 계정에 위시가 1개라 확인하지 못했다(LV2·실제 라우터 RQ1로 대신 잠금). 저장은 하지 않았다 |

병렬 세션 워크트리(`.claude/worktrees/*`)의 `node_modules`가 jest 모듈 맵을 오염시켜, 모든 jest 실행에 워크트리 제외 옵션을 붙였다. 옵션 없는 기본 `npm test`는 이 코드와 무관하게 시작 전 실패한다. 스모크 때 8081 포트는 다른 세션 워크트리의 Metro가 쓰고 있어 8082로 띄웠다(그 프로세스는 건드리지 않았다).

## 4. 확인 필요 · 후속

- **디바이스 확인 이월(사용자)**: 위시가 2개 이상인 계정에서 A "기록하기" 직후 B "기록하기"를 빠르게 눌러도 에디터가 A로 열리고, 취소 시 두 위시가 모두 남는지. Android 전환 중 탭 동작.
- 후속 U68: 로그 목록에서 A 로그 카드를 누르고 전환 중 B 카드를 누르거나, 로그 A 화면에서 로그 B 알림을 누르면, 조회가 끝날 때까지 화면은 A인데 동작은 B의 로그로 될 수 있다(공용 조회 훅이 deps가 바뀌어도 이전 응답을 버리지 않음, 코드 읽기 근거·실행 미확인). U14와 같은 파일이라 함께 설계하는 것을 권한다.
- 참고(범위 밖, qa-ux info): 에디터에서 가게를 다른 곳으로 바꿔 저장해도 원래 위시는 지워진다(기존 동작). 저장 직후 재조회 전까지 옛 행이 잠깐 남는다. 전환 중 ✕·추가에는 가드가 없다(D4, 에디터 params와 무관).

## 5. 주의사항

- 에디터에 "마운트 때만 읽는 params"(프리필)를 싣는 새 진입점을 만들면 같은 `navigation.isFocused()` 가드를 함수 첫 줄에 둔다(architecture §4 규칙). 지금 해당 진입은 위시 목록과 지도 위시 카드 두 곳이다.
- 가드를 `useIsFocused()` 렌더 값으로 바꾸면 같은 틱의 두 번째 탭을 막지 못한다(실제 라우터 RQ1). ref로 잠그면 복귀 때 풀어야 하고, 못 풀면 버튼이 죽는다.
- LogScreen.spec의 네비게이션 더블은 `navigate` 뒤 포커스를 잃게 되어 있다. 이 흉내를 빼면(항상 true) 가드를 지워도 테스트가 통과한다.
