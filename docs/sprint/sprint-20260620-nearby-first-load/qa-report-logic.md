# QA Report — Logic / Integration (nearby-first-load)

> 검증자: qa-logic · 날짜: 2026-06-20 · 범위: 로직·통합 정합성·비용 가드레일·TDD·컨벤션 (비주얼 제외 — 변화 0)
> 대상 스프린트: `sprint-20260620-nearby-first-load` (주변 음식점 첫 로드 즉시화)

## 결론: **PASS** (회귀 0, 모든 인수조건 통과, 미검증 없음)

- `npm test` 전체: **136 suites / 1168 tests 통과** (baseline 1163 + 5 신규, 회귀 0) — dev-notes 일치.
- `npx tsc --noEmit`: **exit 0**.
- `useNearbyPlaces.spec.ts`: **12 passed** (기존 7 + 신규 5: T1-a/b/c/d, T2; "디바운스 3회"→G1 의미보존 갱신).
- 변경 파일 범위: `git diff --stat HEAD` 결과 `useNearbyPlaces.ts`(+10) / `useNearbyPlaces.spec.ts`(+82) **단 2파일** — plan §2 in-scope 동결 준수.

---

## 1. 통과 항목 (PASS)

### T1 첫 조회 즉시성 — PASS (load-bearing 확인)
- `useNearbyPlaces.ts:112` `const delay = last === null ? NEARBY_FIRST_DELAY_MS : NEARBY_DEBOUNCE_MS;` — 첫 조회(`lastQueriedRef.current === null`)만 0틱, 2회차+ 500ms. `NEARBY_FIRST_DELAY_MS = 0`(line 28) 상수화로 매직넘버 회피(plan §3.4 권장 충족).
- **load-bearing 검증(mutation)**: `delay`를 `NEARBY_DEBOUNCE_MS` 고정으로 치환 → 정확히 T1-a/T1-b/T1-c/T1-d/T2 **5건만 red**, G1~G5는 green 유지. 즉 신규 테스트가 leading-edge 분기를 실제로 못박고, 가드레일 테스트는 그와 독립임이 동시에 증명됨. (검증 후 원본 복원 완료.)
- 테스트 위치: spec `:51`(T1-a), `:63`(T1-b 0틱≠동기), `:74`(T1-c 2회차 트레일링), `:92`(T1-d).

### T2 첫 진입 invoke ≤1 (idle 다발 수렴) — PASS (3자 경계면 직접 읽음)
생산자→배선→소비자 시퀀스를 같이 읽어 확인:
- **생산자** `mapHtml.ts:113` `idle` 리스너 등록 직후 `:116-121` `setTimeout(0)` relayout+setCenter → 추가 `idle` 발화 → `emitBounds`(`:51`)가 `BOUNDS_CHANGED` 다발 post.
- **배선** `MapTabScreen.tsx:121` 각 `BOUNDS_CHANGED` → `nearby.setBounds({sw,ne})`.
- **흡수** `useNearbyPlaces.ts`: 효과 deps `[bounds]`(`:136`) 변경마다 재실행, cleanup `cancelDebounce`(`:132-134`)가 직전 0틱 `timer`를 `clearTimeout` → 마지막 bounds 1건만 발사. 동일 viewport 재-idle은 상위 `last.key === key`(`:97`)에서 return → 추가 0. **두 방어선 모두 코드상 존재.**
- 테스트 `spec:111`(T2): 연속 setBounds 3회 후 0틱 → `searchNearby` 정확히 1회, 마지막 bbox(`37.7`). mutation 시 red(상기) → load-bearing.

### T3/G1~G5 비용 가드레일 회귀 0 (architecture §8) — PASS
첫-조회-즉시화가 가드레일을 **우회/약화하지 않음**을 소스로 확인 — 캐시/동일키/최소이동 분기는 모두 `delay` 결정(`:112`)보다 **상위**(`:97` 동일키, `:101` 캐시히트, `:109` 최소이동)에서 평가·return되므로 leading-edge와 독립.
- G1 디바운스 수렴(2회차+): `spec:124` warm 후 3회 대이동 → 1회 수렴. PASS.
- G2 양자화 캐시: `:97`/`:100-106` 불변, `spec:149` 재방문 invoke 0. PASS.
- G3 최소이동 임계 `NEARBY_MIN_MOVE=1e-3`(`:32`): `:109` 불변, `spec:170/185`. PASS.
- G4 레이스 가드 `requestSeqRef`(`:114`,`:119`,`:126`): 첫 요청이 0틱 발사여도 seq 가드 동일, `spec:198` stale 폐기. PASS.
- G5 에러: `:125-128` `setItems([])`+`status='error'`, `spec:223`. 첫 조회 에러도 동일. PASS.

### T4 계약·데이터 불변 — PASS
- 훅 시그니처 `UseNearbyPlacesResult`(`:63-68`) 불변, `searchNearby(boundsToRect(...))` 호출 인자(`:117`) 불변, `nearbyToMapMarkers({items})`(`:140`, saved:false) 불변.
- 소비자 계약 영향 0: `MapTabScreen.tsx` `nearby.markers`(머지 `:69`), `nearby.items` lookup(`:152`), `nearby.setBounds`(`:121`), status 사용처 — 전부 내부 타이머 delay만 바뀌어 무영향. `MapTabScreen.spec` 무변경(diff 없음), 전체 소비자 테스트 green.

### 컨벤션 (code-convention.md) — PASS
- `useCallback`/`useMemo` 실제 호출 0건(`:139` 히트는 주석).
- `export function` 0건 — 훅은 `export const useNearbyPlaces = () =>`(`:76`) 화살표.
- useEffect 인라인 화살표 0건 — 명명 함수 `debounceNearbyFetch`(`:90`)/`runNearbySearch`(`:115`)/`cancelDebounce`(`:132`).
- enum-style 상수 `NEARBY_FIRST_DELAY_MS`/`NEARBY_DEBOUNCE_MS` `as const` 의미(export const number). 파일명=심볼명 일치.

### 엣지케이스 (plan §6) — PASS (코드/테스트 근거)
- 캐시 히트가 첫 조회: `:97`/`:101` 상위 분기에서 leading-edge 도달 전 return → invoke 0. (캐시 `spec:149`로 경로 보장.)
- 에러가 첫 조회: G5(`spec:223`) — 0틱 발사도 reject 시 status='error', markers []. 지도/saved 불변.
- 첫 조회 직후 곧 이동: T1-d(`spec:92`) — 첫 1회 + 트레일링 1회, 레이스 가드(G4)로 보호.
- 빠른 진입/이탈(언마운트): cleanup `clearTimeout`(`:133`)이 0틱 타이머도 회수 → 유령 invoke 없음. (T1-b가 "0틱이라 cleanup 가능"을 단언해 간접 보장.)

---

## 2. 실패 항목 (FAIL)
없음.

## 3. 미검증 항목 (사유)
- **라이브 디바이스 체감(첫 진입 핀 즉시성)**: 단위는 fake timer로 못박았으나 실제 Edge Function 왕복·WebView idle 타이밍은 디바이스 스모크 영역(plan §8 명시, testing-strategy 단위 경계). 본 QA 범위 밖 — 이월 정상.

---

## 핵심 발견
- 코드·테스트·계약 정합, 가드레일 회귀 0, 파일 범위 동결 모두 충족. 수정 요청 없음.
</content>
</invoke>
