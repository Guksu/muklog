# QA Report (Logic) — 지도 탭 헤더 제거 (map-headerless)

> 검증일 2026-08-13 · qa-logic-map-headerless · 스킬 `integration-qa`
> 입력: `plan.md` · `dev-notes.md` · 구현 소스 · `docs/design/architecture.md` · `docs/loops/ux-improvements.md`
> 범위: 로직·통합 정합성·보안/비용·TDD·컨벤션 (**비주얼 충실도 제외** — `qa-report-visual.md` 담당)

---

## 0. 판정 요약

| 구분 | 결과 |
|---|---|
| **로직 인수조건** | **전부 통과** — T1·T3·T4·T5 자동 검증 통과, T2는 코드 리뷰로 통과, T6는 아래 B1 참조, T7 문서 확인 |
| **경계면 1~8** | **8/8 통과** — 옵션 유실 0, 정책 단일 출처 배선 확인, inset 누수 0 |
| **뮤테이션(load-bearing)** | **4/4 killed** (dev 미검증 표본 M5 포함) |
| **차단(Blocker)** | **B1 — `npm test` 현재 빨감. 단, 원인은 이번 스프린트 코드가 아니라 `src/`에 남은 타 에이전트 임시 파일 2개** |
| **미검증(이월)** | 디바이스 스모크 S1~S5(실기기 필요) — 특히 **S1은 자동 테스트 커버리지 공백(M4)의 유일한 판정자** |
| **스프린트 "로직 완료" 표시** | **B1 정리 후 가능**. 코드 자체는 결함 0 |

---

## 1. 통과 항목

### 1.1 경계면 2 — `screenOptions` 객체→함수 전환 시 옵션 유실 (계획이 지목한 최대 위험)
`git show HEAD:src/navigation/HomeTabs/HomeTabs.tsx`(전환 전) ↔ 현재 파일(전환 후)을 옵션 키 1:1 대조. **전환 전 6개 전부 보존, 값도 동일. 유실 0.**

| 옵션 | 전환 전 | 전환 후(`HomeTabs.tsx`) | 판정 |
|---|---|---|---|
| `header` | `({ route }) => <HomeHeader title={route.name === Routes.MapTab ? '지도' : '먹로그'} />` | `:42` `() => <HomeHeader title={route.name === Routes.MapTab ? '지도' : '먹로그'} />` | 통과 — `route`를 `screenOptions` 인자에서 클로저로 승계. react-navigation은 `screenOptions` 함수를 **라우트별로** 호출하므로 클로저의 `route`와 기존 `header({route})`의 `route`는 동일 객체다. 워드마크 분기 동작 불변 |
| `headerShadowVisible` | `false` | `:43` `false` | 통과 |
| `tabBarActiveTintColor` | `theme.color.primary` | `:44` 동일 | 통과 |
| `tabBarInactiveTintColor` | `theme.color.fgMuted` | `:46` 동일 | 통과 |
| `tabBarStyle` | `hideTabBar ? { display:'none' } : buildTabBarStyle({ insets, theme })` | `:49` 동일(**분기·인자 포함**) | 통과 — `hideTabBar`·`insets` 클로저 캡처 유지, 온보딩 탭바 숨김 회귀 없음 |
| `tabBarLabelStyle` | `{ fontFamily:'SUIT-SemiBold', fontSize:11 }` | `:51-54` 동일 | 통과 |
| `headerShown` (신규) | (없음 = 기본 true) | `:38` `shouldShowHomeHeader({ routeName: route.name })` | 통과 |

`Tab.Screen` 2개의 `title`·`tabBarIcon` 정의도 무접촉(diff 확인). **`tabBarStyle` 유실이 가장 조용한 사고**였는데(탭바 높이·Android 하단 inset이 기본값으로 되돌아감) 분기까지 온전하다.

### 1.2 경계면 1 — 정책 단일 출처가 실제 배선에 쓰이는가(우회 구현 아닌가)
- **생산자** `src/navigation/homeHeaderVisibility/homeHeaderVisibility.ts:15-16` — `routeName !== Routes.MapTab`.
- **소비자** `src/navigation/HomeTabs/HomeTabs.tsx:38` — `headerShown: shouldShowHomeHeader({ routeName: route.name })`.
- `grep -rn "shouldShowHomeHeader" src/` 결과 **소비자는 HomeTabs 한 곳뿐**(나머지는 정의·스펙). 우회 구현 없음.
- `grep -rn "headerShown" src/` 전수: HomeTabs는 `:38` 한 줄뿐 — **하드코딩된 `headerShown` 이중 배선 없음**. 계획이 금지한 두 패턴 모두 미사용: `header: () => null` 없음(`:42`가 실제 `HomeHeader` 반환), 전역 `headerShown:false` 후 역방향 없음.
- 문자열 하드코딩 0 — 양쪽 다 `Routes.MapTab`(`routes.ts:9` `'MapTab'`) 참조. enum-style 상수 컨벤션 준수.
- **미지 라우트 폴백**: `!==` 비교라 `HomeTabParamList`에 없는 이름은 자동으로 `true`. `routes.ts:57-60`상 홈 탭은 `LogList`·`MapTab` 2개뿐이고, 신규 탭 추가 시 헤더 유지가 기본이 된다(T1-3이 lock).

### 1.3 경계면 3 — safe-area 승계와 inset 누수
`MapTabScreen.tsx`에서 `insets` 사용처는 **정확히 2곳**(`grep -n "insets"` 결과 `:95` 선언, `:338` 필터 바, `:350` 범례). FAB(`:370-373` `bottom: theme.spacing[16]`)·스팟 카드·상태 오버레이 계산에 **섞이지 않았다**.

| 오버레이 | 코드 | 계획 대비 |
|---|---|---|
| 필터 바 | `:338` `top: insets.top + theme.spacing[12]` | 일치 |
| 범례 | `:350` `top: insets.top + theme.spacing[56], left: theme.spacing[16]` | 일치(`left` 불변) |
| FAB | `:372` `right: theme.spacing[16], bottom: theme.spacing[16]` | **불변** |
| 상태 오버레이 | `styles.overlay` = `absoluteFillObject` 중앙 정렬 | **불변** |

- **컨테이너 `SafeAreaView` 미사용 확인**: `styles.root = { flex: 1 }`, 루트는 평범한 `View`. `MapTabScreen.tsx`에 `SafeAreaView`·`edges` 사용 0건 → 지도(WebView)는 상태바까지 차오른다(풀블리드 유지).
- 상대 간격 44 보존: 56 − 12 = 44, 양쪽에 같은 `insets.top`을 더하므로 대수적으로 불변. T3-5가 런타임으로도 lock.

### 1.4 경계면 4 — 오버레이 좌표 기준점 전제가 두 파일에서 일치
`MapWebView.tsx:54-56`이 children을 `<View pointerEvents="box-none" style={StyleSheet.absoluteFill}>`로 감싼다. 이 래퍼에 패딩이 없으므로 자식의 `top`은 **MapWebView 영역 최상단** 기준이고, 헤더가 사라져 그 지점이 곧 **화면 최상단(상태바 뒤)** 이 된다. `MapTabScreen`이 `insets.top`을 더하는 전제와 정확히 맞물린다. 두 파일이 같은 전제를 공유.

### 1.5 경계면 5 — F1(진입점 상실)의 대체 경로 실재
`HomeHeader.tsx:76`(`PlusHeaderButton`)·`:80`(아바타 → `navigation.navigate(Routes.Profile)`)가 두 진입점의 **유일한** 위치다. 지도 탭에서 헤더를 끄면 접근 불가가 맞다(의도된 트레이드오프). 대체 경로 확인:
- 먹로그 탭(`Routes.LogList`, `initialRouteName`)은 `shouldShowHomeHeader` → `true`라 헤더가 그대로 → 두 진입점 유지.
- 하단 탭바는 지도 탭에서 항상 노출(`tabBarStyle` 숨김은 `shouldHideTabBar`=로그 0개 온보딩 한정이고, 그때는 지도 탭 자체가 도달 불가).
→ **지도 탭 → (탭바) → 먹로그 탭 → `+`/프로필** 경로 실재. plan §2 Out-of-scope 기록과 일치.

### 1.6 경계면 6 — 신규 safe-area 모킹이 기존 케이스를 깨지 않았는가
`MapTabScreen.spec.tsx` diff는 **순수 추가**다(기존 단언 수정 0):
- `:14-21` 모듈 스코프 `jest.mock('react-native-safe-area-context')` — `jest.requireActual` 스프레드 후 `useSafeAreaInsets`만 오버라이드하므로 `SafeAreaProvider` 등 나머지는 실 구현 유지(`LogScreen.spec.tsx:35-42` 선례와 동일 idiom).
- `beforeEach`에 `mockTopInset.current = 0;` 1줄 추가 → **기존 61 케이스는 top:0**을 보고 이전과 동일하게 동작.
- 실측: `MapTabScreen.spec.tsx` 64 케이스(기존 61 + 신규 3 describe 블록) **전량 green**.

### 1.7 다른 탭 헤더 잔존 (검증 포인트 4)
`headerShown`은 `route.name`으로만 갈리고 `Routes.MapTab`만 `false`다. 영향 범위 확인:
- **먹로그 탭**: `true` → 헤더 유지(T1-2가 lock).
- **루트 스택 화면들**(Profile·JoinLog·LogScreen·MuklogEditor·NotifSettings 등): `AppNavigator.tsx:26` `screenOptions={{ headerShown: false }}` + 화면별 `options`로 이미 독립 제어되며, 각 화면은 자체 `SubBar`를 쓴다. **탭 네비게이터 옵션과 스택 네비게이터 옵션은 서로 다른 레이어**라 이번 변경이 새는 지점 없음.
- `MapTab`은 `HomeTabs.tsx:74`에만 등록(`grep -rn "MapTab" src/` 전수) — 다른 네비게이터에 중복 등록되어 정책을 우회하는 경로 없음.

### 1.8 회귀 — 지도 기능 불변 (검증 포인트 5)
`git diff HEAD -- MapTabScreen.tsx` 전량이 **오버레이 `top` 2줄 + testID 3개 + import 1줄 + 주석**뿐이다. 다음은 **한 글자도 바뀌지 않았다**:
- INIT center 계산(`initialRegion`·`rankCoordsSource`), 핀 조회/변환(`useMuklogPins`·`pinsToMapMarkers`), 클러스터러(`mapHtml.ts` 미접촉), FAB 리센터(`handleLocate`→`buildRecenterScript`), nearby(`useNearbyPlaces`·`setBounds`), 메시지 디스패치(`handleMessage`).
- WebView 메시지 계약 9종·지도 훅 5종 시그니처 불변 — 기존 61 케이스 green이 뒷받침.

### 1.9 보안·비용 가드레일
| 항목 | 결과 |
|---|---|
| DB/마이그레이션/RLS/RPC/Edge Function | 변경 **0** (diff에 `supabase/` 무접촉) |
| Kakao Local 호출·Map SDK 로드 | 증가 **0** (`useNearbyPlaces`·`mapHtml`·`MapPrewarm` 미접촉) |
| Kakao 키 노출 | 신규 노출 경로 0(네트워크 코드 무접촉) |
| 신규 의존성 | **0** — `react-native-safe-area-context`는 기존 의존성(`HomeHeader`·`SubBar`·`HomeTabs`가 이미 사용) |
| 폴링·타이머·리스너 | 신규 0. `useSafeAreaInsets` 구독 1개 추가 — inset 변경 시에만 리렌더이고 `orientation:"portrait"` 고정이라 사실상 발화 0 |
| AWS | 미사용(불변) |

### 1.10 코드 컨벤션 (`docs/code-convention.md`)
| 규칙 | 결과 |
|---|---|
| `useCallback`/`useMemo` 미사용 | 변경 3파일 전수 grep **0건** |
| 컴포넌트·훅 화살표 `const` | `export function` **0건**. `shouldShowHomeHeader`·`HomeTabs`·`MapTabScreen` 전부 화살표 |
| named-object 인자 | `shouldShowHomeHeader({ routeName })` 준수. `screenOptions={({ route }) => …}`는 react-navigation 콜백 contract 예외이며 **`HomeTabs.tsx:33-34`에 주석 명시**(기존 `tabBarIcon: ({ focused })` 선례와 동일) |
| useEffect 인라인 화살표 | 변경 파일 `useEffect(() =>` **0건** |
| enum-style 상수 | `Routes.MapTab` 참조, 문자열 리터럴 하드코딩 0 |
| 파일명 = 심볼명 | `homeHeaderVisibility.ts` ↔ `shouldShowHomeHeader`… 디렉터리 idiom이 `tabBarStyle/`(파일명=모듈 주제, 복수 export 가능)과 동일하므로 준수 |
| raw hex/토큰 우회 | 변경 파일 raw hex **0건**, 전부 `theme.spacing[n]` 경유 |

### 1.11 문서 사실 정합 (검증 포인트 6)
- `architecture.md` 신규 행: 킷 이탈 근거(`mk-home.jsx:334-336`)·정책 함수·금지 패턴 2종·오버레이 승계·F1·"DB/RPC/Edge/의존성 0"·"2000 green" — **전부 실제 코드/실행 결과와 일치. 과대 서술 없음.** 스모크 이월도 명시됨.
- `ux-improvements.md`: 이번 diff는 **7행(map-nearby-load)** 갱신뿐이고 **6행(map-headerless)은 여전히 `대기`**. 이 스프린트가 만든 변경이 아니며, 6행은 QA 통과 후 갱신되어야 할 **미완 항목**(아래 O1).

### 1.12 TDD — 인수조건 ↔ 테스트 대응
| 인수조건 | 대응 테스트 | 결과 |
|---|---|---|
| T1 정책 3케이스 | `homeHeaderVisibility.spec.ts` T1-1~T1-3 | 통과 |
| T2 옵션 보존 | (자동 테스트 없음 — 계획이 명시적으로 제외) | **코드 리뷰로 통과**(§1.1) |
| T3 오버레이 inset | `MapTabScreen.spec.tsx` T3-1~T3-6 | 통과 |
| T4 testID | T3가 해당 testID로 노드 조회 → 자동 커버 | 통과 |
| T5 safe-area 모킹 회귀 0 | 기존 61 케이스 green | 통과 |
| T6 전체 스위트 | `npx jest` | §2 B1 참조 |
| T7 스모크 문서화 | `dev-notes.md` §7 S1~S5, 각 항목에 "무엇을 볼지" 기재 | 통과 |

**실행 결과(임시 파일 오염 전, 직접 실행):**
```
Test Suites: 199 passed, 199 total
Tests:       2000 passed, 2000 total
tsc --noEmit: exit 0
```
→ dev-notes 수치와 정확히 일치.

### 1.13 뮤테이션 표본 — 테스트가 load-bearing인가
**방법**: dev 소스 동결 준수를 위해 `src/` **바깥**(`qamut/`)에 격리 사본을 만들고(상대 import → `@/` 별칭 재작성), 기본 testMatch에 걸리지 않는 `*.mutant.ts(x)` 이름으로 `--testMatch` 명시 실행 후 **즉시 삭제**했다. 격리 사본 baseline 64/64 green 확인 후 뮤턴트 주입.

| 뮤턴트 | 결과 | 죽인 케이스 수 |
|---|---|---|
| M1 `shouldShowHomeHeader`를 상수 `true`로 | **killed** | 1 (T1-1) |
| M2 범례만 `insets.top` 미승계 | **killed** | 2 (T3-3·4, T3-5) |
| **M5 필터 바만 `insets.top` 미승계** (dev 미검증 표본 — qa 추가) | **killed** | 3 (T3-1·2, T3-5, T3-6) |
| M3 `insets.top`이 FAB `bottom`으로 누수 | **killed** | 1 (T3-6) |

**4/4 killed.** dev-notes가 검증하지 않은 M5(필터 바 쪽 누락)까지 잡히므로 T3 스위트는 양방향 대칭으로 load-bearing이다. 껍데기 단언 없음.

**소스 동결 검증**: 착수 시 `src/` 트리 체크섬 `84535ad2…`(624파일) 고지 → 뮤테이션은 격리 사본에서만 수행 → `qamut/` 삭제 확인. 종료 시 체크섬이 `6fe4517f…`로 **달라졌는데, 원인은 제 작업이 아니라 §2 B1의 타 에이전트 임시 파일 2개**다(`git status`로 파일 단위 확인 — 제가 만든 파일은 남아 있지 않고, 스프린트 소스 6파일은 무변경).

---

## 2. 차단 항목 (Blocker)

### B1 — `npm test`가 현재 빨감: `src/`에 남은 타 에이전트 임시 파일 2개
**이번 스프린트 코드의 결함이 아니다.** 워킹트리 오염이다.

```
Test Suites: 1 failed, 199 passed, 200 total
Tests:       1 failed, 2000 passed, 2001 total
```

| 파일 | 성격 |
|---|---|
| `src/navigation/screens/MapTabScreen/ZzTempHeadBaseline.tsx` | 변경 **전** MapTabScreen 사본(`useSafeAreaInsets` import 없음) |
| `src/navigation/screens/MapTabScreen/ZzTempRenderDiff.spec.tsx` | 렌더 diff 스펙 — `writeFileSync` 호출부(`:237`)에서 실패 |

둘 다 오늘 14:35 생성으로 **제 착수 이후 나타났고 제가 만든 파일이 아니라 삭제하지 않았습니다**(qa-visual 계열 렌더 비교 작업으로 추정). 영향:
1. `ZzTempRenderDiff.spec.tsx`가 **기본 testMatch에 걸려 `npm test`에 편입**(`--listTests`로 확인) → 스위트 199→200, plan §9 DoD 2번 미충족.
2. `ZzTempHeadBaseline.tsx`는 tsconfig `include: ["**/*.ts","**/*.tsx"]` 대상 → typecheck·번들 크롤에 노출.
3. 커밋되면 `src/`에 죽은 코드가 남는다.

**조치 요청(담당: 파일 생성 주체 / team-lead 조율)**: 두 파일 삭제 후 `npm test` 재확인. 렌더 비교가 계속 필요하면 **`src/` 밖 + 기본 testMatch 미매치 이름 + `--testMatch` 명시 + 즉시 삭제**(§1.13에서 제가 쓴 방식)를 권합니다. team-lead에 이미 통보 완료.

**정리 후 예상 결과**: 199 suites / 2000 tests green(오염 전 실측치와 동일).

---

## 3. 미검증 (이월 — 통과로 처리 금지)

### U1 — 디바이스 스모크 S1~S5 (실기기 필요)
`dev-notes.md` §7에 체크리스트로 기록됨(T7 충족). 전부 **미실행 이월**.

**⚠️ 가장 중요한 공백 — M4**: `HomeTabs`의 `headerShown`을 상수 `true`로 고정하는 뮤턴트는 **살아남는다**. 확인 결과 `HomeTabs`를 렌더해 헤더 유무를 단언하는 테스트가 **존재하지 않는다**(`grep -rln "HomeTabs" src/**/*.spec.tsx` → `AuthGate.spec.tsx`는 마커로 대체, `tabBarStyle.spec.ts`는 스타일 순수 함수만). 이는 plan T2가 의도적으로 선택한 커버리지 공백이며 dev-notes §3.3이 정직하게 고지했다.

→ **"지도 탭에 헤더가 실제로 사라졌는가"라는 이 스프린트의 핵심 인수조건은 현재 어떤 자동 테스트도 증명하지 않는다.** 정책 함수가 옳고(T1) 배선이 옳음(코드 리뷰 §1.2)까지가 자동 검증의 한계다. **S1을 건너뛰면 핵심 인수조건이 미검증으로 남는다.**

메모리 `qa-layout-blind-spot`(렌더 픽셀 미확인으로 레이아웃 버그 유출) 사례에 정확히 해당하는 변경이므로 S1·S2는 필수.

### U2 — Android 비 edge-to-edge에서 `insets.top = 0` 보고 시 칩 가림 여부
코드상으로는 `0 + 12 = 12`로 현행과 동일해 회귀는 없다. 다만 "시스템이 이미 상태바 아래에서 화면을 시작한다"는 전제가 실기기에서 성립하는지는 **S2로만 확인 가능**. 어긋나면 이 스프린트의 유일한 미해결 케이스(plan §6 기록과 동일 판단).

### U3 — 상태바 가독(F2)
코드 접촉 0(`App.tsx` `<StatusBar style="dark" />` 불변). S4 눈 확인 이월.

---

## 4. 관찰 (비차단)

### O1 — `ux-improvements.md` 6행이 `대기`로 남아 있음
루프 표의 map-headerless 행 상태가 아직 `대기`다. QA 통과 후 `✅ 통과 (2026-08-13, 디바이스 스모크 S1~S5 이월)`로 갱신 필요. **B1 정리 전에는 green이 아니므로 지금 갱신하면 안 된다** — B1 해소 후 처리 권장.

### O2 — D1(testID 3개, 계획은 2개) — **문제 없음. 오히려 더 나은 선택**
dev-notes §4가 판단을 요청한 건. 결론: **수용**.
- testID는 렌더 산출물·레이아웃에 영향이 없고(비주얼 영향 0), 기존 testID 제거·변경 0이다.
- 계획의 원안(`getByTestId('map-locate-button').parent`)은 RNTL 12에서 `Pressable`의 composite 인스턴스를 반환해 `props.style`이 `undefined`가 된다는 dev 실측이 타당하다. 부모 체인 traversal은 `MapLocateButton` 내부 구조가 바뀌면 **조용히 깨지거나 엉뚱한 노드를 읽는** 취약한 단언이다.
- "배치를 소유한 래퍼에 식별자를 둔다"는 규칙이 다른 오버레이 2종과 일관된다. 계획 이탈이지만 **추가만 있고 제거·의미 변경이 없다**.

### O3 — `header` 콜백을 남겨둔 판단 — 적절
지도 탭은 `headerShown:false`라 호출되지 않지만 `route.name === Routes.MapTab ? '지도' : '먹로그'` 분기를 남겼다. 정책이 되돌려질 때 워드마크가 맞고, 죽은 코드도 아니다(먹로그 탭이 실사용). 유지 권장.

---

## 5. 재검증 필요 사항

| # | 항목 | 담당 | 조건 |
|---|---|---|---|
| B1 | 임시 파일 2개 정리 후 `npm test` 199 suites / 2000 green 재확인 | 파일 생성 주체 / team-lead | **스프린트 "로직 완료" 표시의 전제** |
| O1 | `ux-improvements.md` 6행 상태 갱신 | team-lead | B1 해소 후 |
| U1 | 디바이스 스모크 S1~S5(특히 S1) | 사용자/실기기 | 이월 — 릴리스 전 필수 |

---

## 6. 결론

**map-headerless 구현 자체는 로직·통합 관점에서 결함 0이다.** 계획이 최대 위험으로 지목한 `screenOptions` 객체→함수 전환에서 기존 옵션 6종이 전부 온전하고, 헤더 표시 정책은 우회 없이 단일 출처로 배선됐으며, `insets.top`은 상단 오버레이 2곳에만 적용되고 하단으로 새지 않는다(뮤턴트 4/4 killed로 테스트가 실제로 이를 잡는 것까지 확인). DB·네트워크·의존성 변경 0으로 비용 가드레일도 무접촉이고, 컨벤션 위반 0이다.

다만 **(a) 워킹트리에 남은 타 에이전트 임시 파일 때문에 지금 `npm test`가 빨갛고**, **(b) "헤더가 실제로 사라졌는가"는 자동 테스트 커버리지 밖(M4)이라 S1 스모크가 유일한 판정자**다. 이 두 가지가 해소되기 전에는 스프린트를 **로직 완료로 표시하지 않는다**.

---

## 7. 리더 종결 노트 (2026-08-14)

§6의 차단 사유 (a)는 해소됐다. 워킹트리를 오염시킨 타 에이전트 임시 파일 2개(`ZzTempHeadBaseline.tsx`·`ZzTempRenderDiff.spec.tsx`)가 제거됐고, 리더가 직접 재실행해 **199 suites / 2000 tests 전량 green · `tsc --noEmit` 0**을 확인했다(`find src -name 'Zz*'` 0건). 해당 위반은 qa-visual이 리포트 §2와 프로젝트 메모리에 재발 방지로 기록했다.

(b) 디바이스 스모크 S1~S5는 관례대로 **사용자 실기기 판정으로 이월**한다 — 특히 S1("헤더가 실제로 사라졌는가")은 M4 뮤턴트가 신고한 자동 테스트 공백의 유일한 판정자다. 이월 상태로 커밋·PR을 진행한다.
