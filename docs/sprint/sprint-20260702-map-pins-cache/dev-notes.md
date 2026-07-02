# dev-notes — map-pins-cache (지도 핀 캐시 SWR)

> 구현: developer. plan.md 계약 그대로. 비주얼 변화 0(ui-publisher·qa-visual 비관여).
> 종료 기준: `npm test` 전체 통과(153 suites / 1470 tests green) + `tsc --noEmit` 클린 + `grep -rn PERF-TEMP src scripts` → 0.

## 1. 구현한 파일

| 파일 | 성격 | 내용 |
|------|------|------|
| `src/features/map/pinsCache/pinsCache.ts` | **신규 순수 모듈** | `PINS_CACHE_VERSION=1`, `pinsCacheKey({userId})`, `loadCachedPins`/`saveCachedPins`(AsyncStorage) |
| `src/features/map/pinsCache/index.ts` | 신규 배럴 | `export * from './pinsCache'` |
| `src/features/map/pinsCache/pinsCache.spec.ts` | 신규 테스트 | T1·T2 — 왕복·빈 경계·폴백(파싱/버전/형/miss/throw)·계정 격리·빈 userId no-op (12 cases) |
| `src/features/map/useMuklogPins/useMuklogPins.ts` | **수정(SWR 개조)** | getSession→userId→loadCachedPins 즉시 ready(cached)→RPC 재검증→ready(fresh)+saveCachedPins |
| `src/features/map/useMuklogPins/useMuklogPins.spec.ts` | **수정(케이스 추가)** | 기존 7 케이스 assertion 무변경(회귀) + SWR 9 케이스(T3~T9) 추가. 공용 모킹에 `auth.getSession`·`../pinsCache` 추가 |

**무변경 보장(계약 불변)**: `MapTabScreen.tsx`·`types.ts`(`MuklogPinsState` shape)·`toMuklogPin`·`MapPrewarm`·`list_my_muklog_pins` 마이그레이션·메시지 계약 모듈 전부 미접촉. DB/Edge Function/RPC 신규 0.

## 2. 생산자 ↔ 소비자 매핑 (QA 교차검증 경로)

```
pinsCache.saveCachedPins(쓰기, {version:1,pins}) ─┐
                                                  ├─ AsyncStorage 키 muklog:map-pins:v1:{userId}
pinsCache.loadCachedPins(읽기, 검증→MuklogPin[]|null) ┘   (userId 네임스페이싱 = 계정 격리)

supabase.auth.getSession() ──userId(로컬,네트워크0)──▶ useMuklogPins.loadPins
                                                        │  userId null → 캐시 미접촉(fail-safe)
loadCachedPins({userId}) ──cached|null──▶ (loading일 때만) setState ready(cached)  ← 캐시-우선 즉시표시
supabase.rpc('list_my_muklog_pins') ──rows(snake)──▶ toMuklogPin ──fresh──▶ setState ready(fresh)
                                                                     └─▶ saveCachedPins(갱신, best-effort)

useMuklogPins.state(MuklogPinsState, shape 불변) ──▶ MapTabScreen
   pins 파생 → pinsToMapMarkers → mergeMapMarkers → markersKey effect ──▶ SET_MARKERS 재주입
   (캐시→fresh 교체 시 markers 변경 → markersKey 발화 → 자동 재주입. MapTabScreen 무수정)
```

## 3. 주요 결정 사항 (plan 준수 + 추측 없이)

- **userId 확보 = `getSession`(로컬)**: `useWishlist` 선례 계승(네트워크 0). `getUser`(서버 왕복) 미사용. getSession 예외/세션 null → `userId=null` → 캐시 read/write no-op, RPC 경로는 정상(T6).
- **race 제거 = 순차 실행**: 캐시 읽기 `await` 완료 후에만 RPC 발사 → "RPC가 캐시보다 먼저 도착" 구조적 불가. 추가로 캐시 setState는 `stateRef.current.status === 'loading'`일 때만(첫 진입) — refresh(ready)에선 스킵해 fresh 위 stale 깜빡임 방지(이중 방어).
- **에러 정책**: `!appliedCache && stateRef.current.status !== 'ready'`일 때만 error 전이. 즉 (a) 캐시 히트(ready)·(b) 이번 흐름에서 캐시 적용·(c) refresh 전 이미 ready fresh — 셋 다 캐시/기존 핀 유지, 배너 없음. 캐시 없는 첫 진입 실패만 error(오늘과 동일, T5).
  - `appliedCache`(로컬 플래그) + `stateRef`(커밋 상태) 병용: 캐시 히트+에러는 렌더 타이밍 의존 없이 `appliedCache`로 확정 유지, refresh 에러는 `stateRef==='ready'`로 유지.
- **refresh = loadPins 재사용**: 동일 경로(getSession→cache→RPC→save). loading으로 되돌리지 않음. `stateRef==='ready'`라 캐시 setState 스킵 → 재검증만(T7).
- **`stateRef` 도입**: async 흐름에서 "현재 loading인가/ready인가"를 읽어야 위 두 판단이 가능. 렌더 중 `stateRef.current = state` 대입(허용 패턴). `useCallback`/`useMemo` 미사용(컨벤션).
- **loadCachedPins 방어**: 계약상 throw 0이지만 훅에서 `try/catch`로 한 번 더 흡수 → 어떤 경우도 RPC 경로로 진행(§5-1 방어 케이스).
- **비용 가드레일**: RPC 호출 = 마운트 1 + refresh당 1(불변, T8 fake-timer로 폴링 0 검증). 캐시 read/write는 로컬 I/O(네트워크 0). Realtime/타이머 0. AWS 0.

## 4. 테스트 결과

- `pinsCache.spec.ts`: 12/12 green (T1·T2).
- `useMuklogPins.spec.ts`: 17/17 green — 기존 7(회귀, assertion 무변경) + 신규 10(T3 히트/miss·T4 교체+갱신·T5a/b 에러정책·T6 fail-safe·T7 refresh·T8 RPC 1회·T9 언마운트 race·**T5c refresh 에러 시 기존 핀 유지**).
  - T5c는 qa-logic 관찰 보완(회귀 커버리지 공백) — ready 상태에서 refresh→RPC 에러 시 error 미전이·직전 fresh 핀 유지 직접 검증. 구현 코드 무변경(stateRef==='ready' → error 스킵이 이미 보장).
- 전체: **153 suites / 1470 tests green**, `tsc --noEmit` 클린. `grep -rn PERF-TEMP src scripts` → 0.

### spec 모킹 변경 메모(회귀 안전)
기존 `useMuklogPins.spec.ts`의 공용 모킹에 `supabase.auth.getSession`과 `../pinsCache`를 추가하고, `beforeEach` 기본값을 **세션 있음(userId 'me') + 캐시 miss(null)** 로 설정. 이 기본값에서 기존 7 케이스는 `loading→RPC` 경로로 동일하게 흐르며 **assertion은 한 줄도 바꾸지 않았다**(T10 회귀 0). 신규 케이스만 케이스별로 `loadCached`/`getSession`을 오버라이드.

## 5. T-MEASURE (이월)

`measurement-result.md` 참조. PERF-TEMP·mapPerf는 산출물 트리에 **미포함**(grep 0). 라이브 수치(콜드 RPC 왕복 = ② 지연, 캐시 전후 "첫 핀 가시화" 단축)는 렌더 타이밍이라 단위 불가 → **사용자 디바이스 스모크로 이월**(재현 절차·재삽입 지점·대조 설계·스모크 체크리스트를 문서에 명기). `map-prewarm` 선례와 동일 절차.

## 6. 미완/후속 후보 (plan §2 OUT — 의도적 미구현)

- 루트 유휴 프리페치(`map-pins-prefetch`) — RPC 앞당김이라 비용 가드 재검토 필요, 이번 OUT.
- write 경로 능동 캐시 무효화 — always-revalidate가 자가 치유하므로 미도입.
- userId별 키 능동 프루닝 — 기기당 소수 계정이라 무시 가능, 후속 후보.
