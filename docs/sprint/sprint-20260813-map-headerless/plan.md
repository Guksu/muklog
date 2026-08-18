# Sprint: 지도 탭 헤더 제거 (map-headerless)

> 작성일 2026-08-13 · planner-map-headerless
> 설계 단일 출처 `docs/design/architecture.md` · 디자인 킷 `.claude/skills/ui-design/templates/muklog/`
> 선행 스프린트: `map-tab`(셸) · `map-tab-nearby` · `map-locate-button` · `map-category-filter` · `map-wish-pins` · `map-clustering`(2026-08-13) · `map-initial-location`(2026-08-13)

## 0. 판정 요약 (읽고 시작할 것)

| 항목 | 판정 | 근거 |
|---|---|---|
| 킷 정합 vs 킷 이탈 | **킷 이탈 — 사용자 명시 요청 우선** | 킷 `mk-home.jsx:334-336` `MapScreen`은 `<HomeHeader title="지도" …/>`를 **명시적으로 렌더**한다(mk-home.jsx:7-25 HomeHeader, `paddingTop: SP`). 즉 킷의 지도 화면은 **헤더 있는** 화면이고, 이번 변경은 킷 시안에서 벗어난다. 사용자 요청("지도 탭에선 헤더 제거", 목적=지도 풀블리드)이 킷보다 우선한다. |
| ui-publisher 투입 | **불필요 — developer 단독 진행** | 이탈이지만 **창작이 0**이다: 신규 컴포넌트·토큰·프리미티브·시안 해석이 없고, 변경은 ① 네비게이터 옵션 1개(헤더 미표시) ② **기존** 오버레이 top 오프셋에 `insets.top` 가산(=킷이 헤더 `paddingTop: SP`로 확보하던 상태바 여백을 오버레이가 그대로 승계)뿐이다. 기존 오버레이(칩 바·범례·FAB·스팟 카드)의 비주얼 값은 **전부 불변**. 새로 그릴 시안이 없으므로 퍼블리싱 단계를 건너뛴다. qa-visual은 "킷 이탈 사실 기록 + 인접 탭 헤더 불변 + 오버레이 미겹침"만 검증한다. |
| safe-area 처리 | **오버레이 top에 `insets.top` 가산** | 헤더가 사라지면 지도(WebView)가 상태바 아래까지 차오른다. 상단 오버레이(카테고리 필터 바 `top:12`, 범례 `top:56`)는 그대로 두면 노치/다이나믹 아일랜드/펀치홀에 겹친다. 두 값에 `insets.top`을 더해 **상대 간격은 보존하고 기준선만 상태바 아래로** 내린다(코드베이스 공통 패턴 — `HomeHeader`/`SubBar`/`LogScreen` 헤더의 `insets.top + spacing[n]`과 동일 idiom). |
| DB/Edge/네트워크 | **변경 0** | 마이그레이션·RPC·Edge Function·Kakao 호출·Supabase 쿼리 모두 미접촉. 순수 클라이언트 셸 변경. |

### 플래그 (사용자 확인 없이 진행하되 리더가 알아야 할 부수효과)
- **F1 — 지도 탭에서 `+`(로그 생성)·프로필 아바타 진입점이 사라진다.** 두 진입점은 `HomeHeader`(`src/navigation/HomeHeader/HomeHeader.tsx:76,80`)에만 있고, 헤더를 끄면 지도 탭에서 접근 불가가 된다. **대체 경로는 유지된다**: 먹로그 탭(=기본 탭 `Routes.LogList`)의 헤더에 두 진입점이 그대로 있고, 하단 탭바는 지도 탭에서 항상 보인다(탭바 숨김은 로그 0개 온보딩 한정 — 그때는 지도 탭 자체가 도달 불가). → **지도 위에 `+`/아바타를 떠 있는 오버레이로 재배치하지 않는다**(사용자 요청은 "헤더 제거"이지 "헤더를 지도 위로 옮기기"가 아니며, 오버레이 재배치는 킷에 없는 순수 창작이라 ui-publisher 사안이 된다). 사용자가 "지도에서도 프로필 가고 싶다"고 하면 별도 스프린트.
- **F2 — 상태바 텍스트 색은 손대지 않는다.** `App.tsx:86` `<StatusBar style="dark" />` 고정 + `app.json:8 userInterfaceStyle:"light"` + `ThemeProvider`가 light 고정이므로, 상태바가 카카오 지도 타일(밝은 베이지) 위에 놓여도 어두운 글자로 가독하다. 변경 없음 — QA 확인 항목으로만 둔다.

---

## 1. 기능 한줄 정의
지도 탭에 들어가면 상단 워드마크 헤더가 사라지고 **지도가 상태바 아래까지 화면을 가득 채운다**. 카테고리 필터 칩·범례는 노치/펀치홀을 피해 상태바 바로 아래에 뜬다. 먹로그 탭 등 다른 화면의 헤더는 그대로다.

## 2. 범위
**In-scope**
- 지도 탭(`Routes.MapTab`)에 한해 커스텀 헤더(`HomeHeader`) 미표시.
- 헤더 표시 정책을 **순수 함수 1개로 단일화**(어느 탭이 헤더를 갖는지의 단일 출처 — 지도 탭만 예외임을 테스트로 못 박는다).
- 지도 상단 오버레이 2종(카테고리 필터 바·범례)의 `top`에 `insets.top` 가산.
- 위 3건의 단위/렌더 테스트 + 디바이스 스모크 항목 정의.

**Out-of-scope (일부러 안 함 — 다음 스프린트 후보)**
- 지도 위에 `+`·프로필 아바타를 오버레이로 재배치(F1). 킷 없는 창작 → 필요해지면 ui-publisher 투입 별도 스프린트.
- 먹로그 탭·프로필·로그 상세 등 **다른 화면의 헤더**(전부 불변).
- 하단 탭바 숨김/투명화, 지도의 탭바 아래 확장(bottom edge-to-edge).
- 상태바 스타일 동적 전환(F2), 다크 모드 대응(앱 자체가 light 고정).
- 상단 오버레이의 비주얼 값 변경(칩 배경 스크림·blur·크기 등 — 전부 현행 유지).
- 지도 SDK/클러스터링/nearby 로직(`map-clustering`·`map-initial-location`이 이미 다룬 영역, 이번 변경과 파일 교집합 없음… 단 `MapTabScreen.tsx`는 `map-initial-location`이 이미 반영 완료된 상태를 베이스로 한다).

## 3. 데이터 · API 계약
**테이블/컬럼 변경: 없음. RLS 변경: 없음. RPC/Edge Function 변경: 없음. 신규 네트워크 호출: 없음.**

이번 스프린트의 "계약"은 전부 컴포넌트/모듈 경계다.

### 3.1 신규 순수 모듈 — 홈 탭 헤더 표시 정책
`src/navigation/homeHeaderVisibility/homeHeaderVisibility.ts` (+ `index.ts`, `.spec.ts` 콜로케이션 — `tabBarStyle` 모듈과 동일 idiom)

```ts
/**
 * 홈 탭(HomeTabs) 화면이 공통 커스텀 헤더(HomeHeader)를 표시할지 판단한다.
 * 지도 탭만 헤더 없이 지도를 화면 가득 쓴다(map-headerless — 킷 mk-home:335 이탈, 사용자 요청).
 * @param routeName 탭 라우트 이름(HomeTabParamList의 키)
 * @returns 헤더를 표시해야 하면 true
 */
export const shouldShowHomeHeader = ({ routeName }: { routeName: string }): boolean =>
  routeName !== Routes.MapTab;
```
- 인자: **named-object**(`{ routeName }`) — 컨벤션 준수.
- `routeName` 타입은 `string`(react-navigation `route.name`이 넘어오는 형태 그대로). 미지의 라우트명은 **헤더 표시(true)** 로 폴백 — 신규 탭이 생겨도 기존 동작 유지.

### 3.2 `HomeTabs` 옵션 계약 변경
`src/navigation/HomeTabs/HomeTabs.tsx`
- `screenOptions`가 **객체 → 함수 형태**로 바뀐다(라우트별 `headerShown` 판단 필요).
  ```tsx
  screenOptions={({ route }) => ({
    headerShown: shouldShowHomeHeader({ routeName: route.name }),
    header: () => <HomeHeader title={route.name === Routes.MapTab ? '지도' : '먹로그'} />,
    // …기존 옵션 전부 그대로(headerShadowVisible·tabBarActiveTintColor·tabBarInactiveTintColor·tabBarStyle·tabBarLabelStyle)
  })}
  ```
- react-navigation 라이브러리 콜백 contract이므로 `({ route })` 구조분해는 **컨벤션 named-args 예외**(기존 `tabBarIcon: ({ focused })` 주석 선례와 동일 — 주석으로 명시할 것).
- `header` 콜백은 남겨둔다(먹로그 탭이 계속 사용). 지도 탭은 `headerShown:false`라 호출되지 않는다.
- ⚠️ **금지**: `header: () => null`로 우회하지 말 것. 헤더 프레임이 남아 지도가 위로 확장되지 않거나(높이 0이어도 레이아웃 계산이 남음) 플랫폼별로 어긋난다. `headerShown:false`가 유일한 정답.
- ⚠️ **금지**: `Tab.Navigator`의 `screenOptions`에서 전역 `headerShown:false`로 끄고 먹로그 탭만 켜는 역방향. 정책의 단일 출처가 흐려진다.

### 3.3 `MapTabScreen` 오버레이 배치 계약
`src/navigation/screens/MapTabScreen/MapTabScreen.tsx`

| 오버레이 | 현행 | 변경 후 | 비고 |
|---|---|---|---|
| 카테고리 필터 바 래퍼 | `top: theme.spacing[12]` | `top: insets.top + theme.spacing[12]` | `left:0/right:0` edge-bleed 불변 |
| 범례 래퍼 | `top: theme.spacing[56]`, `left: theme.spacing[16]` | `top: insets.top + theme.spacing[56]`, `left` 불변 | 필터 바와의 상대 간격(44) 보존 |
| 상태 오버레이 | `StyleSheet.absoluteFillObject` 중앙 정렬 | **불변** | 중앙 배치라 노치 위험 없음. 헤더 높이만큼 중심이 올라가는 건 의도된 결과 |
| 현재위치 FAB | `right:16 / bottom:16` | **불변** | 하단 기준 — 헤더 제거와 무관 |
| 스팟 카드 3종(Selected/Nearby/Wish) | `MapWebView` 바깥 형제, 하단 도킹 | **불변** | 하단 기준 |
| `LogPickerSheet` | 모달 시트 | **불변** | 자체 safe-area 처리 |

- `insets`는 `useSafeAreaInsets()`(`react-native-safe-area-context`)로 `MapTabScreen`에서 직접 읽는다. `HomeHeader:52`·`SubBar:29`·`LogScreen` 헤더와 동일 패턴.
- **`SafeAreaView`/`Screen edges`를 쓰지 말 것.** 지도(WebView) 자체는 상태바 아래까지 차올라야 하므로 컨테이너에 top inset 패딩을 주면 안 된다 — 지도 위 **오버레이만** inset을 흡수한다. (`ui-fidelity-audit`의 "SubBar가 top inset 직접 처리 → Screen edges에서 'top' 제외" 결정과 같은 원리.)
- **testID 신설**(테스트가 style을 읽을 지점 — 래퍼 View에 부여):
  - 카테고리 필터 바 래퍼 View → `testID="map-overlay-filterbar"`
  - 범례 래퍼 View → `testID="map-overlay-legend"`
  (기존 `category-filter-bar`·`map-legend-dot`는 자식 컴포넌트 내부라 `top`을 들고 있지 않다. 래퍼에 붙여야 위치를 단언할 수 있다.)

### 3.4 불변 계약(회귀 금지 — QA lock 대상)
- WebView 메시지 계약(INIT/SET_MARKERS/SET_SELECTED/RECENTER/READY/MARKER_TAP/BOUNDS_CHANGED/MAP_TAP/ERROR) **전부 불변**.
- `useMuklogPins`·`useWishPins`·`useNearbyPlaces`·`useLocationPermission`·`useAddNearbyWish` 시그니처·호출 횟수 **불변**.
- 먹로그 탭 헤더(워드마크 "먹로그" + `+` + 아바타) **불변**.
- 하단 탭바(`buildTabBarStyle`·`shouldHideTabBar`) **불변**.

## 4. 화면 · UX

### 4.1 변경 전/후
```
[변경 전 — 지도 탭]                       [변경 후 — 지도 탭]
┌──────────────────────┐                ┌──────────────────────┐
│ ▓▓ 상태바 ▓▓          │                │ ▓▓ 상태바(지도 위) ▓▓  │  ← 지도가 여기까지 차오름
├──────────────────────┤                │ [전체][한식][일식]…    │  ← top = inset + 12
│ 지도        [+] (아바타)│  ← 제거        │ ●우리맛집 ●가고싶은곳…  │  ← top = inset + 56
├──────────────────────┤                │                      │
│ [전체][한식][일식]…    │  top 12        │        (지도)         │
│ ●우리맛집 ●가고싶은곳…  │  top 56        │                  (◉) │
│        (지도)     (◉) │                │                      │
├──────────────────────┤                ├──────────────────────┤
│  먹로그      지도      │                │  먹로그      지도      │  ← 불변
└──────────────────────┘                └──────────────────────┘
```
- 먹로그 탭 → 지도 탭 전환 시 헤더가 사라지고 지도가 그 높이만큼 위로 확장된다. 지도 탭 → 먹로그 탭 복귀 시 헤더가 다시 나타난다(react-navigation 화면별 헤더 — 별도 애니메이션 처리 불필요).

### 4.2 상태별 표시(전부 현행 유지, 위치만 이동)
- **로딩**: 상태 오버레이 카드 화면 중앙("지도를 불러오는 중이에요").
- **권한 거부**: 중앙 info 배너("위치 권한을 허용하면 현재 위치를 볼 수 있어요").
- **에러**: 중앙 error 배너 + "다시 시도".
- **빈 상태(핀 0)**: 안내 없음(기존 결정 유지) — 지도만 깔끔히.
- 위 3종 배너 표시 중에도 상단 필터 바/범례는 그대로 보이며 노치를 침범하지 않는다.

### 4.3 원티드/킷 토큰 사용 지점
- `theme.spacing[12]`·`theme.spacing[56]`·`theme.spacing[16]` — 기존 값 그대로 재사용(신규 토큰 0).
- 색·radius·타이포 변경 0. 킷 `--mk-*` 실값 접촉 0.

## 5. 작업 목록 (각 인수조건 포함)

- [ ] **T1 — 헤더 표시 정책 순수 모듈 신설** (`src/navigation/homeHeaderVisibility/`)
  — 인수조건: `shouldShowHomeHeader({ routeName: Routes.MapTab })`가 `false`, `shouldShowHomeHeader({ routeName: Routes.LogList })`가 `true`, 미지의 라우트명(`'Whatever'`)은 `true`를 반환한다.
  — 테스트: `homeHeaderVisibility.spec.ts` — 3케이스 단언.

- [ ] **T2 — `HomeTabs`에서 지도 탭 헤더 끄기**
  — 인수조건: `screenOptions`가 함수 형태로 바뀌고 `headerShown`이 `shouldShowHomeHeader`의 결과로 결정된다. 기존 옵션(`headerShadowVisible`·tint 2종·`tabBarStyle`·`tabBarLabelStyle`)과 `header`(먹로그 탭용) 콜백은 전부 보존된다. `tabBarIcon`/탭 2개 정의 불변.
  — 테스트: T1 단위 테스트 + 코드 리뷰(QA 교차검증 §7-1). 네비게이터 렌더 테스트는 만들지 않는다(NavigationContainer + 전 Provider 모킹 비용이 얻는 것보다 크다 — 정책은 T1이, 실제 표시는 디바이스 스모크 S1이 잡는다).

- [ ] **T3 — `MapTabScreen` 상단 오버레이에 top inset 반영**
  — 인수조건: `useSafeAreaInsets()`를 읽어 필터 바 래퍼 `top = insets.top + spacing[12]`, 범례 래퍼 `top = insets.top + spacing[56]`로 계산한다. `insets.top = 0`이면 현행과 **정확히 동일한 값**(12 / 56)이 나온다. FAB·스팟 카드·상태 오버레이의 위치 계산은 손대지 않는다.
  — 테스트: `MapTabScreen.spec.tsx` — inset 0 vs 59 두 번 렌더해 `top` 차이가 정확히 59인지 단언(T3-1·T3-2).

- [ ] **T4 — 오버레이 래퍼 testID 부여**
  — 인수조건: 필터 바 래퍼에 `map-overlay-filterbar`, 범례 래퍼에 `map-overlay-legend` testID가 있고, 기존 testID(`category-filter-bar`·`map-locate-button`·`map-webview` 등)는 그대로다.
  — 테스트: T3 테스트가 이 testID로 노드를 찾으므로 자동 커버 + 기존 스펙 전량 green.

- [ ] **T5 — `MapTabScreen.spec.tsx`에 safe-area 가변 모킹 추가**
  — 인수조건: `LogScreen.spec.tsx:35-42`와 동일한 `mockTopInset` 패턴(`jest.requireActual` 스프레드 + `useSafeAreaInsets` 오버라이드)을 추가하고, 기존 지도 스펙 전 케이스가 그대로 통과한다(모킹 추가로 인한 회귀 0).
  — 테스트: `npm test -- MapTabScreen` 전량 green.

- [ ] **T6 — 회귀 스위트 통과**
  — 인수조건: `npm test` 전량 green(신규 케이스 포함, 기존 실패 0).
  — 테스트: `npm test`.

- [ ] **T7 — 디바이스 스모크 항목 문서화**(dev-notes에 체크리스트로)
  — 인수조건: §5-2 스모크 항목 S1~S5가 dev-notes에 기록되고, 각 항목에 "무엇을 눈으로 확인하는지"가 적혀 있다.
  — 테스트: 문서 존재 확인(스모크 실행 자체는 사용자/실기기 몫 — 메모리 `qa-layout-blind-spot`에 따라 **레이아웃 변경이므로 스모크 필수**로 표시).

## 5-1. 테스트 케이스 (TDD — Red→Green→Refactor)

### 단위(순수 함수) — `homeHeaderVisibility.spec.ts`
| # | 유형 | 케이스 | 기대 |
|---|---|---|---|
| T1-1 | 정상 | `routeName = Routes.MapTab` | `false` |
| T1-2 | 정상 | `routeName = Routes.LogList` | `true` |
| T1-3 | 경계 | `routeName = 'UnknownTab'`(미지 라우트) | `true`(안전 폴백 — 신규 탭은 헤더 유지) |

### 화면 렌더 — `MapTabScreen.spec.tsx` (신규 describe: `map-headerless`)
| # | 유형 | 케이스 | 기대 |
|---|---|---|---|
| T3-1 | 정상 | `insets.top = 0`으로 렌더 → `map-overlay-filterbar`의 flatten된 `top` | `12`(현행 보존) |
| T3-2 | 경계 | `insets.top = 59`(다이나믹 아일랜드 근사)로 렌더 → 같은 노드의 `top` | `12 + 59 = 71`. **T3-1 값 + 59**로 단언(상수 하드코딩 대신 델타 단언 — `LogScreen.spec.tsx:509-512` 선례) |
| T3-3 | 정상 | `insets.top = 0` → `map-overlay-legend`의 `top` | `56` |
| T3-4 | 경계 | `insets.top = 59` → `map-overlay-legend`의 `top` | T3-3 값 + 59 |
| T3-5 | 경계 | `insets.top = 59` → 필터 바와 범례의 `top` 차이 | 정확히 `44`(=56−12, 상대 간격 보존 — inset이 둘 중 하나에만 적용되는 실수 방지) |
| T3-6 | 회귀 | `insets.top = 59` → `map-locate-button` 래퍼의 `bottom` | `16`(inset이 하단 요소로 새지 않음) |

### 모킹/스모크 경계 (`docs/testing-strategy.md` 준수)
- **모킹**: `react-native-webview`(실 네이티브 부재) · `react-native-safe-area-context`의 `useSafeAreaInsets`(가변 inset 주입) · 지도 훅 5종(기존 스펙이 이미 모킹) · `@react-navigation/native`(`useFocusEffect`만, 기존).
- **단위 테스트 대상 아님**: react-navigation이 `headerShown:false`를 실제로 어떻게 렌더하는지(라이브러리 내부) — 네비게이터 렌더 테스트를 만들지 않는 이유(T2 참조). 실제 헤더 부재는 **S1 디바이스 스모크**가 판정한다.

## 5-2. 디바이스 스모크 (S1~S5 — 실기기, 메모리 `qa-layout-blind-spot` 준수)
- **S1** iOS 노치/다이나믹 아일랜드 기기: 지도 탭 진입 → 상단에 워드마크 헤더가 **없고** 지도가 상태바 뒤까지 차오르는지. 카테고리 칩의 상단이 노치/아일랜드와 **겹치지 않는지**(칩 전체가 온전히 보임).
- **S2** Android 펀치홀/제스처 기기: 같은 확인 + `insets.top`이 0으로 보고되는 비 edge-to-edge 케이스에서도 칩이 상태바에 가리지 않는지(가리면 이 스프린트의 유일한 미해결 케이스 — dev-notes에 기록 후 별도 대응).
- **S3** 탭 전환 왕복(먹로그 ↔ 지도) 5회: 먹로그 탭 헤더는 그대로, 지도 탭은 계속 헤더 없음. 전환 중 헤더 잔상/점프/깜빡임 없음.
- **S4** 지도 탭에서 상태바 글자가 밝은 지도 타일 위에서 읽히는지(F2 — dark 고정이라 정상 기대).
- **S5** 기존 지도 기능 회귀: 핀 탭 → 카드 도킹 시 상단 오버레이 위치 불변 · FAB 위치 불변 · 필터 칩 가로 스크롤 정상 · 로딩/에러 배너 중앙 표시.

## 6. 엣지케이스
- **노치/펀치홀 겹침(핵심 위험)**: 헤더가 흡수하던 `insets.top`을 오버레이가 승계하지 않으면 칩이 상태바에 씹힌다 → T3-1~T3-5로 lock + S1·S2로 최종 확인.
- **inset이 0인 기기/플랫폼**: 계산이 `0 + 12 = 12`로 현행과 동일 → 회귀 0(T3-1·T3-3이 이 경로를 고정).
- **Android가 `insets.top`을 0으로 보고**: 비 edge-to-edge 안드로이드에서는 시스템이 이미 상태바 아래에서 화면을 시작하므로 `12`만으로 정합. (`tabBarStyle.ts` 주석의 `insets.bottom=0` 선례와 같은 성질 — top도 동일 논리로 안전하지만 **S2로 실측 확인**.)
- **하단 탭바 숨김 상태(로그 0개, `shouldHideTabBar`)**: 이때 지도 탭은 도달 불가(탭바가 없어 전환 수단이 없음) → 이번 변경과 상호작용 없음. 로그 합류/생성으로 탭바가 돌아온 직후 지도 탭 진입해도 헤더 없음 동일.
- **상태 오버레이 표시 중**: 배너는 중앙 정렬이라 헤더 제거로 중심이 헤더 높이만큼 올라간다. 노치 침범 불가(중앙) — 의도된 결과이며 별도 처리 없음.
- **스팟 카드 도킹 시**: 지도 영역(`MapWebView` flex:1)이 줄어들지만 상단 오버레이는 **top 기준**이라 위치 불변. FAB는 지도 영역 하단 기준이라 자동으로 카드 위로 올라감(기존 동작 유지, T3-6이 하단 계산 오염을 방어).
- **회전**: `app.json:6 orientation:"portrait"` 고정 → landscape 케이스 없음.
- **다크 모드**: `userInterfaceStyle:"light"` + `ThemeProvider` light 고정 → 다크에서 상태바 대비 문제 발생 불가(향후 다크 도입 시 F2 재검토).
- **딥링크로 지도 탭 직행**(`useDeepLinkNavigation`): 헤더 없음 동일 — 진입 경로 무관하게 화면 옵션이 결정한다.
- **동시성(커플 2명)**: 이번 변경은 로컬 셸 렌더뿐 — 파트너 상태·Realtime·DB와 무관(해당 없음).
- **네트워크 실패**: 지도 SDK 로드 실패/핀 조회 실패 시에도 상단 오버레이 배치는 동일하게 inset을 반영한다(에러 배너와 칩이 동시에 보이는 상태 — S5).
- **`+`/프로필 진입 상실(F1)**: 지도 탭에서 프로필로 가려면 먹로그 탭을 한 번 거쳐야 한다. 의도된 트레이드오프이며 §2 Out-of-scope에 기록.

## 7. QA 교차검증 경계면 (생산자 ↔ 소비자)

**qa-logic** (양쪽을 같이 열고 읽을 쌍)
1. `homeHeaderVisibility.ts`(정책) ↔ `HomeTabs.tsx`(소비) — 헤더가 꺼지는 라우트가 **지도 탭 하나뿐**인지. `Routes` enum 값과 문자열 비교가 어긋나지 않는지.
2. `HomeTabs.tsx` `screenOptions` 객체→함수 전환 ↔ 기존 옵션 전량 — `headerShadowVisible`·`tabBarActiveTintColor`·`tabBarInactiveTintColor`·`tabBarStyle`(+`hideTabBar` 분기)·`tabBarLabelStyle`이 **하나도 유실되지 않았는지**(함수 전환 시 옵션 누락이 전형적 사고).
3. `MapTabScreen.tsx` 오버레이 `top` 계산 ↔ `useSafeAreaInsets()` — `insets.top`이 상단 2개에만 적용되고 FAB/카드/상태 오버레이로 새지 않았는지.
4. `MapTabScreen.tsx` ↔ `MapWebView`(children `absoluteFill`) — 오버레이의 좌표 기준점이 헤더 제거로 화면 최상단으로 이동했음을 두 파일이 같은 전제로 두는지.
5. `HomeHeader.tsx`(`+`·프로필 진입) ↔ 지도 탭 도달 경로 — 지도 탭에서 사라진 진입점의 대체 경로(먹로그 탭 헤더)가 실제로 살아 있는지(F1 검증).
6. `MapTabScreen.spec.tsx` 신규 safe-area 모킹 ↔ 기존 케이스 전량 — 모킹 추가가 기존 단언을 깨지 않았는지.
7. 코드 컨벤션(`docs/code-convention.md`) — named-object 인자, 화살표 함수, `useCallback/useMemo` 미사용, 라이브러리 콜백 예외 주석.
8. 비용 가드레일 — 네트워크 호출·리렌더 유발 리스너 증가 0인지(`useSafeAreaInsets` 추가로 인한 리렌더는 inset 변경 시에만, 즉 사실상 0).

**qa-visual** (킷 ↔ RN 대조)
1. 킷 `mk-home.jsx:334-336`(헤더 있는 MapScreen) ↔ RN 지도 탭(헤더 없음) — **의도된 이탈**임을 리포트에 명시(불일치로 FAIL 처리하지 말 것. 근거: §0 판정 + 사용자 요청).
2. 킷 `mk-home.jsx:358` 범례 `top:14 / left:16`(지도 div 기준) ↔ RN 범례 `insets.top + 56 / left 16` — 킷은 헤더 아래 지도 영역 기준, RN은 화면 기준 + inset. **필터 바(킷 mk-log:113-118에서 가져온 요소)가 킷 지도 화면엔 없다**는 점을 감안해 "상단 스택 = 필터 바 → 범례" 순서와 간격 44가 유지되는지만 본다.
3. 킷 `mk-home.jsx:363-372` FAB `right:16 / bottom:16` ↔ RN — 불변 확인.
4. 먹로그 탭 헤더(킷 `mk-home.jsx:106`) ↔ RN — 워드마크·`+`·아바타 전부 불변 확인.
5. 상단 오버레이가 노치/상태바를 침범하지 않는지 — 스크린샷 기반(S1·S2와 동일 판정).

## 8. 비용 가드레일 체크
- **Kakao Local API 호출**: 증가 0. `useNearbyPlaces`의 디바운스·양자화 캐시·최소이동 임계 전부 미접촉.
- **Kakao Map SDK 로드**: 변경 0(`mapHtml` 미접촉, `MapPrewarm` 미접촉).
- **Supabase 쿼리/RPC/Edge Function**: 호출 0건 추가. 마이그레이션 0.
- **Storage/이미지**: 무관.
- **폴링·타이머·리스너**: 신규 0. `useSafeAreaInsets` 구독 1개 추가(라이브러리 컨텍스트 — inset 변경 시에만 리렌더, portrait 고정이라 사실상 발화 0).
- **AWS 리소스**: 미사용(불변).

## 9. 완료 기준 (Definition of Done)
1. T1~T7 인수조건 전부 충족.
2. `npm test` 전량 green(신규 T1-1~3 · T3-1~6 포함).
3. `docs/sprint/sprint-20260813-map-headerless/dev-notes.md`에 변경 파일·스모크 체크리스트(S1~S5)·F1/F2 상태 기록.
4. qa-logic·qa-visual 리포트 분리 작성(`qa-report-logic.md`·`qa-report-visual.md`), qa-visual은 §7 qa-visual 1번(의도된 킷 이탈)을 명시.
5. 디바이스 스모크 S1~S5는 **이월 허용**(실기기 필요) — 단 dev-notes에 "이월"로 명시.
6. `docs/design/architecture.md` §4(화면) 또는 스프린트 백로그 표에 `map-headerless` 행 추가 — 킷 이탈 결정과 F1(진입점 축소)을 기록해 다음 스프린트가 되돌리지 않게 한다.

## 10. 변경 예상 파일
| 파일 | 성격 |
|---|---|
| `src/navigation/homeHeaderVisibility/homeHeaderVisibility.ts` | 신규(순수 함수) |
| `src/navigation/homeHeaderVisibility/homeHeaderVisibility.spec.ts` | 신규(단위 테스트) |
| `src/navigation/homeHeaderVisibility/index.ts` | 신규(배럴) |
| `src/navigation/HomeTabs/HomeTabs.tsx` | 수정(`screenOptions` 함수화 + `headerShown`) |
| `src/navigation/screens/MapTabScreen/MapTabScreen.tsx` | 수정(오버레이 top inset + testID 2개) |
| `src/navigation/screens/MapTabScreen/MapTabScreen.spec.tsx` | 수정(safe-area 모킹 + 신규 describe) |
| `docs/design/architecture.md` | 수정(백로그/화면 기록) |
| `docs/sprint/sprint-20260813-map-headerless/dev-notes.md` | 신규(developer) |

**미접촉 보장**: `HomeHeader.tsx` · `SubBar.tsx` · `tabBarStyle.ts` · `MapWebView` · `mapHtml.ts` · 지도 훅 전부 · 마이그레이션 · Edge Function.
