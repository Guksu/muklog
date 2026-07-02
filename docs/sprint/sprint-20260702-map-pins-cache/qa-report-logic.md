# QA 리포트 — 로직·통합 정합성 (map-pins-cache)

> 검증자: qa-logic. 기준: `plan.md`(계약·인수조건) · `dev-notes.md` · `docs/testing-strategy.md` · `docs/code-convention.md`.
> 방법: 생산자↔소비자 양쪽 동시 읽기(경계면 교차검증) + 종료 기준 직접 실행.
> **판정: 통과(PASS) — 블로커 0. 경미(비차단) 관찰 2건.**

## 0. 종료 기준 직접 실행 결과

| 게이트 | 결과 |
|--------|------|
| `npx tsc --noEmit` | **exit 0**(클린) |
| `npx jest`(전체) | **153 suites / 1470 tests green**(dev-notes 주장과 일치) |
| `pinsCache` + `useMuklogPins` 스펙 | **28/28 green** |
| `grep -rn PERF-TEMP src scripts` | **0건**(계측 코드 미포함 — plan §9 완료 기준 충족) |

## 1. 경계면 교차검증 (생산자 ↔ 소비자)

### (1) pinsCache 쓰기 ↔ 읽기 — PASS
- `saveCachedPins`가 `{version:1, pins}` 직렬화(`pinsCache.ts:80-81`) ↔ `loadCachedPins`가 동일 형 역직렬화·검증(`pinsCache.ts:55-59`). 왕복 정합. 키는 `pinsCacheKey`(`v1:{userId}`) 단일 출처로 양쪽 공유(`pinsCache.ts:22-23`).
- `PINS_CACHE_VERSION=1` 불일치 시 null(`pinsCache.ts:56`) → 버전 bump로 구 캐시 자동 무효. 계약대로.

### (2) 계정 격리(보안 경계) — PASS
- 키가 `userId` 네임스페이싱(`pinsCache.ts:22`)이라 A 저장·B 조회 시 구조적으로 다른 키 → 교차 노출 불가. 테스트 `pinsCache.spec.ts:108-112`가 A 저장→A hit→B null을 실증(형식적 아님 — 키잉 제거 시 red).
- `userId` 빈 문자열/미확보 시 read/write 모두 no-op(`pinsCache.ts:51,78`), 테스트 `pinsCache.spec.ts:114-120`이 스토리지 미접촉을 단언.
- 소비자(useMuklogPins)는 userId를 `supabase.auth.getSession()`(로컬, 네트워크 0)로 확보하고 null이면 캐시 미접촉(`useMuklogPins.ts:38-42,48`) — `getUser`(서버 왕복) 미사용 확인. RPC는 동일 세션 컨텍스트라 캐시 키(getSession userId)와 데이터 소유자가 일치.

### (3) 캐시 안전성 — no-throw / race — PASS
- `loadCachedPins` no-throw: 파싱실패·버전불일치·비배열·형불량·AsyncStorage throw 전부 null(`pinsCache.ts:52-62`), 테스트 6경로(`pinsCache.spec.ts:73-106`)가 각각 실증.
- race 부재: 캐시 읽기 `await` 완료 후에만 RPC 발사(`useMuklogPins.ts:50→62`, 순차) → "RPC가 캐시보다 먼저 도착해 fresh를 stale이 덮음" 구조적 불가. 이중 방어로 캐시 setState는 `stateRef.current.status === 'loading'`일 때만(`useMuklogPins.ts:52`) → refresh(ready)에선 stale 깜빡임 스킵.

### (4) 에러 정책 — PASS
- `!appliedCache && stateRef.current.status !== 'ready'`일 때만 error 전이(`useMuklogPins.ts:67`). 즉 (a) 캐시 히트, (b) 이번 흐름 캐시 적용, (c) 이미 ready(fresh)면 전부 현재 핀 유지. 캐시 없는 첫 진입 실패만 error(오늘과 동일).
- 테스트 T5a(`useMuklogPins.spec.ts:185-194`, 캐시 유지)·T5b(`:196-207`, error 전이) 두 분기 실증.

### (5) 소비자 계약 불변 (useMuklogPins ↔ MapTabScreen) — PASS
- 반환 shape `{ state: MuklogPinsState, refresh }` 불변(`useMuklogPins.ts:89`), `MuklogPinsState` 유니온 신규 필드 0(`types/types.ts:30-33`).
- MapTabScreen 무수정 확인(git 변경 파일에 미포함). `state.status==='ready'?state.pins:[]`(`MapTabScreen.tsx:71`) → `markersKey` effect(`:138-145`)가 markers 변경 시 SET_MARKERS 재주입. **캐시→fresh 교체가 markers 변경을 유발 → 기존 배선이 무수정으로 재주입 처리** — plan 핵심 약속 충족.
- `initialRegion({coords, pins})`(`initialRegion.ts:22-`)는 pins bbox 폴백 사용 — 캐시로 pins가 READY 이전 채워지면 INIT 센터가 핀 bbox가 되는 부수 이득(계약·코드 변경 0). 회귀 아님.

### (6) RPC 계약 불변 — PASS
- `supabase.rpc('list_my_muklog_pins')` 무인자 호출 불변(`useMuklogPins.ts:62`). `toMuklogPin` snake→camel 매핑 불변(`toMuklogPin.ts`). 한국어 에러 메시지 불변(`useMuklogPins.ts:68`).

## 2. 비용 가드레일 — PASS
- **RPC 호출 횟수 불변**: 마운트 1 + refresh당 1. 캐시 read/write는 로컬 I/O(네트워크 0). 테스트 T8(`useMuklogPins.spec.ts:237-252`)이 fake-timer로 60초 경과 후에도 rpc 1회를 단언(폴링 0).
- **폴링/Realtime/타이머 0**: 변경 모듈에 `setInterval/setTimeout/subscribe/channel/realtime` 0건(grep 확인).
- **AWS 0 / 신규 네이티브 모듈 0**: AsyncStorage(프로젝트 표준)만 사용, DB/Edge/RPC 마이그레이션 0.

## 3. TDD·테스트 유의미성 — PASS
- 인수조건 T1~T10 각각 대응 테스트 존재, 핵심 단언이 로직 결함 시 red가 되는 유의미한 테스트(예: T3 캐시-우선은 RPC pending 상태에서 ready(cached)를 요구 → 캐시 미적용 시 timeout; 계정 격리는 키잉 제거 시 red). 형식적 테스트 아님.
- 기존 회귀 7케이스 assertion 무변경 유지(`useMuklogPins.spec.ts:60-149`), 공용 모킹에 getSession·pinsCache만 추가(기본값 세션 있음+캐시 miss로 기존 경로 보존) → T10 회귀 0 실증.

## 4. 컨벤션 — PASS
- `useCallback`/`useMemo` 실제 호출 0(변경 모듈 grep: 주석 1건뿐). 화살표 const·named-object 인자(`{userId}`/`{userId,pins}`/`{row}`) 준수. `useEffect` 명명 함수(`loadPinsOnMount`/`cleanupPins`). enum-style·파일명=심볼명 준수. AsyncStorage import는 raw 토큰 무관(스타일링 아님).

## 5. 비주얼 무변경 확인 — PASS
- git 변경 스코프 = `useMuklogPins.ts`/`.spec.ts` 수정 + `pinsCache/` 신규 + 스프린트 docs. `MapTabScreen.tsx`·`components/`·`theme/`·킷 관련 파일 변경 0 → 비주얼 변화 0 전제 충족(qa-visual 비관여 근거 유효).

## 6. 경미 관찰 (비차단 — 후속 판단용)

1. **refresh 에러 시 "현재 핀 유지"가 직접 테스트되지 않음.** plan T7은 "에러 시 현재 핀 유지"를 명시하나 스펙은 refresh **성공**만 검증(`useMuklogPins.spec.ts:219-235`). 코드 로직상 refresh 시 `stateRef.current.status==='ready'` → 에러 분기 `!appliedCache && stateRef!=='ready'`가 false → 유지가 보장되므로 **동작은 정확**하나 회귀 방지 커버리지 공백. 후속에 refresh-error-keeps-pins 케이스 1개 추가 권장(블로커 아님).
2. **`isValidCachedPin` 최소형 검증(muklogId·lat·lng)만 수행** — plan §3.2 계약과 정확히 일치(의도된 설계). category/area/rating은 미검증이나, 생산자(saveCachedPins)가 항상 `toMuklogPin` 산출 well-formed만 쓰고 캐시는 1왕복 내 fresh로 교체되므로 실질 위험 0. 기록용 관찰이며 수정 불필요.

## 7. 미검증(단위 불가 — 이월 적절)
- 실 AsyncStorage 영속·앱 재시작 후 캐시 잔존, 콜드 진입 "첫 핀 가시화" 단축 수치(T-MEASURE) → `measurement-result.md`에 재현 절차·PERF-TEMP 재삽입 지점·스모크 체크리스트가 문서화된 채 **사용자 디바이스 스모크로 이월**. 렌더 타이밍은 단위 재현 불가라 이월이 적절(메모리 `qa-layout-blind-spot` 부합). 통과로 처리하지 않고 "이월"로 분류.

## 결론
로직·통합 정합성·보안(계정 격리)·비용 가드레일·TDD·컨벤션·비주얼 무변경 전 항목 **통과**. 종료 게이트(tsc 0 · jest 1470 green · PERF-TEMP 0) 직접 실행으로 확인. 블로커 없음 — 스프린트 "로직 완료" 처리 가능. 경미 관찰 2건은 후속 권장 사항이며 차단하지 않음.
