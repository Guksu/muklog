# Sprint: 지도 핀 선택 UX (map-pin-select)

> 작성 단일 출처: `docs/design/architecture.md`(§4 map-tab·§6 비용 가드레일) · 디자인 킷 `templates/muklog/mk-home.jsx`(345-356·401-416) · 현재 코드(§3 계약).
> 풀 파이프라인: **planner → ui-publisher → developer → qa(qa-visual ∥ qa-logic)**. 비주얼 변화 O(선택 핀 활성 상태) → qa-visual 관여.
> git 작업 없음. TDD(인수조건 = 테스트 케이스, Red 먼저). 클라이언트 전용(Kakao·RPC·마이그레이션 0).

---

## 1. 기능 한줄 정의

지도에서 핀을 탭하면 **그 핀이 활성 상태로 커지고(그림자·zIndex 강조) 하단 카드가 뜨며**, 다른 핀을 탭하면 활성이 이동하고, **지도 빈 곳을 탭하면 선택이 해제**되어 활성 강조와 카드가 함께 사라진다. 하나의 "핀 선택 UX" — 킷 정합 2건(활성 비주얼 + 빈곳 탭 해제)을 한 기능으로 묶는다.

---

## 2. 범위

### In-scope
1. **선택 핀 활성(active) 비주얼** — 킷 `Pin`(mk-home.jsx:401-416) 규칙: `size = active ? 44 : saved ? 36 : 26`, active면 `drop-shadow` 강화 + `zIndex ↑` + 내부 카테고리 아이콘 비례 스케일. saved·nearby 공통 적용(양쪽 active=44).
2. **지도 빈 곳 탭 → 선택 해제** — 지도 배경 탭 시 `selected=null` + 하단 카드 닫힘 + 활성 강조 해제.
3. **선택 상태 브리지** — RN↔WebView 신규 메시지 2종: 인바운드 `MAP_TAP`(빈곳 탭), 아웃바운드 `SET_SELECTED{selectedId}`(활성 핀 id 전달·해제 시 null). SET_MARKERS 재주입(nearby 갱신) 시 **선택 유지** 정책 포함.

### Out-of-scope (일부러 안 함)
- **핀 도형 킷 정합(원형→teardrop)** — 현재 RN `mapHtml` 핀은 **원형(34px·이모지·컬러 보더)**, 킷 `Pin`은 **SVG teardrop + 카테고리 아이콘(`<I>`)**. 이 도형 divergence는 **latent**(이번 스프린트 이전부터). 활성 상태만 다루고, teardrop 전환은 별도 fidelity 스프린트(§킷 divergence). → **이번엔 원형 핀에 active *treatment*만 번역 적용.**
- **첫 스팟 자동 선택** — 킷 `MapScreen`은 `sel` 초기값=첫 muklog(자동 선택)이나 RN은 **null 시작 유지**(자동 카드 오픈 미도입, §킷 divergence 근거).
- RPC / Kakao Local / 마이그레이션 / Realtime / 폴링 — 0(비용 가드레일 §6 불변).
- `MapMarker` 형 변경(선택은 별도 채널로 전달, 마커에 `selected` 필드 미추가), SelectedSpotCard/NearbySpotCard 내부 변경.
- `MapPrewarm` — INIT 미송신 blank 부팅 불변(비책임, 건드리지 않음).

### 킷 divergence (plan 명기 — ui-publisher가 확정)
- **teardrop↔원형**: active 비주얼은 킷 teardrop 기준(36/26→44) 규칙에서 **원형 핀으로 유도**(예: 34→44 스케일 + 그림자 강화 + zIndex↑ + 이모지 font-size 비례). 정확한 px/그림자 값은 **ui-publisher 확정**(mapHtml CSS는 WebView 격리 HTML → "번역 불가 영역"으로 ui-publisher가 hex/size 소유, 기존 mapHtml 주석 정책 계승).
- **nearby active 크기**: 킷은 nearby 비탭(onClick=saved만)이나 앱은 map-tab-nearby에서 nearby 탭+`NearbySpotCard` 도입(승인된 divergence). 킷 `Pin` 규칙상 active=44는 saved/nearby 공통 → **nearby active도 확대 적용**이 자연스러움. 최종 크기는 ui-publisher가 킷 규칙에서 유도·확정.
- **자동 선택 미도입 근거**: 자동 선택은 진입 즉시 카드가 지도를 가림 + RN은 핀 bbox 센터링이라 부적합 → null 시작 유지.

---

## 3. 데이터 · API 계약

### 3.0 DB / RPC / Edge Function
- **변경 없음.** 마이그레이션 0, RPC 0, Edge Function 0. 선택은 **클라이언트 로컬 상태 + WebView 메시지**로만 처리(네트워크 0).

### 3.1 신규 메시지 계약 (기존 4 인바운드 / 3 아웃바운드에 각 1종 추가)

**인바운드(WV→RN) — 신규 `MAP_TAP`** (`src/features/map/types`):
```ts
export const MapInboundType = { Ready:'READY', MarkerTap:'MARKER_TAP', Error:'ERROR',
  BoundsChanged:'BOUNDS_CHANGED', MapTap:'MAP_TAP' } as const;   // ← MapTap 추가
// MapInboundMessage 유니온에 추가:
| { type: typeof MapInboundType.MapTap }                          // 페이로드 없음(빈곳 탭 신호)
```

**아웃바운드(RN→WV) — 신규 `SET_SELECTED`** (`src/features/map/types`):
```ts
export const MapOutboundType = { Init:'INIT', SetMarkers:'SET_MARKERS', Recenter:'RECENTER',
  SetSelected:'SET_SELECTED' } as const;                         // ← SetSelected 추가
// 페이로드: { type:'SET_SELECTED', selectedId: string | null }  // null=해제(모든 핀 비활성)
```

### 3.2 parseMapMessage — MAP_TAP 분기 (developer)
```ts
if (message.type === MapInboundType.MapTap) return { type: MapInboundType.MapTap };
```
- 비JSON/미지/필드잡음은 기존대로 null 흡수(throw 0). MAP_TAP은 페이로드 없어 형 검증 불필요.

### 3.3 mapMessages — buildSetSelectedScript (developer)
```ts
export const buildSetSelectedScript = ({ selectedId }: { selectedId: string | null }): string => {
  const payload = JSON.stringify({ type: MapOutboundType.SetSelected, selectedId });
  return `window.__muklogSetSelected && window.__muklogSetSelected(${payload}); true;`;
};
```
- 관례상 마지막 `true;`(iOS WKWebView 평가 경고 회피 — 기존 3종과 동일).

### 3.4 mapHtml — 선택 반영 방식 (id-only 토글, 마커 재생성 없음)

**설계 결정(설계 포인트 확정)**: 선택은 **id만 전달하는 아웃바운드(`SET_SELECTED`)** 로 반영한다 — 매 탭마다 전체 마커를 clear+재생성(overlay 재생성=깜빡임·비용)하지 않고, **활성 클래스만 토글**한다.

**developer(브리지 JS)**:
- 오버레이를 id로 추적: `renderMarkers`에서 각 element에 `el.dataset.pinId = m.id` 부여하고 `mkOverlayEls[m.id] = el`(id→element 맵) 보관. `clearMarkers`가 맵도 비운다.
- 모듈 스코프 `mkSelectedId`(현재 선택 id) 추가. `renderMarkers`는 각 핀 렌더 시 `m.id === mkSelectedId`면 active 클래스 부여(→ **SET_MARKERS 재주입 후에도 선택 유지**의 핵심).
- `window.__muklogSetSelected = function(payload){ mkSelectedId = payload.selectedId; /* 모든 핀 el에서 active 제거 → mkSelectedId와 일치하는 el에만 부여 + 그 overlay zIndex↑ */ }`.
- 마커 element click 핸들러에 `event.stopPropagation()` 추가(마커 탭이 지도 배경 click으로 새어 MAP_TAP 유발 방지).
- 지도 배경 click 리스너: `kakao.maps.event.addListener(mkMap, 'click', function(){ post({ type:'MAP_TAP' }); })`(INIT에서 등록).
- active zIndex는 `overlay.setZIndex(...)`(kakao CustomOverlay) 또는 element zIndex — developer 재량(비활성 복귀 시 원복).

**ui-publisher(비주얼 CSS 값)**: `.mk-pin`/`.mk-pin--nearby`/**신규 `.mk-pin--active`**의 크기·그림자·zIndex·이모지 font-size(비례). 킷 `Pin` active 규칙(44·drop-shadow 강화·zIndex 5) 번역. **이 CSS 블록의 실값은 ui-publisher가 소유**(developer는 클래스 토글 메커니즘만).

> 경계: 같은 파일(`mapHtml.ts`)을 공동 편집하되 **JS 로직=developer / `<style>` CSS 값=ui-publisher**. ui-spec에 CSS 실값을, dev-notes에 브리지 로직을 각각 기록.

### 3.5 MapTabScreen 배선 (developer)
- `selected` state는 **기존 그대로**(MARKER_TAP→setSelected 존재). 추가:
  - **MAP_TAP 수신 → `setSelected(null)`**(handleMessage에 분기 추가).
  - **선택 변경 시 SET_SELECTED 주입** — `markersKey` effect와 동형의 신규 effect: `selectedId = selected?.id ?? null`을 키로, `mapReady`일 때 `buildSetSelectedScript({ selectedId })` 주입. READY 이후에만.
- `MuklogPinsState`·SelectedSpotCard/NearbySpotCard·overlay 분기·markersKey(SET_MARKERS)·initialRegion **불변**. 선택은 `selected` state와 새 effect로만 배선(핀/카드 로직 무변경).

### 3.6 선택 유지 / 해제 정책 (SET_MARKERS 재주입 시)
- **nearby 갱신 등으로 SET_MARKERS 재주입** 시: `renderMarkers`가 `mkSelectedId`를 읽어 active 재적용 → **선택 유지**(RN은 아무 것도 안 함, HTML이 자체 복원). `markersKey`(마커 id+saved)는 selection 미포함이라 selection 변경이 마커 재생성을 유발하지 않음(반대도 마찬가지 — 독립 채널).
- **선택된 핀이 마커 목록에서 사라진 경우**(§6 엣지): saved 핀은 viewport 무관 항상 렌더 → 사라지지 않음. **nearby 핀만** viewport 이탈/ dedup으로 사라질 수 있음 → 그 경우 (a) WebView: `mkSelectedId`에 매칭되는 element 없음 → active 표시 자연 소멸(무해), (b) RN: `nearby.items.find(...)`가 null → `selectedNearby` null → **NearbySpotCard 자동 닫힘**(기존 동작). RN `selected` state는 stale id로 남지만 카드 없음(pre-existing) → 소비자 무해. *선택: RN이 selectedNearby 소실 시 `selected=null`로 정리하면 SET_SELECTED(null)까지 일관 — 소규모 정리 작업(T7)으로 포함.*

---

## 4. 화면 · UX (역할 경계)

| 축 | 책임 | 산출물 |
|----|------|--------|
| **비주얼(어떻게 보이는가)** | **ui-publisher** | `mapHtml.ts` `<style>`의 `.mk-pin--active`(크기 44·그림자 강화·zIndex·이모지 비례) + saved/nearby active 크기 확정. 킷 `Pin`(mk-home:401-416) 번역. `ui-spec.md`. |
| **동작(어떻게 작동하는가)** | **developer** | 메시지 계약 2종(MAP_TAP/SET_SELECTED)·parseMapMessage·mapMessages·mapHtml 브리지 JS(overlay-by-id·class 토글·map click·stopPropagation)·MapTabScreen 배선. `dev-notes.md`. |

- **상태(로딩/빈/에러/성공)**: 이 기능은 상태 오버레이 무관(선택은 지도 위 상호작용). loading/error/권한 오버레이(MapTabScreen.tsx:179-209) **불변**.
- **원티드 토큰**: mapHtml은 WebView 격리 HTML → 토큰 직접 사용 아님(킷 brand hex/size를 ui-publisher가 직접 관리, 기존 정책 계승). RN 측 신규 토큰 사용 0.
- **성공 경로**: 핀 탭 → 활성 확대 + 카드 도킹 / 빈곳 탭 → 해제 + 카드 닫힘.

---

## 5. 작업 목록 (각 인수조건 포함, 소유자 태그)

### 브리지·배선 (developer)
- [ ] **T1. [dev] 메시지 타입 확장** — 인수조건: `MapInboundType.MapTap='MAP_TAP'` + `MapInboundMessage`에 `{type:MAP_TAP}`, `MapOutboundType.SetSelected='SET_SELECTED'` 추가. 기존 4/3종 불변. — 테스트: 타입 존재·값 스냅샷, 기존 유니온 무변경.
- [ ] **T2. [dev] parseMapMessage MAP_TAP 분기** — 인수조건: `{type:'MAP_TAP'}` → `{type:MapInboundType.MapTap}`. 비JSON/미지/잡음은 null(기존). MARKER_TAP·BOUNDS_CHANGED·READY·ERROR 파싱 불변. — 테스트: MAP_TAP 정상, 잡음 null, 기존 4종 회귀.
- [ ] **T3. [dev] buildSetSelectedScript** — 인수조건: `{selectedId:'m1'}`·`{selectedId:null}` 각각 `window.__muklogSetSelected(...)` 호출 문자열 생성, 마지막 `true;`. — 테스트: 문자열에 payload JSON·`true;` 포함, null 케이스.
- [ ] **T4. [dev] mapHtml 브리지 JS** — 인수조건: (a) 마커 element에 `dataset.pinId` + id→element 맵 보관, (b) `__muklogSetSelected`가 mkSelectedId 갱신 + 매칭 el만 active 클래스·zIndex, (c) `renderMarkers`가 mkSelectedId 매칭 시 active 재적용(SET_MARKERS 유지), (d) 지도 `click`→`post({type:'MAP_TAP'})`, (e) 마커 click `stopPropagation`. — 테스트: mapHtml 문자열에 `__muklogSetSelected`·`MAP_TAP`·`stopPropagation`·`mkSelectedId` 존재(문자열 계약 검사, 기존 mapHtml.spec 패턴). 실제 렌더는 디바이스 스모크.
- [ ] **T5. [dev] MapTabScreen 배선** — 인수조건: (a) handleMessage `MAP_TAP`→`setSelected(null)`, (b) 신규 effect가 `mapReady`일 때 선택 변경마다 `buildSetSelectedScript({selectedId: selected?.id ?? null})` 주입, (c) MARKER_TAP·markersKey·overlay·카드 분기 불변. — 테스트: MAP_TAP 메시지 dispatch→selected null, 선택 변경→inject 호출(webviewRef mock), 기존 배선 회귀.
- [ ] **T6. [dev] 선택 유지 정책(SET_MARKERS 독립)** — 인수조건: nearby 갱신(SET_MARKERS 재주입)이 selection state를 바꾸지 않음, markersKey에 selection 미포함(selection 변경이 SET_MARKERS 재주입 유발 안 함). — 테스트: markersKey 산식에 selected 미포함 확인, nearby markers 변경 시 selected 불변.
- [ ] **T7. [dev] 선택 핀 소실 정리(선택)** — 인수조건: 선택된 nearby 핀이 `nearby.items`에서 사라지면 카드 닫힘(기존) + `selected=null`로 정리(SET_SELECTED(null) 일관). saved 핀은 항상 존재라 해당 없음. — 테스트: selectedNearby 소실 시 selected null 전이.

### 비주얼 (ui-publisher)
- [ ] **T8. [ui] `.mk-pin--active` 정의 + active 크기 확정** — 인수조건: 활성 핀이 킷 `Pin` active 규칙 번역 — 확대(킷 44 기준, 원형 핀으로 유도한 px)·그림자 강화(drop-shadow/box-shadow)·zIndex↑·이모지 font-size 비례 확대. saved·nearby 공통 active. 비활성 대비 시각 구분 명확. — 검증: 디바이스 스모크(WebView 렌더 픽셀), 킷 mk-home active 핀과 대조(qa-visual). ui-spec에 CSS 실값 기록.

### 계측·회귀
- [ ] **T9. [dev] 회귀 0** — 인수조건: 기존 map 테스트 전부 green(parseMapMessage·mapMessages·mapHtml·MapTabScreen), 4 인바운드/3 아웃바운드 계약 무변경(신규는 순수 추가), `npm test` 전체 통과. — 테스트: 기존 spec 무변경 통과.

> 순서: T1→T2·T3(병렬)→T4→T5→T6·T7 / **T8(ui-publisher)은 T4의 클래스 토글 메커니즘과 병렬 가능**(CSS 값은 JS 로직과 독립) → T9 회귀. qa-visual(T8) ∥ qa-logic(T1-T7,T9) 병렬 검증.

## 5-1. 테스트 케이스 (TDD)

**단위(jest-expo + @testing-library/react-native)**:
- `parseMapMessage`(T2): 정상 MAP_TAP / 경계 여분필드 무시 / 실패 비JSON·미지 null / 회귀 MARKER_TAP·BOUNDS_CHANGED·READY·ERROR.
- `mapMessages`(T3): buildSetSelectedScript id·null, `true;` 종결 / 회귀 build{Init,SetMarkers,Recenter} 무변경.
- `types`(T1): MapTap·SetSelected 값, 기존 유니온 회귀.
- `MapTabScreen`(T5-T7): MAP_TAP→selected null / 핀 탭→selected+SET_SELECTED inject / 다른 핀 탭→id 이동 inject / nearby 갱신 시 selected 유지 / selectedNearby 소실→selected null(T7). webviewRef.injectJavaScript·parseMapMessage 모킹.
- `mapHtml`(T4): 문자열 계약(`__muklogSetSelected`·`MAP_TAP` post·`stopPropagation`·`mkSelectedId`·`dataset.pinId`) 존재. (JS 실행 아님 — 문자열 검사, 기존 mapHtml.spec 패턴 계승.)

**모킹/스모크(외부·WebView JS — 단위 불가)**:
- 실제 활성 핀 렌더(크기·그림자·zIndex·이모지 스케일), 빈곳 탭이 실제 MAP_TAP 발화, 마커 탭이 MAP_TAP로 안 새는지(stopPropagation) → **디바이스 스모크(dev/시뮬)**. 메모리 `qa-layout-blind-spot`: WebView 렌더 픽셀은 단위로 안 보임 → 디바이스 스모크 필수(이번 스프린트 비주얼 검증의 핵심 경계).
- kakao map `click` 이벤트 실제 발화·overlay click과의 경합 → 스모크.

---

## 6. 엣지케이스

- **빈 곳 탭 vs 마커 탭 경합**: 마커 element click은 `stopPropagation`으로 지도 `click`(MAP_TAP) 미발화 → 마커 탭이 곧바로 해제되지 않음. (스모크 확인 대상.)
- **선택 후 다른 핀 탭**: MARKER_TAP→selected 교체→SET_SELECTED(new id) 주입→이전 active 해제+신규 active(HTML이 전체 비활성 후 매칭만 활성). 카드도 교체.
- **선택 후 nearby 갱신(SET_MARKERS 재주입)**: renderMarkers가 mkSelectedId 재적용 → **활성 유지**. selection 채널과 markers 채널 독립(§3.6).
- **선택된 nearby 핀이 viewport 이탈/dedup으로 소실**: WebView active 자연 소멸 + RN NearbySpotCard 자동 닫힘(기존) + T7으로 selected=null 정리. saved 핀은 viewport 무관 항상 렌더라 해당 없음.
- **selected 상태에서 mapReady 늦음(READY 전 탭 불가)**: 마커는 INIT(READY 후)에만 그려져 READY 전 탭 자체가 없음. SET_SELECTED effect도 `mapReady` 가드 → READY 전 주입 0.
- **커플 동시성(2명)**: 선택은 **각자 기기 로컬 UI 상태** — 상대와 무관(공유 데이터 없음). 쓰기·RPC 0이라 동시성 영향 0.
- **네트워크 실패/에러 오버레이 중 탭**: 선택은 클라 로컬이라 네트워크 무관. 에러 오버레이는 지도 위 배너(차단 아님) — 그 아래 지도/핀 탭 동작은 기존 정책 따름(변경 없음).
- **자동 선택 미도입**: 진입 시 selected=null → 활성 핀·카드 없음(킷의 자동 첫선택과 의도적 divergence).
- **잘못된/잡음 WebView 메시지**: parseMapMessage가 null 흡수(MAP_TAP 위조/여분필드도 안전). SET_SELECTED는 RN→WV 단방향(외부 위조 경로 없음).

---

## 7. QA 교차검증 경계면 (생산자 ↔ 소비자)

**qa-logic(로직·통합)**:
- `mapHtml`(생산자: MAP_TAP post) ↔ `parseMapMessage`(소비자: MAP_TAP 분기) ↔ `MapTabScreen.handleMessage`(setSelected null): 빈곳 탭 end-to-end 계약.
- `MapTabScreen`(생산자: selectedId) ↔ `buildSetSelectedScript` ↔ `mapHtml.__muklogSetSelected`(소비자: 클래스 토글): 활성 반영 계약, null=해제.
- `mkSelectedId`(HTML 상태) ↔ `renderMarkers`(SET_MARKERS 재주입): 선택 유지 정책(§3.6).
- `markersKey`(SET_MARKERS 트리거) ↔ `selectedId`(SET_SELECTED 트리거): **두 채널 독립**(selection 변경이 마커 재생성 유발 안 함, 반대도).
- 회귀: 기존 4 인바운드/3 아웃바운드·MARKER_TAP saved 분기·카드 분기·overlay·initialRegion 불변.
- 비용 가드레일: RPC/Kakao/Realtime/폴링 0, 신규 메시지는 로컬 이벤트.

**qa-visual(비주얼 충실도)**:
- 킷 `Pin` active(mk-home:401-416: 44·drop-shadow 강화·zIndex 5·아이콘 0.46 비례) ↔ RN `.mk-pin--active`(원형 번역): 확대·그림자·zIndex·이모지 비례. saved/nearby active 모두.
- 킷 `MapScreen`(345-356: on일 때 zIndex 5) ↔ RN 활성 핀 stacking.
- **WebView 렌더 픽셀은 RN 스냅샷으로 안 보임 → 디바이스 스모크 필수**(메모리 `qa-layout-blind-spot`).
- 비활성(saved 36/nearby 26)·현재위치 점·범례·FAB·카드 레이아웃 회귀 0(선택은 활성 핀만 바꿈).

## 8. 비용 가드레일 체크

- **AWS 미사용 / RPC 0 / Kakao Local 0 / 마이그레이션 0** — 선택은 클라 로컬 UI + WebView 메시지(네트워크 0).
- **폴링/Realtime 0** — 신규 타이머·구독 없음. MAP_TAP은 사용자 탭 이벤트, SET_SELECTED는 탭당 1회 주입(이벤트 구동).
- **마커 재생성 회피** — id-only SET_SELECTED로 overlay clear+재생성 없이 클래스만 토글(렌더 비용·깜빡임 최소).
- **이미지 압축·viewport 조회** — 본 기능 무관(nearby viewport 조회 정책 불변).

---

## 9. 산출물 / 완료 기준

- 수정: `src/features/map/types`(MapTap·SetSelected)·`parseMapMessage`·`mapMessages`·`mapHtml`(JS+CSS 공동편집)·`MapTabScreen`(+ 각 `.spec`).
- 무변경 보장: `MapMarker` 형·SelectedSpotCard/NearbySpotCard·`buildInitScript`/`buildSetMarkersScript`/`buildRecenterScript` 로직·`pinsToMapMarkers`/`mergeMapMarkers`·initialRegion·`MapPrewarm`·마이그레이션.
- 완료 기준: T1~T9 인수조건 green + `npm test` 전체 통과 + ui-spec(CSS 실값)·dev-notes(브리지 로직) + qa-report-logic·qa-report-visual 병렬 통과.
- 라이브 검증: 활성 핀 렌더·빈곳 탭 해제·stopPropagation 경합은 **디바이스 스모크(dev/시뮬)** 로 확인(WebView 픽셀·이벤트는 단위로 안 드러남 — 메모리 권고).
