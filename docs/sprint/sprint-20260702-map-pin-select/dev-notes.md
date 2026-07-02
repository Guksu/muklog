# dev-notes — map-pin-select (지도 핀 선택 UX)

> 구현: developer(브리지 JS·배선·메시지 계약). CSS 실값(`.mk-pin--active`)은 ui-publisher 소유(ui-spec.md) — 이 파일은 **동작(어떻게 작동하는가)** 만 기록.
> 종료 기준: `npm test` 전체 통과(153 suites / 1492 tests green) + `tsc --noEmit` 클린.

## 1. 구현/수정한 파일

| 파일 | 성격 | 내용 |
|------|------|------|
| `src/features/map/types/types.ts` | 수정(T1) | `MapInboundType.MapTap='MAP_TAP'` + 유니온 `{type:MapTap}`, `MapOutboundType.SetSelected='SET_SELECTED'`. 기존 4/3종 불변(순수 추가) |
| `src/features/map/parseMapMessage/parseMapMessage.ts` | 수정(T2) | `MAP_TAP` 분기(페이로드 없음 → `{type:MapTap}`, 여분필드 무시). 기존 파싱 불변 |
| `src/features/map/mapMessages/mapMessages.ts` | 수정(T3) | `buildSetSelectedScript({selectedId})` — `__muklogSetSelected` 호출 문자열(`true;` 종결) |
| `src/features/map/mapHtml/mapHtml.ts` | 수정(T4, JS만) | 브리지 JS: id 추적·클래스 토글·map click·stopPropagation·zIndex. **CSS `<style>`는 ui-publisher 소유(미접촉)** |
| `src/navigation/screens/MapTabScreen/MapTabScreen.tsx` | 수정(T5·T7) | MAP_TAP→`setSelected(null)`, 선택 변경→SET_SELECTED inject effect, nearby 소실 정리 effect |
| 각 `.spec` | 테스트 | parseMapMessage +2 / mapMessages +2 / mapHtml +5 / MapTabScreen +6 (TDD) |

**무변경 보장**: `MapMarker` 형(선택 필드 미추가 — 별도 채널)·SelectedSpotCard/NearbySpotCard·`buildInitScript`/`buildSetMarkersScript`/`buildRecenterScript` 로직·`pinsToMapMarkers`/`mergeMapMarkers`·`initialRegion`·`MapPrewarm`·마이그레이션. DB/RPC/Edge Function/Kakao Local 0.

## 2. 생산자 ↔ 소비자 매핑 (QA 교차검증 경로)

### 빈 곳 탭 → 해제 (인바운드 MAP_TAP)
```
mapHtml: kakao.maps.event.addListener(mkMap,'click', mkMapBackgroundTap → post({type:'MAP_TAP'}))
   │ (마커 element click은 event.stopPropagation() → 지도 click으로 안 샘 = 경합 차단)
   ▼
parseMapMessage: {type:'MAP_TAP'} → {type: MapInboundType.MapTap}  (여분필드 무시, 비JSON/미지 null)
   ▼
MapTabScreen.handleMessage: MapTap → setSelected(null)  → 카드 닫힘 + (아래) SET_SELECTED(null) inject
```

### 선택 반영 (아웃바운드 SET_SELECTED, id-only 토글)
```
MapTabScreen: selectedId = selected?.id ?? null
   │ useEffect syncSelectionToMap([selectedId, mapReady]) — mapReady일 때만
   ▼
buildSetSelectedScript({selectedId}) → "window.__muklogSetSelected({type:'SET_SELECTED',selectedId}); true;"
   ▼
mapHtml.__muklogSetSelected(payload):
   mkSelectedId = payload.selectedId (null 허용)
   for id in mkPins: 매칭 el → classList.add('mk-pin--active') + overlay.setZIndex(5)
                     비매칭 el → classList.remove('mk-pin--active') + setZIndex(saved 3 / nearby 1)
```

### 선택 유지 (SET_MARKERS 재주입 시 — 채널 독립)
```
nearby 갱신 → markersKey 변경 → buildSetMarkersScript → mapHtml.renderMarkers
   renderMarkers: 각 핀 렌더 시 m.id === mkSelectedId면 active 재적용 + zIndex 5  ← 선택 자가 복원
   → RN은 아무것도 안 함(SET_SELECTED 재발화 없음). markersKey에 selection 미포함 → 두 채널 독립.
```

## 3. 주요 결정 사항 (plan §3.4·§3.6 준수, 추측 없이)

- **id-only 토글(마커 재생성 회피)**: SET_SELECTED는 id만 전달. `mkPins`(id→{el,overlay,saved}) 맵으로 매칭 핀만 클래스/zIndex 토글 → overlay clear+재생성 없음(깜빡임·비용 0, 비용 가드레일 §8).
- **overlay stacking = `setZIndex`**: ui-spec §4대로 element z-index만으론 kakao 오버레이 간 stacking 불가(각 오버레이 별도 컨테이너). `pinZIndex(saved,active)`(active 5 / saved 3 / nearby 1)를 constructor `zIndex` + `overlay.setZIndex`로 적용. `.mk-pin--active {z-index:5}`(ui-publisher CSS)는 동일 컨텍스트 fallback·의도 선언.
- **선택 유지 핵심 = renderMarkers의 mkSelectedId 재적용**: `clearMarkers`는 `mkPins`만 비우고 `mkSelectedId`는 유지 → SET_MARKERS 재주입 시 renderMarkers가 현재 선택을 스스로 복원(§3.6). RN 개입 0.
- **경합 차단 = stopPropagation**: 마커 element click 핸들러가 `event.stopPropagation()` → 마커 탭이 지도 배경 click(MAP_TAP)으로 새어 즉시 해제되는 것 방지(엣지 §6).
- **채널 독립**: `markersKey`(마커 id+saved)에 selection 미포함 → selection 변경이 SET_MARKERS를 유발하지 않고, SET_MARKERS 재주입이 selection state를 바꾸지 않음. `syncSelectionToMap` effect dep=`[selectedId, mapReady]`라 nearby 갱신(selectedId 불변)엔 재발화 0(T6 검증).
- **mapReady 가드**: SET_SELECTED effect는 `mapReady`(READY 수신)일 때만 inject → READY 전 주입 0(T5). 마커는 INIT 이후에만 그려져 READY 전 탭 자체가 없음(엣지 §6).
- **T7 정리**: 선택된 nearby 핀이 `nearby.items`에서 사라지면 `clearSelectionWhenNearbyGone` effect가 `setSelected(null)` → NearbySpotCard 자동 닫힘 + SET_SELECTED(null) 일관. saved 핀은 viewport 무관 항상 렌더라 해당 없음(effect는 `selected.saved` 시 early-return).
- **자동 선택 미도입**: 진입 selected=null 유지(킷 자동 첫선택과 의도적 divergence, plan §2). 신규 RN 토큰 사용 0.

## 4. 테스트 결과

- `parseMapMessage.spec.ts`: MAP_TAP 정상·여분필드 무시 + 기존 회귀 green.
- `mapMessages.spec.ts`: buildSetSelectedScript id·null·`true;` + 기존 회귀 green.
- `mapHtml.spec.ts`: `__muklogSetSelected`·`mkSelectedId`·`dataset.pinId`·`addListener(mkMap,'click'`·`MAP_TAP`·`stopPropagation`·classList add/remove·`setZIndex` 문자열 계약 + base 34px 회귀 green. (실 렌더·이벤트는 디바이스 스모크.)
- `MapTabScreen.spec.tsx`: T5(핀 탭→SET_SELECTED id / 다른 핀→id 이동 / MAP_TAP→해제+카드닫힘+null / READY 전 inject 0)·T6(nearby 갱신 시 선택 유지·selection 재발화 0)·T7(nearby 소실→selected null) + 기존 회귀 green.
- 전체: **153 suites / 1492 tests green**, `tsc --noEmit` 클린.

## 5. 라이브 검증(디바이스 스모크 이월 — WebView 픽셀/이벤트는 단위 불가)

메모리 `qa-layout-blind-spot`: WebView 렌더 픽셀/kakao 이벤트는 단위로 안 드러남. dev/시뮬 스모크로 확인:
- 핀 탭 → 활성 확대(34→44)·그림자·zIndex 5로 위에 겹침, 카드 도킹.
- 다른 핀 탭 → 이전 활성 원복 + 신규만 활성.
- 지도 빈 곳 탭 → 전 핀 비활성 + 카드 닫힘. 마커 탭이 곧바로 해제되지 않음(stopPropagation 경합 확인).
- nearby 갱신(지도 이동) 후에도 선택 핀 활성 유지.

## 6. 역할 경계 메모

- `mapHtml.ts` 공동편집: **JS 로직=developer(본 커밋) / `<style>` CSS 값=ui-publisher**. `.mk-pin--active` CSS(44px·box-shadow·23px·z-index 5)는 ui-publisher가 이미 랜딩(mapHtml 22/22 green) — developer는 클래스 토글 메커니즘만 추가, CSS 실값 미접촉.
