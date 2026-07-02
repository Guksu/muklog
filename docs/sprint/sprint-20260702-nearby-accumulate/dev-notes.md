# dev-notes — nearby-accumulate (주변 핀 누적 머지)

> 구현: developer. plan.md 계약 그대로, TDD(Red→Green). 비주얼 변화 0(핀 색·도형·카드·범례 불변 → ui-publisher/qa-visual 비관여).
> 종료 기준: `npm test` 전체 통과(154 suites / 1503 tests green) + `tsc --noEmit` 클린.

## 1. 구현/수정한 파일

| 파일 | 성격 | 내용 |
|------|------|------|
| `src/features/map/accumulateNearbyItems/accumulateNearbyItems.ts` | **신규 순수 모듈** | `accumulateNearbyItems({prev, next, cap})` — kakaoPlaceId dedup + LRU(재수신 시 최신화·최근 이동) + cap 초과 시 오래된 것부터 퇴출. 순수(prev/next 미변형), throw 0 |
| `src/features/map/accumulateNearbyItems/index.ts` | 신규 배럴 | `export * from './accumulateNearbyItems'` |
| `src/features/map/accumulateNearbyItems/accumulateNearbyItems.spec.ts` | 신규 테스트 | T1 — 합집합·dedup·recency·cap LRU·빈 prev/next·순수성 (8 cases) |
| `src/features/map/useNearbyPlaces/useNearbyPlaces.ts` | **수정(적용 3지점만)** | `NEARBY_ACCUM_CAP=100` 신설 + 성공/캐시히트 경로 `setItems((prev)=>accumulate(...))` + 에러 경로 `setItems([])` 제거 |
| `src/features/map/useNearbyPlaces/useNearbyPlaces.spec.ts` | **수정(케이스 추가 + 에러 정책 갱신)** | T2·T3·T5 추가, 기존 "에러→markers 비움" → T4 "에러→누적 유지"로 갱신. **가드레일 스펙 12개 무변경** |

**무변경 보장(§9)**: `searchNearby`·`boundsToRect`·`nearbyToMapMarkers`·`mergeMapMarkers`·`nearby-search` Edge·`MapTabScreen`·`NearbySpotCard`·**API 경로 로직(디바운스 500ms·양자화 캐시·최소이동 임계·레이스 seq·delay 산식·invoke 횟수)** 전부 미접촉. DB/RPC/Kakao Local/마이그레이션 0.

## 2. 생산자 ↔ 소비자 매핑 (QA 교차검증 경로)

```
searchNearby(invoke, area별 원본 15컷) ──nextItems──┐
cacheRef(양자화 bbox별 원본 15컷, 불변) ──cached──────┤ (누적과 독립 — 캐시는 원본 저장, 누적은 표시 레이어)
                                                     ▼
useNearbyPlaces 적용 3지점:
  성공:    setItems(prev => accumulateNearbyItems({prev, next: nextItems, cap: NEARBY_ACCUM_CAP}))
  캐시히트: setItems(prev => accumulateNearbyItems({prev, next: cached,    cap: NEARBY_ACCUM_CAP}))
  에러:    setStatus('error')만 (setItems 없음 → 누적 유지)
                                                     ▼
accumulateNearbyItems: Map<kakaoPlaceId,item> dedup+LRU+cap → items(누적)
                                                     ▼
markers = nearbyToMapMarkers({ items })  (누적 파생, saved:false — 코드 그대로)
   ├──▶ mergeMapMarkers({saved, nearby}) 좌표 epsilon dedup(saved↔nearby, 별개 레이어) ──▶ SET_MARKERS
   └──▶ MapTabScreen NearbySpotCard: items.find(kakaoPlaceId) lookup(누적 items에서 조회)
```

**dedup 2레이어 구분(§7 핵심)**: (1) `accumulateNearbyItems` = **nearby↔nearby id dedup**(kakaoPlaceId), (2) `mergeMapMarkers` = **saved↔nearby 좌표 epsilon dedup**. 서로 다른 레이어라 누적분에도 mergeMapMarkers 좌표 dedup이 그대로 적용된다.

## 3. 에러 테스트 "의도적 갱신" 근거 (plan §3.4·§7)

- **기존 테스트**: `'에러: searchNearby reject → status=error, markers 비움'` — `setItems([])`로 전체 팝아웃을 검증했다.
- **변경**: 이 스프린트에서 에러 정책을 **누적 유지**로 전환(§3.4). 한 area 조회 실패가 이미 확인된 다른 area 핀을 지울 이유가 없고, nearby 에러는 애초에 silent(사용자 차단 배너 아님 — 지도/saved/카드 불변). 그래서 `setItems([])`를 **제거**하고 `setStatus('error')`만 남겼다.
- **테스트 갱신**: 기존 테스트를 T4 `'에러 시 누적을 유지한다(비우지 않음) + status=error'`로 교체 — 성공 응답으로 누적을 쌓은 뒤 다른 area 조회를 실패시켜 **items가 비워지지 않고 status만 error**임을 단언. 이는 plan이 명시한 "의도된 정책 전환"이며 회귀가 아니다(qa-logic 정책 전환 확인 대상).

## 4. 주요 결정 사항 (추측 없이 plan 준수)

- **적용 3지점만 변경 — API 경로 불변**: 디바운스·양자화 캐시·최소이동·레이스 seq·`lastQueriedRef`·`delay` 산식·invoke는 한 줄도 안 건드렸다. 기존 가드레일 스펙 12개가 무변경 green(연속이동 1회 수렴·재방문 invoke 0·임계 미호출·stale 폐기·첫조회 0틱)인 것이 경로 불변의 증거(T6).
- **캐시는 원본 저장(불변)**: `cacheRef.set(key, nextItems)`는 area별 원본 15컷 그대로. 누적은 setItems 단계에서만 — 캐시 히트도 누적에 병합돼 재방문 area가 기존 누적을 지우지 않는다(T3).
- **레이스 안전**: stale 응답은 `seq !== requestSeqRef.current`로 accumulate **전에** 폐기 → 늦은 응답이 누적을 오염시키지 않음(기존 레이스 테스트 무변경 green).
- **cap=100, LRU**: `Map` 삽입순서로 오래된 것을 앞에서 퇴출. 재수신 항목은 delete+set으로 최근 이동 → cap 퇴출을 면함(unit 검증). 상한이 WebView 오버레이 수를 bound(무한 누적 방지).
- **누적 스코프 = 컴포넌트 수명**: 훅 state라 MapTab 언마운트/앱 재시작 시 리셋(영속 없음). distance는 rect 검색이라 원래 null → 팬 이후 stale 왜곡 없음(§3.5).
- **컨벤션**: 순수 함수 화살표 const·named-object 인자·JSDoc·enum 미사용. useMemo/useCallback 미도입(markers 직접 파생 유지).

## 5. 테스트 결과

- `accumulateNearbyItems.spec.ts`: 8/8 green (T1 — 합집합·dedup·recency·cap LRU·경계·순수성).
- `useNearbyPlaces.spec.ts`: 16/16 green — 기존 가드레일 12(무변경) + T2(성공 누적)·T3(캐시 히트 누적)·T4(에러 누적 유지, 정책 갱신)·T5(cap LRU 퇴출).
- 전체: **154 suites / 1503 tests green**, `tsc --noEmit` 클린. 회귀 0(nearbyToMapMarkers·mergeMapMarkers·boundsToRect·searchNearby·MapTabScreen·map-pin-select 무변경 통과).

## 6. 파생 정합 / map-pin-select 상호작용 (T7·T8)

- `markers`는 누적 items에서 파생(코드 그대로) → 누적 마커. `mergeMapMarkers` saved 근접 dedup·`NearbySpotCard` kakaoPlaceId lookup이 누적 items 기준으로 자연 동작(기존 MapTabScreen 스펙 green).
- **map-pin-select 긍정 상호작용**: 누적 유지로 선택된 nearby 핀이 계속 렌더 → 선택 소실 빈도 **감소**. 퇴출(cap 초과)로 소실 시 기존 map-pin-select T7(`clearSelectionWhenNearbyGone`)이 selected 정리 + 카드 닫힘. SET_SELECTED/markersKey 독립 채널이라 충돌 0.

## 7. 라이브 검증(디바이스 스모크 이월)

메모리 `map-perf-bottleneck`(WebView 병목)·`qa-layout-blind-spot`(렌더 픽셀 단위 불가): 누적 오버레이 렌더·성장 시 SET_MARKERS 전체 재생성 flicker·cap 근처 팬 성능은 dev/시뮬 스모크로 확인, **cap 최종값(100) 튜닝**. 심하면 cap 하향 또는 증분 렌더(후속 후보).
