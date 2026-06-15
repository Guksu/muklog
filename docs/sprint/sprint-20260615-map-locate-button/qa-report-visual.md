# QA Report — Visual 충실도 (map-locate-button)

> 검증자: qa-visual · 방법: 킷 `templates/muklog`(정답지) ↔ RN 양쪽 동시 대조(3축) · 로직/데이터 제외(qa-logic 담당)
> 디자인 단일 출처: 킷 `mk-home.jsx:289-298`(우하단 FAB) + `mk-home.jsx:252·266-270`(me 마커 펄스 `mkLocate`)
> 매핑 출발점: `docs/sprint/sprint-20260615-map-locate-button/ui-spec.md`

## 갱신 이력 (2026-06-16) — FAB 위치 점프 버그 정정 재검증

**사용자 버그 제보**: 현재위치 FAB가 카드 유무에 따라 위치가 **점프**(카드 없을 때 위치와 카드 도킹 시 위치가 다름)해 킷 디자인과 불일치. 킷은 FAB가 **항상 같은 위치**.

**이전 보고서(§4)의 오판 정정**: 직전 검증은 developer의 `cardDocked` 조건부 오프셋(`bottom = cardDocked ? 120px : 16`)을 "겹침 회피, 적정 클리어런스"로 **통과 처리**했다. 이는 **킷 구조를 잘못 읽은 오판**이었다. 킷(mk-home.jsx)은 FAB offset을 조건부로 바꾸지 않는다 — FAB(290-298)는 지도 영역 div(`flex:1`, 263) 안에 `right:16 bottom:16` 고정이고, 선택 스팟 카드(302~)는 그 div **바깥의 형제 블록**(`flex:none`, 303)이다. 카드가 뜨면 지도 div가 줄어 FAB가 **offset 변동 없이** 자동으로 카드 위로 온다(항상 "지도 영역 바닥 16px"). 조건부 120px 오프셋은 킷에 없는 "위치 점프" 시각 회귀를 만든다 → **실제로는 불일치였음**.

**수정 검증 결과**: `MapTabScreen.tsx`가 킷 구조대로 재정합됨 — FAB는 MapWebView(flex:1) children 오버레이로 `bottom: spacing[16]` **고정**(cardDocked 조건 제거), 카드는 MapWebView 바깥 형제(`flexShrink:0`=flex:none). **불일치 해소 확인, 통과**. (상세 §4 갱신)

## 결론: **비주얼 충실도 통과** (불일치 0건 / 근사 허용 2건 / 미검증 2건 = 디바이스 스모크)

ui-publisher 수정 요청 **없음**(FAB 위치 수정 이미 반영·검증됨). 차단 이슈 없음.

---

## 1. FAB 충실도 (킷 mk-home.jsx:290-298) — 통과

| 축 | 킷(라인) | RN(파일:라인) | 판정 |
|---|---|---|---|
| 크기 46×46 | mk-home:291 `width:46 height:46` | `MapLocateButton.tsx:46-51` `button{width:46,height:46}` | ✅ 일치 |
| radius full | mk-home:291 `borderRadius:999` | `MapLocateButton.tsx:27` `theme.radius.full`(=9999, `tokens.ts:127`) | ✅ 일치(46×46에 9999 → 완전 원형) |
| 배경 surface | mk-home:292 `background:var(--mk-card)` | `MapLocateButton.tsx:26` `theme.color.surface` | ✅ 일치(카드면=흰) |
| 그림자 shadow.fab | mk-home:292 `boxShadow:0 4px 14px rgba(0,0,0,.18)` | `MapLocateButton.tsx:28` `theme.shadow.fab` → `tokens.ts:138` `{opacity:0.18, radius:14, offset{0,4}, elevation:5}` | ✅ 값 정확 일치(검정 그림자, 컬러 아님). **떠 있는 레이어라 헤어라인 아닌 그림자가 정답**(킷과 동일 — 브랜드 "그림자 대신 헤어라인" 규칙의 예외, 킷이 그림자를 명시) |
| 중앙 정렬 | mk-home:293 `display:flex; align/justify:center` | `MapLocateButton.tsx:49-50` `alignItems/justifyContent:'center'` | ✅ 일치 |
| 보더 없음 | mk-home:291 `border:none` | 미지정(기본 없음) | ✅ 일치 |
| 접근성 라벨 | mk-home:290 `aria-label="내 위치로 이동"` | `MapLocateButton.tsx:33-34` `accessibilityRole="button"` + `accessibilityLabel="내 위치로 이동"` | ✅ verbatim 일치 |
| tap scale .92 | mk-home:295 `onMouseDown transform:scale(.92)` | `MapLocateButton.tsx:53` `pressed ? {transform:[{scale:0.92}]}` | ✅ 일치(CSS transition→Pressable 즉시 토글, 컨벤션상 과한 애니메이션 지양 — ui-spec §6 근사 사유 기록 확인) |
| 우하단 16/16 배치 | mk-home:291 `right:16 bottom:16`(지도 div 263 내부 고정) | `MapTabScreen.tsx:212` `right:theme.spacing[16]` / `bottom:theme.spacing[16]` **고정**(MapWebView children 오버레이, 조건부 분기 없음) | ✅ 토큰 경유 일치 + 킷 구조 정합(§4 참조 — 카드 유무 무관 항상 동일 offset, 점프 없음) |

## 2. locate 아이콘 (킷 mk-home.jsx:298) — 통과

- 킷: `<I name="locate" size={24} color="#3B82F6" />`.
- RN: `MapLocateButton.tsx:39` `<Icon name={IconName.Locate} size={24} color="mapLocate" />`.
- **glyph verbatim 검증**: ui-design `assets/icons/locate.svg` ↔ RN `assets/icons/icons.ts:36` `locate` — path `d` **바이트 동일**, viewBox `0 0 24 24` 유지, `width/height`만 제거(`Icon.tsx:60-61`에서 size로 덮어씀), `fill="currentColor"` 유지로 토큰 재색칠. ✅ 일치.
- size 24 ✅ / color `mapLocate`(=#3B82F6, `tokens.ts:59·102`) ✅.

## 3. 색 토큰 경유 + primary vs mapLocate 구분 — 통과

- **raw hex 0건**(컴포넌트): `MapLocateButton.tsx`·`Icon.tsx`·`MapTabScreen.tsx` 모두 `theme.color.*`/`color="mapLocate"`/`theme.shadow.fab`만 사용. 하드코딩 hex 없음.
- **primary(#3366FF) ≠ mapLocate(#3B82F6) 근거 확인**: 킷은 me 마커(mk-home:270)·FAB 아이콘(mk-home:298) 모두 인라인 실값 `#3B82F6`을 쓰며 `--mk-accent`(#3366FF) 변수가 아니다. ui-spec §2.2 주석·§5 + `tokens.ts:56-59` 주석이 "킷 verbatim → primary로 근사하지 않고 전용 토큰 추가"를 명시. → primary로 통일하지 않은 것이 **정답**(킷=디자인 기준). ✅

## 4. FAB 위치 점프 — 정정 재검증 (킷 mk-home.jsx:263·290-298·302-303) — 통과

> ⚠️ **이전 보고서 오판 정정**: 직전 §4는 developer의 `bottom = cardDocked ? 120px : spacing[16]` 조건부 오프셋을 "겹침 회피, 적정 클리어런스"로 통과시켰다. **킷 구조를 잘못 읽은 오판**이며, 실제로는 카드 유무에 따라 FAB가 **위치 점프**하는 비주얼 회귀였다. 아래 구조 대조로 정정한다.

**킷 구조(정답지) — FAB offset은 항상 16 고정, 점프 없음**
- 지도 영역 div(`mk-home:263` `flex:1, position:relative`) **안**에 FAB(`mk-home:290-298`)가 `position:absolute right:16 bottom:16`.
- 선택 스팟 카드(`mk-home:302-303`)는 지도 div **바깥의 형제 블록**(`flex:"none"`).
- → 카드가 뜨면 지도 div(flex:1)가 카드 높이만큼 줄어들고, FAB는 "지도 영역 바닥 16px"이라 **offset 값 변동 없이** 자동으로 카드 위로 따라 올라온다. FAB 절대좌표는 한 번도 바뀌지 않는다.

**RN 구조 대조 — 킷과 동일하게 재정합됨**
| 항목 | 킷(라인) | RN(파일:라인) | 판정 |
|---|---|---|---|
| 화면 루트 flex:1 | (mk.screen) | `MapTabScreen.tsx:240` `root:{flex:1}` | ✅ |
| 지도 영역 flex:1 + 상대좌표 | mk-home:263 `flex:1 position:relative` | `MapWebView.tsx:63` `container:{flex:1, overflow:'hidden'}` | ✅ |
| FAB가 지도 영역 children 오버레이 | mk-home:290 지도 div 내부 absolute | `MapTabScreen.tsx:212-214` FAB가 `<MapWebView>` children(`MapWebView.tsx:54-56` absoluteFill 오버레이) | ✅ 지도 영역 내부 |
| FAB offset 고정 16/16 | mk-home:291 `right:16 bottom:16`(고정) | `MapTabScreen.tsx:212` `right:spacing[16], bottom:spacing[16]` **고정**(cardDocked 분기 제거) | ✅ 조건부 분기 0 |
| 카드는 지도 영역 바깥 형제(flex:none) | mk-home:302-303 형제 `flex:"none"` | `MapTabScreen.tsx:218-234` 카드가 `</MapWebView>` 뒤 root 직속 형제 + `SelectedSpotCard.tsx:89`·`NearbySpotCard.tsx:97` `card:{flexShrink:0}`(=flex:none) | ✅ 형제 + 콘텐츠 높이 |

- **판정 1 (점프 없음)**: FAB offset이 카드 없음/있음 모두 동일하게 `right/bottom 16`(조건 분기 없음). 위치 점프 회귀 **해소**. ✅
- **판정 2 (겹침 없음 — 구조적)**: 카드 도킹 시 카드(flexShrink:0)가 root의 세로 공간을 차지 → MapWebView(flex:1)가 그만큼 줄어듦 → FAB는 줄어든 지도 영역 바닥 16px라 **구조적으로 항상 카드 위**. 매직넘버 오프셋 추정 불필요(킷 레이아웃 흐름 그대로). ✅
- **이전 보고서의 "120px 오프셋 통과" 판정은 폐기**한다.

## 5. 펄스 처리 (킷 mkLocate, mk-home:266-270) — 기록(차단 아님)

- 킷 펄스(`mk-home:268` 18×18 원 `border:2px solid #3B82F6` `animation:mkLocate .7s`)는 **지도 위 me 마커의 1회 확산 링**이지 FAB 효과가 아니다(`recenter` 트리거 종속).
- RN에서 지도·마커는 WebView(`mapHtml`) 격리 영역 → `MapLocateButton`은 순수 onPress 셸로 펄스 미포함이 **정답**(ui-spec §2.4·§6 사유 기록 확인 — FAB에 Animated 펄스 추가 시 오히려 킷과 불일치).
- me 마커 펄스 실제 재현(developer `__muklogRecenter`/mapHtml)은 RN 비주얼 범위 밖 → **디바이스 스모크**(아래 미검증).

---

## 근사 허용 (RN 한계 — ui-spec §6 사유 기록 확인)

| 항목 | 사유 | 판정 |
|---|---|---|
| `shadow.fab` blur 14px | RN `shadowRadius`는 CSS blur와 1:1 환산 아님 → 14로 시각 근접 + elevation 5(Android 보강). 검정 그림자(킷 동일). | ✅ 근사 허용 |
| tap scale(.92) 트랜지션 | 킷 CSS transition vs RN Pressable press-state 즉시 토글(타이밍 없음). 코드베이스 무선례·과한 애니메이션 지양 컨벤션. | ✅ 근사 허용 |

## 미검증 (디바이스 스모크 — 통과 처리 아님)

| 항목 | 사유 |
|---|---|
| FAB↔카드 겹침/점프 실기기 육안 | §4에서 **구조적으로 해소 확인**(킷과 동일한 flex 흐름 — 점프·겹침 구조상 불가). 단 실제 렌더 육안은 실기기에서 카드 토글 시 FAB 위치 불변 + 카드 위 위치 최종 확인 권고(통과 처리는 §4 구조 판정으로 완료). |
| me 마커 펄스(mkLocate) 1회 재생 | WebView/mapHtml(developer) 영역 — RN 비주얼 범위 밖. 실기기에서 FAB 탭 → 마커 링 1회 확산 재현 확인 권고. |
