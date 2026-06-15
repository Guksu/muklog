# QA Report — Logic/Integration (map-tab-nearby, 슬라이스 2)

> qa-logic. `integration-qa` 스킬 적용. 경계면 생산자↔소비자 동시 읽기. 비주얼/킷 충실도 제외(qa-visual 담당).
> 기준: plan.md(§3 계약·§5-1 TDD·§7 경계면·§8 비용) · dev-notes.md · docs/testing-strategy.md · docs/code-convention.md.
> 검증일 2026-06-15. **Bash 실행 권한이 이 세션에서 거부됨** → `npm test`/`tsc` 라이브 실행은 미검증으로 분류(dev-notes 보고값 인용, 직접 재현 못 함). 정적 교차검증은 전수 수행.

## 결론 요약
- **통과**: 경계면 7종 전부, 비용 가드레일 테스트 강제(디바운스/캐시/임계/페이지네이션 금지), REST 키 미노출, slice1 회귀 0, 코드 컨벤션 전수, 테스트 유의미성 표본.
- **실패**: 없음(developer 수정요청 0건).
- **미검증**: `npm test` 전체 통과·`npx tsc --noEmit`·Deno serve/디바이스 스모크(환경상 실행 불가). dev-notes는 757 green·tsc clean 보고.

---

## 1. 경계면 교차검증 (§7 — 양쪽 동시 읽기)

### 1.1 `nearby-search` Edge `{results}`(camel, distance) ↔ `searchNearby`/`nearbyToMapMarkers` — 통과
- **필드 1:1**: Edge `NearbyPlaceItem`(index.ts:39-47) = 클라 `NearbyPlaceItem`(types.ts:54-62). kakaoPlaceId/placeName/categoryName/categoryGroupCode/lat/lng/distance 동일. `searchNearby`가 `body.results`를 그대로 반환(searchNearby.ts:96), `nearbyToMapMarkers`가 lat/lng/categoryName/categoryGroupCode/kakaoPlaceId만 소비(nearbyToMapMarkers.ts:18-35) — 미스매치 0.
- **distance null 처리**: Edge `parseDistance`가 빈 문자열/비수치 → null(index.ts:82-86). 소비측 `formatDistance`가 null → ''(formatDistance.ts:13). NearbySpotCard가 distanceText 미전달 시 거리 조각 생략(NearbySpotCard.tsx:43-46). 양쪽 일관.
- **rect 순서(lng,lat,lng,lat)**: index.ts:132 `${sw.lng},${sw.lat},${ne.lng},${ne.lat}` — Kakao x=lng·y=lat 규약대로 `lng_min,lat_min,lng_max,lat_max`. 정확.
- **FD6·size=15·page 미사용**: index.ts:24-25,133-135. `category_group_code=FD6&rect=...&size=15`. URL에 `page` 파라미터 부재(grep 확인). 페이지네이션 금지 충족.

### 1.2 비용 가드레일 — 테스트가 실제로 강제하는가 (최우선 §8) — 통과
useNearbyPlaces.spec.ts 7케이스를 코드와 대조:
- (a) **디바운스 1회**(spec:50-67): 창 내 3회 setBounds(크게 이동) → `toHaveBeenCalledTimes(1)` + 마지막 bbox. 디바운스 제거 시 3회로 빨개짐 → load-bearing.
- (b) **동일(양자화) bbox 0회**(spec:69-88): A→B→A 왕복, 재방문 시 `toHaveBeenCalledTimes(2)` 유지. cacheRef + quantizeKey(useNearbyPlaces.ts:88-101). 캐시 제거 시 3회 → load-bearing.
- (c) **최소 이동 임계 미만 미호출**(spec:90-103): +5e-5 이동 → 1회 유지. `isBelowMinMove`(useNearbyPlaces.ts:104). 가드 제거 시 2회 → load-bearing.
- (d) **stale 폐기**(spec:118-141): 늦은 첫 응답 폐기, markers=['second']. `requestSeqRef` 시퀀스 가드(useNearbyPlaces.ts:106,111,118). seq 비교 추적: 두 번째 setBounds로 effect 재실행→seq=2, 첫 응답 resolve 시 1!==2 폐기. 정확.
- (e) **에러 정책**(spec:143-152): reject → status='error' + markers=[]. 코드 catch가 setItems([])+setStatus('error')(useNearbyPlaces.ts:117-121). 일치.
- **임계 이상 이동 호출**(spec:105-116): 보강 케이스, 가드의 가짜통과 방지.
- **Edge·훅 양쪽 전체조회 금지**: Edge size=15·page 미사용(index.ts) + 훅 viewport 이벤트에만 반응(폴링/Realtime 0, useNearbyPlaces는 setBounds 호출에만 반응). 자동 갱신 없음.
- 유의미성 표본: 위 (a)(b)(c)는 단언이 곧 호출 횟수라 가드 제거 시 즉시 빨개지는 구조 — 껍데기 단언 아님.

### 1.3 `BOUNDS_CHANGED`/`MARKER_TAP.saved` ↔ `parseMapMessage` ↔ `MapTabScreen` — 통과
- **생산자(HTML)**: emitBounds가 `{type:'BOUNDS_CHANGED', sw:{lat,lng}, ne:{lat,lng}}`(mapHtml.ts:49-59), 클릭이 `{type:'MARKER_TAP', id:m.id, saved:m.saved}`(mapHtml.ts:77). saved는 항상 동봉.
- **파서**: parseMapMessage가 BOUNDS_CHANGED는 sw/ne 둘 다 `{lat,lng}` 수치일 때만 통과·잡음 null 흡수(parseMapMessage.ts:51-57, asCoords:8-14). MARKER_TAP는 id:string + saved:boolean 필수, 누락/비boolean → null(parseMapMessage.ts:37-42). saved 누락 흡수 검증(spec:53-58).
- **소비자(MapTabScreen)**: BOUNDS_CHANGED → `nearby.setBounds({sw,ne})`(MapTabScreen.tsx:100-103). MARKER_TAP → `setSelected({id,saved})`(96-98). 카드 분기 saved=true→SelectedSpotCard / false→NearbySpotCard(129-134,191-207). setBounds 인자 일치 테스트(MapTabScreen.spec:212-219). saved 분기 테스트(158-169,239-252).

### 1.4 `mergeMapMarkers` dedup ↔ id 출처 차이 + MapMarker 폭확장 회귀 — 통과
- **좌표 근접 dedup**: saved.id=muklogId, nearby.id=kakaoPlaceId라 id 비교 불가 → 좌표 epsilon(1e-4) dedup(mergeMapMarkers.ts:9,17-18,33-36). saved 우선. dedup/경계/빈 테스트(mergeMapMarkers.spec:37-66). epsilon 경계 안(±/2)→제외, 바깥(*2)→유지 양방향 확인.
- **MapMarker.saved boolean 폭확장 회귀**: types.ts:44-50 `saved: boolean`. `pinsToMapMarkers`는 리터럴 `saved: true` 유지(pinsToMapMarkers.ts:27) — 시그니처/구현 무변. boolean에 true 리터럴 할당 가능 → 기존 spec 회귀 0(타입만 넓힘). nearbyToMapMarkers만 false 생산.

### 1.5 REST 키 미노출 — 통과
- `KAKAO_REST_API_KEY`는 Edge env에서만 읽고(index.ts:128) Authorization 헤더로만 사용(index.ts:139). 응답 본문은 `{results}` 또는 `{error}`만(index.ts:124,129,141,144,151,155) — 키 미포함. searchNearby/클라 코드에 REST 키 문자열 부재(클라는 supabase.functions.invoke만 호출, searchNearby.ts:82). mapHtml은 JS 키(KAKAO_JS_KEY) placeholder만 — REST 키와 별개. place-search 원칙 보존. (키 값은 읽지/기록하지 않음.)

### 1.6 slice1 회귀 0 — 통과
- MapTabScreen 오버레이 우선순위(SDK에러→핀에러→로딩→권한)·SelectedSpotCard·useMuklogPins·initialRegion 전부 불변(MapTabScreen.tsx:136-167,191-198). slice1 케이스 spec 전부 보존(MapTabScreen.spec:126-209). nearby 에러가 slice1 오버레이/카드 안 깸 테스트(254-265) — 머지에 빈 nearby만 들어가 saved 경로 불변.
- 신규 outbound 메시지 0: nearby 마커는 기존 SET_MARKERS로 머지 재주입(MapTabScreen.tsx:113-119, reinjectMarkersOnChange 명명 함수). slice1 INIT/SET_MARKERS 경로 재사용.

### 1.7 이모지 매핑 재사용 — 통과
- nearbyToMapMarkers가 기존 `mapKakaoCategory`+`categoryEmoji` 재사용(nearbyToMapMarkers.ts:6-7,22-26), 폴백 PIN_FALLBACK_EMOJI 재사용(pinsToMapMarkers에서 import). 중복 정의 0. 한식→noodle·불명확→폴백 테스트(nearbyToMapMarkers.spec:29-37).

---

## 2. 계약 보강 검증 (dev-notes §2: `items` 추가 노출) — 통과
- plan §3.5는 `{setBounds, markers, status}`만 명시했으나, NearbySpotCard 데이터(placeName/categoryName/distance) lookup 위해 훅이 `items: NearbyPlaceItem[]` 추가 노출(useNearbyPlaces.ts:58-63,134). markers는 items에서 파생(132). MapTabScreen이 `nearby.items.find(kakaoPlaceId===id)`로 카드 조회(MapTabScreen.tsx:131-134). 합리적 보강·경계면 정합. items 소비 테스트(MapTabScreen.spec:239-252).

## 3. Edge Function 단위 경계 — 적절 (미검증 분류)
- `nearby-search`는 Deno 런타임, 앱 tsconfig exclude(`supabase/functions` 확인). 앱 jest/tsc 대상 아님. 핸들러/정규화 로직은 클라 측 계약 모킹(searchNearby.spec·nearbyToMapMarkers.spec)으로 shape 검증 + serve/디바이스 스모크로 분리 — place-search 선례와 동일, 적절. Edge 자체 단위 실행은 환경상 **미검증**.
- Edge bbox 2차 가드: 역전 bbox(sw>ne)·누락·NaN → BOUNDS_REQUIRED(index.ts:120-125). 비정상 JSON → 빈 객체 흡수 → BOUNDS_REQUIRED(118-119). 에러 토큰 3종(400/500/502) 계약 일치.

## 4. TDD·컨벤션 — 통과(정적), 라이브 미검증
- **인수조건↔테스트 대응**: §5 작업 14항목 중 단위 대상(유틸5·훅1·파서·카드·MapTabScreen·mapHtml) 전부 spec 존재 + §5-1 케이스 매핑 확인.
- **컨벤션 전수(Grep)**: useCallback/useMemo 0건. useEffect 전부 명명 함수(debounceNearbyFetch·requestLocationOnEnter·reinjectMarkersOnChange). 컴포넌트/훅 화살표 const. named-object 인자. enum-style 상수(MapInboundType/MuklogErrorToken). 파일명=심볼명. raw hex는 mapHtml HTML 격리 환경만(예외 명시). **위반 0**.
- **테스트 유의미성 표본**: 비용 가드레일 3케이스(디바운스/캐시/임계)는 단언=호출횟수라 가드 제거 시 빨개짐. parseMapMessage saved 누락 null·NaN 좌표 제외·epsilon 경계 양방향 등 실패 경로 커버.
- **미검증**: `npm test`(757) / `npx tsc --noEmit` 라이브 실행 못 함(Bash 거부). dev-notes 보고값(전수 green·clean) 신뢰하되 직접 재현 안 됨.

---

## developer 수정요청
- **없음.** 경계면·비용 가드레일·키 미노출·회귀·컨벤션 모두 통과. 라이브 실행(npm test/tsc/serve/스모크)만 환경상 미검증 — 오케스트레이터/디바이스에서 1회 확인 권장.
