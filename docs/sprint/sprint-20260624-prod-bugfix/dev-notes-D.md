# dev-notes D — Android 하단 탭바(GNB) safe-area (#1)

## #1 Android에서 하단 탭바가 시스템 내비게이션바에 가려짐

### 근본원인
`src/navigation/HomeTabs.tsx`의 `tabBarStyle`이 하단 패딩을 **react-navigation의 자동 home-indicator safe-area inset**에 맡기고 있었다(기존 주석: "하단 패딩(킷 22)은 react-navigation이 자동 처리"). 그러나 Android(app.json에 `edgeToEdgeEnabled` 미설정)에서는 `react-native-safe-area-context` 4.12.0이 `insets.bottom`을 **0으로 보고**한다. 따라서 react-navigation도 하단 패딩을 0으로 두어 탭바가 화면 끝에 붙고, 그 위로 시스템 내비게이션바(제스처/3버튼)가 겹쳐 GNB가 가려졌다.

코드베이스 다른 화면들(`Screen edges={['left','right']}` + `useSafeAreaInsets().bottom` 수동 적용 — MuklogList·PlaceSearchView·HomeHeader 등)은 이미 자동 inset에 의존하지 않고 직접 적용하는 패턴인데, 탭바만 자동에 의존해 어긋났다.

### 수정 (파일:라인)
- **신규 `src/navigation/tabBarStyle.ts`** — 순수 빌더 `buildTabBarStyle({ insets, theme })`(+ `TAB_BAR_CONTENT_HEIGHT = 56`).
  - 킷 비주얼 토큰 유지: `backgroundColor: surface`, `borderTopColor: hairlineAlt`, `paddingTop: spacing[8]`.
  - `paddingBottom: insets.bottom` — 콘텐츠를 시스템 내비바 위로 클리어.
  - `height: TAB_BAR_CONTENT_HEIGHT + insets.bottom` — 바 전체를 inset만큼 키워 GNB 비가림(콘텐츠 위치는 paddingBottom으로 보존).
  - inset 0(인셋 없는 기기)면 콘텐츠 높이만 → **회귀 0**. iOS 홈인디케이터·Android 제스처/3버튼 모두 그만큼 자란다.
- **`src/navigation/HomeTabs.tsx`**
  - line 7: `useSafeAreaInsets` import 추가.
  - line 12: `buildTabBarStyle` import 추가.
  - line ~19: `const insets = useSafeAreaInsets();`
  - line ~30: 인라인 `tabBarStyle` 객체 → `tabBarStyle: buildTabBarStyle({ insets, theme })`.

### 생산자 ↔ 소비자 매핑
- 생산자: `useSafeAreaInsets()` (react-native-safe-area-context, App.tsx의 `SafeAreaProvider` 하위) → `insets.bottom`.
- 소비자: `buildTabBarStyle({ insets, theme })` → `Tab.Navigator screenOptions.tabBarStyle`.

### 테스트
- **신규 `src/navigation/tabBarStyle.spec.ts`** (3 케이스, TDD Red→Green):
  1. inset 있으면 `paddingBottom = insets.bottom`, `height = CONTENT + inset`.
  2. inset 0이면 추가 패딩 없음·콘텐츠 높이만(회귀 방지).
  3. 킷 토큰(surface/hairlineAlt/paddingTop spacing[8]) 유지.
- 결과: `npx jest src/navigation` → **22 suites / 263 tests 전부 통과**. 회귀 0.
- `npx tsc --noEmit` → 변경 파일(HomeTabs.tsx·tabBarStyle.ts) 타입 에러 0.

### 디바이스 검증 필요(사용자)
단위 테스트는 inset 계산만 검증한다. 실기기에서 다음을 확인 필요:
1. **Android 제스처 내비** — 탭바 라벨/아이콘이 제스처 바에 가리지 않는가.
2. **Android 3버튼 내비** — 탭바가 버튼 바 위로 올라오는가.
3. **iOS 홈인디케이터** — 회귀 없이 기존처럼 클리어되는가.
4. 탭바 높이가 과하게 커지지 않는가(`TAB_BAR_CONTENT_HEIGHT=56` 적정성). 필요 시 이 상수만 조정.

### 경계 준수
하단 탭바 관련 파일(`HomeTabs.tsx` 신규 `tabBarStyle.ts`)만 수정. HomeHeader(그룹 A)·map·profile·categories 미변경.
