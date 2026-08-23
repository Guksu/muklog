# QA 리포트 — 로직·통합 정합성 (map-pin-loading)

- **작성일**: 2026-08-20
- **검증자**: qa-logic
- **기준 문서**: `plan.md`(§4 계약 · §4.5 처분표 · §8 경계면 B1~B12 · §10 비용 C1~C9 · 뮤턴트 M1~M12) · `ui-spec.md` §3.3·§4
- **범위**: 로직·통합·보안·비용·TDD·컨벤션. **비주얼 충실도는 qa-visual 담당(본 리포트 대상 아님)**
- **진행 방식**: 단계적 검증. 1단계 = W0~W2 모듈 · **2단계 = W3~W4 + 전량 게이트**(완료)

---

## 0. 최종 판정 — ✅ **PASS (로직 완료)**

**정본 지문(4단계 · 확정)**: `useNearbyPlaces.spec.ts = 0cd1f24081eaeecfeec56dea35752c8c` 외 7종 무변경. 검증 전후 재측정해 불변 확인.

| 구분 | 결과 |
|---|---|
| 인수조건 A0-1~A4-6 | **전부 테스트 커버 · 통과** |
| 경계면 B1~B12 | **전부 통과** |
| 비용 C1~C9 | **전부 테스트로 잠김** |
| 뮤턴트 | **21종 전량 killed**(M1~M12 + L1·L2a·L2b·L3(M11) + L4 2축 + L5 + AND 스윕 3) |
| `npm test` | **205 suites / 2,169 tests green** |
| `npx tsc --noEmit` | **exit 0** |
| 폐기 심볼 잔재 | **0건** |
| diff 0 계약(mapHtml·searchNearby·accumulateNearbyItems·initialRegion·Edge) | **전부 diff 0** |
| 미해결(이월) | **L6 1건**(계약 상충 — 리더 이월 승인) |

### 최종 뮤테이션 (4단계, 격리 사본 · 정본 무접촉)

```
M1_allowance         → 11 failed / 51    M11_preload_reentry → 1 failed / 51  ★회귀 해소
M2_hydrate_order     →  3 failed / 51    M12_flush           → 1 failed / 51
M3_loading           →  1 failed / 51    L1_revert           → 1 failed / 51
M4_error_commit      →  2 failed / 51    L2a_lastQueried     → 1 failed / 51
M8_prune             →  2 failed / 51    L2b_currentBounds   → 1 failed / 51
M9_correction        →  3 failed / 51    L4_prune_lng        → 1 failed / 51  ★신규 잠금
AND_inflight_trigger →  1 failed / 51    L4b_prune_lat       → 1 failed / 51  ★양축 확인
AND_corr_armed       →  3 failed / 51    L5_span_zero        → 1 failed / 51  ★신규 잠금
AND_corr_threshold   →  1 failed / 51
```

`M5`·`M6`·`M7`·`M10`(순수 유틸·저장소·계측)은 해당 모듈 해시가 1단계와 동일해(`bboxDrift` `9d23d0c6` · `nearbyCache` `859b038e` · `nearbyTrace` `57f47c28`) 1단계 killed 결과가 그대로 유효하다.

**특기: L4는 두 축을 모두 확인했다.** `farLng` 제거뿐 아니라 `farLat` 제거도 각각 죽는 것을 확인해, 한 축만 잠그고 다른 축이 비는 상태가 아님을 실증했다.

---

## 0.05 교훈 (리더 지시 — 회고 반영용)

1. **가드를 추가하면 기존 가드의 테스트 하중이 그쪽으로 옮겨 갈 수 있다.** 그래서 수정 검증은 "새 테스트가 통과하는가"가 아니라 **"기존 뮤턴트가 전량 여전히 죽는가"** 까지 한 배치로 돌려야 한다. L3(M11 생존 회귀)이 정확히 그 사례였고, 원인은 **qa-logic이 제안한 L1 가드**였다 — 제안 시 신규 케이스만 검증하고 기존 뮤턴트를 재실행하지 않았다.
2. **N조건 AND에서 한 조건을 검증하려면 나머지 N−1 조건이 전부 참인 상태를 만들어야 한다.** 아니면 다른 조건이 대신 false를 만들어 대상 조건이 하중을 못 받는다(M3 1차 생존 → 같은 뿌리로 L2 2건 추가 발견). **다중조건 판정식은 conjunct 단위로 뮤테이션을 돌리는 것을 기본 절차로 삼을 것.**
3. **OR 판정식은 항(term)마다 변위 축을 따로 만들어야 한다.** L4는 `farLat || farLng`인데 테스트가 lat만 변위시켜 lng 항이 비어 있었다. 실제 이동(서울→강릉)은 경도 우세라 미검증 축이 곧 실사용 축이었다.
4. **상한 단언은 그 경로를 실제로 지나는지 확인해야 한다.** A3-10은 `toBeLessThanOrEqual(2)`를 갖고도 항상 `settle()` 뒤에 preload를 불러 위반 순열(L1)을 지나지 않았다. **단언의 존재 ≠ 경로의 커버.**
5. **비동기 초기화가 둘 이상이면 완료 순서의 순열이 테스트 대상이다.** 이 스프린트의 실결함 L1과 이월 L6은 모두 "하이드레이션 ↔ READY 순서"에서 나왔다. 프리워밍 같은 최적화는 이 순열의 분포를 바꾸므로 **최적화가 버그 확률을 높이는 방향**일 수 있다.

---

## 0.06 이월 (미해결 — 다음 스프린트)

| # | 건 | 판정 |
|---|---|---|
| **L6** | 캐시 보유 area인데 bounds가 하이드레이션보다 먼저 오면 invoke 1회 낭비(상한 위반 아님) | **이월**(리더 승인). 코드 결함이 아니라 **C1(캐시 있으면 invoke 0) ↔ T1-a(첫 조회 0틱)의 계약 상충**이다. 근거·naive fix 반증은 §0.45. **plan §11 Q5(wish 핀 캐시 영속) 다음 스프린트에서 T1-a를 "0틱 또는 하이드레이션 완료 중 빠른 쪽"으로 완화할지와 함께 결정**할 것을 권고한다 |
| D1(§10 D1) | `NEARBY_FALLBACK_SPAN` 실측 교정 | 계획된 이월 — 디바이스 스모크 S9에서 관측 |

---

## 0.1 3단계 판정 기록 (developer 2회차 반영 전) — 조건부

> ⚠ **동결 지문 변경 감지 → 절차대로 재기준선.** 2단계 검증 후 트리가 움직였다(원인: developer가 L1·L2·D1을 반영). 리더 규율("해시가 달라지면 즉시 중단·보고")에 따라 검증을 멈추고 변경 내용을 먼저 특정한 뒤, 새 기준선으로 전량 재검증했다.
>
> | 파일 | 2단계 정본 | 3단계 정본(현재) |
> |---|---|---|
> | `useNearbyPlaces.ts` | `f8657610…` | **`09bf8d8825145657cbeb5fa571c132015`** |
> | `useNearbyPlaces.spec.ts` | `30488a21…` | **`dc76f0df6b1e5d7a0c16c9e163e91117`** |
> | `MapTabScreen.tsx` | `b2d2c55d…` | `b2d2c55d…` (불변) |

### 해소 확인 — L1 · L2 · D1 전부 반영됨 ✅

| 건 | 반영 | 뮤테이션 재검증 |
|---|---|---|
| **L1** 자동 invoke 3회 | `useNearbyPlaces.ts:302` `if (firstLoadUsedRef.current) return;` + 잠금 케이스 `spec:585` "A3-10 하이드레이션이 늦고 첫 BOUNDS_CHANGED가 먼저 와도 자동 invoke ≤2 — L1" | **가드 되돌림 뮤턴트 killed**(1 fail) — 잠금이 실제로 작동한다 ✅ |
| **L2** AND conjunct 2개 하중 0 | `spec:697`·`:709` 2건 추가 | **C2·C3 뮤턴트 각각 killed**(1 fail) ✅ |
| **D1** spec 헤더 주석 | `존속 10 · 재작성 6 · 교체 1`로 정정 | — ✅ |

### 게이트 재실행

`npm test` **205 suites / 2,167 passed**(2단계 2,164 + 신규 3) · `npx tsc --noEmit` **exit 0** · `it()` **49건**(46 + 3).

### ⚠ 남은 DoD 미충족 1건 + 신규 관찰 2건

| # | 건 | 성격 | 차단 |
|---|---|---|---|
| **L3** | **M11 뮤턴트가 생존으로 회귀**(`preloadCalledRef` 가드가 테스트 하중을 잃음) | plan §12 DoD "뮤턴트 M1~M12 전부 killed" **미충족** | **예** |
| L4 | prune의 **lng 축이 미검증**(`farLat \|\| farLng`에서 lng 제거해도 49건 green) | 테스트 공백(E4 절반) | 아니오 |
| L5 | `recordSpanOnce`의 **0폭 span 가드 미검증**(제거해도 49건 green) | 테스트 공백 | 아니오 |

---

## 0.3 L3 (DoD 미차단 불가) — M11 생존 회귀: **내가 제안한 L1 가드의 부작용**

**먼저 밝힌다: 이 회귀의 원인은 내가 제안한 수정안이다.** L1 가드가 기존 M11 테스트를 무력화할 수 있다는 점을 수정안 검증 시 확인하지 못했다.

2단계에서 killed였던 **M11(`preloadCalledRef` 재호출 가드 제거)이 3단계에서 49건 전부 green으로 생존**한다.

**원인**: 기존 M11 케이스는 `await settle()`(하이드레이션 완료) **뒤에** preload를 두 번 부른다. 그 시점엔 첫 preload가 이미 `firstLoadUsedRef`를 세워 놓으므로, 둘째 preload를 막는 것이 `preloadCalledRef`가 아니라 **새로 들어간 L1 가드**다. 즉 원래 가드는 죽여도 테스트가 빨개지지 않는다.

**그런데 `preloadCalledRef`는 여전히 실동작에 필요하다.** 하이드레이션 **전에** preload가 두 번 오면(`pendingPreloadRef` 덮어쓰기) L1 가드는 `firstLoadUsedRef`가 아직 false라 관여하지 못한다. 격리 프로브로 확인했다:

```
preload({37.5}) → preload({38.5}) → (하이드레이션) → settle
  정본  : 호출 rect sw.lat = [37.49]   ← 첫 bbox가 이긴다(옳음)
  뮤턴트: 호출 rect sw.lat = [38.49]   ← 둘째 bbox가 이긴다(계약 위반)
```

실경로다 — `MapTabScreen`의 preload effect는 `[permission.coords, pinsCount]` 의존이라 좌표가 warm→fresh로 승격되면 두 번 발화하는데, 그 승격은 하이드레이션(`getSession` 네트워크 갱신 포함)보다 빠를 수 있다. 이것이 애초에 A4-1이 막으려던 시나리오다.

**수정안(검증 완료)** — 기존 M11 케이스(`spec:592` 부근)의 두 `preload` 호출을 **`await settle()` 앞으로** 옮긴다. 정본에서 통과하고 M11 뮤턴트를 죽이는 것을 확인했다:

```ts
it('M11 preload 2회차 이후는 no-op(좌표 승격으로 재호출돼도 invoke 순증 0)', async () => {
  const { result } = renderHook(() => useNearbyPlaces());
  // ⚠ settle() 앞에서 두 번 부른다 — 하이드레이션 뒤면 L1 가드가 대신 막아
  //    preloadCalledRef가 하중을 못 받는다(qa-logic L3).
  act(() => result.current.preload({ bbox: bounds({ lat: 37.5 }) }));
  act(() => result.current.preload({ bbox: bounds({ lat: 38.5 }) }));
  await settle();
  await settle();
  expect(searchMock).toHaveBeenCalledTimes(1);
  expect(searchMock).toHaveBeenLastCalledWith(bounds({ lat: 37.5 }));
});
```

> **교훈(회고감)**: 가드를 추가하면 **기존 가드의 테스트 하중이 옮겨 갈 수 있다.** 수정안을 낼 때 "새 테스트가 통과하는가"뿐 아니라 **"기존 뮤턴트가 여전히 죽는가"** 를 함께 돌려야 한다. 이번엔 전량 뮤테이션 재실행이 잡아냈다.

## 0.4 L4 · L5 (비차단 테스트 공백)

- **L4 — prune의 lng 축 미검증**: `pruneDistantAreas`(`:214`)는 `farLat || farLng`로 두 축을 보지만, A3-12(`spec:444`)는 **lat만 변위**시킨다(`bounds({ lat: 37.5 + 0.02 * 4 })`). `farLng`를 제거해도 49건이 green이다. 경도로 주로 멀어지는 이동(서울 127.0 → 강릉 128.9)에서 E4(타 도시 핀 오염) 차단이 검증되지 않는다. **권고**: A3-12에 lng 변위 케이스 1건 추가(또는 기존 케이스를 대각선 변위로).
- **L5 — 0폭 span 가드 미검증**: `recordSpanOnce`(`:182`)의 `if (span.lat === 0 || span.lng === 0) return;`을 제거해도 49건 green이다. 퇴화 뷰포트 emit이 그대로 캐시 span으로 박히면 다음 세션 선로딩이 0폭 bbox로 조회한다. 발생 확률은 낮지만 가드가 있는 이유가 그것이다. **권고**: 0폭 bounds로 `setBounds` 후 `saveNearbyCache` payload의 `span`이 null로 남는지 단언.

---

## 0.45 L6 (developer 질의 회신) — 캐시가 있는데도 1회 쏘는 경로: **확인됨. 단, 계약 상충이라 이월 권고**

developer가 "하이드레이션이 캐시 히트로 끝나는데 bounds가 먼저 와서 miss로 invoke가 나가는 경로"를 봐달라고 요청했다. **의심이 정확했다 — 재현된다.**

```
캐시에 area(37.5) 보유 → setBounds(37.5) [하이드레이션 전] → settle
결과: invoke 1회.  items에는 'cached'가 실린다(하이드레이션은 나중에 성공)
기대(C1 정신): invoke 0
```

**상한 위반은 아니다**(자동 invoke ≤2 유지). 순수한 낭비 1회다.

### 왜 "발사 직전 캐시 재확인"으로는 못 고치는가 (naive fix 반증)

`fire()` 첫머리에 `if (areasRef.current.has(key)) { applyCachedArea(...); return; }`를 넣어 검증했다 — **여전히 invoke 1회**다. 0틱 타이머(매크로태스크)가 하이드레이션(`getSession` + AsyncStorage, 실제 I/O)보다 **항상 먼저** 깨기 때문이다. 발사 시점에 `areasRef`는 아직 비어 있다. 프로덕션에서는 레이스가 아니라 **결정적으로** 타이머가 이긴다.

### 진짜 원인 — 두 계약의 상충

| 경로 | 하이드레이션 대기 | 근거 |
|---|---|---|
| `preload` | **대기함**(`pendingPreloadRef` 큐잉) | A3-2·C1이 이 경로로 invoke 0을 얻는다 |
| 첫 `setBounds` | **대기 안 함**(0틱 즉시) | **T1-a**(`spec`)가 `renderHook` 직후 `settle()` **없이** `setBounds`하고 0틱 1회 호출을 단언한다 |

즉 **first-bounds 경로만 하이드레이션 게이팅이 없다.** 이 비대칭이 L6의 정체다. 그런데 게이팅을 넣으면 **T1-a의 "첫 조회는 0틱" 계약이 깨진다**(0620 `nearby-first-load` 스프린트가 세운 계약이고 §4.4 "유지되는 것" 목록에 명시). 두 계약은 bounds가 하이드레이션보다 먼저 오는 순열에서 **동시에 만족될 수 없다** — 캐시를 보려면 기다려야 하고, 0틱에 쏘려면 캐시를 못 본다.

**판정: 이 스프린트에서 고치지 말 것을 권고한다.** 코드 결함이 아니라 **계약 트레이드오프**라 planner 판단이 필요하고(어느 쪽을 포기할지), 이번 스프린트 범위(§3.1) 밖이다. 손실은 그 순열에서 **invoke 1회**로 bounded이고 상한도 안 넘는다. **§8 이월 항목으로 기록**하며, plan §11 Q5의 다음 스프린트 후보(wish 핀 캐시 영속)와 함께 다루기를 권한다 — 그때 T1-a를 "0틱 또는 하이드레이션 완료 중 빠른 쪽"으로 완화할지 결정하면 된다.

---

## 0.5 2단계 판정 기록 (developer 반영 전)

| 구분 | 건수 |
|---|---|
| 통과 | 48 |
| **실패(블로킹)** | **1** — L1 비용 가드레일 B11 위반 |
| 실패(비차단) | 1 — L2 TDD 하중 구멍 |
| 관찰 | 3 |

**스프린트를 "로직 완료"로 표시하지 않는다.** L1은 plan §10·§8 B11이 코드로 강제하기로 한 **자동 invoke 상한 2를 3으로 넘기는** 실경로이며, 재현과 수정안 검증을 모두 마쳤다. L2는 4조건 AND 중 2개가 테스트 하중을 못 받는 구멍으로, 팀 리드가 지시한 **M3 회고 일반화 스윕**에서 나왔다.

### 독립 재실행 게이트 (developer 보고와 대조)

| 항목 | developer 보고 | qa-logic 독립 실행 | 일치 |
|---|---|---|---|
| `npm test` | 205 suites / 2,164 | **205 passed / 2,164 passed** | ✅ |
| `npx tsc --noEmit` | 0 | **exit 0** | ✅ |
| `useNearbyPlaces.spec.ts` | 46 tests | **46** (`it()` 실측) | ✅ |

**동결 지문 8종 전부 일치**(검증 시작·종료 시점 재측정, 소스 무변경). 뮤테이션은 전부 스크래치패드 격리 사본에서 실행해 공유 트리를 건드리지 않았고, 검증 종료 후 스크래치패드를 비웠다.

---

## 0.1 L1 (블로킹) — 자동 invoke 상한 2 위반: 실제로는 3회

**경계면**: B11(비용) · plan §4.4 "첫 조회 허용분" · §5-1 C4(상한 2) · A3-10.

**재현**(격리 프로브, 정본 훅 무수정):

```
1. preload({ bbox: 37.5 })      ← 하이드레이션 resolve 전(A3-2가 보장하는 큐잉 경로)
2. setBounds({ lat: 37.52 })    ← 지도 READY가 하이드레이션보다 빨라 첫 BOUNDS_CHANGED가 먼저 도착
3. (하이드레이션 완료)
4. setBounds({ lat: 38.0 })     ← 사용자 액션 아님(관성·relayout 정착)

결과: 자동 invoke = 3   (호출 rect sw.lat = [37.51, 37.49, 37.99])
       기대 = ≤ 2
```

**원인** — `useNearbyPlaces.ts:297-306` `runPreload`가 **허용분(`firstLoadUsedRef`)을 확인하지 않는다**:

- 2번에서 첫 `setBounds`가 `firstLoadUsedRef`를 소비하며 실제 뷰포트로 invoke #1을 발사한다(`:331-334`).
- 3번에서 하이드레이션이 끝나면 큐잉된 `runPreload`가 **무조건** 실행돼 invoke #2를 쏜다. 이미 실측 뷰포트로 조회한 뒤라 **추정 bbox 조회는 낭비**다(지도가 보고 있지 않은 37.49를 조회).
- 게다가 `runPreload`가 `correctionArmedRef = true`(`:304`)로 **보정 1회권을 장전**해, 4번의 정착 이동이 invoke #3을 부른다.

**실경로 도달성**: `MapTabScreen.tsx:164-183`이 `[permission.coords, pinsCount]` effect에서 preload를 쏘므로 coords가 warm이면 마운트 즉시 발사된다. 한편 하이드레이션은 `supabase.auth.getSession()`(만료 토큰이면 **네트워크 갱신**) + AsyncStorage 읽기다. 따라서 **프리워밍된 WebView(빠른 READY) + 만료 세션(느린 getSession)** 이면 이 순서가 성립한다 — `MapPrewarm`이 READY를 앞당길수록(0619 스프린트 −63%) 오히려 **더 잘 발생**한다.

**수정안(검증 완료)** — `useNearbyPlaces.ts:297` `runPreload` 첫 줄에 가드 3줄:

```ts
const runPreload = ({ bbox }: { bbox: Bounds }): void => {
  // 허용분이 이미 첫 setBounds에 소비됐다면(=실제 뷰포트로 조회 완료) 추정 bbox 선로딩은 불필요하고,
  //   보정을 장전하면 자동 invoke가 3회가 된다(상한 2 위반). 실측 뷰포트가 추정보다 항상 정확하다.
  if (firstLoadUsedRef.current) return;
  const span = spanRef.current;
  ...
```

격리 사본에 적용해 확인했다: **프로브 3 → 1회**, 정본 spec **46건 전부 green 유지**(회귀 0). A3-2·A3-3·A3-9·A3-10·C1~C4는 전부 `settle()`로 하이드레이션을 먼저 끝내므로 영향받지 않는다.

**권고 잠금 테스트**: 위 재현 순서를 그대로 케이스화해 `expect(searchMock.mock.calls.length).toBeLessThanOrEqual(2)`로 잠근다. 현재 A3-10은 항상 `await settle()` **후에** `preload`를 호출해 이 순서를 만들지 못한다(`spec:563-579`) — 상한 단언은 있으나 **이 경로를 지나지 않는다**.

---

## 0.2 L2 (비차단, TDD) — `researchAvailable` 4조건 AND 중 2개가 하중 0

팀 리드 지시 ⑤(**M3 회고 일반화**: "4조건 AND의 한 조건을 검증하려면 나머지 3조건이 전부 참이어야 한다")에 따라 `useNearbyPlaces.ts:408-412`의 네 conjunct를 각각 무력화해 스윕했다.

| conjunct | 뮤턴트 | 결과 |
|---|---|---|
| `status !== 'loading'` | `true`로 치환 | **killed** (1 fail) ✅ M3 수정 확인 |
| `lastQueried !== null` | 제거(널이면 퇴화 bbox → Infinity) | **생존 — 46건 전부 green** ❌ |
| `currentBounds !== null` | 제거(널이면 퇴화 bbox) | **생존 — 46건 전부 green** ❌ |
| `exceedsResearchThreshold(...)` | `true`로 치환 | **killed** (3 fail) ✅ |

즉 **M3가 지적한 구멍이 같은 AND의 다른 두 조건에 그대로 남아 있다.** 두 조건이 막던 실제 결함:

- `lastQueried !== null` 제거 시 — 이 마운트에서 **적용된 조회가 0건인데도 버튼이 뜬다**(예: 첫 조회가 실패해 `lastQueried`가 끝내 null인 상태).
- `currentBounds !== null` 제거 시 — 뷰포트 미수신 상태에서 버튼이 뜨는데, `research()`는 `currentBoundsRef`가 null이라 **no-op**이다(`:320-321`) → **눌러도 아무 일도 안 일어나는 버튼**. 선로딩만 성공하고 BOUNDS_CHANGED가 아직 안 온 구간에서 성립한다.

**권고 테스트 2건(검증 완료)** — 정본 훅에서 통과하고 두 뮤턴트를 각각 죽이는 것을 확인했다(정본 48/48 green · C2 뮤턴트 1 fail · C3 뮤턴트 1 fail):

```ts
it('조회 전에는 뷰포트를 받아도 researchAvailable=false(lastQueried 조건 하중) — C2', async () => {
  searchMock.mockRejectedValue(new Error('net'));
  const { result } = renderHook(() => useNearbyPlaces());
  await settle();
  act(() => result.current.setBounds(bounds({ lat: 37.5 })));
  await settle();
  expect(result.current.status).toBe('error');
  act(() => result.current.setBounds(bounds({ lat: 40.0 })));
  expect(result.current.researchAvailable).toBe(false);
});

it('뷰포트 미수신이면 선로딩이 성공해도 researchAvailable=false(눌러도 no-op인 버튼 방지) — C3', async () => {
  const { result } = renderHook(() => useNearbyPlaces());
  await settle();
  act(() => result.current.preload({ bbox: bounds({ lat: 37.5 }) }));
  await settle();
  expect(searchMock).toHaveBeenCalledTimes(1);
  expect(result.current.researchAvailable).toBe(false);
});
```

---

## 1단계 요약 (W0~W2)

| 구분 | 건수 |
|---|---|
| 통과 | 26 |
| 실패 | **0** |
| 관찰(비차단) | 2 |
| 미검증(2단계 이월) | W3·W4 전 항목 + B1·B2·B4·B6·B11 |

**1단계 판정: PASS (블로킹 이슈 0).** 완료 모듈 4종의 spec 55건 전량 green이고, 이 단계에서 검증 가능한 뮤턴트 4종(M5·M6·M7·M10)이 **전부 killed**되어 단언이 하중을 갖는 것을 실증했다.

### 실행 결과

```
npx jest src/features/map/{nearbyTrace,bboxDrift,nearbyPreloadBbox,nearbyCache}
→ Test Suites: 4 passed / Tests: 55 passed        (2026-08-20)

npx jest src/features/map/components/MapResearchButton
→ Test Suites: 1 passed / Tests: 6 passed
```

> 경합 규율 준수: 1단계 jest 실행은 완료 모듈 경로로 한정했다. 전체 스위트(`npm test`)·`tsc --noEmit`는 developer의 W3~W4 작업이 진행 중이라 **2단계 종료 판정에서만** 실행한다. developer가 수정 중인 `useNearbyPlaces.ts`·`MapTabScreen.tsx`는 읽기만 했다.

---

## 2. 경계면 교차검증 (양쪽 동시 읽기)

### B3 `nearbyCache` ↔ `pinsCache` — 이번 스프린트 유일한 보안면 ✅ 통과

생산자/소비자가 아니라 **선례 대조**다. `pinsCache.ts`와 `nearbyCache.ts`를 나란히 읽어 5개 규율을 축별로 확인했다.

| 규율 | `pinsCache.ts` | `nearbyCache.ts` | 판정 |
|---|---|---|---|
| userId 키잉 | `muklog:map-pins:v1:{userId}` (:22-23) | `muklog:map-nearby:v1:{userId}` (:43-44) | ✅ 동일 규율 · **네임스페이스 비충돌** |
| 빈 userId no-op | `load` `if (!userId) return null` (:51) · `save` `if (!userId) return` (:78) | `load` (:100) · `save` (:139) — 동일 위치·동일 형태 | ✅ |
| 버전 태깅 | `version !== PINS_CACHE_VERSION → null` (:56) | `version !== NEARBY_CACHE_VERSION → null` (:106) | ✅ |
| 조용한 miss | `try/catch → null` (:52-62) | `try/catch → null` (:101-123) | ✅ |
| no-throw 쓰기 | `catch {}` 흡수 (:82-84) | `catch {}` 흡수 (:145-147) | ✅ |

**키 충돌 검증은 두 키를 동시에 단언**해 잠겨 있다 — `nearbyCache.spec.ts:67-71`이 `pinsCacheKey`를 실제로 import해 정확 문자열(`toBe`)과 상호 불일치(`not.toBe`)를 함께 단언한다. 접두사 세그먼트(`map-pins` vs `map-nearby`)가 달라 어떤 userId 조합에서도 교차 접근이 성립하지 않는다.

**`nearbyCache`가 선례보다 강화한 지점(퇴행 아님)**: `pinsCache`의 좌표 검증은 `typeof === 'number'`(:35-36)라 `NaN`을 통과시키는 반면, `nearbyCache`는 `Number.isFinite`(:47-48)로 막는다. 캐시된 좌표가 `NaN`이면 지도 마커가 사라지므로 강화가 옳다.

### B5 `nearbyPreloadBbox` ↔ `initialRegion` ✅ 통과

**`initialRegion`은 무수정이다** — `git status`에 없다(untracked·modified 어느 쪽도 아님). 계약대로 diff 0.

센터 우선순위 일치가 **테스트로 잠겨 있다**: `nearbyPreloadBbox.spec.ts:50-64`가 `initialRegion`을 실제로 import해 3케이스(coords+먼 핀 / coords 없음+핀 2개 / 핀 1개)에서 **bbox 중심 == initialRegion 센터**를 대조한다. 우선순위가 뒤바뀌면(핀 우선) 케이스 1에서 즉시 빨개지는 하중 있는 단언이다.

`DEFAULT_REGION`(서울시청) 폴백 구간만 의도적으로 갈라진다 — `initialRegion`은 서울시청을 반환하고 `nearbyPreloadBbox`는 `null`(선로딩 스킵)이다. plan §4.2가 명시한 설계이며 spec:46-48이 잠근다.

**관찰 O1(비차단)**: 비유한 입력에서 두 함수가 갈라진다. `coords: {lat: NaN}`이면 `initialRegion`은 NaN 센터를 그대로 반환하는 반면 `nearbyPreloadBbox`는 `null`을 낸다(`nearbyPreloadBbox.ts:53`). 결과는 "선로딩 스킵 → 첫 `BOUNDS_CHANGED`가 실제 뷰포트로 조회"라 **안전한 강등**이고 비용도 늘지 않는다. `initialRegion` 무수정 계약이 있으므로 수정 요청 아님 — 기록만 남긴다.

### B8 `nearbyTrace` ↔ 프로덕션 번들 ✅ 통과

`nearbyTrace.ts:44`의 `if (!__DEV__) return;`이 유일한 게이트이고 그 뒤에 `console.log` 1개만 있다. 모듈 전역에 타이머·리스너·구독·전역 상태 0.

정적 규율이 **문자열 단언 함정을 피해** 잠겨 있다: `nearbyTrace.spec.ts:100-105`가 `console.` 등장 횟수를 `toHaveLength(1)`로 **개수로** 고정하므로, 가드 밖에 로그를 추가하면 단언이 깨진다(단순 `toContain`이었으면 통과했을 자리다). A0-1은 `log/info/warn/error/debug` **5채널 전부**를 감시해 한 채널만 보는 함정도 피했다.

### B9 `MapPrewarm` ↔ 선로딩 (E17) ✅ 통과

`MapPrewarm.tsx`의 import는 `MapWebView`·`mapHtml`·`env`·`useDeferredFlag`뿐이다. `useNearbyPlaces`·`nearbyPreloadBbox`·`searchNearby` **import 0건** — 프리워머가 nearby 조회를 트리거하지 않는 정적 규율이 유지된다.

### B7 `searchNearby` ↔ Edge `nearby-search` ✅ 통과 (diff 0)

`git diff --stat`이 `mapHtml`·`searchNearby`·`accumulateNearbyItems`·`initialRegion`·`supabase/functions/nearby-search` 전부에서 **빈 출력**이다. 계약 4.0의 "무변경" 목록이 현재까지 지켜진다. (2단계에서 W3~W4 작업 종료 후 재확인한다.)

### B10 `MapResearchButton` ↔ `MapTabScreen` — 로직면만 ✅ 통과

컴포넌트가 **자기 노출 조건을 모른다**: `MapResearchButtonProps`는 `{ onPress, testID }`뿐이고 `visible`이 없다(`MapResearchButton.tsx:32-37`). spec이 이 부재를 명시 케이스로 잠갔다. 배치·간섭 판정은 qa-visual 소관이며 **본 리포트에서 다루지 않는다**. 실제 조건 렌더 배선(`researchAvailable`)은 W4 항목이라 2단계 이월.

---

## 3. 인수조건 대비 — "존재"가 아니라 "의미"

각 spec이 껍데기가 아닌지 **뮤테이션으로 실증**했다. 격리 사본은 `src/` 밖 스크래치패드에 두고 `--roots`/`--modulePaths`로 실행한 뒤 즉시 삭제했다(공유 트리 무접촉 — 프로젝트 소스 수정 0).

| 뮤턴트 | 변형 | 결과 | 죽인 케이스 |
|---|---|---|---|
| **M5** | `exceedsResearchThreshold`를 `shift`만으로 판정(zoom 무시) | **killed** (3 fail / 16) | A2-2 줌 2배 · 임계 경계값 · 줌아웃 대칭 |
| **M6** | `nearbyCache`의 `userId` 가드 제거 | **killed** (1 fail / 20) | A1-1 빈 userId no-op |
| **M7** | TTL 초과 시 `span`까지 폐기 | **killed** (1 fail / 20) | A1-3 부분 폐기 |
| **M10** | `traceNearby`의 `__DEV__` 가드 제거 | **killed** (2 fail / 10) | A0-1 · A0-3 정적 규율 |

> M6에서 A1-4(계정 격리)는 살아남았다 — 가드를 지워도 키에 userId가 남아 교차 노출은 생기지 않기 때문이며, 예상된 결과다. A1-1이 단독으로 가드를 잠근다.

M1·M2·M3·M4·M8·M9·M11·M12는 `useNearbyPlaces`·`MapTabScreen` 뮤턴트라 **2단계(동결 확인 후)** 로 이월한다.

### A0~A2 인수조건 커버리지

| 인수조건 | 대응 spec | 판정 |
|---|---|---|
| A0-1 `__DEV__=false` 20회 → console 0 | `nearbyTrace.spec.ts:26-37` (5채널) | ✅ M10로 하중 실증 |
| A0-2 `invoke:end` 페이로드 | `:39-50` | ✅ |
| A0-3 타이머·리스너 0 | `:90-105` (개수 고정) | ✅ M10로 하중 실증 |
| A1-1 빈 userId no-op | `nearbyCache.spec.ts:87-93` | ✅ M6로 하중 실증 |
| A1-2 조용한 miss 7종 | `:124-192` (키없음·파싱·버전·비배열·area형·item형·getItem throw) | ✅ |
| A1-3 TTL 부분 폐기 | `:196-205` | ✅ M7로 하중 실증 |
| A1-4 계정 격리 | `:95-99` | ✅ |
| A1-5 setItem reject 흡수 | `:101-104` | ✅ |
| A1-6 키 형식·비충돌 | `:67-71` (정확 문자열 + pinsCacheKey 대조) | ✅ |
| A2-1 0.3배 false / 0.4배 true | `bboxDrift.spec.ts:89-92` | ✅ |
| A2-2 줌 2배 true / 1.5배 false | `:108-119` | ✅ M5로 하중 실증 |
| A2-3 퇴화 bbox Infinity·NaN 0 | `:66-80`, `:127-130` | ✅ |
| A2-4 센터 우선순위 3분기 | `nearbyPreloadBbox.spec.ts:28-48` | ✅ |
| A2-5 span 일치·정렬·극단 좌표 | `:66-84` | ✅ |

**계획을 넘어선 보강 3건**(완화가 아니라 강화): 임계 **경계값 포함**(`>=`) 확인(`bboxDrift.spec.ts:94-106`) · 구 `NEARBY_MIN_MOVE`(1e-3) 크기 이동이 버튼을 켜지 않음(`:136-141`, 처분표 #10의 의도 승격을 신규 심볼 위에서 재확인) · `savedAt` 미래값·비숫자(E18) 분기(`nearbyCache.spec.ts:179-182`, `:216-223`).

---

## 4. 비용 가드레일 (1단계 범위)

- **AWS**: 미사용 ✅
- **네트워크**: 신규 모듈 4종 전부 네트워크 0. `nearbyCache`는 로컬 AsyncStorage I/O만 ✅
- **저장소 상한**: `saveNearbyCache`가 `slice(-NEARBY_CACHE_AREA_CAP)`로 **쓰기 시점에** cap을 강제한다(`nearbyCache.ts:142`) — 호출부가 어떻게 쌓든 ≈24KB 상한이 지켜진다. spec:112-121이 최고참 퇴출·최신 유지를 함께 단언 ✅
- **타이머·리스너 순증**: 1단계 모듈 0개 ✅ (`nearbyTrace` 정적 단언으로 잠금)
- **키 노출**: 신규 모듈에 Kakao/Supabase 키 참조 0건 ✅

C1~C9(invoke 횟수 상한)는 `useNearbyPlaces` 항목이라 **2단계 이월**.

---

## 5. 코드 컨벤션 (`docs/code-convention.md`) — 1단계 모듈

| 항목 | 결과 |
|---|---|
| `useCallback`/`useMemo` 실제 호출 | **0건** (신규 4모듈 + `MapResearchButton`) ✅ |
| `export function` 컴포넌트/훅 | **0건** — 전부 `export const … = () => {}` ✅ |
| named-object 인자 | 전 함수 준수. `pins.map((p) => p.lat)` 등 배열 콜백만 예외(규약 허용) ✅ |
| enum-style `as const` | `NearbyTraceEvent`·`NearbyInvokeTrigger` (`nearbyTrace.ts:10-30`) ✅ |
| 파일명 = 대표 심볼 | 4모듈 전부 일치, `index.ts` 배럴 존재 ✅ |
| 토큰 경유 | `MapResearchButton`이 `theme.color.surface`·`radius.full`·`shadow.fab` 경유, raw hex 0 ✅ |

**관찰 O2(비차단, W3 대상)**: `useNearbyPlaces.ts:42`가 로컬 `type Bounds = { sw: Coords; ne: Coords }`를 여전히 자체 정의한다. plan §4.1이 `bboxDrift`를 `Bounds`의 단일 출처로 승격했으므로, W3 재작성 시 로컬 정의를 지우고 `import { type Bounds } from '../bboxDrift'`로 교체하는 편이 낫다. 구조적 타이핑 덕에 지금은 컴파일이 통과하지만, 두 정의가 갈라지면 `nearbyCache`(`bboxDrift`의 `Bounds` 사용)와의 경계가 조용히 어긋난다. developer에게 전달함.

---

## 6. 2단계 이월 (미검증 — 통과로 처리하지 않음)

| 항목 | 사유 |
|---|---|
| W3 `useNearbyPlaces` A3-1~A3-15 | 구현 진행 중(task #3) |
| W4 `MapTabScreen` A4-1~A4-6 | 미착수 |
| B1 반환 shape ↔ 화면 배선 | W3·W4 완료 후 |
| B2 이중 emit ↔ `setBounds`(C9) | 〃 |
| B4 캐시 ↔ 하이드레이션(TTL·cap·prune·flush) | 〃 |
| B6 §4.5 처분표 이행(존속 11 무수정·재작성 6·완화 0) | 〃 |
| B11 C1~C9 상한 · 자동 invoke ≤2 | 〃 |
| 뮤턴트 M1·M2·M3·M4·M8·M9·M11·M12 | 소스 동결 후 |
| 폐기 심볼 잔재 0 | 현재 `useNearbyPlaces.spec.ts`가 `NEARBY_DEBOUNCE_MS`를 여전히 참조(W3 재작성 대상이라 정상 진행 중) |
| `npm test` 전량 · `tsc --noEmit` | 경합 회피 — 2단계 종료 판정에서 1회 |
| 디바이스 스모크 S1~S9 | 실기기 단독 권위 — 로직 QA 범위 밖 |

---

## 7. 2단계 준비 — B6 판정 기준선 (git HEAD 실측)

W3 착수 전 `useNearbyPlaces.spec.ts`의 HEAD 상태를 실측해 §4.5 처분표의 판정 기준선을 고정했다(읽기 전용, developer 작업 무간섭). 2단계에서는 `git diff HEAD -- src/features/map/useNearbyPlaces/useNearbyPlaces.spec.ts`로 케이스별 이행을 대조한다.

### P1 — plan §4.5 요약 행의 산술 오류 (계획 결함, 비차단)

```
HEAD it() 케이스 수                : 16
plan §4.5 표의 '존속' 행 수        : 10
plan §4.5 표의 '재작성' 행 수      : 6
plan §4.5 표의 '교체' 행 수        : 1
```

plan §4.5는 표 아래에서 **"→ 존속 11 · 재작성 6 · 삭제 0."** 이라고 요약하지만, 표의 실제 행을 세면 **존속 10 · 재작성 6 · 교체 1**(합 17)이다. 원인은 17번 행(`spec import NEARBY_DEBOUNCE_MS` → **교체**)이 요약에서 존속 쪽으로 합산된 것으로 보인다. 17번은 `it()` 케이스가 아니라 **import 문 1행**이므로 "무수정 존속" 대상이 될 수 없다(폐기 심볼이라 반드시 바뀐다).

**B6의 검증 가능한 정확한 불변식**:
- `it()` 케이스 **16건** 중 **10건 무수정 존속** · **6건 재작성**(동등 이상 강도, 완화 0)
- import 1행은 신규 상수로 **교체**
- 케이스 총수는 **감소하지 않는다**(재작성으로 늘어나는 것은 허용)

**후속 — ✅ 해결(2026-08-20, sprint-planner)**. plan이 4곳 전부 정정된 것을 grep으로 확인했다. 리더 지시는 §4.5·§12 두 곳이었으나 같은 숫자가 §6 W3(개발 지시)·§8 B6(QA 판정 기준)에도 있어 planner가 범위를 넓혀 고쳤다.

| 위치 | 정정 후 | 확인 |
|---|---|---|
| §4.5 요약 (`plan.md:265`) | `존속 10 · 재작성 6 · 교체 1 · 삭제 0` | ✅ |
| §6 W3 개발 지시 (`:349`) | `it() 16건 = 존속 10 무수정 + 재작성 6, import 1행 교체` | ✅ |
| **§8 B6 판정 기준 (`:464`)** | `it() 16건 중 존속 10 무수정, 재작성 6 동등 이상 강도, 완화 0` | ✅ **본 리포트의 대조 기준값** |
| §12 DoD (`:523`) | 동일 문구로 정정 | ✅ |

`grep -n "존속 11" plan.md` → **1건**, §13 R1 개정 이력이 옛 값을 인용한 줄뿐이다(감사 추적상 의도적 보존). 본문 잔재 0. 계약·인수조건 변경은 0이므로 1단계 판정에 영향 없다.

### 재작성 6건의 "완화 0" 판정 기준 (sprint-planner 인계)

2단계 B6에서 재작성본을 완화로 오판하지 않기 위한 기준을 기록해 둔다.

- **#4·#5·#8은 "500ms 후 호출된다" → "어느 시점에도 호출 0"** 으로 바뀐다. 단언 문장만 보면 약해 보이지만 **실제로는 강화**다 — "호출 0"은 **타이머를 전부 소진시킨 뒤**에야 성립하므로, 재작성본이 `jest.runAllTimers()`(또는 충분한 `advanceTimersByTime`) 이후에 0을 단언하는지를 확인한다. 타이머를 소진하지 않고 0을 단언하면 그건 진짜 완화다.
- **#7(`T2-b 첫 emit + 60ms 재emit → invoke 1회`)은 필수 존속**이다. `mapHtml`의 0ms/60ms 이중 emit이 그대로 살아 있으므로(diff 0 확인됨), 이 케이스가 빠지면 완화가 맞다.
- 나머지(#1·#10·#11)는 신규 심볼(`researchAvailable`·`exceedsResearchThreshold`) 위에서 같은 불변식을 다시 잠그는지 확인한다.

### 존속 10건(무수정이어야 하는 케이스) — HEAD 라인 기준

| 처분표 # | HEAD 라인 | 케이스 |
|---|---|---|
| 2 | `:51` | T1-a 첫 조회는 0틱 |
| 3 | `:63` | T1-b 동기 즉시가 아니라 0틱 |
| 6 | `:111` | T2 첫 진입 idle 다발 3회 → 정확히 1회 |
| 7 | `:124` | T2-b 첫 emit + 재emit → 1회 (**필수 존속** — mapHtml 이중 emit 생존) |
| 9 | `:167` | 캐시 동일 bbox 재 setBounds → 0회 추가 |
| 12 | `:216` | 레이스: stale 응답 폐기 |
| 13 | `:242` | T2 누적 합집합(kakaoPlaceId dedup) |
| 14 | `:260` | T3 캐시 히트도 누적 합류 |
| 15 | `:283` | T4 에러 시 누적 유지 + status=error |
| 16 | `:303` | T5 cap 초과 LRU 퇴출 |

### 재작성 6건(동등 이상 강도 확인 대상) — HEAD 라인 기준

| 처분표 # | HEAD 라인 | 기존 → 재작성 후 잠글 불변식 |
|---|---|---|
| 1 | `:38` | 디바운스 1회 호출 → **0틱** 1회 호출(허용분 소비) |
| 4 | `:74` | 트레일링 500ms 후 호출 → **어느 시점에도 0회** + `researchAvailable === true` |
| 5 | `:92` | 연속 대이동 총 2회 → 추가 invoke **0** + `researchAvailable === true` |
| 8 | `:142` | 디바운스 수렴 1회 → invoke **0**(더 강한 가드레일) |
| 10 | `:188` | 미세 이동 미호출 → 미세 이동은 `researchAvailable`을 **켜지 않는다** |
| 11 | `:203` | 임계 이상 이동 → 호출 → invoke 0 · 버튼 true · `research()` 시 1회 |

### ui-spec §3.3·§4 배선 계약 (2단계 A4-3·A4-4·A4-6 대조표)

| 확인 항목 | 계약값 |
|---|---|
| 조건 렌더 주체 | **부모**(`nearby.researchAvailable`) — 컴포넌트에 `visible` prop 없음 |
| 버튼 testID | `map-research-button` (A4-3이 이 문자열을 단언) |
| 래퍼 testID | `map-overlay-research` |
| 래퍼 `pointerEvents` | **`box-none` 필수** — 없으면 전폭 래퍼가 지도 상단 35pt 띠의 팬·탭을 삼킨다 |
| top 계산 | `insets.top + theme.spacing[56] + theme.spacing[40]` (=96) |
| inset 흡수 방향 | **top 뿐** — 하단(스팟 카드·FAB)에 더하지 않는다(A4-6 `map-headerless` 규율) |
| onPress | `nearby.research` |
| 삽입 위치 | `map-overlay-legend` 블록 **아래**, 상태 오버레이 블록 **위** |

---

## 7.5 2단계 검증 상세 (W3~W4)

### B6 처분표 이행 — ✅ 통과 (developer 판정 요청 건)

developer가 "존속 = 파일 무수정"이 아니라 **"존속 = 단언 불변"** 으로 해석해 달라고 요청한 5건(#9·#12·#13·#14·#15)을 포함해, **존속 10건 전량의 `expect` 문을 HEAD와 기계 비교**했다.

```
[SAME] T1-a 첫 조회는 0틱                 HEAD expect=4  CUR expect=4
[SAME] T1-b 동기 즉시가 아니라 0틱         HEAD expect=2  CUR expect=2
[SAME] T2 첫 진입 idle 다발 3회           HEAD expect=2  CUR expect=2
[SAME] T2-b 첫 emit + 재emit(필수 존속)    HEAD expect=2  CUR expect=2
[SAME] 캐시 동일 bbox 재조회              HEAD expect=3  CUR expect=3
[SAME] 레이스 stale 폐기                  HEAD expect=1  CUR expect=1
[SAME] T2 누적 합집합                     HEAD expect=2  CUR expect=2
[SAME] T3 캐시 히트 합류                  HEAD expect=3  CUR expect=3
[SAME] T4 에러 시 누적 유지               HEAD expect=3  CUR expect=3
[SAME] T5 cap LRU 퇴출                    HEAD expect=3  CUR expect=3
```

**10건 전부 `expect` 문이 바이트 단위로 동일**하다(개수·내용 모두). 바뀐 것은 구동 수단뿐이고, 단언 수 감소·조건 약화는 0이다. **developer의 주장을 인정한다 — 완화 0.**

다만 "단언 텍스트 불변"은 필요조건이지 충분조건이 아니므로(구동 수단이 바뀌면 같은 문장이 다른 경로를 지날 수 있다), **뮤테이션으로 하중을 재확인**했다. 재작성 6건이 실제로 강화됐는지도 sprint-planner가 인계한 기준(#4·#5·#8의 "호출 0"은 타이머를 전부 소진한 뒤 단언해야 성립)으로 확인했다 — `spec:150-190`·`:225-248`이 `jest.advanceTimersByTime(10_000)` 등으로 타이머를 소진한 뒤 0을 단언한다. ✅

### 뮤테이션 — plan M1~M12 전량 독립 확인 (12/12 killed)

전부 **스크래치패드 격리 사본**에서 정본 spec을 재조준해 실행했다(공유 트리 무접촉, 정본 해시 불변 확인).

| 뮤턴트 | 변형 | 결과 |
|---|---|---|
| M1 | `setBounds` 허용분 가드 제거 | **killed** (10 fail) |
| M2 | 하이드레이션 ↔ 선로딩 순서 뒤집음 | **killed** (2 fail) |
| M3 | `researchAvailable`에서 `status!=='loading'` 제거 | **killed** (1 fail) |
| M4 | `research()` 실패 시에도 `lastQueried` 갱신 | **killed** (1 fail) |
| M5 | `exceedsResearchThreshold`를 shift만으로 판정 | **killed** (1단계, 3 fail) |
| M6 | `nearbyCache` userId 가드 제거 | **killed** (1단계, 1 fail) |
| M7 | TTL 초과 시 span까지 폐기 | **killed** (1단계, 1 fail) |
| M8 | prune(span 3배) 제거 | **killed** (1 fail) |
| M9 | 보정 조회 1회 제한 제거 | **killed** (3 fail) |
| M10 | `traceNearby`의 `__DEV__` 가드 제거 | **killed** (1단계, 2 fail) |
| M11 | `preload` 재호출 가드 제거 | **killed** (1 fail) |
| M12 | 쓰기 디바운스 flush를 취소로 변경 | **killed** (1 fail) |

계획된 M표는 전부 죽는다. **다만 M표에 없던 두 뮤턴트(L2의 C2·C3)가 생존**했다 — M표 자체가 4조건 AND를 한 조건만 다뤘기 때문이며, 이것이 L2의 요지다.

### B3 계정 격리 — ✅ 통과 (캐시 + 훅 양쪽)

1단계에서 `nearbyCache` 자체를 확인했고, 2단계는 **훅의 `userIdRef` 소비 측**을 봤다.

| 경로 | 코드 | 판정 |
|---|---|---|
| 읽기 | `const cached = userId ? await loadNearbyCache({ userId }) : null;` (`:366`) | ✅ userId 없으면 **호출 자체를 안 한다** |
| 쓰기(즉시) | `persistCache`가 `if (!userId) return` (`:146-147`) | ✅ |
| 쓰기(디바운스) | `scheduleCacheWrite`가 `if (!userIdRef.current) return` (`:161`) | ✅ 타이머조차 걸지 않는다 |
| 세션 실패 | `catch { userId = '' }` (`:360-362`) → 캐시 미접촉, 조회는 진행 | ✅ E6 정합 |

`areasRef`는 훅 인스턴스 지역 상태라 계정 전환 시 언마운트로 소멸한다 — 타 계정 핀이 메모리로도 새지 않는다. spec `:476-498`이 "세션 없음이면 읽지도 쓰지도 않는다"와 "getSession throw해도 조회는 진행"을 잠근다. **이번 스프린트 유일 보안면은 양쪽 모두 통과.**

### B4 캐시 ↔ 하이드레이션 — ✅ 통과

TTL 부분 폐기(`:368-370` — `cached.span`은 싣고 만료 시 `areas`는 빈 배열), cap 재적용(`foldAreas`가 `accumulateNearbyItems`에 `cap` 전달, `:138-142`), prune(`:200-220`, M8로 하중 실증), 쓰기 디바운스·언마운트 flush(`:396-401`, M12로 하중 실증) 전부 계약대로다. 영속 시 `areas`는 `Map` 삽입 순서(LRU) 그대로 넘기고 cap은 `saveNearbyCache`가 쓰기 시점에 강제한다 — 이중 방어.

### B1 · B2 · C9 — ✅ 통과

`MapTabScreen.tsx:246-249`가 `BOUNDS_CHANGED`를 `nearby.setBounds`로만 넘기고 **주석으로 "조회하라가 아니라 통지"** 를 명시한다(B1의 "소비자가 전제하는지"). `mapHtml` **diff 0**이라 0ms/60ms 이중 emit과 idle 리스너가 그대로 살아 있고, 훅은 이를 양자화 키 dedup + 허용분으로 흡수한다 — C9(이중 emit → invoke 1)·T2-b가 spec에서 잠근다. C1~C9 9건 전부 대응 케이스가 존재한다(`spec:730-846`).

### B7 · B9 · B12 — ✅ 통과

`mapHtml`·`searchNearby`·`accumulateNearbyItems`·`initialRegion`·Edge Function **전부 diff 0**(git 확인). `MapPrewarm`은 nearby 모듈 import 0건(E17 유지). 컨벤션은 `useCallback`/`useMemo` 0건, 인라인 `useEffect(() =>` 0건, 폐기 심볼(`NEARBY_DEBOUNCE_MS`·`NEARBY_MIN_MOVE`·`isBelowMinMove`) **grep 0건**.

### 관찰 3건 (비차단)

- **O2 해소** — `useNearbyPlaces.ts:25`가 `Bounds`를 `../bboxDrift`에서 import한다(1단계 권고 반영, 로컬 정의 삭제 확인).
- **D1** — `useNearbyPlaces.spec.ts:4` 헤더 주석이 아직 **"존속 11 · 재작성 6"**(P1 정정 전 값)이다. plan은 4곳 정정됐으나 spec 주석은 남았다. 문서만의 문제라 비차단이지만, 다음 수정 시 `존속 10 · 재작성 6 · 교체 1`로 맞추길 권한다.
- **O1 유지** — 비유한 좌표에서 `initialRegion`(NaN 센터 반환)과 `nearbyPreloadBbox`(null)의 분기 차이. 안전한 강등이라 조치 불요.

---

## 8. 왕복 기록

| # | 대상 | 내용 | 상태 |
|---|---|---|---|
| 1 | developer | O2(`useNearbyPlaces.ts:42` 로컬 `Bounds` → `bboxDrift` import 교체 권고) | 전달 완료, W3에서 확인 예정 |
| 2 | team-lead → sprint-planner | P1(§4.5 요약 `존속 11` → `존속 10 · 재작성 6 · 교체 1` 정정, §12 DoD 동반 수정) | ✅ 해결 — plan 4곳 정정 확인 |
| 3 | developer | **L1**(`useNearbyPlaces.ts:297` `runPreload`에 `firstLoadUsedRef` 가드 3줄 — 자동 invoke 3→2 이하) + 잠금 테스트 권고 | 전달, 재검증 대기 |
| 4 | developer | **L2**(`researchAvailable` C2·C3 하중 0 — 검증 완료된 테스트 2건 제공) | 전달, 재검증 대기 |
| 5 | developer | D1(`useNearbyPlaces.spec.ts:4` 헤더 주석 `존속 11` 잔재) | ✅ 해결 |
| 6 | developer | L1·L2·D1 **반영 확인**(가드 되돌림·C2·C3 뮤턴트 전부 killed, 205/2,167 green) | ✅ 해결 |
| 7 | developer | **L3**(M11 생존 회귀 — 기존 M11 케이스의 preload 2회를 `settle()` 앞으로 이동. 원인은 qa-logic이 제안한 L1 가드의 부작용) | 전달, 재검증 대기 |
| 8 | developer | L4(prune lng 축 미검증) · L5(0폭 span 가드 미검증) | ✅ 해결 — 2회차에 잠금 추가 |
| 9 | developer | **L6 질의 회신** — 의심 확인(재현) + naive fix(`fire()` 캐시 재확인) 반증 + T1-a 계약 상충 분석, **2회차 범위에 넣지 말 것** 권고 | ✅ 이월 합의(리더 승인) |
| 10 | developer | **L3·L4·L5 반영 최종 재검증** — 21종 전량 killed, 게이트 205/2,169 green | ✅ **PASS 확정** |

> 왕복 2회차로 종료(한도 내). developer의 2회차는 **프로덕션 코드 변경 0 · spec만 변경** — L3·L4·L5가 전부 "가드는 옳은데 하중이 없다"는 지적이었기 때문이며, 이는 발견의 성격과 정확히 일치한다.

---

## 9. 개정 이력

| # | 날짜 | 내용 |
|---|---|---|
| 1 | 2026-08-20 | 1단계(W0~W2) 검증 — PASS, 블로킹 0, 뮤턴트 4종 killed |
| 2 | 2026-08-20 | 2단계 준비 — B6 판정 기준선 HEAD 실측(존속 10/재작성 6/교체 1), P1 계획 산술 오류 발견, ui-spec 배선 계약 대조표 확보 |
| 5 | 2026-08-20 | **4단계 확정 판정 — PASS(로직 완료)**. 지문 8종 일치(`spec = 0cd1f240…`), 게이트 205 suites / 2,169 green · tsc 0, **뮤턴트 21종 전량 killed**(M11 회귀 해소 · L4 양축 · L5 · AND 스윕). 교훈 5건·이월 L6 기록. 왕복 2회차로 종료 |
| 4 | 2026-08-20 | **3단계 재검증(developer L1·L2·D1 반영 후)** — 동결 지문 변경 감지 후 재기준선(`09bf8d88`/`dc76f0df`). L1·L2 잠금이 뮤테이션으로 작동 확인, 게이트 205/2,167 green·tsc 0. **L3 신규**(M11 생존 회귀 — qa-logic이 제안한 L1 가드가 기존 M11 케이스의 하중을 가로챔, 수정안 검증 완료) · L4·L5 테스트 공백 2건 |
| 3 | 2026-08-20 | **2단계(W3~W4) 검증 — 조건부 판정**. 게이트 독립 재실행 일치(205/2,164 green · tsc 0 · 동결 지문 8종 일치). B6 존속 10건 `expect` 바이트 동일 확인(developer 판정 요청 인정, 완화 0) · M1~M12 12종 전량 killed · B3·B4·B1·B2·B7·B9·B12 통과. **블로킹 L1**(자동 invoke 3회 = B11 상한 2 위반, 수정안 검증 완료) · **L2**(AND conjunct 2개 하중 0, 잠금 테스트 검증 완료) 발견 |
</content>
</invoke>
