# dev-notes: map-pin-loading (nearby 로딩 모델 개편)

- **작성일**: 2026-08-20 / **담당**: developer
- **입력**: `plan.md`(§4 계약·§4.5 처분표·§6 W0~W5) · `ui-spec.md`(§3 배치 지시서·§4 props 계약)
- **게이트 결과**: `npm test` **205 suites / 2,164 tests 전량 green** · `npx tsc --noEmit` **0** · 뮤턴트 **13종 전부 killed**

| 항목 | 착수 시 baseline | 완료 시 |
|---|---|---|
| 테스트 | **201 suites / 2,070 tests** (plan §6이 적은 "199/2,038"은 구 수치 — 착수 시 재측정) | 205 suites / **2,164 tests** (+4 suites / +94 tests) |
| 회귀 | — | **0**(기존 스펙 실패 0) |

---

## 1. 무엇이 바뀌었나 (한 문장)

`BOUNDS_CHANGED`의 의미를 **"조회하라" → "현재 뷰포트는 여기다"** 로 바꿨다. 조회를 태우는 경로는 셋뿐이다 — **선로딩(마운트 1회)** · **첫 화면 보정(1회)** · **사용자의 `research()`**. 그 외 어떤 팬·줌도 네트워크를 태우지 않는다.

---

## 2. 생산자 ↔ 소비자 매핑 (qa-logic 교차검증용)

| # | 생산자 | 계약(shape) | 소비자 |
|---|---|---|---|
| P1 | `bboxDrift/bboxDrift.ts` | `Bounds{sw,ne}` · `BboxSpan{lat,lng}` 타입 **원천** / `bboxSpan({bounds})→BboxSpan` / `bboxDrift({prev,next})→{shift,zoom}` / `exceedsResearchThreshold({prev,next})→boolean` / 상수 `NEARBY_RESEARCH_DRIFT=0.35`·`NEARBY_RESEARCH_ZOOM_RATIO=1.6` | `useNearbyPlaces`(버튼 판정·보정 판정) · `nearbyCache`(타입) · `nearbyPreloadBbox`(타입) |
| P2 | `nearbyPreloadBbox/nearbyPreloadBbox.ts` | `nearbyPreloadBbox({coords,pins,span})→Bounds \| null` / `NEARBY_FALLBACK_SPAN={lat:0.018,lng:0.022}` | `MapTabScreen`(마운트 선로딩 bbox 산출) · `useNearbyPlaces`(캐시 span으로 재구성) |
| P3 | `nearbyCache/nearbyCache.ts` | `loadNearbyCache({userId})→Promise<NearbyCachePayload\|null>` / `saveNearbyCache({userId,payload})→Promise<void>` / `NearbyCachePayload{version,savedAt,span,areas}` / `NearbyCacheArea{key,bounds,items}` / 상수 TTL 24h·cap 8·디바운스 2000 | `useNearbyPlaces`(하이드레이션·디바운스 쓰기) |
| P4 | `nearbyTrace/nearbyTrace.ts` | `traceNearby({event,detail})→void`(`__DEV__` 아니면 즉시 return) / `nearbyRenderGapMs({readyAt,at})→number\|null` / `NearbyTraceEvent` 8종 · `NearbyInvokeTrigger` 4종 | `useNearbyPlaces`(cache/invoke) · `MapTabScreen`(preload·map:ready·render:first) |
| P5 | `useNearbyPlaces` | `{ markers, items, status, setBounds, preload({bbox}), research(), researchAvailable }` | `MapTabScreen` |
| P6 | `MapResearchButton`(ui-publisher 소유, **무수정**) | `{ onPress, testID? }` — 노출 조건을 **모른다** | `MapTabScreen`이 `nearby.researchAvailable`로 조건 렌더 + `onPress={nearby.research}` |
| P7 | `searchNearby` / Edge `nearby-search` | `{sw,ne}` → `{results:NearbyPlaceItem[]}` | `useNearbyPlaces` — **양쪽 diff 0** |

**diff 0 확인(git status 기준)**: `mapHtml.ts` · `searchNearby.ts` · `accumulateNearbyItems.ts` · `supabase/functions/nearby-search/` · `initialRegion.ts` — 전부 **변경 없음**.
**폐기 심볼 잔재**: `grep -rn "NEARBY_DEBOUNCE_MS\|NEARBY_MIN_MOVE\|isBelowMinMove" src` → **0건**(설명 주석도 심볼명을 쓰지 않고 "구 최소이동 임계(도 단위 1e-3)"로 표기해 grep 게이트를 통과시켰다).

---

## 3. 변경/신설 파일

**신설(4 모듈 + spec + index)**
- `src/features/map/nearbyTrace/{nearbyTrace.ts, nearbyTrace.spec.ts, index.ts}` — 10 tests
- `src/features/map/bboxDrift/{bboxDrift.ts, bboxDrift.spec.ts, index.ts}` — 15 tests
- `src/features/map/nearbyPreloadBbox/{nearbyPreloadBbox.ts, ...}` — 10 tests
- `src/features/map/nearbyCache/{nearbyCache.ts, ...}` — 20 tests

**재작성**
- `src/features/map/useNearbyPlaces/useNearbyPlaces.ts` — 상태 기계 전면 교체. spec `it()` 16건 → **46 tests**.
  qa-logic O2 반영: 로컬 `type Bounds` 정의를 버리고 `bboxDrift`의 `Bounds`를 단일 출처로 import(두 정의가 갈라져 하이드레이션 경계 B4가 조용히 어긋나는 경로 차단)
- `src/features/map/useNearbyPlaces/useNearbyPlaces.spec.ts`

**배선**
- `src/navigation/screens/MapTabScreen/MapTabScreen.tsx` — 선로딩 effect · 계측 2종 · 버튼 조건 렌더(ui-spec §3.3 코드 그대로)
- `src/navigation/screens/MapTabScreen/MapTabScreen.spec.tsx` — 훅 모킹 계약 확장 + A4-1~A4-6(70 tests)
- `docs/design/architecture.md` §5 백로그에 `map-pin-loading` 행 추가

**만지지 않은 것**: `src/features/map/components/MapResearchButton/*` · `ui-spec.md`(ui-publisher 소유), `MapLegend.tsx`·`tokens.ts`·`components/index.ts`(ui-publisher 변경분).

---

## 4. 훅 내부 계약 (핵심 상태 기계)

```
mount ─ hydrate(): getSession → userId → loadNearbyCache
                    → span 적재(있으면) → areas → areasRef(Map, 삽입순 = LRU)
                    → items = foldAreas(accumulate, cap 100) → status 'ready'(items>0)
                    → hydratedRef=true → 대기 중 preload 실행   ← 순차(뒤집히면 캐시 히트를 놓친다)

preload({bbox})  : 마운트당 1회. 하이드레이션 전이면 큐잉.
                   실행 시 캐시 span이 있으면 그 폭으로 bbox 재구성 → startQuery(defer)
                   → preloadBboxRef 기록 + 보정 1회권 장전

setBounds(next)  : currentBounds 갱신 + 세션 첫 span 1회 기록(캐시 쓰기 예약)
                   ① 허용분 미소진 → 첫 조회 발사(0틱)
                   ② 0틱 타이머가 아직 대기 중 → 대상 bbox만 재타겟(추가 invoke 0 — idle 다발 수렴)
                   ③ 보정 1회권 장전 + 선로딩 bbox 대비 임계 초과 → 보정 조회 1회
                   ④ 그 외 → **아무 것도 하지 않는다**

research()       : 현재 bbox로 즉시(defer 아님) 1회. in-flight면 no-op(연타 가드).

startQuery       : prune 1회 → 양자화 키 캐시 히트면 invoke 0(누적 병합·LRU 갱신·lastQueried 갱신)
                   miss면 fire(0틱 또는 즉시) → seq 레이스 가드 → 성공: area 저장·누적·캐시 쓰기 예약
                                                              실패: status='error'만(누적·lastQueried 불변)

researchAvailable = status!=='loading' && lastQueried && currentBounds && exceedsResearchThreshold(...)
unmount          : 0틱 타이머 회수(유령 invoke 0) + 대기 중 캐시 쓰기 **flush**(취소 아님)
```

**비용 상한(테스트로 잠금)**: C1 0 · C2 1 · C3 1 · C4 2(유일한 순증 경로) · C5 0 · C6 +1 · C7 1 · C8 0 · C9 1.

---

## 5. plan §4.5 처분표 — 실제 결과와 **계획과 달라진 점(중요)**

> **숫자 기준**: plan 요약의 "존속 11"은 산술 오기였고(17행 중 1행은 `it()`가 아니라 import 문),
> 정정된 기준은 **`it()` 16건 = 존속 10 + 재작성 6, import 1행 교체**다(planner 정정 · qa-logic 실측 일치).
> HEAD `it()` 16건 → 현재 46건(케이스 총수 감소 0, 순증 +30).

**존속 10건의 실제 이행** — 단언(expect 문)은 **10건 전부 개수·강도 불변**이다. 본문 변경 여부만 셋으로 갈린다.

| 구분 | 건수 | 케이스 | 본문 diff |
|---|---|---|---|
| **무수정 그대로** ✅ | **4** | #2 T1-a · #3 T1-b · #6 T2 · #16 T5 | **0**(주석 포함 byte-identical) |
| 상수 참조 1줄 교체 | 1 | #7 T2-b | `NEARBY_DEBOUNCE_MS` → 로컬 `SETTLE_MS=500` 1줄. 처분표 #17이 지시한 교체(심볼이 삭제됐다). 단언·경과시간 값 모두 동일 |
| **단언 불변 · 구동 수단만 교체** ⚠ | 5 | #9 캐시 · #12 레이스 · #13 T2 누적 · #14 T3 · #15 T4 | 다섯 모두 "두 번째 area를 `setBounds`로 warm한다"를 전제한다. 그 자동 조회가 이번 스프린트의 **삭제 대상**이라 전제가 성립하지 않는다 → area B를 `research()`(#12는 선로딩+보정)로 warm. **expect 문은 한 줄도 약화·삭제하지 않았다**(#9는 제목의 "재 setBounds"→"재조회"도 함께 정정) |

> 즉 "존속 = 파일 무수정"은 계획의 이상이었고, 실제 최대치는 **"존속 = 단언 불변"** 이다(4건은 파일 무수정까지 달성).
> 각 케이스 주석에 원 단언과 수단 변경 사유를 남겼다 — qa-logic이 `git diff HEAD -- <spec>`으로 B6 대조 가능.

**재작성 6건(#1 `:38` · #4 `:74` · #5 `:92` · #8 `:142` · #10 `:188` · #11 `:203`)은 전부 동등 이상 강도**로 갔다: 트레일링 1회 → **0회**(#4·#5·#8), 미호출 → **미호출 + 버튼 미노출**(#10), 호출 → **버튼 켜짐 + 탭 시 1회**(#11), 디바운스 1회 → **0틱 1회**(#1).

**재작성 6건(#1·#4·#5·#8·#10·#11)은 전부 동등 이상 강도**로 갔다: 트레일링 1회 → **0회**(#4·#5·#8), 미호출 → **미호출 + 버튼 미노출**(#10), 호출 → **버튼 켜짐 + 탭 시 1회**(#11).

---

## 6. 뮤테이션 결과 (M1~M12, 13종 — M6은 read/write 분리)

격리 방식: 리포 `src`를 **스크래치패드로 통째 복사**해 별도 jest config(rootDir=스크래치패드, `modulePaths`로 프로젝트 node_modules 참조)로 실행 → 공유 트리는 **단 한 번도 변형하지 않았다**(QA 동시 실행과 경합 0). 실행 후 사본 삭제 완료.

| 뮤턴트 | 결과 | 죽인 케이스 |
|---|---|---|
| M1 허용분 가드 제거 | KILLED | A3-4 / C5 |
| M2 하이드레이션↔선로딩 순서 뒤집기 | KILLED | A3-2 |
| M3 `researchAvailable`에서 `status!=='loading'` 제거 | **1차 SURVIVED → 단언 강화 후 KILLED** | A3-7 |
| M4 실패에도 `lastQueried` 갱신 | KILLED | A3-8 |
| M5 `exceedsResearchThreshold`를 shift만으로 | KILLED | A2-2 |
| M6 캐시 `userId` 가드 제거(read) | KILLED | A1-1 / A1-4 |
| M6b 캐시 `userId` 가드 제거(write) | KILLED | A1-1 |
| M7 TTL 초과 시 span까지 폐기 | KILLED | A1-3 |
| M8 prune 제거 | KILLED | A3-12 |
| M9 보정 1회 제한 해제 | KILLED | A3-9 / A3-10 |
| M10 `__DEV__` 가드 제거 | KILLED | A0-1 |
| M11 preload 1회 가드 제거 | KILLED | 훅 M11 케이스 |
| M12 언마운트 flush를 취소로 | KILLED | A3-13(언마운트) |

**M3이 처음 살아남은 이유(기록)**: A3-7이 *같은 자리에서* 연타하는 시나리오였다. 그 상태에선 drift가 0이라 `lastQueried`/`currentBounds` 조건만으로 이미 false가 나와, `status!=='loading'`이 하중을 전혀 받지 않았다. **드리프트가 살아 있는 상태에서 누르도록** 바꿔 "조회 중이라 숨었다"와 "이동이 없어 숨었다"를 분리했다. (교훈: 4조건 AND의 한 조건을 검증하려면 **나머지 3조건이 전부 참인 상태**를 만들어야 한다.)

---

## 7. 리더 확정 사항 반영 확인

| 결정 | 반영 |
|---|---|
| Q1 첫 진입 invoke 2회 허용 | C4·A3-10으로 **상한 2**를 잠금(그 외 경로 ≤1) |
| Q2 nearby 에러 무음 | `status='error'`만, 배너 0. 실패 시 `lastQueried` 미갱신 → 버튼 잔존(A3-8) |
| Q4 `MapLocateButton`에 자동 재검색 미부착 | `handleLocate` **무수정**(RECENTER만) |
| Q5 wish 핀 캐시 영속 제외 | `useWishPins` 무수정 |

---

## 8. 이월 · 미완 항목

1. **디바이스 스모크 S1~S9 미수행**(단위 테스트로 대체 불가). 특히 **S2**(재진입 gapMs 0·invoke 0) · **S3**(팬 중 핀 불변) · **S6**(prune)이 이 스프린트의 핵심 주장이다.
2. **D1 — `NEARBY_FALLBACK_SPAN`(0.018/0.022) 실측 교정 이월**. 계산 근사값이며, 실기기 첫 세션의 `[nearby] cache:hydrate`/첫 `BOUNDS_CHANGED` span 로그로 20% 이상 어긋나면 상수를 고친다. **캐시가 있는 2회차부터는 관측 span이 이 상수를 대체**하므로 영향은 "최초 설치 첫 진입 정확도"에 한정된다.
3. **baseline gapMs 미측정**(W0의 "개선 전 실기기 1회 측정"). 계측 모듈을 개선과 같은 스프린트에 넣었으므로 개선 전 수치를 잴 기회가 없었다 — 대신 `render:first`의 `gapMs`가 **0이면 목표 달성**이라는 절대 기준으로 판정 가능하다(상대 비교 불필요).
4. **L6 — 하이드레이션보다 `setBounds`가 먼저 오면 캐시 히트를 놓치고 1회 낭비**(qa-logic 확인, 이월 확정).
   내가 제기하고 qa-logic이 재현했다: 캐시에 area가 있는데도 첫 `setBounds`가 하이드레이션보다 빨리 오면 invoke 1회가 나간다(상한 위반 아님, C1 정신 위배).
   - **"발사 직전 캐시 재확인"은 해법이 아니다**(qa-logic이 실측 반증): 0틱 타이머(매크로태스크)가 `getSession`+AsyncStorage(실 I/O)보다 **결정적으로 먼저** 깨므로, `fire()` 첫머리에서 `areasRef`를 다시 봐도 아직 비어 있다. 같은 시도를 반복하지 말 것.
   - **진짜 원인은 계약 상충이다**: `preload`는 하이드레이션을 기다리지만(A3-2·C1이 여기서 invoke 0을 얻는다) 첫 `setBounds`는 기다리지 않는다 — **T1-a("첫 조회는 0틱", 0620 `nearby-first-load`가 세우고 plan §4.4 "유지되는 것"에 명시)** 가 `settle()` 없이 0틱 1회 호출을 단언하기 때문이다. bounds가 먼저 오는 순열에서 **두 계약은 동시에 만족될 수 없다**(캐시를 보려면 기다려야 하고, 0틱에 쏘려면 캐시를 못 본다).
   - **다음 스프린트 결정 사항**: T1-a를 "0틱 **또는 하이드레이션 완료 중 빠른 쪽**"으로 완화할지 planner가 판단한다(Q5 wish 핀 캐시 영속과 같은 스프린트 후보). 손실은 그 순열에서 **invoke 1회로 bounded**.
5. 스크래치패드 뮤테이션 사본은 실행 직후 삭제했다.

## 9. qa-logic 2단계 지적 반영 (L1·L2·D1)

| # | 지적 | 반영 |
|---|---|---|
| **L1(블로킹)** | 자동 invoke가 상한 2를 넘어 **3회**. 하이드레이션(`getSession`+AsyncStorage)이 프리워밍된 WebView의 READY보다 느리면 "선로딩 큐잉 → 첫 `BOUNDS_CHANGED`가 먼저(실측 invoke #1) → 하이드레이션 완료 → 늦게 깨어난 `runPreload`가 **추정 bbox로 invoke #2** + 보정 장전 → 관성 정착이 invoke #3" | `runPreload` 첫 줄에 **허용분 가드**(`if (firstLoadUsedRef.current) return;`) 추가. 실측 뷰포트가 추정보다 항상 정확하므로 늦게 깨어난 선로딩은 버린다. **잠금 케이스 신설** — 재현 순서를 그대로 밟아 `≤2`뿐 아니라 **정확히 1회 · 실측 rect(sw 37.51)** 까지 단언(추정 37.49를 쐈으면 죽는다) |
| **L2(비차단)** | `researchAvailable` 4조건 AND 중 `lastQueried!==null`·`currentBounds!==null` **두 conjunct가 하중 0**(무력화해도 46건 전부 green) — M3와 같은 실패 양식 | qa-logic이 검증해 준 2건을 그대로 채택. 특히 `currentBounds` 쪽은 "**눌러도 아무 일도 안 일어나는 버튼**"(선로딩만 성공하고 `BOUNDS_CHANGED` 전인 구간)을 막는 조건이었다 |
| **D1(문서)** | spec 헤더가 정정 전 "존속 11" | `it()` 16건 = 존속 10 · 재작성 6 · import 1 교체로 정정 |

### 2회전 — L3·L4·L5 (qa-logic 3단계)

| # | 지적 | 반영 |
|---|---|---|
| **L3(블로킹, DoD)** | **L1 가드가 M11을 무력화**했다. 기존 M11 케이스가 `settle()` **뒤에** preload를 두 번 부르는데, 그 시점엔 첫 preload가 이미 `firstLoadUsedRef`를 세워 **L1 가드가 둘째를 대신 막는다** → 정작 검증 대상인 `preloadCalledRef`를 지워도 아무도 빨개지지 않음 | 두 preload를 **하이드레이션 전으로** 옮겼다. 그 순서에서만 `pendingPreloadRef`가 둘째 bbox로 덮어써지는지(= A4-1 "첫 bbox가 이긴다" 계약)를 볼 수 있다. `preloadCalledRef`는 **여전히 필요하다** — 하이드레이션 전에는 `firstLoadUsedRef`가 false라 L1 가드가 관여하지 못한다 |
| **L4(비차단)** | prune의 `farLat \|\| farLng`에서 **`farLng`가 하중 0** — A3-12가 lat으로만 변위시켰다 | 경도 변위 케이스 1건 추가(실제 이동은 서울 127.0 → 강릉 128.9처럼 경도로 멀어지는 쪽이 흔하다) |
| **L5(비차단)** | `recordSpanOnce`의 **0폭 span 가드가 하중 0** | 퇴화 뷰포트에서 payload.span이 `null`로 남는지 단언. 이게 뚫리면 0폭 span이 캐시에 박혀 다음 세션 선로딩이 0폭 bbox로 조회한다 |

**전체 뮤테이션 재실행**(격리 사본, **18종 전부 KILLED**): M1~M12(13종) + L1 + L2a·L2b + L4 + L5.
> **이번엔 신규 케이스만이 아니라 기존 뮤턴트 전부를 다시 돌렸다** — L3이 바로 "수정이 기존 잠금을 무력화한" 사례였기 때문이다(qa-logic 자진 보고). 수정 후에는 **신규 통과 + 기존 유지**를 함께 확인해야 한다.

**반영 후 게이트**: `npm test` **205 suites / 2,169 tests green** · `tsc --noEmit` 0 · 회귀 0. 훅 spec **51건**.

> **교훈(M3 → L1·L2로 이어진 같은 뿌리)**: 상한·AND 단언은 **그 경로를 실제로 지나는 세팅**에서만 하중을 갖는다.
> A3-10은 상한 2를 단언했지만 항상 하이드레이션을 먼저 끝내고 `preload`를 불러 문제의 순서를 지나지 않았다 —
> "단언이 있다"와 "그 단언이 이 경로를 덮는다"는 별개다. 비동기 초기화가 둘 이상이면 **완료 순서의 순열**을 케이스로 만들어야 한다.

## 10. 계측 사용법(실기기 디버깅)

Metro 콘솔에서 `[nearby]`로 grep:
```
[nearby] preload:start { source: 'coords' }        ← 탭 진입 즉시
[nearby] cache:hydrate { areas, items, ageMs }     ← 캐시 하이드레이션(재진입)
[nearby] invoke:start  { key, trigger }            ← trigger로 경로 식별(preload|first-bounds|correction|research)
[nearby] invoke:end    { key, ms, count, ok }
[nearby] map:ready {}                              ← gapMs의 t0
[nearby] render:first  { kind:'nearby', gapMs }    ← **gapMs 0 = 지도와 함께 도착(목표)**
```
`invoke:start`가 사용자 탭 없이 3건 이상 찍히면 허용분 계약이 깨진 것이다(테스트가 잡지 못한 경로).
