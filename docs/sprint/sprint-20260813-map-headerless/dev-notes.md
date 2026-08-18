# Dev Notes — 지도 탭 헤더 제거 (map-headerless)

> 작성일 2026-08-13 · developer
> 입력 단일 출처 `plan.md` · 스택 가이드 `.claude/skills/rn-supabase-dev/`
> 결과: **`npm test` 2000/2000 green (199 suites)** · **`tsc --noEmit` 오류 0** · DB/Edge/네트워크 변경 0 · 신규 의존성 0

---

## 1. 변경 파일

| 파일 | 성격 | 요지 |
|---|---|---|
| `src/navigation/homeHeaderVisibility/homeHeaderVisibility.ts` | 신규(순수 함수) | `shouldShowHomeHeader({ routeName })` — 헤더 표시 정책 단일 출처 |
| `src/navigation/homeHeaderVisibility/index.ts` | 신규(배럴) | `export * from './homeHeaderVisibility'` (tabBarStyle과 동일 idiom) |
| `src/navigation/homeHeaderVisibility/homeHeaderVisibility.spec.ts` | 신규(단위) | T1-1~T1-3 (3 케이스) |
| `src/navigation/HomeTabs/HomeTabs.tsx` | 수정 | `screenOptions` 객체→함수 + `headerShown` 정책 배선 |
| `src/navigation/screens/MapTabScreen/MapTabScreen.tsx` | 수정 | 상단 오버레이 2종 top에 `insets.top` 가산 + 오버레이 래퍼 testID 3종 |
| `src/navigation/screens/MapTabScreen/MapTabScreen.spec.tsx` | 수정 | safe-area 가변 모킹 + `map-headerless` describe(4 케이스, T3-1~T3-6) |
| `docs/design/architecture.md` | 수정 | 스프린트 백로그에 `map-headerless` 행 추가(킷 이탈·F1 기록 — 되돌림 방지) |

**미접촉 확인**: `HomeHeader.tsx` · `SubBar.tsx` · `tabBarStyle.ts` · `MapWebView` · `mapHtml.ts` · 지도 훅 전부(`useMuklogPins`·`useWishPins`·`useNearbyPlaces`·`useLocationPermission`·`useAddNearbyWish`) · 마이그레이션 · Edge Function · `package.json`.

---

## 2. 계약 shape (생산자 ↔ 소비자 매핑 — QA 교차검증용)

### 2.1 헤더 표시 정책
```ts
// 생산자: src/navigation/homeHeaderVisibility/homeHeaderVisibility.ts
shouldShowHomeHeader({ routeName: string }): boolean   // routeName !== Routes.MapTab
```
| 생산자 | 소비자 | 배선 지점 |
|---|---|---|
| `shouldShowHomeHeader` | `HomeTabs.tsx` `screenOptions({ route }).headerShown` | `HomeTabs.tsx:35` — `headerShown: shouldShowHomeHeader({ routeName: route.name })` |
| `Routes.MapTab`(`'MapTab'`) | 정책 함수 내부 비교 · `HomeTabs` 워드마크 분기 | 문자열 리터럴 하드코딩 없음 — 양쪽 다 `Routes` enum-style 상수 참조 |

- 폴백: 미지 라우트명은 `true`(헤더 표시). 신규 탭이 추가돼도 기본 동작이 유지된다.
- `header` 콜백은 **보존**(먹로그 탭이 계속 사용). 지도 탭은 `headerShown:false`라 호출되지 않지만, 정책이 되돌려질 때 워드마크가 맞도록 `route.name` 분기는 남겨 뒀다.
- 금지 사항 준수: `header: () => null` 우회 **미사용**, 전역 `headerShown:false` 후 역방향 **미사용**.

### 2.2 `screenOptions` 객체→함수 전환 시 옵션 보존 (plan §7 qa-logic 2번)
전환 전후 **6개 옵션 전부 보존**. 유실 0.

| 옵션 | 전환 전 | 전환 후 |
|---|---|---|
| `header` | `({ route }) => <HomeHeader …/>` | `() => <HomeHeader …/>`(route는 `screenOptions` 인자에서 승계) |
| `headerShadowVisible` | `false` | `false` |
| `tabBarActiveTintColor` | `theme.color.primary` | 동일 |
| `tabBarInactiveTintColor` | `theme.color.fgMuted` | 동일 |
| `tabBarStyle` | `hideTabBar ? {display:'none'} : buildTabBarStyle({insets, theme})` | 동일(분기 포함) |
| `tabBarLabelStyle` | `{ fontFamily:'SUIT-SemiBold', fontSize:11 }` | 동일 |
| **신규** `headerShown` | (없음 = 기본 true) | `shouldShowHomeHeader({ routeName: route.name })` |

`Tab.Screen` 2개 정의(`title`·`tabBarIcon`)는 손대지 않았다.

### 2.3 `MapTabScreen` 오버레이 배치
| 오버레이 | testID | 전 | 후 |
|---|---|---|---|
| 카테고리 필터 바 래퍼 | `map-overlay-filterbar` (신규) | `top: 12`, `left/right: 0` | `top: insets.top + 12`, left/right 불변 |
| 범례 래퍼 | `map-overlay-legend` (신규) | `top: 56`, `left: 16` | `top: insets.top + 56`, `left` 불변 |
| 현재위치 FAB 래퍼 | `map-overlay-locate` (신규 — §4 편차 참조) | `right: 16`, `bottom: 16` | **불변** |
| 상태 오버레이 | (없음) | `absoluteFill` 중앙 | **불변** |
| 스팟 카드 3종·`LogPickerSheet` | 기존 | 하단 도킹/모달 | **불변** |

- `insets`는 `useSafeAreaInsets()`(`react-native-safe-area-context`)를 `MapTabScreen`에서 직접 읽는다(`HomeHeader`·`SubBar`·`LogScreen` 헤더와 동일 idiom).
- **`SafeAreaView`·`Screen edges` 미사용** — 컨테이너에 top 패딩을 주면 지도가 상태바까지 차오르지 않는다. 오버레이만 inset을 흡수한다.
- 기존 testID(`category-filter-bar`·`filter-chip-*`·`map-legend-dot`·`map-locate-button`·`map-status-*`·`selected-spot-card`·`nearby-spot-card`·`log-picker-row-*`) **전부 불변**.

### 2.4 불변 계약 (회귀 lock)
- WebView 메시지 계약 9종(INIT/SET_MARKERS/SET_SELECTED/RECENTER/READY/MARKER_TAP/BOUNDS_CHANGED/MAP_TAP/ERROR) 불변 — 기존 스펙 전량 green으로 확인.
- 지도 훅 5종 시그니처·호출 횟수 불변(모킹 계약 무변경, 기존 61→64 케이스 중 기존 61 전부 통과).
- 먹로그 탭 헤더·하단 탭바(`buildTabBarStyle`·`shouldHideTabBar`) 불변.

---

## 3. 테스트

### 3.1 신규 케이스 (TDD Red→Green 확인)
| # | 파일 | 케이스 |
|---|---|---|
| T1-1 | `homeHeaderVisibility.spec.ts` | `MapTab` → `false` |
| T1-2 | 〃 | `LogList` → `true` |
| T1-3 | 〃 | `'UnknownTab'` → `true`(폴백) |
| T3-1·T3-2 | `MapTabScreen.spec.tsx` | 필터 바 top: inset 0에서 `12`, inset 59에서 **base+59**(델타 단언) |
| T3-3·T3-4 | 〃 | 범례 top: inset 0에서 `56`, inset 59에서 **base+59** |
| T3-5 | 〃 | inset 59에서 범례−필터 바 = **정확히 44**(상대 간격 보존) |
| T3-6 | 〃 | inset 59에서 FAB 래퍼 `bottom` = **16 불변** + 같은 렌더의 필터 바는 `71`(상단만 흡수 대조) |

Red 확인: 구현 전 4 케이스 실패(정책 모듈 부재로 suite 1개 실패 + 지도 3 케이스 실패) → 구현 후 전량 green.

### 3.2 전체 스위트
```
Test Suites: 199 passed, 199 total
Tests:       2000 passed, 2000 total
tsc --noEmit: 오류 0
```
(직전 베이스 1993 + 신규 7 = 2000. 기존 케이스 실패·수정 0 — safe-area 모킹 추가로 인한 회귀도 0.)

### 3.3 뮤테이션 검증 (테스트가 실제로 잡는지 확인 — 표본은 실행 직후 원본 복원, 체크섬 대조 완료)
| 뮤턴트 | 결과 |
|---|---|
| M1 정책이 지도 탭에서 `true` 반환 | **killed** — T1-1 실패 |
| M2 범례만 `insets.top` 미승계 | **killed** — T3-3·T3-4, T3-5 실패 |
| M3 `insets.top`이 FAB `bottom`으로 샘 | **killed** — T3-6 실패 |
| M4 `HomeTabs`의 `headerShown`을 상수 `true`로 고정 | **survived (의도된 미커버)** — plan T2가 네비게이터 렌더 테스트를 명시적으로 제외했다. 정책 자체는 T1이, 실제 헤더 부재는 **디바이스 스모크 S1**과 qa-logic 코드 리뷰(§7-1·2)가 판정한다. |

> M4는 계획된 커버리지 공백이다. 헤더가 실제로 사라졌는지는 **S1 스모크 전까지 자동 테스트로 증명되지 않는다** — 스모크를 건너뛰면 이 스프린트의 핵심 인수조건이 미검증 상태로 남는다.

---

## 4. 계획 대비 편차 (1건 — 추가만, 제거·변경 없음)

**D1 — testID 3개 부여(계획은 2개).** plan §3.3은 `map-overlay-filterbar`·`map-overlay-legend` 2개를 정의했고, T3-6은 "`map-locate-button` 래퍼의 `bottom`"을 단언하라고 했다. 그런데 RNTL 12에서 `getByTestId('map-locate-button').parent`는 host 래퍼가 아니라 `Pressable`의 composite(forwardRef) 인스턴스를 반환해 `props.style`이 `undefined`다(실측 확인). 부모 체인을 여러 칸 거슬러 오르는 단언은 프리미티브 내부 구조가 바뀌면 조용히 깨지므로, FAB 래퍼 View에 `map-overlay-locate` testID를 부여해 직접 읽었다. **비주얼·레이아웃 영향 0**(testID는 렌더 산출물에 영향 없음), 기존 testID 제거·변경 0. 배치를 소유한 래퍼에 식별자를 두는 방식은 다른 오버레이 2종과 동일 규칙이다.

---

## 5. 플래그 상태 (plan §0)

- **F1 — 지도 탭에서 `+`·프로필 아바타 진입점 상실: 발생함(의도된 트레이드오프).** 두 진입점은 `HomeHeader`에만 있어 지도 탭에서 접근 불가가 됐다. 대체 경로 확인: 먹로그 탭(`Routes.LogList`, 기본 탭)의 헤더에 `PlusHeaderButton`·아바타가 그대로 있고 하단 탭바는 지도 탭에서 항상 노출된다(탭바 숨김은 로그 0개 온보딩 한정이며, 그때는 지도 탭 자체가 도달 불가). 지도 위 오버레이 재배치는 킷 없는 창작이라 **미구현**(plan §2 Out-of-scope).
- **F2 — 상태바 스타일: 미변경.** `App.tsx` `<StatusBar style="dark" />` + `app.json userInterfaceStyle:"light"` 고정. 코드 접촉 0, S4에서 눈으로만 확인.

---

## 6. 비용 가드레일

| 항목 | 변화 |
|---|---|
| Kakao Local API 호출 | **0** (`useNearbyPlaces` 디바운스·양자화 캐시·최소이동 임계 미접촉) |
| Kakao Map SDK 로드 | **0** (`mapHtml`·`MapPrewarm` 미접촉) |
| Supabase 쿼리/RPC/Edge Function/마이그레이션 | **0** |
| 폴링·타이머·리스너 | 신규 0. `useSafeAreaInsets` 구독 1개 추가(라이브러리 컨텍스트 — inset 변경 시에만 리렌더, `orientation:"portrait"` 고정이라 사실상 발화 0) |
| 신규 의존성 | **0** (`react-native-safe-area-context`는 기존 의존성) |
| AWS | 미사용(불변) |

---

## 7. 디바이스 스모크 체크리스트 S1~S5 — **이월**(실기기 필요, 미실행)

> 메모리 `qa-layout-blind-spot`: 이번 변경은 **레이아웃 변경**이라 렌더 픽셀을 보지 않으면 단위 테스트가 통과해도 겹침을 놓친다. 아래는 반드시 실기기에서 눈으로 확인한다.

- [ ] **S1 — iOS 노치/다이나믹 아일랜드 기기.** 지도 탭 진입 시 상단 워드마크 헤더가 **없고**, 지도 타일이 상태바 뒤까지 차오르는지. 카테고리 칩의 상단이 노치/아일랜드에 **가리지 않고 칩 전체가 온전히** 보이는지. (M4 뮤턴트가 살아있는 구간 — `headerShown` 배선의 실제 판정자)
- [ ] **S2 — Android 펀치홀/제스처 기기.** 같은 확인 + `insets.top`을 0으로 보고하는 비 edge-to-edge 케이스에서도 칩이 상태바에 가리지 않는지. **가리면 이 스프린트의 유일한 미해결 케이스** — 재현 기기·OS 버전과 함께 기록하고 별도 대응(Android edge-to-edge 설정 검토).
- [ ] **S3 — 탭 전환 왕복(먹로그 ↔ 지도) 5회.** 먹로그 탭 헤더는 매번 그대로(워드마크·`+`·아바타), 지도 탭은 매번 헤더 없음. 전환 중 헤더 잔상·레이아웃 점프·깜빡임이 없는지.
- [ ] **S4 — 상태바 가독(F2).** 밝은 카카오 지도 타일 위에서 상태바 글자(dark 고정)가 읽히는지.
- [ ] **S5 — 기존 지도 기능 회귀.** 핀 탭 → 스팟 카드 도킹 시 상단 오버레이 위치 불변 · FAB 위치 불변(카드 위로 자동 상승) · 필터 칩 가로 스크롤 정상 · 로딩/에러/권한 배너가 화면 중앙에 표시(헤더 높이만큼 중심이 올라간 상태가 정상).

---

## 8. qa-logic에 요청하는 교차검증 경로

plan §7 qa-logic 1~8 전부. 특히 다음 3개를 우선 봐 달라.
1. **경계면 2번(옵션 유실)** — §2.2 표를 `HomeTabs.tsx` 실물과 대조. 함수 전환에서 옵션이 하나라도 빠지면 탭바 색·높이·라벨 폰트가 조용히 기본값으로 되돌아간다.
2. **경계면 3번(inset 누수)** — `insets.top`이 상단 2개에만 적용되고 FAB·카드·상태 오버레이 계산에 섞이지 않았는지(T3-6이 lock 중이나 코드 눈으로도 확인).
3. **D1(§4) 판단** — testID 1개 추가가 계획 이탈로 문제되는지. 문제라면 대안(부모 체인 traversal)의 취약성도 함께 봐 달라.
