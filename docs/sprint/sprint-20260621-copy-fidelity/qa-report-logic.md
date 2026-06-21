# QA Report — Logic / 통합 정합 (sprint-20260621-copy-fidelity, S6+S7)

검증자: qa-logic · 날짜: 2026-06-21 · 범위: 카피·미세 정합 스윕(순수 문자열/상수). 비주얼 충실도는 qa-visual 담당.

## 종합 판정: PASS (로직 완료)

`npm test`(jest) 140 suites / 1278 tests green, `tsc --noEmit` exit 0. 변경은 전부 순수 문자열/상수이며 로직·구조·토큰·네비게이션 불변. 구 문자열 잔존 0(예외 2건은 킷 별개 요소로 정상). 신규 로직(JoinLog 성공 토스트)은 성공 경로에만 존재하고 spec이 load-bearing으로 단언.

---

## 1. 카피 회귀 안전 (로직·구조·토큰 불변) — PASS

각 화면의 동작 경로가 문자열 변경과 무관하게 불변임을 생산자/소비자 양쪽 확인:

| 화면 | 동작 | 확인 |
|---|---|---|
| JoinLogScreen | `joinRoom({code})` → `refresh()` → `replace(LogScreen)` | `JoinLogScreen.tsx:36-47` — 분기/순서 불변. 변경은 라인 53·69·76·89-90 문자열뿐 |
| RoomCreatedScreen | `onEnter`/`onLater` props 위임 | `RoomCreatedScreen.tsx:60-62` 불변. 변경은 라인 44·52 문자열뿐 |
| AddSheet | `onCreate`/`onJoin` 위임, `creating` 비활성 | `AddSheet.tsx:82-94` 불변. 변경은 라인 80·85·91-92 문자열뿐 |
| WishlistView | `onAdd`/`onVisit`/`onRemove`, addedByMe 분기 | `WishlistView.tsx:84-180` 불변. 변경은 라인 61·68·157 문자열뿐 |
| LoginScreen | `onGoogle`/`onApple`/`showApple` 분기 | `LoginScreen.tsx:38-113` 불변. 변경은 `LOGIN_COPY`(:32) 상수뿐 |
| Stars | filledCount·editable·onChange | `Stars.tsx:24-59` 불변. 변경은 기본 `size` 14→15(:24) |

토큰 경유 유지(raw hex/숫자 0): 변경 라인에 색·간격 하드코딩 추가 없음. 별색은 여전히 `'starFill'` 토큰 경유(`Stars.tsx:35`).

## 2. JoinLog 성공 토스트(신규 로직) — PASS

- 생산자: `JoinLogScreen.tsx:42` — 성공 경로에서만 `showToast({ message: '로그에 들어왔어요! 💕', tone: 'positive' })` 후 `:43` replace.
- 실패 경로: `:44-46` catch 블록 비어 있음 → 토스트 없음. `useJoinRoom.error`가 인라인 에러로 표시(`:81-85`). 화면 유지.
- 전역 경유: 로컬 `useToastController`(`:31`) → 루트 `ToastProvider`. 테스트 헬퍼 `renderWithTheme.tsx:19-24`가 실제 `ToastProvider`를 래핑하고, spec은 `useJoinRoom`/`useMyLogsContext`만 모킹(토스트는 실 파이프라인) → 단언이 load-bearing.
- spec 단언: `JoinLogScreen.spec.tsx:72-82` 성공 시 `getByText('로그에 들어왔어요! 💕')` 단언, `:84-101` 실패 시 `mockReplace` 미호출 단언. 양쪽 커버.

## 3. 구 문자열 잔존 0 — PASS

변경 대상 구 문자열을 `src` 전수 grep: 실제 코드/주석에서 모두 제거됨. 잔존 2건은 **킷 별개 요소**로 정상(이슈 아님):

- `LogListScreen.tsx:371`·`LogListScreen.spec.tsx:267/279/282` "초대코드로 입장" → EmptyLogs onJoin(킷 mk-home:177, title 그대로). AddSheet(mk-home:198)와 다른 요소 → 불변·정상(ui-spec.md:45·95 명시).
- `Sheet.spec.tsx:37-69` "무엇을 할까요?" → 공용 Sheet **프리미티브** 제너릭 테스트의 임의 title 픽스처(AddSheet 실 title 아님). AddSheet 실 title은 `AddSheet.tsx:80` "어떻게 시작할까요?"로 갱신됨 → 정상(ui-spec.md:100 명시).

신규 카피 렌더 확인(생산자↔spec):
- "초대코드 입력"(`JoinLogScreen.tsx:53` ↔ `SubBar.spec.tsx:13`), "연인의 로그에 들어가기"(:69), "연인이 보낸 6자리 코드를…"(:76), "들어가기"(:89-90 ↔ `JoinLogScreen.spec.tsx` 전건).
- "우리 로그가 만들어졌어요"(`RoomCreatedScreen.tsx:44` ↔ `.spec.tsx:15`), "아래 코드를…"(:52).
- "어떻게 시작할까요?"(`AddSheet.tsx:80`), "먼저 시작하고 연인을 초대해요"(:85), "초대코드로 들어가기"(:91 ↔ `AddSheet.spec.tsx:27/44`·`PlusHeaderButton.spec.tsx:60-65/100-108`), "연인이 보낸 6자리 코드가 있어요"(:92).
- "다음엔 여기 어때요?"(`WishlistView.tsx:61` ↔ `.spec.tsx:45`), "가보고 싶은 맛집을 미리…"(:68), "{닉}님이 담았어요"(:157 ↔ `.spec.tsx:73/78`).
- `LOGIN_COPY` "둘이 다녀온 맛집을\n오래오래 함께 기억해요."(`LoginScreen.tsx:32` ↔ `.spec.tsx:24`).

주석 정합: `PlusHeaderButton.tsx:5`·`AddSheet.tsx:3,18` "초대코드로 들어가기"로 갱신됨. (참고: `LogListScreen.tsx:431` 주석 "초대코드 입장"은 EmptyLogs 흐름 설명으로 변경 범위 밖 — stale 아님, 영향 0.)

## 4. Stars size 영향 — PASS (영향 0 검증)

기본 `size` 14→15(`Stars.tsx:24`). 전 소비처가 명시 size 주입 → 기본값 미도달:
- `SelectedSpotCard.tsx:73` `size={13}` / `MuklogCard.tsx:128` `size={14}` / `MuklogEditor.tsx:564` `size={32}` / `MuklogDetailScreen.tsx:378` `size={STARS_SIZE}`.

→ 기존 소비처 렌더 영향 0. 기본 15는 향후 size 미주입 소비처에만 적용. 로직·동작 불변.

## 5. TDD / 종료 게이트 — PASS

- 인수조건↔spec 대응: AC A~F 각 신 문자열을 해당 spec이 단언(위 §3 매핑). Stars 기본값은 동작 단언(`Stars.spec.tsx` value 분기·onChange) 유지, size 상수 변경이 단언을 깨지 않음(스냅샷 없음).
- `tsc --noEmit` → **exit 0**.
- `npm test`(jest, CI=1) → **Test Suites: 140 passed, 140 total / Tests: 1278 passed, 1278 total / Time 8.197s**.
- 의미성(load-bearing): JoinLog 성공 토스트 spec은 실 ToastProvider 경유라 `showToast` 제거/변경 시 red(§2). 카피 spec은 정확 문자열 매칭(`getByText`)이라 오타/미변경 시 red.

## 6. 보안 · 컨벤션 — PASS

- 시크릿 미접근(.env/키 미열람).
- 컨벤션: 변경 6파일에서 `useCallback`/`useMemo` 0건, `export function` 0건(전부 화살표 const). named-args·enum-style·파일명=심볼명 유지(문자열 변경이 구조 불변).
- AWS 미사용·RLS 등 백엔드 변경 없음(카피 스윕이라 해당 경계 무변).

---

## 미검증 (사유)

- **디바이스 스모크(카피 실렌더 픽셀)**: 사용자 영역(plan.md:52). 정적+jest 렌더로는 통과, 실기기 클리핑/줄바꿈은 미검증.
- **비주얼 충실도(킷 라인 대비 정확 카피·줄바꿈)**: qa-visual 담당(역할 경계).
