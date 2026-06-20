# Sprint: 주변 음식점 첫 로드 즉시화 (nearby-first-load)

> 선행: `sprint-20260615-map-tab-nearby`(주변 음식점 viewport 핀 — 디바운스·양자화 캐시·최소이동 임계·레이스 가드). 본 스프린트는 그 산출물 `useNearbyPlaces` 단일 파일의 **첫 조회 지연만** 제거하고 나머지 가드레일은 전부 불변으로 유지한다.

---

## 1. 기능 한줄 정의

지도 탭에 처음 진입하면, 주변 음식점 핀이 **500ms 디바운스 지연 없이 즉시(0틱)** 뜨기 시작한다 — 단, 첫 진입에서 `nearby-search` Edge Function은 **2회 이상 호출되지 않는다**(초기 idle 다발이 1건으로 수렴). 두 번째 이후의 지도 이동은 기존 500ms 디바운스를 그대로 유지한다.

---

## 2. 범위

- **In-scope**
  - `src/features/map/useNearbyPlaces.ts` 한 곳 수정: **첫 조회(직전 조회 없음)만 leading-edge(0틱) 즉시 조회**, 이후 조회는 기존 500ms 트레일링 디바운스.
  - 기존 비용 가드레일 4종(디바운스 수렴 · 양자화 캐시 · 최소이동 임계 · 레이스 가드) **회귀 0** 보장.
  - `useNearbyPlaces.spec.ts`의 "디바운스 3회 수렴" 테스트를 새 의미(첫 조회는 즉시, 2회차+만 트레일링)에 맞게 **의미 보존 갱신** + 신규 인수조건 테스트 추가.
- **Out-of-scope** (의도적 제외 — 다음 스프린트 / 후속)
  - **지도 생성 전 center+zoom 근사 bbox 선조회**(§대안 a) — 더 빠르나 부정확·복잡, 채택 안 함.
  - **프리페치/예열**(현재 위치 기반 사전 invoke), **클러스터링**, **필터칩**.
  - `nearby-search` Edge Function 내부, `searchNearby` 래퍼, `boundsToRect`, `nearbyToMapMarkers`, `mergeMapMarkers`, `MapTabScreen` 배선 — 전부 **불변**(이 스프린트 미수정).
  - `mapHtml.ts`의 INIT/relayout/setCenter idle 발생 로직 — **불변**(RN 측에서 흡수).
  - 비주얼/레이아웃 변화 없음 → **ui-publisher·qa-visual 비관여**(lean: planner→developer→qa-logic).

---

## 3. 데이터 · API 계약 (전부 불변 — 명시적 동결)

이 스프린트는 **신규 테이블·컬럼·RLS·RPC·Edge Function 없음**. 기존 계약을 그대로 보존하는 것이 인수조건이다.

### 3.1 Edge Function `nearby-search` — 불변
- 입력: `boundsToRect({ sw, ne })`의 결과(rect 문자열). 호출 경로 `searchNearby(rect)` 그대로.
- 응답 shape `NearbyPlaceItem[]`(불변): `{ kakaoPlaceId, placeName, categoryName, categoryGroupCode, lat, lng, distance }`.

### 3.2 `MapMarker`(주변 핀) — 불변
- `nearbyToMapMarkers({ items })` → `MapMarker[]`, `saved: false`. 머지·dedup·색 구분은 `mergeMapMarkers`가 전담(불변).

### 3.3 훅 시그니처 `useNearbyPlaces()` — 불변
- 반환: `{ setBounds: (next: Bounds) => void; markers: MapMarker[]; items: NearbyPlaceItem[]; status: NearbyPlacesStatus }`.
- 외부(소비자 `MapTabScreen`)에서 보는 계약은 **완전 동일**. 변경은 내부 effect의 타이머 지연 결정뿐.

### 3.4 상수
- `NEARBY_DEBOUNCE_MS = 500` — **불변**(2회차+ 트레일링 디바운스에 계속 사용).
- `NEARBY_QUANTIZE_DECIMALS = 4`, `NEARBY_MIN_MOVE = 1e-3` — **불변**.
- (신규 도입 시 0이면 매직넘버 회피 위해) `NEARBY_FIRST_DELAY_MS = 0` 상수 추가 가능 — 0틱 leading-edge 의미를 명시. (developer 재량: 상수화 권장, 인라인 0도 허용)

### 3.5 에러 처리 — 불변
- `searchNearby` reject 시 `setItems([])` + `setStatus('error')`. 핀/카드 데이터만 비움(지도/saved 핀/카드 불변). 첫 조회가 에러여도 동일.

---

## 4. 화면 · UX

- **화면 변화 없음.** `MapTabScreen`·WebView·HTML 모두 미수정.
- 체감 변화: 지도가 뜨면 주변 음식점 핀(`mapNearbyPin #B6ABA0`)이 기존 ~1초+ → **즉시(~Edge Function 왕복시간만)** 등장.
- 상태 전이(불변): `idle` → (첫 조회) → `loading` → `ready`/`error`. 첫 조회에서 `loading` 진입이 **500ms 빨라질 뿐** 전이 순서 동일.
- 원티드 토큰 사용 지점: 없음(로직 전용 스프린트).

---

## 5. 작업 목록 (각 인수조건 포함)

- [ ] **T1. 첫 조회 leading-edge 분기** — `debounceNearbyFetch` effect에서 `lastQueriedRef.current === null`(= 직전 조회 없음, 첫 조회)일 때 `setTimeout(0)`(또는 `NEARBY_FIRST_DELAY_MS`)로, 그 외엔 `setTimeout(NEARBY_DEBOUNCE_MS)`로 `runNearbySearch`를 예약한다. **두 경로 모두 동일한 `timer`를 cleanup에서 `clearTimeout`** 하도록 유지.
  - 인수조건: 첫 `setBounds(b)` 직후, 가짜 타이머를 **0ms(틱)** 만 흘려도 `searchNearby`가 1회 호출된다(기존엔 500ms 흘려야 호출). 두 번째 이후 `setBounds`는 0ms엔 미호출, 500ms 흘려야 호출.
  - 테스트: T1-a(즉시), T1-d(2회차 트레일링 유지) — §5-1.
- [ ] **T2. 첫 진입 invoke ≤1회 보장(idle 다발 수렴)** — 0틱이어도 cleanup의 clearTimeout이 동작하므로, 초기 INIT relayout/setCenter가 idle을 **연속 2~3회** 유발해도 마지막 `bounds` 1건만 살아남아 `searchNearby`는 1회만 호출된다.
  - 인수조건: 첫 진입을 모사해 `setBounds`를 (같은 effect commit 사이클 흐름으로) 연속 3회 호출한 뒤 0틱을 흘리면 `searchNearby`는 **정확히 1회**. 2회 이상이면 실패.
  - 테스트: T2 — §5-1.
- [ ] **T3. 비용 가드레일 4종 회귀 0** — 디바운스 수렴(2회차+) · 양자화 캐시(재방문 invoke 0) · 최소이동 임계(미세이동 미호출) · 레이스 가드(stale 폐기)가 전부 기존과 동일하게 동작.
  - 인수조건: §5-1 G1~G4 테스트가 모두 green. (캐시/임계/레이스 분기는 코드상 첫 조회 분기보다 **상위**에서 평가되므로 leading-edge 도입과 독립 — 이를 테스트로 못박는다.)
  - 테스트: G1~G4 — §5-1.
- [ ] **T4. 기존 spec 의미 보존 갱신** — `useNearbyPlaces.spec.ts`의 "디바운스: 창 내 연속 setBounds 3회 → 1회만" 테스트는 첫 조회가 즉시화되며 의미가 바뀐다. **첫 조회를 미리 소진(warm)한 뒤** 2~4번째 이동으로 트레일링 수렴을 검증하도록 갱신(또는 별도 케이스로 분리). 나머지 테스트(첫 호출/캐시/임계/레이스/에러)는 `advanceTimersByTime(NEARBY_DEBOUNCE_MS)`가 0틱 이후도 포함하므로 그대로 green이어야 함 — 회귀 없이 통과 확인.
  - 인수조건: `npm test src/features/map/useNearbyPlaces.spec.ts` 전체 green. 갱신된 디바운스 테스트가 "첫 조회 즉시 + 2회차+ 트레일링"을 모두 단언.
- [ ] **T5. 전체 스위트 회귀 0** — `npm test` 전체 green(기존 baseline 대비 통과 수 유지/증가, 신규 케이스만큼만 증가).
  - 인수조건: 전 스위트 green, MapTabScreen 등 소비자 테스트 불변 통과.

---

## 5-1. 테스트 케이스 (TDD — Red 먼저)

> 대상: `useNearbyPlaces.spec.ts`(단위, `searchNearby` 모킹 + `jest.useFakeTimers`). Edge Function/Kakao/네이티브는 모킹·스모크 경계(`docs/testing-strategy.md`). 헬퍼 `bounds()`·`item()`은 기존 spec 재사용.

### 첫 조회 즉시성 (신규)
- **T1-a (정상·핵심)**: `setBounds(bounds())` 직후 `advanceTimersByTime(0)`만 → `searchNearby` **1회 호출**, `status==='loading'→'ready'`, `markers[0].saved===false`. (기존 동작과 대비: 기존 코드면 0틱엔 0회.)
- **T1-b (경계)**: `setBounds` 직후 타이머를 **전혀 흘리지 않으면**(0ms 미경과) 아직 호출 전, 0틱(혹은 마이크로태스크 flush) 후 1회 — leading이 "동기 즉시"가 아니라 "0틱"임을 명시(0틱이라도 cleanup 가능해야 T2 성립).
- **T1-c (대비 회귀 가드)**: 첫 조회를 소진한 **두 번째** 이동은 `advanceTimersByTime(0)`엔 미호출, `advanceTimersByTime(NEARBY_DEBOUNCE_MS)` 후 호출 — 2회차부터 트레일링 디바운스 유지.
- **T1-d (정상)**: 첫 조회(0틱 소진) → 2번째·3번째 큰 이동을 디바운스 창 안에서 연속 → 0틱엔 첫 1회만, 500ms 후 마지막 bbox로 추가 1회(총 2회).

### 첫 진입 invoke ≤1 (신규 — 가장 중요)
- **T2 (정상·핵심)**: 첫 진입 idle 다발 모사 — `setBounds(b1)`·`setBounds(b2)`·`setBounds(b3)`를 연속 호출(각 effect commit 사이 0틱) 후 `advanceTimersByTime(0)` → `searchNearby` **정확히 1회**, 마지막 bbox(b3)로 호출. **2회 이상이면 실패(첫-진입-중복-invoke 회귀 검출).**
  - 비고: relayout/setCenter가 같은 viewport로 2회 idle을 쏘는 경우도 양자화 동일키면 캐시/`last.key===key` 분기로 0추가. 다른 키여도 cleanup이 직전 0틱 타이머를 취소해 마지막 1건만 발사 → **둘 다 1회 상한** 보장.

### 비용 가드레일 회귀 0 (기존 의미 보존 — 동결)
- **G1 디바운스 수렴**: (T4 갱신본) 첫 조회 warm 후, 창 내 연속 대이동 3회 → 마지막 bbox로 **1회만** 추가 호출.
- **G2 양자화 캐시**: 첫 조회(A) → 멀리(B) → 원위치(A 동일 양자화키) 재방문 → A 재방문은 **invoke 0 추가**(히트), `status==='ready'`. (기존 spec line 69~88 의미 유지; 첫 조회 즉시화로 타이밍만 0틱, 호출 수 불변.)
- **G3 최소이동 임계**: 첫 조회 후 `NEARBY_MIN_MOVE` 미만 미세 이동 → **추가 0회**. 임계 이상 → 추가 1회. (기존 line 90~116 유지.)
- **G4 레이스 가드**: 첫 요청 pending 중 둘째 이동 → 둘째 결과 반영, 늦게 온 첫 응답은 **stale 폐기**(`markers===['second']`). (기존 line 118~141 유지; 첫 요청이 0틱 발사여도 seq 가드 동일.)
- **G5 에러**: 첫 조회가 reject → `status==='error'`, `markers===[]`. (기존 line 143~152, 첫 조회 즉시화여도 동일.)

### 통합 회귀
- **T5**: `npm test` 전체 green. `MapTabScreen.spec.tsx` 등 소비자 불변 통과(훅 외부 계약 동일).

> **Red 진입 가이드(developer)**: T1-a·T2를 **먼저 작성→실패 확인**(현행 코드는 0틱엔 0회 호출이므로 Red). 그다음 T1 구현으로 Green. G1~G5는 기존 통과 테스트의 의미를 보존하되 G1만 warm 단계를 추가해 갱신.

---

## 6. 엣지케이스

- **권한 거부(현재위치 없음)**: 위치 권한이 거부돼도 지도는 saved 핀 중심/기본 center로 INIT→idle→`BOUNDS_CHANGED` 발생 → 첫 `setBounds`가 들어옴. 따라서 첫-조회-즉시화는 **권한과 무관하게** 동작해야 한다(위치는 center 결정에만 영향, nearby는 bbox만 사용). 인수조건: 권한 없이도 첫 bounds 수신 시 0틱 invoke 1회.
- **첫 조회 직후 곧바로 이동**: 첫 조회가 0틱에 발사된 직후(아직 pending) 사용자가 크게 이동 → 둘째는 트레일링(500ms). 둘째 발사 전 첫 응답이 오면 첫 결과 반영 후 둘째가 덮어씀(레이스 가드 G4로 stale 보호). 추가 invoke는 정상적인 "이동당 1회".
- **캐시 히트가 첫 조회인 경우**: 이론상 첫 진입에서 캐시는 비어 있음(앱 첫 마운트). 그러나 훅이 재마운트되지 않고 같은 인스턴스에서 동일 양자화키로 재진입하면 첫 조회 분기 이전에 **캐시/`last.key===key` 분기**가 상위에서 return → invoke 0. leading-edge 분기는 캐시 미스일 때만 도달. 인수조건: 캐시 히트 경로는 leading-edge와 무관하게 invoke 0.
- **Edge Function 에러가 첫 조회**: G5. 첫 0틱 invoke가 reject → `status='error'`, markers 비움. 지도·saved 핀·카드 불변(차단 아님). 이후 이동으로 재시도 가능.
- **빠른 연속 진입/이탈**(탭 전환으로 마운트/언마운트 반복): 언마운트 시 effect cleanup이 in-flight 타이머를 `clearTimeout` → 끊긴 진입의 0틱 타이머도 취소. 재진입 시 새 훅 인스턴스(또는 보존된 ref)에 따라 첫 조회 재평가. 인수조건: 언마운트 후 잔존 타이머로 인한 유령 invoke 없음(cleanup이 0틱 타이머도 회수).
- **동시성(커플 2명)**: 두 사용자가 각자 디바이스에서 지도 진입 — 서로 독립(읽기 전용 Kakao 조회, 공유 상태 없음). 충돌 없음.
- **동일 viewport 재-idle**(relayout/setCenter가 같은 영역 2회 idle): 양자화 동일키 → `last.key===key` 상위 return으로 추가 0(T2가 커버).

---

## 7. QA 교차검증 경계면 (생산자 ↔ 소비자)

- **`mapHtml.ts`(INIT relayout/setCenter idle 발생) ↔ `MapTabScreen`(`BOUNDS_CHANGED`→`nearby.setBounds`) ↔ `useNearbyPlaces`(첫 조회 분기)**: 첫 진입에서 idle이 몇 번 쏘이든 invoke ≤1을 RN 측이 흡수하는지. (qa-logic: 세 파일을 같이 읽고 첫-진입 시퀀스 추적.)
- **`useNearbyPlaces.setBounds`/`markers`/`items`/`status` ↔ `MapTabScreen` 소비**: 훅 외부 계약 불변 확인(SET_MARKERS 재주입·NearbySpotCard lookup·status 사용처가 영향 없음).
- **`useNearbyPlaces` ↔ `useNearbyPlaces.spec.ts`**: 갱신된 디바운스 테스트가 "첫 조회 즉시 + 2회차+ 트레일링"을 정확히 단언하는지, 가드레일 G1~G5가 의미 보존인지.
- **`searchNearby` ↔ `nearby-search` Edge Function**: 호출 횟수만 바뀌고 인자/응답 shape 불변(모킹 경계 — 라이브는 스모크).

---

## 8. 비용 가드레일 체크

- **Kakao 호출량 불변(증가 0)**: 첫 진입 invoke는 기존에도 1회였고 본 변경 후에도 **≤1회**(T2로 강제). 즉 **쿼터 사용량은 동일**, 단지 **지연만 제거**. 신규 호출 경로 0.
- **디바운스 보존**: 2회차+ 연속 이동은 500ms 트레일링으로 1회 수렴(G1) — 과호출 차단 불변.
- **양자화 캐시 보존**: 재방문 invoke 0(G2) — 불변.
- **최소이동 임계 보존**: 미세 흔들림/관성 미호출(G3) — 불변.
- **레이스 가드 보존**: stale 폐기(G4) — 불변.
- **AWS 미사용**: Supabase Edge Function(`nearby-search`)·`KAKAO_REST_API_KEY` 그대로, 신규 인프라 0.
- **재빌드 불필요**: 순수 JS(RN) 변경 → Dev Client 재빌드 없음. 라이브 확인은 디바이스 스모크(첫 진입 핀 즉시성 체감)로 이월.

---

## 핵심 결정 요약

1. **권장안 확정**: `useNearbyPlaces` effect에서 **첫 조회(`lastQueriedRef.current === null`)만 `setTimeout(0)` leading-edge**, 2회차+는 기존 `setTimeout(NEARBY_DEBOUNCE_MS)` 트레일링. 단순·저위험·단일 파일.
2. **대안 기각**: (a) 지도 생성 전 center+zoom 근사 bbox 선조회 = 더 빠르나 부정확·복잡 → X. (b) "동기 즉시 invoke" = idle 다발 수렴 불가(cleanup 못 함) → **0틱**으로 채택.
3. **invoke 추가 0 보장 논리**: 0ms여도 타이머는 `clearTimeout` 대상이라, 초기 INIT relayout/setCenter가 idle을 다발로 쏴도 직전 0틱 타이머가 취소되고 **마지막 bounds 1건만 발사** → 첫 진입 invoke ≤1. 동일 viewport 재-idle은 양자화 `last.key===key`로 0추가. 두 방어선으로 "첫 진입 2회 이상 invoke 없음"을 T2 인수조건으로 못박음.
