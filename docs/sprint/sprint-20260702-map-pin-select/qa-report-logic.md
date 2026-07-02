# QA 리포트 — 로직·통합 정합성 (map-pin-select)

> 검증자: qa-logic. 기준: `plan.md`(계약·인수조건) · `ui-spec.md` · `dev-notes.md` · `docs/testing-strategy.md` · `docs/code-convention.md`.
> 방법: 생산자↔소비자 양쪽 동시 읽기(브리지 메시지 왕복·선택 라이프사이클) + 종료 기준 직접 실행. 비주얼 충실도는 qa-visual(통과) 담당이라 다루지 않음.
> **판정: 통과(PASS) — 블로커 0. 경미(비차단) 관찰 3건.**

## 0. 종료 기준 직접 실행 결과

| 게이트 | 결과 |
|--------|------|
| `npx tsc --noEmit` | **exit 0**(클린) |
| `npx jest`(전체) | **153 suites / 1492 tests green**(dev-notes 주장과 일치) |
| map-pin-select 관련 스펙(mapHtml·mapMessages·parseMapMessage·MapTabScreen) | **75/75 green** |

## 1. 브리지 메시지 계약 왕복 (생산자 ↔ 소비자)

### (1) 인바운드 MAP_TAP — 빈곳 탭 end-to-end — PASS
- 생산자: `mapHtml` `kakao.maps.event.addListener(mkMap,'click', mkMapBackgroundTap → post({type:'MAP_TAP'}))`(`mapHtml.ts:141-143`), INIT에서 등록. 마커 element click은 `event.stopPropagation()`(`mapHtml.ts:104`)로 지도 click에 안 샘.
- 소비자: `parseMapMessage`가 `{type:'MAP_TAP'}`→`{type:MapInboundType.MapTap}`, 여분 필드 무시(`parseMapMessage.ts:59-62`). `MapInboundType.MapTap='MAP_TAP'`(`types.ts:83`)로 문자열 일치.
- 소비자: `MapTabScreen.handleMessage` `MapTap`→`setSelected(null)`(`MapTabScreen.tsx:132-136`). 왕복 정합.

### (2) 아웃바운드 SET_SELECTED — 활성 반영/해제 — PASS
- 생산자: `MapTabScreen` `selectedId = selected ? selected.id : null`, `syncSelectionToMap` effect가 `mapReady`일 때 `buildSetSelectedScript({selectedId})` inject(`MapTabScreen.tsx:155-162`).
- 직렬화: `buildSetSelectedScript`가 `JSON.stringify({type:MapOutboundType.SetSelected, selectedId})` + `window.__muklogSetSelected(payload); true;`(`mapMessages.ts:54-61`). `MapOutboundType.SetSelected='SET_SELECTED'`(`types.ts:92`). 따옴표/이스케이프는 JSON.stringify가 처리, `true;` 종결(iOS WKWebView 규약) 존재.
- 소비자: `__muklogSetSelected`가 `mkSelectedId = payload.selectedId ?? null`, mkPins 순회하며 매칭 el만 `mk-pin--active` add + `overlay.setZIndex(5)`, 나머지 remove + 원복(`mapHtml.ts:176-186`). 계약 왕복 정합(핸들러가 `selectedId` 필드를 정확히 읽음).

### (3) 선택 유지 (SET_MARKERS 재주입 시) — 채널 독립 — PASS
- `renderMarkers`가 각 핀 렌더 시 `m.id === mkSelectedId`면 active 재적용 + `pinZIndex(saved,true)`(`mapHtml.ts:100-101,112`). `clearMarkers`는 `mkPins`만 비우고 `mkSelectedId` 유지(`mapHtml.ts:86`) → SET_MARKERS 재주입 후 선택 자가 복원. RN 개입 0.
- 채널 독립: `markersKey = m.id+saved`에 selection 미포함(`MapTabScreen.tsx:144`), `syncSelectionToMap` dep=`[selectedId, mapReady]`에 markers 미포함(`:161`). 선택 변경이 마커 재생성을 유발 안 하고, 마커 재주입이 selection state를 안 바꿈. MapTabScreen.spec T6(`:462-485`)가 양방향 실증(카드 유지 + k1 SET_MARKERS 포함 + SET_SELECTED 재발화 0).

## 2. 선택 상태 라이프사이클 — PASS
- 핀 탭→활성+카드: MARKER_TAP→`setSelected({id,saved})`→SET_SELECTED(id) inject(T5 `:407-419`).
- 다른 핀 탭→이동: SET_SELECTED(new id)로 이전 비활성+신규 활성(T5 `:421-433`).
- 빈곳 탭→해제: MAP_TAP→setSelected(null)→카드 닫힘+SET_SELECTED(null)(T5 `:435-449`).
- READY 전 inject 0: `mapReady` 가드로 SET_SELECTED 미주입(T5 `:451-460`). 마커는 INIT(READY 후)에만 그려져 READY 전 탭 자체 없음.
- nearby 소실 정리(T7): `clearSelectionWhenNearbyGone` effect가 선택된 nearby 핀이 `nearby.items`에서 사라지면 `setSelected(null)`(`MapTabScreen.tsx:167-174`), saved 핀은 early-return. T7 테스트(`:487-506`)가 카드 닫힘+SET_SELECTED(null) 실증. **무한 루프 없음**(setSelected(null) 후 재실행 시 `!selected` early-return).
- **T7 스퓨리어스 소실 안전성 확인**: `useNearbyPlaces`는 loading 시 items를 비우지 않고 **error에서만 `setItems([])`**(`useNearbyPlaces.ts:127`) → 정상 viewport 재조회(loading) 중엔 T7이 오발화하지 않음(직전 items 유지). error 시엔 마커도 사라지므로 선택 정리가 일관.

## 3. z-order 실적용 — PASS
- CSS z-index만으로 kakao CustomOverlay 간 stacking 불가 → `overlay.setZIndex(pinZIndex(saved,active))` 실제 호출(`mapHtml.ts:184`), `pinZIndex`=active 5 / saved 3 / nearby 1(`:66-68`). 생성자 zIndex(`:112`)에도 반영, 비활성 복귀 시 원복(active=false→saved 3/nearby 1). qa-visual가 넘긴 "setZIndex 실호출" 항목 충족(CSS `.mk-pin--active{z-index:5}`는 동일 컨테이너 fallback). mapHtml.spec `:182-187`가 `setZIndex`·classList add/remove 문자열 계약 검증.

## 4. 경합·엣지 — PASS
- 마커 click `stopPropagation`(`mapHtml.ts:104`)으로 마커 탭이 MAP_TAP으로 안 새어 즉시 해제 방지. mapHtml.spec `:178-180` 검증(실 이벤트 경합은 디바이스 스모크 이월, plan §6).
- saved/nearby id 충돌 방어: `{id, saved}` 쌍 유지(`MapTabScreen.tsx:63,124,134,199-204`), 카드 분기·SET_SELECTED 모두 쌍 기반. 회귀 0.
- 위조/잡음 메시지: parseMapMessage가 null 흡수(MAP_TAP 여분필드도 안전, `:104-108`), SET_SELECTED는 RN→WV 단방향.

## 5. 비용 가드레일 — PASS
- 변경 파일에 `supabase.rpc`/`realtime`/`subscribe`/`setInterval` 0건(grep 확인). MAP_TAP=사용자 탭 이벤트, SET_SELECTED=선택 변경당 1회 inject(이벤트 구동, 폴링 아님).
- 마커 재생성 회피: id-only 토글로 overlay clear+재생성 없이 클래스만 토글(`__muklogSetSelected`) — 깜빡임·렌더 비용 0.
- DB/RPC/Edge/Kakao Local/마이그레이션 0. `MapPrewarm` 미변경(git 변경 목록에 없음 — INIT 미송신 blank 부팅 불변). AWS 0.

## 6. TDD·회귀·컨벤션 — PASS
- 인수조건 T1~T9 대응 테스트 존재, 유의미(예: T5 READY 전 inject 0은 mapReady 가드 제거 시 red, T6 채널 독립은 markersKey에 selection 넣으면 red, MAP_TAP 왕복은 stopPropagation/파싱 결함 시 red).
- 회귀 0: 기존 parseMapMessage 4종·mapMessages 3종·mapHtml base·MapTabScreen slice1/slice2/#4/locate 케이스 전부 green(순수 추가). 기존 4 인바운드/3 아웃바운드 계약 불변.
- 컨벤션: 변경 파일에 `useCallback`/`useMemo` 0건(grep). 화살표 const·named-object 인자(`{selectedId}`)·useEffect 명명 함수(`syncSelectionToMap`·`clearSelectionWhenNearbyGone`·`reinjectMarkersOnChange`)·enum-style(MapInboundType/MapOutboundType)·파일명=심볼명 준수. mapHtml `<style>`/브리지 JS는 WebView 격리 환경(토큰 경유 대상 아님 — 기존 정책, ui-publisher 소유).

## 7. 경미 관찰 (비차단 — 후속 판단용)

1. **T1 타입에 전용 단위 테스트 없음** — `MapInboundType.MapTap`/`MapOutboundType.SetSelected` 값은 소비자(parseMapMessage가 'MAP_TAP'→MapTap, buildSetSelectedScript가 '"type":"SET_SELECTED"' 생성)를 통해 **간접 검증**됨. plan §5-1이 언급한 "types 값 스냅샷" 전용 테스트는 부재하나 실질 커버리지 존재. 비차단.
2. **`renderMarkers`의 mkSelectedId 재적용(SET_MARKERS 유지) 로직은 문자열 계약으로만 얕게 검증** — mapHtml.spec는 `mkSelectedId`·`dataset.pinId` 존재만 단언하고 "재렌더 시 active 재적용" 실행은 검증 못 함(WebView JS 단위 실행 불가). RN 측 T6이 selection 유지를 검증하고 실 재적용은 디바이스 스모크로 이월(plan 명시) — 경계 적절. 비차단.
3. **READY 시 SET_SELECTED(null) 1회 잉여 inject** — READY로 mapReady false→true 전이 시 `syncSelectionToMap`가 selectedId=null로 재발화해 SET_SELECTED(null)를 1회 주입(INIT 직후, 전 핀 이미 비활성). 완전 무해한 no-op(mkSelectedId를 이미 null인 값으로 재설정)이나 관찰로 기록. 비차단.

## 8. 미검증(단위 불가 — 이월 적절)
- 실제 활성 핀 렌더(44px·그림자·zIndex 5·이모지 스케일), 빈곳 탭이 실제 MAP_TAP 발화, 마커 탭이 MAP_TAP로 안 새는지(stopPropagation 경합), kakao map `click`↔overlay click 경합 → **디바이스 스모크(dev/시뮬)**. WebView JS 실행·kakao 이벤트는 jest 단위로 재현 불가(메모리 `qa-layout-blind-spot`). 통과 아닌 "이월"로 분류. dev-notes §5 스모크 체크리스트가 절차 문서화.

## 결론
브리지 메시지 왕복(MAP_TAP/SET_SELECTED)·선택 라이프사이클·채널 독립·z-order 실적용(setZIndex)·경합 방어·비용 가드레일·TDD·회귀·컨벤션 전 항목 **통과**. 종료 게이트(tsc 0 · jest 1492 green) 직접 실행 확인. 블로커 없음 — 스프린트 "로직 완료" 처리 가능. 경미 관찰 3건은 모두 비차단(테스트 커버리지 얕음 또는 무해 no-op)이며 디바이스 스모크가 실 렌더/이벤트를 커버.
