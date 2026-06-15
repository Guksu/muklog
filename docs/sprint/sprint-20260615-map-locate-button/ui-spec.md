# UI Spec: 지도 탭 현재위치 버튼 (map-locate-button)

> 디자인 단일 출처: 킷 `.claude/skills/ui-design/templates/muklog/mk-home.jsx:289-298`(우하단 "내 위치로 이동" FAB) + 펄스 `mk-home.jsx:267-268`(me 마커 링 애니메이션 `mkLocate`).
> 담당: ui-publisher(아이콘 등록·`MapLocateButton` 프리젠테이션·토큰). 배선/로직(handleLocate·refreshCoords·RECENTER)은 developer.

## 1. 산출물 요약
| 산출물 | 파일 | 상태 |
|---|---|---|
| `IconName.Locate` + glyph | `assets/icons/icons.ts`, `src/components/Icon.tsx`(+`Icon.spec.tsx`) | 신규 |
| `mapLocate` 컬러 토큰(#3B82F6) | `src/theme/tokens.ts`(palette·light·dark, +`tokens.spec.ts`) | 신규 |
| `shadow.fab` 토큰 | `src/theme/tokens.ts` | 신규 |
| `MapLocateButton` 컴포넌트 | `src/features/map/components/MapLocateButton.tsx`(+`.spec.tsx`) | 신규 |
| barrel export | `src/features/map/components/index.ts` | 수정 |

`npm test`(MapLocateButton·Icon·tokens spec) green + `tsc --noEmit` green.

## 2. 킷 라인 ↔ RN 매핑

### 2.1 FAB 컨테이너 (킷 mk-home.jsx:290-294 `<button>`)
| 킷(웹, mk-home) | 실값 | RN(`MapLocateButton.tsx`) |
|---|---|---|
| `width:46 height:46` (291) | 46×46 | `styles.button` `width:46 height:46` |
| `borderRadius:999` (291) | full | `theme.radius.full` |
| `background:var(--mk-card)` (292) | 카드면(흰) | `theme.color.surface` |
| `boxShadow:0 4px 14px rgba(0,0,0,.18)` (292) | 검정 소프트 그림자 | `theme.shadow.fab`(신규: opacity .18 / radius 14 / offset {0,4} / elevation 5) |
| `border:none` (291) | 보더 없음 | 미지정(헤어라인 아님 — 떠 있는 레이어라 그림자만) |
| `display:flex; alignItems/justifyContent:center` (293) | 중앙 정렬 | `alignItems:'center' justifyContent:'center'` |
| `aria-label="내 위치로 이동"` (290) | 접근성 | `accessibilityRole="button" accessibilityLabel="내 위치로 이동"` |
| `right:16 bottom:16` (291) | 우하단 오프셋 | **부모(MapTabScreen) 책임** — 컴포넌트는 절대좌표를 갖지 않음(레이아웃 분리, §4 참조) |

### 2.2 아이콘 (킷 mk-home.jsx:298 `<I name="locate" size={24} color="#3B82F6" />`)
| 킷 | RN |
|---|---|
| `name="locate"` | `IconName.Locate`(=`'locate'`) — glyph는 ui-design `assets/icons/locate.svg` **verbatim**(width/height 제거, viewBox `0 0 24 24` 유지, fill="currentColor") |
| `size={24}` | `<Icon size={24}>` |
| `color="#3B82F6"` | `color="mapLocate"`(신규 토큰 #3B82F6, 킷 verbatim) |

색 출처 주: 킷 FAB 아이콘과 me 마커는 **#3B82F6**(킷 인라인 실값, `--mk-*` 변수 아님). 브랜드 primary는 **#3366FF**(`--mk-accent`)로 미세하게 다르다. plan §4 지시("킷 verbatim 유지: 킷이 디자인 기준")에 따라 primary로 근사하지 않고 전용 토큰 `mapLocate`를 추가해 정확히 일치시킴. raw hex 하드코딩 회피(컨벤션) + 킷 정합 양립.

### 2.3 탭 피드백 (킷 mk-home.jsx:295-297 onMouseDown/Up/Leave `transform:scale(.92)`)
| 킷 | RN |
|---|---|
| press 동안 `scale(.92)`, release `scale(1)` | `Pressable` `pressed ? styles.pressed`(=`transform:[{scale:0.92}]`). 기존 프리미티브(Card/Chip/IconButton) press-state 패턴과 동일. `Animated` 미사용(코드베이스 무선례·과한 애니메이션 지양). |

### 2.4 펄스 애니메이션 (킷 mk-home.jsx:267-268 `mkLocate .7s`) — RN 근사/범위 분리
- 킷의 펄스(중앙 18×18 원 `border:2px solid #3B82F6`, `animation:mkLocate .7s`)는 **지도 위 현재위치(me) 마커**의 1회 확산 링이다(FAB 자체 효과 아님 — `<FauxMap>` 내부 `recenter` 트리거에 종속).
- muklog RN에서 지도·마커는 **WebView(`mapHtml.ts`) 격리 영역**이다. 따라서 펄스는 RN `MapLocateButton`의 책임이 아니라 **WebView/`__muklogRecenter`(developer)** 영역에 속한다.
- 결정(근사+사유): `MapLocateButton`은 펄스 미포함(순수 onPress 셸). plan §4/T9의 "탭 시 펄스 1회"는 WebView me 마커 차원이며 **디바이스 스모크/qa-visual** 대상. RN FAB에 별도 Animated 펄스를 추가하지 않는다(킷 펄스는 마커 효과이지 버튼 효과가 아님 → 추가 시 오히려 킷과 불일치). developer가 원할 경우 `__muklogRecenter` 핸들러에서 마커 링 1회 재생으로 킷 `mkLocate`를 근사(이 스프린트 mapHtml 범위, ui-publisher 경계 밖).

## 3. props 계약 (developer 인계)

### `MapLocateButton` (`src/features/map/components/`)
```ts
export type MapLocateButtonProps = {
  onPress: () => void; // 필수. 탭 시 호출. 위치 재취득·재센터 배선은 호출부 책임.
  testID?: string;     // 선택. 테스트 식별자.
};
```
- 데이터/권한/위치 로직 **없음**. `accessibilityLabel`은 내부 고정("내 위치로 이동", 킷 aria-label verbatim) — prop 아님.
- 렌더: 46×46 surface 원형 FAB + locate 아이콘(24/mapLocate) + press scale .92.

### `Icon` (`IconName.Locate`)
```tsx
<Icon name={IconName.Locate} size={24} color="mapLocate" />
```
- `testID="icon-locate"`로 렌더(스모크 검증됨).

## 4. developer 조립 가이드 (MapTabScreen 배선)
> ⚠ ui-publisher 경계: 아래는 **developer 작업 안내**일 뿐(MapTabScreen.tsx는 ui-publisher가 건드리지 않음).

1. import: `import { MapLocateButton } from '@/features/map/components';`(barrel).
2. 배치: `MapWebView` children 오버레이로 우하단에 절대배치. 컴포넌트는 자체 좌표가 없으니 **부모가 래퍼 `View`로 위치를 준다**:
   - `position:'absolute'`, `right: theme.spacing[16]`, `bottom: theme.spacing[16]`(킷 right/bottom 16).
   - NearbySpotCard/SelectedSpotCard가 하단 도킹될 때 가려지지 않도록: 카드 표시 시 `bottom`을 카드 높이만큼 상향하거나 z-order로 카드 위에 둔다(plan §4 — 디바이스 스모크/qa-visual 확인).
3. 콜백: `onPress={handleLocate}`(plan §3.7 — 권한 분기 → `refreshCoords` → `buildRecenterScript` inject). 펄스(me 마커 링)는 `__muklogRecenter`(mapHtml) 차원에서 근사.

예시(개념, developer 구현):
```tsx
<MapWebView ref={webviewRef} ...>
  <View style={{ position: 'absolute', right: theme.spacing[16], bottom: locateBottom }}>
    <MapLocateButton onPress={handleLocate} />
  </View>
</MapWebView>
```
- `MapWebView`가 children 오버레이를 지원하는지 확인 필요. 미지원이면 형제 절대배치로 둔다(developer 판단, ui-publisher 경계 밖).

## 5. 토큰 변경 목록
| 토큰 | 값 | 출처 | 비고 |
|---|---|---|---|
| `color.mapLocate` | `#3B82F6` | 킷 mk-home:270·298 인라인 verbatim | 라이트/다크 공통. primary(#3366FF)와 구분. spec 검증. |
| `shadow.fab` | `{ shadowColor:'#000', shadowOpacity:0.18, shadowRadius:14, shadowOffset:{0,4}, elevation:5 }` | 킷 mk-home:292 `0 4px 14px rgba(0,0,0,.18)` | RN shadowRadius는 CSS blur와 1:1 아님(근사). 검정 그림자(킷 동일, 컬러 아님). |

## 6. RN 미재현/근사 기록
- **펄스(mkLocate)**: FAB가 아닌 WebView me 마커 효과 → RN FAB 비포함, WebView(developer) 영역으로 분리(§2.4).
- **box-shadow blur 14px**: RN `shadowRadius:14`로 근사(블러 반경 환산 비선형이나 시각 근접). elevation 5로 Android 보강.
- **scale(.92) 트랜지션**: 킷은 CSS transition, RN은 `Pressable` press-state 즉시 토글(트랜지션 타이밍 없음 — 컨벤션상 과한 애니메이션 지양).

## 7. qa-visual 대조 포인트
- 킷 mk-home:291 46×46·radius full ↔ `MapLocateButton.tsx styles.button`.
- 킷 mk-home:292 surface 배경·그림자 ↔ `theme.color.surface`·`theme.shadow.fab`.
- 킷 mk-home:298 locate 아이콘 24·#3B82F6 ↔ `<Icon Locate 24 mapLocate>`(=#3B82F6).
- 킷 mk-home:291 우하단 16/16 오프셋 ↔ **MapTabScreen 래퍼**(컴포넌트 아님 — 배치는 developer, 디바이스 스모크).
- 카드 하단 도킹 시 FAB 비가림 ↔ MapTabScreen z/오프셋(디바이스 스모크).
