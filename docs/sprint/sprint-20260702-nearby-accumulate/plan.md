# Sprint: 주변 핀 누적 머지 (nearby-accumulate)

> 작성 단일 출처: `docs/design/architecture.md`(§4 map-tab-nearby·§6 비용 가드레일) · 현재 코드(`useNearbyPlaces` §3 계약) · 선례 `sprint-20260615-map-tab-nearby`·`sprint-20260620-nearby-first-load`.
> lean 스프린트: **planner → developer → qa-logic** (ui-publisher / qa-visual 비관여 — 비주얼 변화 0, 핀 도형·색·카드 불변).
> git 작업 없음. TDD(인수조건 = 테스트 케이스, Red 먼저). 클라이언트 전용(Kakao/RPC/마이그레이션 0).

---

## 0. 배경 — 문제 (리더 진단, 사용자 확인)

Kakao rect 카테고리 검색은 뷰포트당 **최대 15건(1페이지, 페이지네이션 금지 — 비용 가드레일)** 만 반환한다. `useNearbyPlaces`가 새 응답으로 items를 **통째 교체**(`setItems(nextItems)`·`setItems(cached)`, useNearbyPlaces.ts:122·103)하기 때문에:
- **팝인**: 같은 위치에서 줌/이동 시, 이전 15컷에 못 든 가게가 갑자기 나타남.
- **소실**: 보이던 핀이 새 15컷에 없으면 사라짐.
- 에러 시 `setItems([])`(127) → **전체 팝아웃**.

체감: "같은 위치인데 줌하면 안 보이던 핀이 갑자기 생김." 원인은 **응답 교체 정책**이지 API 호출 경로가 아니다. → **수신 핀을 세션 내 누적(dedup)** 하고, **결과 적용(apply) 단계만** 교체→합집합으로 바꾼다. **API 호출 경로(디바운스·캐시·임계·레이스·invoke 횟수)는 완전 불변.**

---

## 1. 기능 한줄 정의

지도를 줌/이동하는 동안, 이전에 한 번이라도 화면에 나타났던 주변 음식점 핀이 **세션 내내 유지**되어(kakaoPlaceId 중복 없이 누적), 같은 위치에서 줌해도 핀이 갑자기 생기거나 사라지지 않는다. **API 호출 횟수·디바운스·캐시·임계는 기존과 정확히 동일**하다.

---

## 2. 범위

### In-scope
- **세션 내 nearby 핀 누적** — 수신(신규 응답 + 캐시 히트)마다 items를 **교체 대신 합집합 병합**(kakaoPlaceId dedup). 신규 순수 모듈 `accumulateNearbyItems`.
- **누적 상한 + LRU 퇴출** — 무한 누적/오버레이 폭증 방지(`NEARBY_ACCUM_CAP`, §3.3 근거).
- **에러 정책 변경** — 에러 시 누적분 **유지**(팝아웃 재발 방지, §3.4).
- items/markers 파생 정합 — `nearbyToMapMarkers`·`mergeMapMarkers`(saved 근접 dedup)·`NearbySpotCard` lookup이 누적 items 기준으로 자연 확장.

### Out-of-scope (일부러 안 함)
- **페이지네이션** — 비용 가드레일 위반(1페이지 15건 상한 불변).
- **뷰포트 필터 렌더**(현재 bbox 내만 그리기) — §3.3에서 **기각**(pan마다 SET_MARKERS 재주입 증가·현행 구조 변경). 상한이 오버레이를 대신 bound.
- **증분 오버레이 렌더**(SET_MARKERS 전체 재생성 대신 델타만) — mapHtml `renderMarkers` 구조 변경이라 lean 범위 밖. 현행 전체 재생성 유지(§6 flicker 트레이드오프·후속 후보).
- 카테고리 필터·클러스터링·비주얼 변경(핀 색/도형/카드)·영속(누적은 컴포넌트 수명 스코프, AsyncStorage 미사용).
- API 호출 경로(디바운스 500ms·양자화 캐시·최소이동 임계·레이스 가드·invoke 횟수) — **불변**.

---

## 3. 데이터 · API 계약

### 3.0 DB / Edge / RPC / 네트워크
- **변경 0.** `nearby-search` Edge·`searchNearby`·`boundsToRect`·invoke body(`{sw,ne}`) 불변. 누적은 **클라이언트 메모리(훅 state)** 에서만 일어남 — 네트워크 0.

### 3.1 신규 순수 모듈 — `accumulateNearbyItems` (시그니처 고정)

```ts
// src/features/map/accumulateNearbyItems/accumulateNearbyItems.ts
//   생산자/소비자: useNearbyPlaces(수신 결과 적용 시 교체 대신 누적).
//   semantics: kakaoPlaceId dedup + LRU(재수신 시 최신으로 갱신·최근으로 이동) + cap 초과 시 오래된 것부터 퇴출.
import { type NearbyPlaceItem } from '../types';

/**
 * 기존 누적(prev)에 신규 수신(next)을 kakaoPlaceId 기준으로 병합한다(dedup·LRU·cap).
 * - next에 있는 id가 prev에 이미 있으면: 데이터를 next 값으로 갱신 + 최근 위치로 이동(재확인=recency).
 * - prev에 없던 id: 뒤에 추가.
 * - 결과 길이가 cap 초과면 앞(가장 오래된)부터 잘라낸다.
 * @param prev 현재 누적 배열(삽입/최근 순)
 * @param next 이번에 수신한 항목(신규 응답 또는 캐시 히트 결과)
 * @param cap 누적 상한(초과분은 오래된 것부터 퇴출)
 * @returns dedup·LRU·cap 적용된 새 배열(순수 — prev/next 미변형)
 */
export const accumulateNearbyItems = ({
  prev,
  next,
  cap,
}: {
  prev: NearbyPlaceItem[];
  next: NearbyPlaceItem[];
  cap: number;
}): NearbyPlaceItem[];
```

**계약 핵심(developer 추측 금지)**:
- dedup 키 = **`kakaoPlaceId`**(기존 `mergeMapMarkers`의 좌표 epsilon dedup은 saved↔nearby용 — 이건 **nearby↔nearby id dedup**으로 별개 레이어).
- LRU 구현 권장: `Map<kakaoPlaceId, NearbyPlaceItem>`을 prev 순서로 구성 → next 각 항목 `map.delete(id); map.set(id, item)`(존재 시 최근으로 이동, 신규는 추가) → `size > cap`이면 `map.keys().next()`(가장 오래된)부터 delete → `[...map.values()]`.
- **순수 함수**(prev/next 미변형, 새 배열 반환). throw 없음.
- next가 빈 배열이면 prev를 그대로 반환(cap만 적용, 실질 무변). prev가 비어도 next를 cap 적용해 반환.

### 3.2 `useNearbyPlaces` 변경 (적용 단계만 — 경로 불변)

**변경 지점은 결과 적용 3곳뿐**, 나머지(디바운스·양자화 캐시·최소이동·레이스 seq·`lastQueriedRef`·delay 산식·invoke)는 **한 줄도 바꾸지 않는다**:

| 위치 | 현재 | 변경 후 |
|------|------|---------|
| 신규 응답(성공, 122) | `setItems(nextItems)` | `setItems((prev) => accumulateNearbyItems({ prev, next: nextItems, cap: NEARBY_ACCUM_CAP }))` |
| 캐시 히트(103) | `setItems(cached)` | `setItems((prev) => accumulateNearbyItems({ prev, next: cached, cap: NEARBY_ACCUM_CAP }))` |
| 에러(127) | `setItems([])` | **삭제**(items 미변경 — 누적 유지). `setStatus('error')`만 유지 |

- `cacheRef`는 **양자화 bbox별 원본 15컷**을 그대로 저장(불변) — 누적과 독립. 캐시 히트도 accum에 병합되므로 재방문 area가 누적에 LRU-합류(§planner 3의 "캐시 결과도 누적에 합류" = **예**).
- `markers = nearbyToMapMarkers({ items })` — items가 누적이므로 markers도 누적 파생(현행 코드 그대로, items 내용만 누적).
- 신규 상수: `export const NEARBY_ACCUM_CAP = 100;`(§3.3 근거).

### 3.3 누적 상한·퇴출·렌더 정책 (설계 포인트 확정)

- **상한 `NEARBY_ACCUM_CAP = 100`** — 뷰포트당 최대 15건이므로 100 ≈ 겹치지 않는 7뷰포트 분량의 고유 가게. 한 세션의 국지적 탐색(줌·인접 팬)을 충분히 커버하면서, WebView CustomOverlay 수(=DOM 오버레이)를 팬 지연이 우려되는 수준 아래로 bound. **튜닝 가능** — 디바이스 스모크에서 flicker/팬 지연 관측 시 하향(§6).
- **퇴출 = LRU**(재확인 시 최근으로 이동, 초과 시 가장 오래 안 본 것부터). 오래 안 본 area는 다시 방문 시 캐시/재조회로 복원(세션 스코프라 무해).
- **렌더 = 누적 전체**(뷰포트 필터 없음). 근거: (a) 줌아웃 소실까지 해결(현재 bbox 내 누적 핀이 모두 보임), (b) **markersKey 재주입이 "누적 증가 시에만" 발생하는 현행 구조 유지**(뷰포트 필터면 pan마다 재-필터→재주입 증가). 오버레이 수는 **상한**이 bound. 트레이드오프(성장 시 전체 재생성 flicker)는 §6·디바이스 스모크.

### 3.4 에러 경로 정책 (설계 포인트 확정)
- 현재 `setItems([])` → 에러 area 하나 실패에 **누적 전체를 비워 팝아웃**. 변경: **에러 시 누적 유지**(items 미변경, `status='error'`만). 근거: 새 area 조회 실패가 이미 확인된 다른 area 핀을 지울 이유 없음. nearby 에러는 애초에 사용자 차단 배너 아님(map-tab-nearby 설계 — 지도/saved/카드 불변, silent) → 누적 유지가 UX·정합 모두 우월.
- ⚠️ **기존 스펙 중 "에러 시 setItems([])/markers 비움" 테스트는 이 스프린트에서 의도적으로 변경**(에러=누적 유지). developer가 해당 테스트를 신정책으로 갱신, qa-logic이 정책 전환 확인.

### 3.5 stale·distance 정합 (확인 완료)
- **distance staleness 없음**: `boundsToRect`가 center 미전달(`{sw,ne}`만) → Kakao rect 검색은 `distance=null`(NearbyPlaceItem 계약: "center 없으면 null"). 누적 항목의 distance는 원래 null이라 팬 이후에도 stale 왜곡 없음. `NearbySpotCard`는 null distance를 `formatDistance`로 처리(불변).
- **폐업 등 stale**: 누적은 **컴포넌트 수명 스코프**(MapTab 언마운트/앱 재시작 시 리셋, 영속 없음) → 세션 내 잠깐 유지라 위험 낮음(설계 포인트 3 확인). 영속 미도입.

---

## 4. 화면 · UX

- **신규 화면·컴포넌트 0.** 소비자 `MapTabScreen`·`NearbySpotCard`·`mergeMapMarkers` 코드 **무수정**(items 내용만 누적으로 확장).
- 상태(loading/error/빈): 오버레이 매핑 불변. nearby 에러는 여전히 silent(누적 유지로 핀만 지속).
- 비주얼: 핀 색(saved primary / nearby 웜그레이)·도형·카드·범례 **전부 불변** → qa-visual 비관여 근거.

---

## 5. 작업 목록 (각 인수조건 포함)

- [ ] **T1. `accumulateNearbyItems` 순수 모듈 신설** — 인수조건: prev+next를 kakaoPlaceId로 합집합(중복 미증가), next 값으로 기존 갱신 + 최근 이동, 신규 뒤 추가, `> cap`이면 오래된 것부터 퇴출. prev/next 미변형(순수). — 테스트: 합집합·dup 미증가·recency 이동·cap 퇴출·빈 next(=prev)·빈 prev(=next capped).
- [ ] **T2. `useNearbyPlaces` 신규 응답 누적** — 인수조건: 성공 응답 시 `setItems`가 accumulate로 누적(교체 아님). area A(15) 후 area B(15, 겹침 없음) → items=30. 겹치는 id는 미증가. — 테스트: 순차 2응답 → items 합집합, 중복 id 케이스 dedup.
- [ ] **T3. 캐시 히트도 누적 합류** — 인수조건: 캐시 히트 결과도 accumulate로 병합(교체 아님), LRU 갱신. — 테스트: 캐시 히트 경로 후 items가 기존∪캐시.
- [ ] **T4. 에러 시 누적 유지** — 인수조건: 조회 에러 시 items **미변경**(누적 보존), `status='error'`. 기존 `setItems([])` 제거. — 테스트: 성공 누적 후 에러 → items 불변 + status error.
- [ ] **T5. 상한·LRU 퇴출** — 인수조건: 누적이 `NEARBY_ACCUM_CAP` 초과 시 가장 오래된 항목부터 퇴출(길이 = cap 유지). — 테스트: cap+α 유입 → 길이 cap, 최신 유지·최고참 소멸.
- [ ] **T6. API 호출 경로 불변(비용 가드레일)** — 인수조건: 디바운스 500ms·양자화 캐시(재방문 invoke 0)·최소이동 임계·레이스 seq·delay 산식·invoke 횟수가 **기존과 동일**(누적은 apply만 바꿈). — 테스트: **기존 useNearbyPlaces 가드레일 스펙 전부 무변경 green**(연속이동 1회 수렴·재방문 0·임계 미호출·stale 폐기).
- [ ] **T7. 파생 정합(markers/items/카드/머지)** — 인수조건: `markers`가 누적 items에서 파생(saved:false), `mergeMapMarkers`의 saved 근접 dedup이 누적분에도 적용, `NearbySpotCard` lookup이 누적 items에서 kakaoPlaceId로 조회 성공. — 테스트: 누적 markers 개수·id, saved 근접 dedup 후 nearby 제외, 누적 item lookup.
- [ ] **T8. map-pin-select 상호작용 무충돌** — 인수조건: 누적으로 선택 nearby 핀 소실 빈도 감소(누적 유지 시 선택 핀 계속 렌더), 퇴출로 소실 시 기존 T7(selected 정리)·카드 닫힘 정상. 선택 채널(SET_SELECTED)·markersKey 독립 유지. — 테스트: 누적 후 선택 핀 markers에 존재, 퇴출 시 lookup null→카드/선택 정리 경로.
- [ ] **T9. 회귀 0** — 인수조건: `npm test` 전체 green, `nearbyToMapMarkers`·`mergeMapMarkers`·`boundsToRect`·`searchNearby`·`MapTabScreen` 무변경 통과. — 테스트: 전체 스위트.

> 순서: T1 → T2·T3·T4(적용 3지점) → T5(cap) → T6 가드레일 회귀 → T7·T8 파생/상호작용 → T9 전체.

## 5-1. 테스트 케이스 (TDD)

**단위(jest-expo + @testing-library/react-native)**:
- `accumulateNearbyItems`(순수): 정상 합집합 / 경계 빈 prev·빈 next·정확히 cap·cap+1 / recency(재수신 시 최근 이동) / dup id 미증가 / 순수성(prev·next 불변). fake 데이터.
- `useNearbyPlaces`(훅, `searchNearby` 모킹): 신규 응답 누적(T2) / 캐시 히트 누적(T3) / 에러 누적 유지(T4) / cap 퇴출(T5) / **가드레일 회귀(T6, 기존 스펙 무변경)** / markers·items 누적 파생(T7).
- 정책 전환 확인: 기존 "에러→setItems([])" 테스트 → "에러→누적 유지"로 갱신(T4, 의도된 변경).

**모킹/스모크(단위 불가)**:
- 실제 WebView에서 누적 오버레이 렌더·성장 시 SET_MARKERS 전체 재생성 flicker/팬 지연·cap 근처 성능 → **디바이스 스모크(dev/시뮬)**. 메모리 `map-perf-bottleneck`(WebView 병목)·`qa-layout-blind-spot`(렌더 픽셀은 단위로 안 보임) → cap 튜닝은 스모크에서 확정.

---

## 6. 엣지케이스

- **겹치는 뷰포트 → 같은 가게 재수신**: kakaoPlaceId dedup으로 핀 1개 유지 + LRU 최근 이동(중복 오버레이 없음). 핵심 요구.
- **같은 위치 줌 인/아웃**: 새 15컷이 이전과 달라도 합집합이라 이전 핀 유지 + 신규 추가 → 팝인/소실 해소.
- **에러(새 area 조회 실패)**: 누적 유지(팝아웃 없음). status='error'는 silent(배너 아님).
- **cap 초과(장기 탐색)**: LRU로 최고참 퇴출 → 재방문 시 캐시/재조회로 복원(세션 스코프, 무해). 선택 핀이 퇴출되면 map-pin-select T7이 정리.
- **선택된 nearby 핀 + 누적**: 누적 유지로 선택 핀이 계속 렌더 → 선택 소실 빈도 **감소**(map-pin-select와 긍정 상호작용). markersKey/SET_SELECTED 독립 채널이라 충돌 없음.
- **markersKey 재주입 빈도**: 누적 증가(신규 고유 핀 유입) 시마다 SET_MARKERS 재주입(현행 구조). 각 재주입은 전체 오버레이 재생성 → cap이 상한. 성장 시 flicker 가능 → 디바이스 스모크(§5-1), 심하면 cap 하향 또는 증분 렌더(후속).
- **빈 응답(0건 area)**: accumulate(next=[]) → prev 유지(무변). 빈 area가 기존 누적을 지우지 않음(구 교체 정책의 소실 제거).
- **좌표 비유한 항목**: `nearbyToMapMarkers`가 기존대로 제외(핀 보호). 누적 items에는 남을 수 있으나 markers에서 제외 — 카드 lookup만 가능(무해).
- **커플 동시성(2명)**: 누적은 각자 기기 로컬 UI 상태 — 상대와 무관, 쓰기·RPC 0이라 영향 0.
- **컴포넌트 재마운트**: MapTab 언마운트 시 누적 리셋(세션 종료) — 영속 없음, 의도된 스코프.

---

## 7. QA 교차검증 경계면 (생산자 ↔ 소비자)

- **`accumulateNearbyItems`(생산자: dedup·LRU·cap) ↔ `useNearbyPlaces`(소비자: 적용 3지점)**: 병합 semantics·순수성·cap. **id dedup(nearby↔nearby)이 좌표 dedup(mergeMapMarkers, saved↔nearby)과 별개 레이어**임 확인.
- **`useNearbyPlaces.items`(누적) ↔ `nearbyToMapMarkers` ↔ `mergeMapMarkers`(saved 근접 dedup) ↔ SET_MARKERS**: 누적분에도 saved dedup 적용, markers 누적 파생.
- **`useNearbyPlaces.items`(누적) ↔ `MapTabScreen` `NearbySpotCard` lookup**: 누적 items에서 kakaoPlaceId 조회.
- **API 경로 불변(비용 가드레일)**: 디바운스·양자화 캐시·최소이동·레이스 seq·**invoke 횟수** — 기존 가드레일 스펙 무변경 green이 증거(T6). 누적은 apply만 변경.
- **에러 정책 전환**: `setItems([])` 제거 → 누적 유지. 기존 에러 스펙 갱신 확인.
- **map-pin-select 상호작용**: 선택 유지 개선·퇴출 시 T7 경로·SET_SELECTED/markersKey 독립.

## 8. 비용 가드레일 체크

- **AWS 미사용 / RPC 0 / Kakao Local 호출 0 증가 / 마이그레이션 0** — 누적은 클라 메모리. **invoke 횟수 불변**(디바운스·캐시·임계·seq 전부 그대로, 페이지네이션 미도입).
- **폴링/Realtime 0** — 신규 타이머·구독 없음.
- **WebView 오버레이 bound** — `NEARBY_ACCUM_CAP`(=100)로 렌더 오버레이 상한(무한 누적 방지). 성장 시 전체 재생성 flicker는 디바이스 스모크로 상한 검증.
- **뷰포트 조회 정책 불변** — nearby는 여전히 viewport bbox 기준 조회(전체 조회 금지). 누적은 표시 레이어일 뿐 조회 범위 확장 아님.

---

## 9. 산출물 / 완료 기준

- 신규: `src/features/map/accumulateNearbyItems/`(`accumulateNearbyItems.ts`·`index.ts`·`.spec.ts`).
- 수정: `src/features/map/useNearbyPlaces/useNearbyPlaces.ts`(적용 3지점 + `NEARBY_ACCUM_CAP`) + `.spec.ts`(누적 케이스 추가 + 에러 정책 갱신).
- 무변경 보장: `searchNearby`·`boundsToRect`·`nearbyToMapMarkers`·`mergeMapMarkers`·`nearby-search` Edge·`MapTabScreen`·`NearbySpotCard`·API 경로 로직(디바운스/캐시/임계/seq).
- 완료 기준: T1~T9 인수조건 green + `npm test` 전체 통과(특히 **기존 invoke-횟수 가드레일 스펙 무변경 green** = 경로 불변 증거) + 에러 정책 전환 테스트.
- 라이브 검증: 누적 오버레이 렌더·성장 flicker·cap 근처 팬 성능은 **디바이스 스모크(dev/시뮬)** 로 확인, cap 최종값 튜닝(메모리 권고 — WebView 렌더/타이밍은 디바이스에서만 드러남).
