# Sprint: 지도 핀 캐시 (map-pins-cache)

> 작성 단일 출처: `docs/design/architecture.md`(§4 map-tab·§6 비용 가드레일) · 현재 코드(§3 계약) · 선례 `sprint-20260619-map-prewarm`(계측 우선·SWR 산출물 형식).
> lean 스프린트: **planner → developer → qa-logic** (ui-publisher / qa-visual 비관여 — 비주얼 변화 0).
> git 작업 없음. TDD(인수조건 = 테스트 케이스, Red 먼저).

---

## 0. 배경 — 병목 가설 (계측으로 확정한다)

지도탭 진입 시 핀이 화면에 찍히려면 **둘 다** 끝나야 한다:
1. **① WebView 부팅 → Kakao SDK READY** — `map-prewarm`으로 −63% 워밍 완료(홈 체류 중 프리워머가 WKWebView·SDK 캐시를 데움). **이번 스프린트 범위 아님.**
2. **② `list_my_muklog_pins` RPC 왕복** — `useMuklogPins`가 지도탭 **마운트 시점에야** RPC를 발사 → 네트워크 대기. 프리워밍으로 ①이 앞당겨진 지금, **핀이 늦게 뜨는 잔여 원인은 ②**로 추정.

`map-prewarm` measurement(감사 추적)에서 워밍 후 RPC 왕복은 136ms까지 줄었지만 이는 프리워밍 ~53초 후 warm 커넥션 기준값이다. **콜드 진입(프리워밍 직후·warm 커넥션 없음)에서 RPC 왕복이 실제 얼마나 지연을 만드는지**는 미측정 → **본 스프린트 T-MEASURE로 확정**한다. 개선 레버 = **캐시된 핀을 진입 즉시 표시(SWR)**하여 RPC 왕복을 체감 경로에서 제거.

**MapTabScreen에는 이미 갈아끼움 배선이 존재**한다: `markersKey` effect가 `markers` 변경 시 `SET_MARKERS`를 재주입(MapTabScreen.tsx:138-145). 따라서 "캐시 도착 → ready → RPC 도착 → 교체" 시 캐시 핀이 먼저 그려지고, RPC 도착으로 `pins`가 바뀌면 자동 재주입된다. **신규 outbound 메시지·계약 변경 불필요.**

---

## 1. 기능 한줄 정의

지도탭에 두 번째 이후 진입할 때, 사용자는 RPC 왕복을 기다리지 않고 **직전에 캐시된 핀을 진입 즉시** 지도에서 본다 — 그 뒤 백그라운드 RPC가 최신 핀을 받아오면 **깜빡임 없이 교체**되고 캐시가 갱신된다(stale-while-revalidate). RPC 호출 횟수는 **늘어나지 않는다**(진입 1회 + 명시적 refresh만, 비용 가드레일 §6 불변).

---

## 2. 범위

### In-scope
- **(a) 사전 계측(T-MEASURE 전반)** — PERF-TEMP 로그로 `rpc-start` / `rpc-response(ms)` / `cache-hit(mount 기준 ms)` / `READY 수신` / `SET_MARKERS 주입` 타임스탬프를 찍어 **② RPC 왕복이 만드는 지연**과 **캐시-우선 도입 전후 "첫 핀 가시화" 시각**을 대조. `map-prewarm`의 `scripts/mapPerf.mjs` 접근 재사용, 종료 시 일괄 제거.
- **(b) `useMuklogPins` 캐시-우선 SWR** — 마운트 시: (1) 로컬 캐시 읽기 → 히트면 즉시 `{status:'ready', pins: cached}` → (2) 백그라운드 RPC 재검증 → (3) 성공 시 `{status:'ready', pins: fresh}`로 교체 + 캐시 갱신.
- **캐시 저장소 = AsyncStorage**(신규 순수 모듈 `pinsCache`). **userId 네임스페이싱**으로 계정 격리, 스키마 **버전 태깅**, 파싱/버전/형 검증 실패 시 **miss로 폴백**.
- `MuklogPinsState` **소비자 계약 불변**(shape 무변경 → MapTabScreen 무수정), 진입 1회 조회 + refresh 정책 불변.

### Out-of-scope (일부러 안 함 — 후속 슬라이스 후보)
- **루트 유휴 프리페치**(홈 체류 중 지도탭 진입 전에 RPC를 미리 쏴서 캐시를 데움) — 후속 슬라이스 `map-pins-prefetch` 후보. 단, 프리페치는 **RPC를 앞당기는(횟수는 유지) 최적화**로 비용 가드레일 재검토 필요(§8) → 이번엔 안 함.
- Realtime / 폴링 — 미도입(비용 가드레일 §6, 기존 정책 계승).
- **RPC 시그니처 변경**(`list_my_muklog_pins` 무인자·8컬럼 투영 불변) — 신규 마이그레이션 0.
- **먹로그 추가/수정/삭제 시 능동적 캐시 무효화**(write 경로 → 캐시 결합) — 안 함. 대신 **항상 재검증(always-revalidate)이 stale을 자가 치유**(§6). 능동 무효화는 후속 후보.
- 비주얼 / 카피 / 레이아웃 변경 — 전부 동일(ui-publisher·qa-visual 비관여).
- `MapPrewarm`(프리워머) — **RPC 미보유가 명문화된 비책임(map-prewarm plan §3.2). 건드리지 않는다.**

---

## 3. 데이터 · API 계약

### 3.0 DB / Edge Function / RPC
- **변경 없음.** 신규 마이그레이션 0, Edge Function 0, RPC 0. `list_my_muklog_pins()` 시그니처·응답 불변.
- 캐시는 **클라이언트 로컬(AsyncStorage)** 에만 존재 — 서버·네트워크 미접촉.

### 3.1 저장소 선택 — AsyncStorage 확정 (근거)
| 후보 | 판정 | 근거 |
|------|------|------|
| **AsyncStorage** ⭐ | **채택** | 이미 프로젝트 표준(세션 영속·`pendingPick`·구 notif prefs). 신규 네이티브 모듈 0 → Dev Client 재빌드 불필요. 핀 페이로드는 작아(수십~수백행 × 8필드) 성능 무관. |
| MMKV 등 신규 네이티브 KV | **기각** | Dev Client **재빌드 필요** + 미탑재 시 top-level import 크래시 리스크(메모리 `native-module-lazy-require`). 얻는 성능 이점(동기 읽기)은 이 페이로드 크기에서 체감 0. |
| SQLite/파일 | **기각** | 과설계. KV 하나면 충분. |

> 결정: **AsyncStorage.** 읽기/쓰기는 로컬 I/O(네트워크 0) — 비용 가드레일 무영향.

### 3.2 신규 순수 모듈 — `pinsCache` (시그니처 고정, 이름 재량)

```ts
// src/features/map/pinsCache/pinsCache.ts — 먹로그 핀 로컬 캐시(userId 네임스페이싱·버전 태깅).
//   생산자/소비자: useMuklogPins(읽기=진입 시 즉시표시, 쓰기=RPC 성공 시 갱신).
//   보안: 반드시 userId로 키잉 — 계정 전환 시 타 계정 캐시 미노출(§6 격리).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { type MuklogPin } from '../types';

/** 캐시 스키마 버전 — MuklogPin 형 변경 시 bump하면 구 캐시가 자동 miss(폴백). */
export const PINS_CACHE_VERSION = 1;

/** 저장 키(단일 출처). userId 네임스페이싱이 계정 격리의 핵심. */
export const pinsCacheKey = ({ userId }: { userId: string }): string =>
  `muklog:map-pins:v${PINS_CACHE_VERSION}:${userId}`;

/** 영속 페이로드 형(버전 포함). */
type PinsCachePayload = { version: number; pins: MuklogPin[] };

/** 캐시 읽기 — 없음/파싱실패/버전불일치/형불량이면 null(=miss, 호출부는 RPC로 폴백). */
export const loadCachedPins = ({ userId }: { userId: string }): Promise<MuklogPin[] | null>;

/** 캐시 쓰기 — RPC 성공 후 최신 핀으로 갱신(버전 태깅). */
export const saveCachedPins = ({ userId, pins }: { userId: string; pins: MuklogPin[] }): Promise<void>;
```

**계약 핵심(developer가 추측 금지)**:
- `loadCachedPins`는 **절대 throw하지 않는다** — `JSON.parse` try/catch, `version !== PINS_CACHE_VERSION`이면 null, `Array.isArray(pins)` 아니거나 각 핀이 `{ muklogId:string, lat:number, lng:number }` 최소형을 만족 못 하면 null. 어떤 실패도 **조용히 miss로 폴백**(로그만).
- **userId가 빈 문자열/미확보면 캐시를 읽지도 쓰지도 않는다**(§6 fail-safe — 잘못된 키로 계정 오염 금지). 호출부(useMuklogPins)가 userId null 가드.

### 3.3 `useMuklogPins` — SWR 전이 (반환 shape 불변)

반환 계약은 **오늘과 동일**: `{ state: MuklogPinsState, refresh: () => Promise<void> }`. `MuklogPinsState` 유니온(loading | ready{pins} | error{message})에 **신규 필드 추가 없음** → MapTabScreen 무수정.

마운트 시 순서(**순차** — 로컬 읽기가 RPC보다 먼저 적용되도록, race 제거):
```
loadPinsOnMount:
  1. userId = (await supabase.auth.getSession()).data.session?.user?.id ?? null
       └ getSession은 로컬 스토리지 읽기(네트워크 0). getUser()는 서버 왕복이라 쓰지 않음.
  2. if (userId) {
       cached = await loadCachedPins({ userId })
       if (cached && mounted && state 아직 loading) setState ready(cached)   // 캐시-우선 즉시표시
     }
  3. { data, error } = await supabase.rpc('list_my_muklog_pins')             // 백그라운드 재검증(1회)
     if (!mounted) return
     if (error) {
        // 정책: 캐시를 이미 보여줬으면 유지(ready 유지), 아니면 error 전이(오늘과 동일)
        if (state.status !== 'ready') setState error(한국어 메시지)
        return
     }
     fresh = rows.map(toMuklogPin)
     setState ready(fresh)                                                   // 깜빡임 없이 교체
     if (userId) void saveCachedPins({ userId, pins: fresh })                // 캐시 갱신(로컬, best-effort)
```

- **refresh()**: 동일 재검증 경로(2·3의 RPC+캐시갱신) 재사용. 오늘처럼 **loading으로 되돌리지 않는다**(지도 뜬 채 갱신). 성공 시 캐시 갱신, 에러 시 현재 핀 유지.
- **race 가드**: 순차 실행(캐시 읽기 완료 후 RPC 발사)이라 "RPC가 캐시보다 먼저 도착해 fresh를 stale이 덮어씀"이 **구조적으로 불가**. 추가로 캐시 setState는 `state.status === 'loading'`일 때만(이미 fresh/에러면 무시) — 이중 방어.
- **RPC 호출 횟수 불변**: 캐시 읽기·쓰기는 로컬(RPC 아님). 마운트 1 RPC + refresh당 1 RPC — 오늘과 정확히 동일(§8).

### 3.4 initialRegion 부수 효과 (긍정, 계약 무변경)
`center = initialRegion({ coords, pins })`는 pins bbox를 폴백 센터로 쓴다(MapTabScreen.tsx:75). 캐시 히트로 pins가 READY 이전에 채워지면 INIT 센터가 서울 폴백 대신 **핀 bbox**가 되어 첫 페인트가 사용자 핀에 더 잘 맞는다. 계약·코드 변경 없이 얻는 이득(과주장 금지 — 캐시 읽기가 READY보다 늦으면 오늘과 동일하게 SET_MARKERS로 늦게 반영, markersKey 배선이 처리).

---

## 4. 화면 · UX

- **신규 화면·컴포넌트 없음.** 소비자는 `MapTabScreen`(무수정)·`initialRegion`뿐.
- 상태 매핑(MapTabScreen.tsx:179-209) 불변:
  - **loading**: 캐시 miss 첫 진입에서만(오늘과 동일 — 로딩 오버레이).
  - **ready(캐시)**: 캐시 히트 시 즉시 — 로딩 오버레이 없이 핀 표시(개선점).
  - **ready(fresh)**: RPC 도착 후 교체(오버레이 없음, markersKey로 SET_MARKERS 재주입).
  - **error**: 캐시 없이 RPC 실패 시에만(오늘과 동일 — 재시도 배너). 캐시 있으면 배너 안 뜸(핀 유지).
- 원티드 토큰 신규 사용 0(비주얼 무변경 → qa-visual 비관여 근거).

---

## 5. 작업 목록 (각 인수조건 포함)

- [ ] **T1. `pinsCache` 순수 모듈 신설** — 인수조건: `pinsCacheKey`가 `muklog:map-pins:v1:{userId}` 생성. `saveCachedPins`가 `{version:1, pins}` 직렬화 저장. `loadCachedPins`가 유효 페이로드에서 `MuklogPin[]` 반환, **miss(키 없음)/파싱실패/버전불일치/형불량에서 null**(throw 0). — 테스트: AsyncStorage 모킹 — save→load 왕복, 각 폴백 경로 null.
- [ ] **T2. 계정 격리 — userId 네임스페이싱** — 인수조건: userId `A`로 저장한 캐시를 userId `B`로 `loadCachedPins` 하면 **null**(교차 노출 0). userId 빈 문자열/미확보면 read/write 모두 no-op. — 테스트: A 저장 후 B 조회 null, 빈 userId no-op.
- [ ] **T3. `useMuklogPins` 캐시-우선 즉시표시** — 인수조건: 캐시 히트 시 RPC resolve **전에** `{status:'ready', pins: cached}`로 전이(getSession→loadCachedPins 후). 캐시 miss면 RPC resolve까지 `loading` 유지. — 테스트: getSession(userId)·loadCachedPins(pins) 모킹 + rpc는 pending Promise → state ready(cached). loadCachedPins null → state loading.
- [ ] **T4. RPC 재검증 → 교체 + 캐시 갱신** — 인수조건: 캐시 핀 A 표시 후 RPC가 핀 B 반환 시 `state.pins === B`(교체), `saveCachedPins`가 B로 1회 호출. — 테스트: cached=A, rpc resolves B → waitFor state ready(B), saveCachedPins called with {userId, pins:B}.
- [ ] **T5. RPC 에러 시 정책 — 캐시 있으면 유지, 없으면 error** — 인수조건: (a) 캐시 히트(ready) 후 RPC error → **state는 ready(cached) 유지**(error 배너 없음). (b) 캐시 miss(loading) + RPC error → `{status:'error', message:'지도를 불러오지 못했어요. 다시 시도해 주세요.'}`(오늘과 동일). — 테스트: 두 분기 각각.
- [ ] **T6. userId 미확보 fail-safe** — 인수조건: `getSession`이 session null 반환 시 `loadCachedPins`·`saveCachedPins` **미호출**(캐시 미접촉), RPC 경로는 그대로 동작(loading→ready/error). — 테스트: getSession null → cache 함수 0회 호출, rpc 정상 전이.
- [ ] **T7. refresh 정책 불변 + 캐시 갱신** — 인수조건: `refresh()`가 loading으로 되돌리지 않고 재검증, 성공 시 `saveCachedPins` 갱신, 에러 시 현재 핀 유지. RPC는 refresh당 정확히 1회. — 테스트: 초기 ready 후 refresh → state ready(new), saveCachedPins 2회째, rpc 2회.
- [ ] **T8. RPC 호출 횟수 불변(비용 가드레일)** — 인수조건: 마운트 시 `supabase.rpc('list_my_muklog_pins')` **정확히 1회**(캐시 히트여도 재검증 1회, miss여도 1회). 폴링 없음(타이머·재조회 0). — 테스트: 캐시 히트/미스 각각 마운트 후 rpc 1회, 시간 경과(fake timer) 후에도 추가 호출 0.
- [ ] **T9. 언마운트 race 가드** — 인수조건: 캐시 읽기 또는 RPC resolve **전에** 언마운트되면 setState 미호출(경고 0). — 테스트: 기존 언마운트 테스트 + 캐시 pending 중 언마운트 케이스.
- [ ] **T10. 소비자 계약 회귀 0** — 인수조건: `MuklogPinsState` shape 무변경(신규 필드 0), MapTabScreen 무수정으로 컴파일·기존 map 테스트 전부 green. `list_my_muklog_pins` 무인자 호출 계약·`toMuklogPin` 매핑·한국어 에러 메시지 불변. — 테스트: 기존 `useMuklogPins.spec.ts`·MapTabScreen 관련 테스트 무변경 통과 + `npm test` 전체 green.
- [ ] **T-MEASURE. (스프린트 종료 단계) 사전 계측 + 전후 대조 + PERF-TEMP 제거** — 인수조건: PERF-TEMP로 ① 캐시 OFF(현행) 콜드 진입에서 `rpc-start`→`rpc-response`(② 왕복 지연)와 "첫 핀 가시화" 시각, ② 캐시 ON에서 캐시 히트 진입의 "첫 핀 가시화(cache-hit)" 시각을 `scripts/mapPerf.mjs`로 비교, 단축 폭 기록(`measurement-result.md`). 이후 `grep -rn PERF-TEMP src scripts` **0건** 되도록 계측 일괄 제거. — 테스트: 제거 후 `npm test` green + `grep -rn PERF-TEMP src scripts` → 0.

> 작업 순서: T1 → T2 → T3 → (T4·T5·T6 병렬) → T7 → T8 → T9 → T10 회귀 → **T-MEASURE 맨 마지막**(계측에 PERF-TEMP 필요, developer는 그 전에 제거 금지).

## 5-1. 테스트 케이스 (TDD)

**단위 테스트 대상(jest-expo + @testing-library/react-native — `docs/testing-strategy.md`)**:
- `pinsCache`(순수 모듈, AsyncStorage 모킹): 정상 save→load 왕복 / 경계 빈 pins[] 왕복 / 실패 파싱오류·버전불일치·형불량·키없음 → null / 계정 격리(A키↔B조회) / 빈 userId no-op.
- `useMuklogPins`(훅, `@/lib/supabase`·`pinsCache` 모킹):
  - 정상: 캐시 히트 즉시 ready(cached)(T3) / RPC 도착 교체+캐시갱신(T4) / 캐시 miss loading→ready(T3·오늘) / refresh 재검증+갱신(T7).
  - 경계: 빈 캐시 pins[] 히트 → ready(pins:[]) 즉시 / getSession null fail-safe(T6) / RPC 도착이 캐시와 동일 핀(교체 무해).
  - 실패: RPC error + 캐시 유지(T5a) / RPC error + 캐시 없음 error(T5b) / 언마운트 race(T9) / loadCachedPins가 throw해도(방어적) 훅이 흡수하고 RPC로 진행.
  - 가드레일: 마운트 rpc 1회, 시간경과 후 추가 0(T8).
- 회귀(T10): 기존 `useMuklogPins.spec.ts`(무인자 RPC·snake→camel·빈=ready·error 한국어·초기 loading·refresh·언마운트) 무변경 green.

**모킹/스모크 대상(외부·네이티브 — 단위 불가)**:
- 실제 AsyncStorage 영속·앱 재시작 후 캐시 잔존 → **디바이스 스모크**(T-MEASURE 배치).
- 실제 콜드 진입 "첫 핀 가시화" 시각 단축(체감) → 디바이스 스모크(dev/시뮬, PERF-TEMP). 메모리 `qa-layout-blind-spot`: 렌더 픽셀·타이밍은 디바이스 스모크 필수.

---

## 6. 엣지케이스

- **빈 캐시 첫 진입**: `loadCachedPins` null → `loading` 유지 → RPC → ready + 캐시 최초 기록(오늘과 동일). 회귀 0.
- **계정 전환/로그아웃 (보안)**: 캐시는 **userId 키잉** → 계정 B는 A의 키를 조회하지 않으므로 **타 계정 핀 노출 구조적 불가**. signOut 시 능동 삭제에 **의존하지 않는다**(AuthProvider↔map 결합 회피). userId 미확보(getSession null) 시 캐시 미접촉(T6). *키 누적(사용자별 1키)은 기기당 1~2계정 수준이라 무시 가능; 능동 프루닝은 후속 후보.*
- **먹로그 추가/수정 후 stale 핀**: 추가 직후 지도 진입 시 캐시(신규 핀 누락)가 먼저 표시 → **RPC가 항상 재검증**하므로 왕복(수백 ms) 후 신규 핀 포함 fresh로 교체(markersKey→SET_MARKERS). stale 창은 **RPC 1왕복으로 상한**. 능동 무효화 없이 자가 치유(§2 OUT 근거).
- **먹로그 삭제 후 stale 핀**: 삭제된 핀이 캐시에서 잠깐 보이다 RPC 도착 시 사라짐(bounded, 자가 치유). 좌표 없는 수동입력 먹로그는 RPC가 애초에 제외(불변).
- **캐시 파싱 실패/스키마 변경**: `JSON.parse` 실패·`version !== 1`·형불량 → null(miss)로 폴백 → RPC 정상 경로. 앱 업데이트로 `MuklogPin` 형이 바뀌면 `PINS_CACHE_VERSION` bump로 구 캐시 자동 무시.
- **네트워크 실패(RPC error)**: 캐시 있으면 **유지**(사용자는 마지막으로 본 핀을 계속 봄, 에러 배너 없음), 캐시 없으면 error 배너+재시도(오늘과 동일, T5).
- **커플 동시성(2명)**: 캐시는 **기기 로컬·userId별**. 멤버 A가 추가한 핀은 멤버 B의 캐시에 없지만, B의 다음 진입 RPC 재검증에서 반영 — **오늘과 동일**(SWR이 cross-member staleness를 악화시키지 않음, 항상 재검증하므로). 쓰기·RPC 앞당김 0이라 동시성 영향 0.
- **RPC가 캐시보다 먼저 도착(race)**: 순차 실행(캐시 읽기 완료 후 RPC 발사)으로 불가. 이중 방어로 캐시 setState는 `loading`일 때만.
- **캐시 히트인데 RPC가 빈 배열 반환**(마지막 먹로그 삭제 등): fresh=[] 로 교체 + 캐시 []로 갱신 → 다음 진입은 즉시 빈 지도(ready pins:[], 에러 아님). 정상.
- **입력 한계**: 핀 수는 로그 5명 × 다수 먹로그로 수백 행 가능하나 AsyncStorage 페이로드로 무해(수십 KB). 상한 이슈 없음.

---

## 7. QA 교차검증 경계면 (생산자 ↔ 소비자)

- **`pinsCache.saveCachedPins`(쓰기) ↔ `loadCachedPins`(읽기)**: 직렬화 형(`{version,pins}`)·키(`v1:{userId}`) 왕복 정합. 버전 bump 시 구 캐시 무시.
- **`pinsCache` 키 ↔ userId**: userId 네임스페이싱이 실제로 격리하는지(A 저장·B 조회 null). **보안 경계 — qa-logic 필수 교차검증.**
- **`useMuklogPins`(소비자) ↔ `supabase.auth.getSession`**: userId 획득 경로가 `getSession`(로컬, 네트워크 0)인지, null 시 fail-safe인지.
- **`useMuklogPins`(소비자) ↔ `supabase.rpc('list_my_muklog_pins')`**: 캐시 히트/미스 무관 **재검증 1회**(호출 횟수 불변), 무인자 계약·snake→camel(`toMuklogPin`) 불변.
- **`useMuklogPins`(생산자) ↔ `MapTabScreen`(소비자)**: `MuklogPinsState` shape 불변 → `pins` 파생·오버레이 분기·markersKey 재주입이 **무수정**으로 동작. 캐시→fresh 교체가 SET_MARKERS 재주입을 유발하는지(markersKey effect).
- **`useMuklogPins` ↔ `initialRegion`**: 캐시 pins가 READY 이전 채워질 때 INIT 센터가 핀 bbox가 되는지(부수 이득, 회귀 아님).
- **비용 가드레일**: 폴링/타이머 0, Realtime 0, RPC 호출 증가 0, 네트워크 신규 0(캐시=로컬).

## 8. 비용 가드레일 체크

- **AWS 미사용** — 클라이언트 로컬 캐시(AsyncStorage)만 추가, 백엔드 0.
- **RPC 호출 횟수 불변** — 마운트 1회 + refresh당 1회(오늘과 동일). 캐시 읽기/쓰기는 **로컬 I/O(네트워크 0)**. 프리페치(RPC 앞당김)는 이번 OUT.
- **폴링/Realtime 0** — 신규 타이머·구독 없음. SWR은 "마운트 1회 재검증"일 뿐 반복 조회 아님(기존 정책 계승).
- **Kakao Local 호출 0** — nearby 경로 무관(캐시는 saved 핀만). map-tab-nearby 비용 가드 불변.
- **이미지 압축·viewport 조회** — 본 기능 무관.
- **저장 용량** — 핀 페이로드 수십 KB 수준, AsyncStorage 무료·로컬. userId별 키 누적은 기기당 소수 계정이라 무시 가능.

---

## 9. 산출물 / 완료 기준

- 신규: `src/features/map/pinsCache/`(`pinsCache.ts`·`index.ts`·`pinsCache.spec.ts`). 수정: `src/features/map/useMuklogPins/useMuklogPins.ts`(+`.spec.ts` 케이스 추가).
- 무변경 보장: `MapTabScreen.tsx`(PERF-TEMP 제외)·`types.ts`(`MuklogPinsState` shape)·`toMuklogPin`·`MapPrewarm`·메시지 계약 모듈·`list_my_muklog_pins` 마이그레이션.
- 완료 기준: T1~T10 인수조건 green + `npm test` 전체 통과 + **T-MEASURE 계측 기록**(`measurement-result.md` — ② RPC 지연 확정 + 캐시 전후 "첫 핀 가시화" 단축) + `grep -rn PERF-TEMP src scripts` → 0.
- 라이브 검증: 실제 앱 재시작 후 캐시 잔존·콜드 진입 체감 단축은 **디바이스 스모크**(dev/시뮬)로 확인(메모리 권고 — 렌더/타이밍은 디바이스에서만 드러남).
