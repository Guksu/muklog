# QA Report — Visual (map-headerless)

> 검증일 2026-08-13 · qa-visual · 스킬 `.claude/skills/visual-qa/`
> 디자인 단일 출처 킷 `.claude/skills/ui-design/templates/muklog/mk-home.jsx`
> 입력: `plan.md`(planner) · `dev-notes.md`(developer) · 선행 `docs/sprint/sprint-20260714-map-category-filter/ui-spec.md`
> **이번 스프린트에는 `ui-spec.md`가 없다** — plan §0 판정("창작 0 → ui-publisher 불투입")에 따른 의도된 부재이며, 오버레이 배치의 시안 출처는 **선행 스프린트 `map-category-filter`의 ui-spec §2**다(§5 참조).

## 0. 판정 요약

| 항목 | 판정 |
|---|---|
| 킷 이탈(지도 탭 헤더 제거) | **의도된 이탈로 기록 — FAIL 아님** (§1) |
| 오버레이 비주얼 불변(top 외 전 값) | ✅ **통과 — 렌더 트리 실측 diff 0** (§2) |
| 인접 탭(먹로그·프로필) 헤더 잔존 | ✅ 통과 (§3) |
| 상태바 `style="dark"` 불변 | ✅ 통과(코드) / 가독은 스모크 S4 (§4) |
| 디바이스 스모크 S1~S5 문서화 | ✅ 존재·**이월** 표기 확인 — **통과 처리 안 함** (§6) |
| 헤더가 실제로 사라졌는지 | ⚠️ **미검증** — 자동 테스트 불가 구간, S1이 유일한 판정자 (§6) |

**비주얼 완료 선언 불가.** §6의 미검증 항목(실기기 스모크)이 남아 있다. 코드·렌더 레벨에서 발견된 **비주얼 결함은 0건**이며, 아래 §7은 수정 필수가 아닌 관찰·nit이다.

---

## 1. 킷 이탈 기록 (임무 1 — FAIL 처리 금지)

### 킷이 말하는 것
| 킷 라인 | 내용 |
|---|---|
| `mk-home.jsx:320` | `function MapScreen({ log, onAdd, onProfile, me })` — 지도 화면 정의 시작 |
| **`mk-home.jsx:335`** | **`<HomeHeader title="지도" onAdd={onAdd} onProfile={onProfile} me={me} />`** — 지도 화면이 공통 헤더를 **명시적으로 렌더**한다 |
| `mk-home.jsx:7-25` | `HomeHeader` 정의 — `paddingTop: SP`(상태바 패드)·`paddingLeft:20/Right:12/Bottom:12`, 워드마크 `800 26px`, `IBTN plus size 24`, `AV size 36` |
| `mk-home.jsx:336` | 헤더 **다음**에 지도 div(`flex:1, position:relative, background:#EFEAE3`)가 시작 — 즉 킷의 지도는 헤더 아래에서 시작한다 |

> plan은 이 지점을 `mk-home.jsx:334-336`으로 표기했다. 실측 라인은 **:335**(헤더), :336(지도 div 시작)이다. 범위 표기 차이일 뿐 내용은 동일.

### RN이 하는 것
| RN 파일:라인 | 내용 |
|---|---|
| `src/navigation/HomeTabs/HomeTabs.tsx:35` | `headerShown: shouldShowHomeHeader({ routeName: route.name })` |
| `src/navigation/homeHeaderVisibility/homeHeaderVisibility.ts:16` | `routeName !== Routes.MapTab` → **지도 탭만 `false`** |
| `src/navigation/screens/MapTabScreen/MapTabScreen.tsx:92` | `const insets = useSafeAreaInsets();` — 헤더가 흡수하던 `paddingTop: SP`(킷 :10)를 **오버레이가 승계** |

### 이탈 판정 근거 (되돌리지 말 것)
1. **사용자 명시 요청(2026-08-12)** — "지도 탭에선 헤더 제거", 목적 = 지도 풀블리드. 킷보다 우선한다.
2. **plan.md §0 판정표 1행** — "킷 이탈 — 사용자 명시 요청 우선"으로 사전 판정, planner가 근거를 킷 라인과 함께 명문화.
3. **`docs/design/architecture.md` 스프린트 백로그 `map-headerless` 행** — "⚠️ 킷 `mk-home.jsx:334-336`의 MapScreen은 헤더가 있는 화면 … 의도된 이탈이며 되돌리지 말 것(qa-visual은 FAIL 처리 금지)"로 영구 기록됨. 다음 스프린트가 "킷과 다름"을 근거로 되돌리는 사고를 이 행이 막는다.
4. **파생 이탈 1건도 함께 기록**: 헤더 제거로 지도 탭에서 `+`(먹로그 작성)·프로필 아바타 진입점이 사라진다(F1). 킷 `mk-home.jsx:335`가 `onAdd`·`onProfile`을 지도 화면에 넘기던 기능이다. 대체 경로(먹로그 탭 헤더)는 살아 있음을 §3에서 확인. **지도 위 `+`/아바타 오버레이 재배치는 킷에 없는 창작**이므로 이번 스프린트에서 하지 않은 것이 맞다.

> **결론: 이탈은 승인된 상태이고 코드가 그 승인 범위 안에 정확히 머물렀다.** 이탈 범위 밖으로 새어나간 비주얼 변경(예: 헤더 제거 김에 오버레이도 손봄)은 §2에서 실측으로 0건 확인.

---

## 2. 오버레이 비주얼 불변 — 렌더 트리 실측 (임무 2)

"코드를 읽어 보니 안 바뀐 것 같다"가 아니라 **HEAD(변경 전)를 복원해 같은 조건에서 렌더한 뒤 트리를 문자 단위로 대조**했다.

**방법**: `git show HEAD:…/MapTabScreen.tsx`로 변경 전 컴포넌트를 임시 복원 → 현행 스펙의 모킹 헤더(1~222행)를 재사용한 임시 스펙으로 before/after를 동일 조건 렌더 → `toJSON()` 트리를 JSON 덤프해 `diff`. 덤프 산출물은 세션 스크래치패드에 남겼다.

> **⚠️ 프로세스 위반 기록(측정 결과에는 영향 없음).** 위 임시 파일 2개(`ZzTempHeadBaseline.tsx`·`ZzTempRenderDiff.spec.tsx`)를 `src/navigation/screens/MapTabScreen/` **안에** 만들었다. 존재하는 동안 `.spec.tsx`가 기본 `testMatch`에 편입돼 전체 스위트가 199→200개가 되고, 그 구간에 팀 리더가 돌린 `npm test`가 red로 보였다. 측정 직후 삭제했으나 **위치 자체가 규범 위반**이며(공유 작업 트리), qa-visual 역할의 두 번째 재발이다. 정리 후 재확인: `find src -name 'Zz*'` **0건**, `git status`의 `src/` 변경은 스프린트 대상 3개 그대로, **`npm test` 199 suites / 2000 tests 전량 green**(dev-notes 기준선과 동일), **`tsc --noEmit` 오류 0**. 앞으로 렌더 대조 사본은 스크래치패드 또는 `testMatch` 비매칭 파일명으로 만든다(메모리 `qa-temp-files-outside-src`에 규범 기록).

### 2.1 before(HEAD) vs after(현행) — 둘 다 `insets.top = 0`

5개 렌더 상태 전부에서 **트리 차이가 testID 3줄뿐**이다.

| 상태 | 렌더 트리 diff |
|---|---|
| ready(핀 0) | `+ "testID": "map-overlay-filterbar"` / `+ "testID": "map-overlay-legend"` / `+ "testID": "map-overlay-locate"` — **그 외 0** |
| 선택 스팟 카드(`MARKER_TAP` → `selected-spot-card` 렌더 확인) | 동일 3줄만 |
| 로딩 배너("지도를 불러오는 중이에요" 렌더 확인) | 동일 3줄만 |
| 권한 거부 배너("위치 권한을 허용하면 현재 위치를 볼 수 있어요" 렌더 확인) | 동일 3줄만 |
| 에러 배너("다시 시도" 렌더 확인) | 동일 3줄만 |

→ **카테고리 필터 바·범례·FAB·스팟 카드·상태 배너의 색·radius·패딩·폰트·그림자·크기·간격·카피가 전부 diff 0.** `testID`는 렌더 산출물에 시각적 영향이 없다(RN 접근성/테스트 식별자). `insets.top = 0`(비 edge-to-edge Android 등)에서 **before와 픽셀 동일**이라는 뜻이기도 하다 — 회귀 0의 직접 증거.

### 2.2 현행 `insets.top = 0` vs `59`(다이나믹 아일랜드 근사)

전체 트리에서 **바뀌는 값이 정확히 2개**다.

```
필터 바 래퍼 top: 12  → 71   (= 12 + 59)
범례   래퍼 top: 56  → 115  (= 56 + 59)
```

- 상대 간격 **44 보존**(115 − 71 = 44 = 56 − 12) — 킷/ui-spec의 "필터 바 → 범례" 상단 스택 순서와 간격이 inset 유무와 무관하게 유지된다.
- **FAB 래퍼 `bottom: 16` 불변**(inset 59 렌더에서도 16) — top inset이 하단으로 새지 않음.
- 상태 배너(`absoluteFillObject` 중앙 정렬)·스팟 카드 3종·`left/right` 값 전부 불변.

### 2.3 토큰 경유·브랜드 규칙
| 항목 | 결과 |
|---|---|
| raw hex/rgba | `HomeTabs.tsx`·`MapTabScreen.tsx`·`homeHeaderVisibility/` 전수 스캔 **0건** |
| 그림자/elevation | 변경 파일 내 `shadow*`·`elevation` **0건**(헤어라인 규칙 유지) |
| 스페이싱 | `theme.spacing[12]`·`[56]`·`[16]` 토큰 경유, 신규 raw 숫자 0. 12·56·16·44 전부 4px 그리드 |
| 색·radius·타이포 | 접촉 0(킷 `--mk-*` 실값 미접촉) |

---

## 3. 인접 탭 회귀 — 먹로그·프로필 헤더 (임무 3)

| 확인 | 결과 |
|---|---|
| `HomeHeader.tsx` 접촉 | **0**(`git diff --stat HEAD -- src/navigation/HomeHeader/` 빈 결과). 킷 `mk-home:7-25` 대응값(`paddingLeft 20`/`Right 12`/`Bottom 12`, 워드마크 800·26 `variant="wordmark"`, `PlusHeaderButton`, `Avatar size 36`) 그대로 잔존 |
| `screenOptions` 객체→함수 전환 시 옵션 유실 | **0** — `headerShadowVisible:false` · `tabBarActiveTintColor: theme.color.primary` · `tabBarInactiveTintColor: theme.color.fgMuted` · `tabBarStyle`(`hideTabBar` 분기 포함) · `tabBarLabelStyle`(SUIT-SemiBold 11) 전부 보존(`HomeTabs.tsx:36-56`). `Tab.Screen` 2개의 `title`·`tabBarIcon`(Icon 25px, primary/fgAssistive) 미접촉 |
| `header` 콜백 시그니처 변경 | `header: ({ route }) => …` → `header: () => …`(`HomeTabs.tsx:42`). 워드마크 분기가 `screenOptions`의 `route`를 클로저로 참조하도록 바뀐 것 — bottom-tabs에서 `screenOptions`와 `header`가 받는 `route`는 **같은 화면의 route**라 먹로그 탭 워드마크는 "먹로그"로 동일. **비주얼 영향 0** |
| 회귀 테스트 | `HomeHeader.spec` · `LogListScreen.spec` · `MapTabScreen.spec` · `homeHeaderVisibility.spec` = **94 passed** |
| 프로필 진입 | 먹로그 탭 헤더 아바타(`HomeHeader.tsx:77-92`, `navigate(Routes.Profile)`) 잔존 — F1 대체 경로 살아 있음 |
| `tabBarStyle.ts`·`MapWebView`·`mapHtml.ts`·지도 훅 | 접촉 0 |

---

## 4. 상태바 (임무 4)

- `App.tsx:86` `<StatusBar style="dark" />` — **파일 미접촉**(git status에 App.tsx 없음). `app.json` `userInterfaceStyle:"light"` + `ThemeProvider` light 고정도 불변.
- 밝은 카카오 지도 타일(킷 지도 배경 `#EFEAE3` 계열) 위 dark 글자 = 가독 기대. **다만 코드 확인일 뿐 픽셀 확인이 아니다** → 스모크 S4가 판정(§6).

---

## 5. 근사 허용 / 사전 승인된 배치

**선행 ui-spec가 이번 변경을 미리 허가해 뒀다** — 이번 스프린트에 `ui-spec.md`가 없어도 오버레이 배치의 시안 근거가 존재한다.

| 출처 | 내용 |
|---|---|
| `sprint-20260714-map-category-filter/ui-spec.md:81` | "현 legend가 plain `spacing[14]`(inset 미사용)이라 맵이 헤더/상태바 아래에서 시작한다고 보고 필터바도 plain `spacing[12]`. **실제로 맵이 노치까지 올라가면 developer가 양쪽에 `insets.top` 가산**." |
| 〃 `:70-71` | 필터 바 `top: spacing[12]`·`left:0/right:0`, 범례 `top: spacing[56]`(=12 + 필터바 ~34 + gap ~10)·`left: spacing[16]` |
| 〃 `:80` | "legend 하강 오프셋(spacing[56])은 **근사값** … 겹침만 없으면 됨" → **근사 허용 기록 존재** |

→ 구현(`MapTabScreen.tsx:338·348`)은 ui-publisher가 남긴 조건부 지시를 **문자 그대로** 이행했다. 킷 `mk-home:358`의 범례(`top:14 / left:16`, 지도 div 기준)와 좌표 기준계가 다른 것은 킷 지도 화면에 필터 바가 없기 때문이며(필터 바는 `mk-log` 계열 요소), plan §7-2가 규정한 대로 **"상단 스택 순서 + 간격 44"** 기준으로 판정해 통과.

**관찰 O1 (수정 불요)**: 위 ui-spec `:70`은 풀블리드 케이스의 예시값을 `insets.top + spacing[8]`로 괄호 안에 적었으나, 구현은 `insets.top + spacing[12]`다(4px 차). 더 명시적인 지시인 `:81`("양쪽에 `insets.top` 가산")과 상대 간격 44 보존을 우선한 선택이라 **정합으로 판정**한다. 노치 아래 8 vs 12의 시각적 선택은 **S1에서 눈으로 판단**할 사안이며, 지금 바꿀 근거는 없다.

---

## 6. 미검증 (통과 처리 금지)

| # | 항목 | 사유 |
|---|---|---|
| **U1** | **지도 탭에 헤더가 실제로 사라졌는가** | react-navigation의 `headerShown:false` 실제 렌더는 네비게이터 렌더 테스트가 없어(plan T2가 명시적으로 제외) 자동 검증 불가. dev-notes §3.3 **뮤턴트 M4(`headerShown`을 상수 `true`로 고정) survived**가 이 공백을 정량으로 보여 준다. 정책 함수는 T1이 lock하지만 **배선의 최종 판정자는 스모크 S1**이다 |
| **U2** | 노치·다이나믹 아일랜드·펀치홀에 카테고리 칩이 겹치지 않는가 | 렌더 트리는 `top`이 inset만큼 내려간 것까지만 증명한다. 실제 안전영역 침범 여부는 픽셀 확인 필요(메모리 `qa-layout-blind-spot`: 레이아웃 변경은 디바이스 스모크 필수) → **S1·S2** |
| **U3** | Android 비 edge-to-edge에서 `insets.top = 0` 보고 시 칩 가림 | §2.1이 "inset 0이면 before와 픽셀 동일"을 증명했으므로 **회귀는 없다**. 다만 헤더가 사라진 상태에서 12px만으로 충분한지는 기기 실측 → **S2** |
| **U4** | 탭 왕복 시 헤더 잔상·레이아웃 점프·깜빡임 | 정적 렌더로 관측 불가 → **S3** |
| **U5** | 밝은 지도 타일 위 상태바 글자 가독 | 코드는 `style="dark"` 확인, 실제 대비는 육안 → **S4** |

**스모크 문서화 확인**: `dev-notes.md` §7에 S1~S5가 각각 "무엇을 눈으로 확인하는지"와 함께 기록돼 있고, 헤더에 **"— 이월(실기기 필요, 미실행)"** 로 명시돼 있다. dev-notes §3.3 각주가 "스모크를 건너뛰면 이 스프린트의 핵심 인수조건이 미검증 상태로 남는다"고 자기 공백을 정확히 신고했다. **문서화 요구(임무 5)는 충족, 스모크 자체는 미실행이므로 통과 처리하지 않는다.**

---

## 7. Nit — 킷 라인 참조 표류 (P3, 비주얼 영향 0)

비주얼 QA의 방법론 자체가 "킷 라인 ↔ RN 파일:라인 추적"이라 주석의 킷 라인이 틀리면 다음 감사가 엉뚱한 곳을 본다. **수정은 선택**이며 이번 스프린트 게이트가 아니다.

| RN 파일:라인 | 주석이 가리키는 킷 라인 | 실제 킷 라인 | 실제로 그 라인에 있는 것 |
|---|---|---|---|
| `HomeTabs.tsx:40-41`(이번 스프린트에 재작성됨) | `mk-home:261`(지도 워드마크), `:82`(먹로그 워드마크) | **:335**, **:106** | :261 = 초대코드 입력 셀, :82 = LogCard FoodCover |
| `HomeHeader.tsx:22`(기존) | 동일 `:82`·`:261` | 동일 | 동일 |
| `MapTabScreen.tsx:369`(기존) | `mk-home:290-298`(FAB) | **:363-372**(`right:16, bottom:16`은 :364) | :290-298 = InviteCodeCard |

원인은 킷 경로 마이그레이션(2026-06-12, `ui_kits/muklog` → `templates/muklog`) 전후로 파일 라인이 이동했는데 주석이 따라가지 않은 것으로 보인다. **디자인 값 자체는 전부 정합**(FAB `right/bottom 16`·워드마크·아바타 36) — 잘못된 것은 포인터뿐이다.

---

## 8. 결론

- **비주얼 결함 0건.** 킷 이탈은 승인·기록된 범위 안에 정확히 머물렀고, 이탈 범위 밖으로 새어나간 비주얼 변경은 5개 렌더 상태 실측 diff로 0임을 증명했다(testID 3줄 외 전무).
- **`insets.top = 0`에서 before와 렌더 트리 완전 동일** → 비 edge-to-edge 환경 회귀 0.
- **비주얼 완료 선언 보류.** U1~U5(실기기 S1~S5)가 남아 있고, 특히 **U1은 자동 테스트가 구조적으로 못 잡는 구간**이다. 사용자 실기기 스모크 후 S1·S2가 통과하면 이 리포트의 §6을 갱신해 "비주얼 완료"로 전환할 수 있다.
