# QA Report — UI 리디자인 슬라이스 A

- **스프린트:** `sprint-20260610-ui-redesign` (슬라이스 A)
- **검증자:** qa-inspector (단독)
- **기준:** plan.md §6 인수조건 · `.claude/skills/ui-design` 브랜드 규칙 · `docs/code-convention.md` · `docs/testing-strategy.md`
- **판정:** **PASS** (블로커 0, 미해결 0, 경미 관찰 2건)

---

## 1. 종료 기준 (직접 실행)

| 게이트 | 결과 | 비고 |
|---|---|---|
| `npx tsc --noEmit` | **EXIT 0 (통과)** | 직접 실행 확인 |
| `npm test` | **27 suites / 170 tests 전부 통과** | dev-notes 수치와 일치 |
| 테스트 의미성(표본 perturbation) | **통과** | `primary` 토큰 `#3366FF`→`#FF0000` 변조 시 tokens.spec **빨강(1 failed)**, 복원 시 9 passed 재확인 → 단언이 실제로 잡음 |

> npm test 로그에 `act()` 경고가 1건 있으나 `MyLogsProvider`(슬라이스 외 feature)의 기존 테스트 위생 노이즈로, 실패가 아니며 이번 변경과 무관.

---

## 2. 인수조건 (plan §6)

### A. 브랜드/토큰 준수

| AC | 항목 | 결과 | 근거 |
|---|---|---|---|
| AC-1 | `primary==='#3366FF'`, `brand==='#0066FF'` | PASS | `tokens.ts:26,28` + `tokens.spec.ts:9,13` |
| AC-2 | `hairline/hairlineAlt/surfaceAlt/fgAssistive` 키 + `radius.control===10`,`card===16` | PASS | `tokens.ts:29-32,56` + `tokens.spec.ts:18-40` |
| AC-3 | 컴포넌트/화면 raw hex 0 | PASS | `grep -rnE "#[0-9a-fA-F]{6}" src/ --글로브` (tokens.ts·spec 제외) → **0건**. 아이콘 SVG는 `currentColor`만 |
| AC-4 | 카드/입력/아바타 보더가 hairline 토큰 | PASS | `color.border` 소비처 **0건**(`grep`), Button/Avatar/Card/ProfileScreen 입력 전부 `hairline` |
| AC-5 | body 계열 family === `Pretendard-Medium` | PASS | `tokens.ts:78-80` + `tokens.spec.ts:52-56` |

### B. 아이콘/이모지

| AC | 항목 | 결과 | 근거 |
|---|---|---|---|
| AC-6 | 제품 화면 렌더 JSX 이모지 0 | PASS | 이모지 grep 히트는 전부 `//`·`*` 코드 주석(대부분 `src/features/**` 미변경 파일). 렌더 JSX 이모지 0 |
| AC-7 | Icon 렌더/color 해석 테스트 | PASS | `Icon.spec.tsx` — name→testID, color 토큰→`#3366FF`/`#171717` 해석, size 적용 단언 |
| AC-8 | 헤더 버튼 글리프→Icon(접근성 라벨 유지) | PASS | PlusHeaderButton `Icon Plus`, ProfileHeaderButton `Icon Person`. `accessibilityLabel` "로그 만들기"/"프로필" 유지. spec에 `queryByText('+'/'프로필')===null` 추가 |

### C. 화면별 핵심 시각

| AC | 항목 | 결과 | 근거 |
|---|---|---|---|
| AC-9 | LogList 카드 = Card(hairline·r16) + chevron-right, 배지·생성일 불변 | PASS | `LogListScreen.tsx:31-39` Card+Badge+Icon. spec에 chevron 단언 추가, navigate/배지/생성일 단언 유지 |
| AC-10 | Profile 입력 radius=control(10)·hairline, 아바타 96 | PASS | `ProfileScreen.tsx:117,145-149,177` |
| AC-11 | 탭바 활성색=primary, 탭 아이콘 | PASS | `HomeTabs.tsx:42,57-74` (먹로그 bubble/bubble-fill, 지도 location) |

### D. 동작 불변 (UI-only 게이트) — 최우선

| AC | 항목 | 결과 | 근거 |
|---|---|---|---|
| AC-12 | 기존 동작 테스트 전부 통과 | PASS | 170 tests 통과. spec diff는 **추가만**(behavior 단언 0건 삭제 확인) |
| AC-13 | 라우트·훅·RPC·쿼리 변경 0 | PASS | `git diff --stat src/features/**` → **빈 결과(변경 0)**. `routes.ts`·`AppNavigator.tsx` 변경 0 |

### E. 컨벤션

| AC | 항목 | 결과 | 근거 |
|---|---|---|---|
| AC-14 | code-convention 100% | PASS | Icon/Card/Badge 전부 화살표 const + 구조분해 객체 인자. useCallback/useMemo 호출 0(히트는 전부 "지양" 주석). ProfileScreen useEffect 명명(`syncNicknameDraft`). HomeTabs `tabBarIcon` 객체 인자는 react-navigation 콜백 contract 예외(주석 명시) |

---

## 3. 회귀(동작 불변) 교차검증

| 경계면 | 생산자 | 소비자 | 판정 |
|---|---|---|---|
| 라우트 등록 ↔ navigate | `routes.ts`(미변경) | LogListScreen `navigate(LogScreen,{roomId})`·ProfileHeaderButton `navigate(Profile)` | 일치, 불변 |
| 훅 계약 | `useMyLogsContext/useCreateRoom/useProfile/useUpdateProfile`(미변경) | 화면 호출부 | 시그니처 불변, `src/features/**` diff 0 |
| RPC 인자 | `useCreateRoom` createRoom() 무인자 | PlusHeaderButton `createRoom()` | spec `toHaveBeenCalledWith()` 유지 |
| Card props ↔ 소비 | `Card({children,onPress,accessibilityLabel,testID,style})` | LogListScreen LogCard | 정합, onPress→navigate 불변 |
| Badge props ↔ 소비 | `Badge({label,tone,testID})` | LogCard `memberBadgeLabel` 파생 | 정합, 라벨 파생식 불변 |
| Icon props ↔ 소비 | `Icon({name:IconName,size?,color?:ColorToken})` | 4개 소비처 모두 enum `IconName.*` + 토큰 color | 정합, 존재하지 않는 토큰 키 참조 0 |
| 토큰 키 ↔ 소비처 | tokens.ts 신규/변경 키 | 화면/컴포넌트 | 미참조 토큰 키 0, tsc EXIT 0 |
| react-native-svg jest 모킹 | `__mocks__/react-native-svg.js` (SvgXml→View, props 통과) | Icon.spec(testID·color·size props 단언) | 모킹 정합, 테스트 실제 통과 |
| 접근성 라벨 회귀 | 헤더 버튼 글리프 제거 | `accessibilityLabel` 유지 | 스크린리더 회귀 0 |

---

## 4. 브랜드 규칙(ui-design) 준수

| 규칙 | 결과 | 근거 |
|---|---|---|
| raw hex 0 (컴포넌트/화면) | PASS | grep 0건 |
| 제품 화면 이모지 0 | PASS | 렌더 JSX 0(주석만 잔존) |
| 그림자 대신 헤어라인 보더 | PASS | Card `borderWidth: StyleSheet.hairlineWidth` + `hairline`, `shadow`/`elevation` 미사용. Card.spec이 `shadowColor/elevation === undefined` 단언 |
| radius(control 10 / card 16) | PASS | Button/입력=control, Card=card. `radius.md/lg/xl` 소비처 잔존 0 |
| primary #3366FF 토큰 일관 적용 | PASS | Button·헤더·탭바·스피너 전부 토큰 참조 |
| 텍스트 글리프(+,›,"프로필")→Icon | PASS | 화면 코드 글리프 렌더 0(grep). spec의 `queryByText('›'/'+')` 부재 단언만 의도적 잔존 |

---

## 5. 범위 준수 (슬라이스 A vs B)

- **슬라이스 B 미구현이 정상** — `SplashView.tsx`·`AuthErrorView.tsx`·`MapTabScreen.tsx`·`LogScreen.tsx`·`Text.tsx`·`Screen.tsx` **diff 0**(미변경). 토큰 값 변경의 혜택만 자동 반영 → 정상.
- **오버구현 없음.** HomeTabs 탭 아이콘은 plan §5-12·T18에서 A 포함으로 명시된 범위.
- Wanted Sans 미도입·다크 토글 미도입 — plan 결론대로 정상.

---

## 6. 발견 이슈 (코드 수정 없이 보고만)

블로커/기능 결함 **없음**. 아래는 경미 관찰(차기 정리 권장, 이번 PASS에 영향 없음):

1. **[경미·관찰] EmptyLogs 카피의 리터럴 `+`** — `LogListScreen.tsx:81` "오른쪽 위 + 버튼으로 로그를 만들어 보세요". 이는 **안내 문구(카피)**로 baseline부터 불변이며 글리프 버튼이 아님 → 브랜드 규칙 위반 아님. 단, 헤더 버튼이 `+` 글리프에서 plus 아이콘으로 바뀌었으므로 카피가 "오른쪽 위 버튼으로"처럼 실제 UI를 가리키도록 다듬으면 일관성↑(선택, UI-only 카피 변경은 이번 스코프상 보류 타당).
   - 권장: 슬라이스 B 또는 카피 정리 시 `+` 문자 제거 검토. 현재는 수정 불필요.

2. **[경미·관찰] 미사용 호환 토큰 보존** — `radius.md/lg/xl`, `color.border/borderStrong`이 소비처 0이나 호환 위해 보존됨(dev-notes §8 명시). dead 토큰이지만 의도적 보존이라 이슈 아님. 차기 정리 후보.

---

## 7. 미해결 / 미검증

- **디바이스 스모크(아이콘 실제 글리프 렌더):** react-native-svg는 네이티브 모듈로 Dev Client 1회 재빌드 후에만 실기기/시뮬에서 글리프가 렌더됨. **단위는 모킹으로 통과**했으나 실제 시각 렌더는 testing-strategy의 "외부 SDK/네이티브 = 디바이스 스모크" 경계에 따라 **사용자 디바이스 확인 필요**(미검증 — 통과로 처리하지 않음, 환경상 자동 검증 불가).
- 그 외 미해결 없음.

---

## 8. 최종 판정

**PASS.** 인수조건 AC-1~AC-14 전부 통과, 동작 불변(UI-only) 게이트 충족(`src/features/**` diff 0, 라우트/훅/RPC 불변, 기존 spec 단언 삭제 0), 브랜드 규칙(raw hex 0·이모지 0·헤어라인 보더·radius·primary·글리프 아이콘화) 충족. tsc EXIT 0 / 170 tests pass / 표본 perturbation으로 테스트 의미성 확인. 블로커·미해결 0(디바이스 스모크 1건만 환경상 미검증으로 분류).
