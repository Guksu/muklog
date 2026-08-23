# 스프린트: map-pin-loading (지도탭 핀 로딩 UX — nearby 로딩 모델 개편)

- **작성일**: 2026-08-20
- **기획**: sprint-planner
- **설계 단일 출처**: `docs/design/architecture.md` (§4 지도 탭 · §5 L237~238·L250~251 · §6 비용 가드레일)
- **선행 스프린트 의존**: `sprint-20260814-map-nearby-load`(증분 마커 렌더 — 이 계획의 전제) · `sprint-20260702-nearby-accumulate`(누적 병합) · `sprint-20260702-map-pins-cache`(**캐시 영속 선례 — 그대로 미러**) · `sprint-20260620-nearby-first-load`(0틱 첫 조회·첫 emit) · `sprint-20260619-map-prewarm`(WebView 부팅 1219ms 실측)

---

## §1. 기능 한 줄 정의

> 지도 탭의 주변(nearby) 핀이 **지도와 함께 도착**하고, 그 뒤로는 **사용자가 "이 지역에서 검색"을 누를 때만** 갱신된다 — 지도 한가운데에 뒤늦게 팝인하는 경로를 구조적으로 없앤다.

사용자 관측: *"핀이 늦게 뜨거나 지도 한가운데에 뒤늦게 팝인한다."*
레퍼런스(케치테이블, 리더 실조작 확인): ① 첫 진입에 핀이 지도와 함께 도착 ② **팬 중 자동 로드 없음 — 명시 버튼으로만 갱신** ③ 우하단 "내주변" 별도.

**사용자 확정 결정(2026-08-20)**: 팬 중 자동 idle 조회를 **폐기**하고 명시 재검색 버튼으로 전환한다. 첫 진입 선로딩 포함.

---

## §2. 규모 판정 — 왜 4요소가 한 기능인가

리더가 지정한 4요소(선로딩 · 캐시 영속 · 명시 재검색 · 계측)를 쪼개면 **중간 상태가 전부 불완전하다**:

| 조합 | 중간 상태의 문제 |
|---|---|
| 선로딩만 | 선로딩 결과가 도착한 직후 idle 자동 조회가 같은 영역을 다시 덮어 팝인이 그대로 남는다(개선 체감 0) |
| 명시 재검색만 | 첫 진입 핀이 여전히 READY 이후에 오므로 "첫 팝인"이 남고, 자동 조회를 껐으니 **오히려 핀이 더 늦게·덜 뜬다**(회귀) |
| 캐시 영속만 | 하이드레이션 결과를 INIT에 태울 시점 계약이 없으면 여전히 SET_MARKERS 팝인 |

세 요소는 **같은 상태 기계(`useNearbyPlaces`)의 한 번의 재작성**이며, 파일·테스트 러너·실패 모드가 겹친다(직전 스프린트가 3분해한 A/D/B와 정반대 상황). 따라서 **1 스프린트 = 1 기능** 규칙을 지키는 방식은 분해가 아니라 **하나로 묶는 것**이다.

**계측(W0)만은 독립**이지만 분리하지 않는다 — 개선 전 baseline을 재려면 **개선보다 먼저** 들어가야 하고, `__DEV__` 가드 no-op이라 표면이 극히 작다.

**⚠ 중단·분할 판정선**: W3(`useNearbyPlaces` 재작성)에서 기존 spec 17건의 재작성이 **완화 없이** 끝나지 않거나 뮤테이션이 살아남으면, W4(화면 배선·버튼)를 다음 스프린트로 넘기고 W0~W3만 닫는다. 그 경우 `researchAvailable`은 반환하되 화면은 소비하지 않아(자동 조회는 이미 폐기) **첫 진입만 개선된 중간 상태**로 배포 가능하다.

---

## §3. 범위

### 3.1 In-scope

1. **nearby 선로딩** — 탭 진입 즉시 초기 bbox를 추정해 WebView 부팅과 **병렬**로 조회. READY 시점에 이미 `markers`에 nearby가 들어 있으면 INIT이 자동으로 함께 싣는다.
2. **nearby 캐시 영속(SWR)** — 양자화 bbox 키 → 결과를 AsyncStorage에 저장. 재진입 시 즉시 표시 후 재검증. `pinsCache` 선례를 그대로 미러(**userId 키잉·버전 태깅·조용한 miss·no-throw**).
3. **명시 재검색 전환** — idle 자동 조회 폐기. `BOUNDS_CHANGED`는 **버튼 노출 판정용으로만** 소비. 드리프트 임계 초과 시 "이 지역에서 검색" 노출 → 탭 시 1회 조회.
4. **계측** — READY→소스별 첫 렌더 갭, nearby invoke 소요를 `__DEV__` 로깅으로 측정 가능하게. **프로덕션 오버헤드 0**(폴링·타이머·리스너 0).

### 3.2 Out-of-scope (일부러 안 한다)

| 항목 | 사유 |
|---|---|
| **wish 핀 캐시 영속** | 같은 `pinsCache` 패턴의 별도 적용면. 리더가 배경에서 "wish도 별도 팝인"을 지적했으나 이번 기능(=nearby 로딩 모델)이 아니다 → **다음 스프린트 1순위 후보** |
| Edge 페이지 팬아웃(0814 §11 S2) | 미착수 상태 그대로. 조회 **양**의 문제이고 이번은 조회 **시점**의 문제 |
| `nearby-search` Edge Function 변경 | **diff 0**. 응답 계약(`{ results: NearbyPlaceItem[] }`) 불변 |
| DB 마이그레이션 · RLS · 신규 RPC | 0건 |
| 우하단 "내주변" 버튼 신설 | **기존 `MapLocateButton`이 이미 그 자리·그 역할**(`right:16 bottom:16`, 현재위치 재취득+RECENTER). 신설하면 중복 — §11 Q4로 리더 확인 |
| nearby 에러의 UI 노출 | 현행 무음 정책 유지(§6 E12). 버튼이 계속 떠 있는 것이 재시도 어포던스 |
| `NEARBY_ACCUM_CAP` 상향 · 클러스터·필터 변경 | 무관 |
| `markersKey`에 데이터 해시 추가 | 0814 F1 한계 그대로 수용 |

### 3.3 퍼블리싱(ui-publisher) 투입 판정: **필요 (신규 컴포넌트 1종)**

`MapResearchButton` 1종이 신규다. **킷 `templates/muklog`에 대응 요소가 없다**(`mk-home.jsx` MapScreen에는 FauxMap·me 마커·핀·스팟 카드·locate FAB만 존재, 재검색/지역검색 계열 요소 0건 — grep 확인). 따라서 이는 **킷 패턴 준수 신규 제안**이며, ui-publisher가 킷의 기존 떠 있는 레이어 선례(`MapLocateButton` = surface·radius full·`shadow.fab`·press scale 0.92)에서 파생해 시안을 확정한다. qa-visual은 "킷 시안 대비"가 아니라 **"킷 패턴 대비"** 로 판정한다(킷에 원본이 없으므로 FAIL 근거를 킷 좌표로 삼지 않는다).

---

## §4. 데이터 · API 계약

### 4.0 변경 없는 것부터 (가장 중요)

```
Edge nearby-search        요청 { sw, ne } / 응답 { results: NearbyPlaceItem[] }   ← 무변경
searchNearby()            시그니처·에러 토큰 정규화                                ← 무변경
NearbyPlaceItem           kakaoPlaceId/placeName/categoryName/categoryGroupCode/lat/lng/distance ← 무변경
WebView ↔ RN 메시지 6종   INIT / SET_MARKERS / RECENTER / SET_SELECTED / READY / MARKER_TAP / MAP_TAP / BOUNDS_CHANGED / ERROR ← 무변경(신규 0)
mapHtml.ts                                                                        ← diff 0
accumulateNearbyItems     { prev, next, cap } → NearbyPlaceItem[]                  ← 무변경
DB / RPC / RLS / 마이그레이션                                                      ← 0건
```

> **`BOUNDS_CHANGED`는 유지하되 의미가 바뀐다**: "조회하라"가 아니라 **"현재 뷰포트는 여기다"** 라는 통지다. 소비자(`useNearbyPlaces.setBounds`)가 더 이상 이 신호로 네트워크를 태우지 않는다. `mapHtml`의 idle 리스너 + INIT 직후 0ms/60ms 이중 emit도 **그대로 둔다**(§6 E3).

### 4.1 신규 순수 유틸 — `src/features/map/bboxDrift/`

```ts
export type Bounds = { sw: Coords; ne: Coords };
export type BboxSpan = { lat: number; lng: number };

/** bbox의 변(span). 0폭 방어 없이 절대값만 — 판정은 호출부. */
export const bboxSpan = ({ bounds }: { bounds: Bounds }): BboxSpan;

/** 이전 bbox 대비 이동·줌 변화를 "뷰포트 폭 배수"로 정규화한다(도 단위 절대값이 아님 — 줌 레벨 무관 판정). */
export const bboxDrift = ({ prev, next }: { prev: Bounds; next: Bounds }): {
  shift: number; // max(|Δcenter.lat|/prevSpan.lat, |Δcenter.lng|/prevSpan.lng). prevSpan 0 → Infinity
  zoom: number;  // max(next/prev, prev/next) — lat·lng 중 큰 쪽. 0 분모 → Infinity
};

/** 재검색 버튼 노출/첫 조회 보정의 단일 판별자. */
export const exceedsResearchThreshold = ({ prev, next }: { prev: Bounds; next: Bounds }): boolean;
//  = drift.shift >= NEARBY_RESEARCH_DRIFT || drift.zoom >= NEARBY_RESEARCH_ZOOM_RATIO
```

**상수(이 파일이 단일 출처)**

| 상수 | 값 | 근거 |
|---|---|---|
| `NEARBY_RESEARCH_DRIFT` | `0.35` | 뷰포트 폭의 35% 이동 = 화면의 3분의 1이 새 영역. 미세 팬·관성은 흡수하고 "다른 동네를 보고 있다"는 켠다 |
| `NEARBY_RESEARCH_ZOOM_RATIO` | `1.6` | 카카오 레벨 1단(≈2배)보다 낮게 잡아 한 단 줌아웃이면 켜진다 |

> **`NEARBY_MIN_MOVE = 1e-3`(도 단위 절대값)을 이 정규화 판정으로 대체한다** — 도 단위 임계는 줌 레벨에 따라 의미가 달라져(레벨 1에선 화면 전체, 레벨 8에선 1픽셀) 버튼 노출 기준으로 쓸 수 없다.

### 4.2 신규 순수 유틸 — `src/features/map/nearbyPreloadBbox/`

```ts
/** 폴백 뷰포트 span(도) — 카카오 level 5(=initialRegion DEFAULT_ZOOM)의 6인치 기기 근사값.
 *  ⚠ 실측 이월(§10 D1): 첫 세션에서 관측된 실제 span으로 교정한다. */
export const NEARBY_FALLBACK_SPAN: BboxSpan = { lat: 0.018, lng: 0.022 };

/**
 * 탭 진입 즉시(지도 부팅 전) 조회할 bbox를 추정한다.
 * 센터는 initialRegion과 **같은 우선순위**(현재위치 → 핀 bbox 중심)로 잡되,
 * DEFAULT_REGION(서울시청) 폴백은 **추정하지 않는다** → null(선로딩 스킵).
 * @returns 추정 bbox 또는 null(신호 없음 — 확실히 틀릴 조회를 미리 태우지 않는다)
 */
export const nearbyPreloadBbox = ({ coords, pins, span }: {
  coords: Coords | null;
  pins: MuklogPin[];
  span: BboxSpan;
}): Bounds | null;
```

**설계 근거(중요)**: 리더 지시는 "직전 세션의 마지막 조회 bbox 영속화가 가장 정확"이었으나, 그건 **지도가 그 자리에 그려질 때만** 참이다. 지도 센터는 `initialRegion({coords, pins})`로 **마운트 시점에 이미 알 수 있다**. 따라서 영속해야 할 것은 bbox 전체가 아니라 **span(뷰포트 폭)** 이다 — 기기 화면 크기와 줌 레벨의 함수라 세션 간 안정적이고, 센터는 매번 새로 계산하는 편이 정확하다. 여행·이동 후에도 어긋나지 않는다.

**span은 세션 첫 `BOUNDS_CHANGED`에서만 기록한다.** INIT 직후 `relayout()+setCenter(center)` 뒤의 첫 emit은 구조적으로 **항상 level 5 뷰포트**이므로(mapHtml `initEmitFirstBounds`), 이 값만이 다음 세션의 level 5 추정에 재사용 가능하다. 이후 사용자 줌으로 바뀐 span은 기록하지 않는다. → **브리지에 `level` 필드를 추가할 필요가 없다**(메시지 계약 무변경 유지).

### 4.3 신규 저장소 모듈 — `src/features/map/nearbyCache/`

`pinsCache.ts`를 **규율까지 그대로 미러**한다(계정 격리가 이 스프린트의 유일한 보안면).

```ts
export const NEARBY_CACHE_VERSION = 1;
/** `muklog:map-nearby:v1:{userId}` — pinsCache(`muklog:map-pins:v1:{userId}`)와 네임스페이스 분리. */
export const nearbyCacheKey = ({ userId }: { userId: string }): string;

export type NearbyCacheArea = {
  key: string;                 // quantizeKey(bounds) — 소수 4자리
  bounds: Bounds;
  items: NearbyPlaceItem[];    // 그 area의 원본 응답(누적본 아님)
};
export type NearbyCachePayload = {
  version: number;
  savedAt: number;             // Date.now() — TTL 판정
  span: BboxSpan | null;       // 세션 첫 BOUNDS_CHANGED에서 관측한 level 5 span
  areas: NearbyCacheArea[];    // LRU 순(오래된 것 → 최근). 최대 NEARBY_CACHE_AREA_CAP
};

/** 어떤 실패도 조용히 null. userId 미확보면 읽지 않는다(no-op). 절대 throw 금지. */
export const loadNearbyCache = async ({ userId }: { userId: string }): Promise<NearbyCachePayload | null>;
/** best-effort 쓰기. userId 미확보면 no-op. 절대 throw 금지. */
export const saveNearbyCache = async ({ userId, payload }: { userId: string; payload: NearbyCachePayload }): Promise<void>;
```

| 상수 | 값 | 근거 |
|---|---|---|
| `NEARBY_CACHE_TTL_MS` | `86_400_000` (24h) | 가게 폐업·신규 반영. 만료 시 **`areas`만 폐기하고 `span`은 보존**한다 — span은 기기·줌의 성질이라 시간에 부패하지 않고, 버리면 선로딩 정확도만 떨어진다 |
| `NEARBY_CACHE_AREA_CAP` | `8` | 8 areas × 15건 × ≈200B ≈ **24KB**. 초과 시 LRU로 가장 오래된 area부터 퇴출 |
| `NEARBY_CACHE_WRITE_DEBOUNCE_MS` | `2000` | 조회 직후 연속 변경을 1회 쓰기로 수렴. 언마운트 시 대기 중 쓰기는 **flush**(취소 아님) |

**유효성 검증(로드 시, 하나라도 실패하면 전체 miss)**: `version === NEARBY_CACHE_VERSION` · `Array.isArray(areas)` · 각 area가 `{key:string, bounds:{sw,ne 유한수}, items:배열}` · 각 item이 `{kakaoPlaceId:string, lat:number(유한), lng:number(유한)}` 최소형 충족. **TTL 초과는 부분 폐기**(areas=[], span 유지)로 miss와 구분한다.

### 4.4 훅 계약 — `useNearbyPlaces` (★ 생산자↔소비자 경계면)

```ts
export type UseNearbyPlacesResult = {
  // ── 기존(무변경) ─────────────────────────────────────────
  markers: MapMarker[];          // 지도 핀용(kind:'nearby'). 실패/빈 → []
  items: NearbyPlaceItem[];      // NearbySpotCard lookup용
  status: NearbyPlacesStatus;    // 'idle' | 'loading' | 'ready' | 'error'

  // ── 의미가 바뀜 ──────────────────────────────────────────
  /** BOUNDS_CHANGED 싱크. **네트워크를 태우지 않는다** — 드리프트 판정 + span 1회 기록만.
   *  예외: 이 마운트에서 아직 한 번도 조회하지 않았다면(선로딩 스킵/미도착) 여기서 첫 조회를 발사한다(0틱). */
  setBounds: (next: Bounds) => void;

  // ── 신규 ────────────────────────────────────────────────
  /** 탭 진입 즉시 1회. 하이드레이션 완료 뒤 실행되도록 내부 큐잉된다. 2회차 이후 호출은 no-op. */
  preload: (args: { bbox: Bounds }) => void;
  /** "이 지역에서 검색" 탭. 현재 bbox로 1회 조회. status==='loading'이면 no-op(연타 가드). */
  research: () => void;
  /** 버튼 노출 여부. 부모는 이 값만 보고 렌더한다(컴포넌트는 자기 노출 조건을 모른다). */
  researchAvailable: boolean;
};
```

**`researchAvailable === true`의 정의 (4조건 AND)**

1. `status !== 'loading'` — 조회 중엔 숨긴다(스피너는 버튼 내부가 아니라 미노출로 처리)
2. `lastQueried !== null` — 이 마운트에서 최소 1회 조회(또는 캐시 적용)가 끝났다
3. `currentBounds !== null` — READY 이후 뷰포트를 한 번은 받았다
4. `exceedsResearchThreshold({ prev: lastQueried.bounds, next: currentBounds })`

**자동 소멸**: `research()` 성공/캐시히트 시 `lastQueried = currentBounds` → drift 0 → 버튼이 스스로 숨는다. 별도 상태 없음.
**에러 시 유지**: 실패는 `lastQueried`를 갱신하지 않으므로 버튼이 그대로 남는다 = **재시도 어포던스**(무음 에러 정책과 정합).

**내부 실행 순서 계약 (`pinsCache` 선례의 "순차" 규율)**

```
mount
 └─ hydrate()   getSession → userId → loadNearbyCache
                 → span 적재(없으면 NEARBY_FALLBACK_SPAN)
                 → areas → cacheRef(양자화 키 맵)
                 → items = areas를 LRU 순으로 accumulateNearbyItems(cap: NEARBY_ACCUM_CAP)
                 → status: 'idle' → 'ready'(items 있을 때만)
 └─ hydrate 완료 후에만 pending preload 실행   ← 순차. 뒤집히면 캐시 히트를 놓치고 invoke가 샌다
```

**`preload({ bbox })` 판정 순서**

```
1) 첫 bbox 확정 시 prune 1회: 하이드레이션된 area 중 bbox 중심에서 span의
   NEARBY_HYDRATE_MAX_SPANS(=3)배 밖에 있는 것은 폐기(items도 재계산)   ← 여행/이동 후 타 도시 핀 오염 차단
2) quantizeKey(bbox)가 cacheRef에 있으면 → invoke 0, 누적 병합, lastQueried 갱신, status='ready'
3) 없으면 → searchNearby 1회(0틱, cleanup 가능한 setTimeout — 언마운트 유령 invoke 0)
```

**첫 조회 허용분(first-load allowance)** — 마운트당 **최대 1회**만 자동 발사된다. 소비 주체는 `preload` 또는 (선로딩이 스킵/미도착이면) 첫 `setBounds`. 소비 후에는 어떤 `setBounds`도 네트워크를 태우지 않는다.

**보정 조회(correction)** — 선로딩 bbox와 실제 INIT bbox가 `exceedsResearchThreshold`를 넘으면 **1회에 한해** 자동 재조회한다(사용자 팬이 아니라 "첫 화면"이 아직 확정되지 않은 상태이므로 버튼을 띄우지 않는다). 이 경로에서만 첫 진입 invoke가 **2회**가 될 수 있다 — 상한은 테스트로 잠근다(§5-1 C4). 그 외 모든 경로는 ≤1.

**유지되는 것**: `NEARBY_FIRST_DELAY_MS = 0`(0틱 leading-edge + cleanup 회수) · `NEARBY_QUANTIZE_DECIMALS = 4` · `NEARBY_ACCUM_CAP = 100` · `requestSeqRef` 레이스 가드 · 에러 시 누적 유지.

### 4.5 삭제 심볼과 기존 단언 처리 방침 ★

> 0814 §4.6이 확립한 규칙("심볼 삭제를 지시하는 계획은 그 심볼에 묶인 기존 단언의 처리 방침을 함께 명시한다")을 적용한다.

| 심볼 | 처리 | 이유 |
|---|---|---|
| `NEARBY_DEBOUNCE_MS = 500` | **삭제** | 트레일링 자동 조회가 사라져 참조처가 0이 된다. 버튼 조회는 사용자 명시 액션이라 디바운스가 오히려 무반응으로 읽힌다(연타는 `status==='loading'` 가드가 처리) |
| `NEARBY_MIN_MOVE = 1e-3` · `isBelowMinMove` | **삭제** | 도 단위 절대 임계 → 줌 정규화 임계(`exceedsResearchThreshold`)로 **승격 대체**(§4.1) |

**원칙: 문장이 아니라 의도를 보존한다.** 위 심볼에 묶인 기존 단언은 후속 심볼 위에서 **동등 이상 강도로 재작성**하고, 원 단언이 지키던 불변식을 주석으로 남긴다. **완화 0**(단언 수 감소 없음, 조건 약화 없음). 재작성본의 하중은 뮤테이션으로 실증한다(§5-1 M표). 폐기 심볼의 **잔재 0**을 단언한다(`NEARBY_DEBOUNCE_MS`·`NEARBY_MIN_MOVE` grep 0).

**기존 `useNearbyPlaces.spec.ts` 17건 전량 처분표** (developer는 이 표대로 움직인다)

| # | 기존 케이스 | 처분 | 재작성 후 잠그는 불변식 |
|---|---|---|---|
| 1 | `setBounds 후 디바운스 1회 호출 → markers ready` | **재작성** | 선로딩 없이 첫 `setBounds` → **0틱** 1회 호출 → ready (허용분 소비) |
| 2 | `T1-a 첫 조회는 0틱` | 존속 | 무변경 |
| 3 | `T1-b 동기 즉시가 아니라 0틱` | 존속 | 무변경(cleanup 회수 가능성) |
| 4 | `T1-c 두 번째 이동은 트레일링 — 500ms 후 호출` | **재작성** | 두 번째 이동은 **어느 시점에도** 호출 0. 대신 `researchAvailable === true` |
| 5 | `T1-d 첫 조회 후 연속 대이동 → 총 2회` | **재작성** | 첫 조회 후 연속 대이동 → 추가 invoke **0**, `researchAvailable === true` |
| 6 | `T2 첫 진입 idle 다발 3회 → 정확히 1회` | 존속 | 무변경(허용분 1회 수렴) |
| 7 | `T2-b 첫 emit + belt-and-suspenders 재emit → 1회` | 존속 | **필수 존속** — mapHtml 0ms/60ms 이중 emit이 살아 있다 |
| 8 | `G1 디바운스 수렴: warm 후 대이동 3회 → 1회` | **재작성** | warm 후 대이동 3회 → invoke **0**(더 강한 가드레일) |
| 9 | `캐시: 동일 bbox 재 setBounds → 0회 추가` | 존속 | 무변경 |
| 10 | `최소 이동 임계: 미세 이동은 미호출` | **재작성** | 미세 이동은 `researchAvailable`을 **켜지 않는다**(의도 승격) |
| 11 | `임계 이상 이동 → 호출` | **재작성** | 임계 이상 이동 → invoke 0 · `researchAvailable === true`, `research()` 시 1회 |
| 12 | `레이스: stale 응답 폐기` | 존속 | 무변경 |
| 13 | `T2 누적 합집합(kakaoPlaceId dedup)` | 존속 | 무변경 |
| 14 | `T3 캐시 히트도 누적 합류` | 존속 | 무변경 |
| 15 | `T4 에러 시 누적 유지 + status=error` | 존속 | 무변경 |
| 16 | `T5 cap 초과 LRU 퇴출` | 존속 | 무변경 |
| 17 | (spec import) `NEARBY_DEBOUNCE_MS` 참조 | **교체** | `NEARBY_RESEARCH_DRIFT` 등 신규 상수로 |

→ **존속 10 · 재작성 6 · 교체 1 · 삭제 0.** (`it()` 케이스는 16건 = 존속 10 + 재작성 6이고, 17번 행은 `it()`가 아니라 `NEARBY_DEBOUNCE_MS` **import 문 1행의 교체**라 존속에 합산되지 않는다.) 총 단언 수는 증가만 한다.

### 4.6 계측 계약 — `src/features/map/nearbyTrace/`

```ts
export const NearbyTraceEvent = {
  PreloadStart: 'preload:start',   // { source: 'coords' | 'pins' }
  PreloadSkip:  'preload:skip',    // { reason: 'no-signal' }
  CacheHydrate: 'cache:hydrate',   // { areas: number, items: number, ageMs: number | null }
  CacheHit:     'cache:hit',       // { key }
  InvokeStart:  'invoke:start',    // { key, trigger: 'preload' | 'first-bounds' | 'correction' | 'research' }
  InvokeEnd:    'invoke:end',      // { key, ms, count, ok: boolean }
  MapReady:     'map:ready',       // {} — MapTabScreen이 READY 수신 시
  FirstRender:  'render:first',    // { kind: 'saved'|'wish'|'nearby', gapMs: number }
} as const;

/** __DEV__가 아니면 즉시 return(인자 평가 외 비용 0). 타이머·리스너·전역 상태 0. */
export const traceNearby = ({ event, detail }: { event: NearbyTraceEvent; detail?: Record<string, unknown> }): void;
```

**`gapMs` 정의**: `map:ready` 수신 시각을 t0으로, 각 kind의 마커가 **처음 1건 이상 지도에 실린 시각**(INIT 탑재 포함) − t0. INIT에 이미 실렸으면 **0**(= 목표 상태). 음수는 0으로 클램프.

---

## §5. 화면 · UX

### 5.1 신규 컴포넌트 — `MapResearchButton` (ui-publisher 소유)

**기획이 확정하는 것은 위치·동작 계약뿐이다. 비주얼 실값은 ui-publisher가 ui-spec.md에서 확정한다.**

| 항목 | 계약 |
|---|---|
| props | `{ onPress: () => void; testID?: string }` — **표시 여부를 스스로 모른다**(부모가 `researchAvailable`로 조건 렌더) |
| 배치 | 지도 상단 **가로 중앙**. 기준선 `top = insets.top + theme.spacing[56]`(범례와 같은 기준선) |
| 배치 제약 ⚠ | ① `MapLegend`(`left: 16`)와 **가로로 겹치지 않을 것** — 좁은 기기에서 중앙 pill이 범례를 덮으면 ui-publisher가 기준선을 한 단 내린다 ② `CategoryFilterBar`(`top: insets.top+12`, edge-bleed 가로 스크롤)의 **탭 영역을 가리지 않을 것** ③ 하단 스팟 카드·`MapLocateButton`과 무간섭 |
| 카피 | **"이 지역에서 검색"** (§11 Q3로 확정 요청) |
| 상태 | 단일 상태만. `status==='loading'`이면 부모가 **미노출**(비활성 스피너 아님 — 노출/미노출 이분법이 상태 수를 줄인다) |
| 킷 근거 | **킷에 원본 없음.** 떠 있는 레이어 선례 `MapLocateButton`(surface 배경 · `radius.full` · `shadow.fab` · press `scale 0.92`)에서 파생. 헤어라인 보더가 아니라 그림자를 쓰는 이유 = 지도 위에 떠 있는 레이어이기 때문(브랜드 규칙의 예외가 아니라 선례 준수) |
| 접근성 | `accessibilityRole="button"`, `accessibilityLabel="이 지역에서 검색"` |

### 5.2 상태 흐름 (사용자가 보는 것)

| 상황 | 화면 |
|---|---|
| 재진입(캐시 hit) | 지도가 뜨는 **그 순간** 주변 핀이 이미 붙어 있다. 버튼 없음 |
| 첫 진입(캐시 miss, 좌표 있음) | 선로딩이 WebView 부팅(≈1.2s)과 병렬로 돈다 → 대부분 INIT에 탑재. 늦으면 SET_MARKERS 1회로 증분 추가(0814 증분 렌더라 기존 핀 깜빡임 0) |
| 첫 진입(좌표·핀 없음) | 선로딩 스킵 → 첫 `BOUNDS_CHANGED`에서 0틱 조회(오늘과 동일) |
| 팬·줌(임계 미만) | **아무 일도 없다.** 핀 고정, 버튼 없음 |
| 팬·줌(임계 초과) | 상단에 "이 지역에서 검색" 등장. 핀은 **여전히 고정**(팝인 0) |
| 버튼 탭 | 버튼 숨김 → 결과 도착 → 핀 증분 추가 → 버튼은 drift 0이라 계속 숨김 |
| 버튼 탭 후 실패 | 핀 불변(누적 유지), 배너 없음, **버튼 다시 노출**(재시도) |
| 지도 SDK 에러 → 재시도 | 재-INIT. 누적 핀이 그대로 INIT에 실려 복원. **자동 재조회 없음**(허용분 소진) |

**원티드 토큰 사용 지점**: 버튼 배경 `color.surface` · `radius.full` · `shadow.fab` · 라벨 타이포·간격은 ui-publisher 확정. 신규 토큰 추가 **0**.

---

## §6. 작업 목록 (TDD: Red → Green → Refactor)

### W0. 계측 모듈 + baseline 측정 (선행)
- [ ] `src/features/map/nearbyTrace/`(모듈 + spec + index) 신설. `MapTabScreen`에 `map:ready`·`render:first` 3종 배선, `useNearbyPlaces`에 invoke 계측 배선.
- **인수조건 A0-1**: `__DEV__ = false`에서 `traceNearby`를 20회 호출해도 `console.*`가 **0회** 호출된다(`src/test/setDevMode.ts` 사용).
- **인수조건 A0-2**: `__DEV__ = true`에서 `invoke:end`가 `{ ms:number, count:number, ok:boolean }`을 담는다.
- **인수조건 A0-3**: 모듈 전역에 타이머·리스너·`setInterval`이 **0개**(소스 grep 단언).
- [ ] **개선 전 baseline을 dev-notes에 기록**(실기기 1회): READY→nearby 첫 렌더 gapMs, invoke ms.

### W1. `nearbyCache` — 영속 저장소
- [ ] 모듈 + spec 신설. `pinsCache.spec.ts`의 케이스 구조를 미러.
- **A1-1**: `userId: ''`면 `load`는 null, `save`는 **AsyncStorage 미접촉**(setItem 호출 0).
- **A1-2**: 키 없음 / JSON 파싱 실패 / `version !== 1` / `areas` 비배열 / item 최소형 위반 → 전부 **조용히 null**, throw 0.
- **A1-3**: `savedAt`이 TTL 초과 → `areas: []` 반환하되 **`span`은 보존**된다.
- **A1-4**: 다른 `userId`로 저장한 값은 읽히지 않는다(키 격리).
- **A1-5**: `AsyncStorage.setItem`이 reject해도 `save`가 throw하지 않는다.
- **A1-6**: 키 문자열이 `muklog:map-nearby:v1:{userId}`이며 `pinsCacheKey`와 **충돌하지 않는다**(두 키 동시 단언).

### W2. `bboxDrift` + `nearbyPreloadBbox` — 순수 유틸
- [ ] 두 모듈 + spec 신설.
- **A2-1**: 폭 0.02인 bbox에서 중심을 0.006 이동(=0.3배) → `exceedsResearchThreshold` **false**; 0.008 이동(=0.4배) → **true**.
- **A2-2**: span이 2배가 되면(줌아웃 1단) `zoom = 2` → **true**. 1.5배면 **false**.
- **A2-3**: `prevSpan`이 0(퇴화 bbox)이면 `shift`·`zoom`이 `Infinity` → true(방어적으로 재검색 허용). NaN 반환 0.
- **A2-4**: `nearbyPreloadBbox`는 `coords` 있으면 그 중심 ± span/2, 없고 `pins` 있으면 핀 bbox 중심, 둘 다 없으면 **null**.
- **A2-5**: 반환 bbox의 span이 인자 `span`과 정확히 일치한다(sw<ne 정렬 보장, 극단 좌표에서 NaN 0).

### W3. `useNearbyPlaces` 재작성 ★핵심
- [ ] 하이드레이션 → 선로딩 → 명시 재검색 상태 기계로 전면 교체. §4.5 처분표대로 기존 17행 처리(`it()` 16건 = 존속 10 무수정 + 재작성 6, import 1행 교체).
- **A3-1 (하이드레이션)**: 캐시에 area 2건이 있으면 마운트 후 `items`가 두 area의 합집합(dedup·cap 적용)이 되고 `searchNearby` 호출 **0**.
- **A3-2 (순차)**: 하이드레이션이 resolve되기 **전에** `preload`를 호출해도, 캐시 히트면 `searchNearby` 호출 **0**(순서 뒤집힘 방지).
- **A3-3 (선로딩 miss)**: 캐시 miss + `preload({bbox})` → 0틱에 `searchNearby` **1회**, 인자는 `boundsToRect(bbox)`.
- **A3-4 (자동 조회 폐기)**: 선로딩 완료 후 임계 초과 `setBounds`를 3회 연속 → 추가 invoke **0**, 모든 타이머 소진 후에도 **0**.
- **A3-5 (버튼 노출)**: 위 상태에서 `researchAvailable === true`. 임계 미만 이동만 하면 **false**.
- **A3-6 (명시 조회)**: `research()` → 1회 invoke → 성공 후 `researchAvailable === false`.
- **A3-7 (연타 가드)**: in-flight 중 `research()`를 3회 더 호출 → 총 invoke **1회**.
- **A3-8 (에러 후 재시도)**: `research()` 실패 → `items` 불변 · `status==='error'` · `researchAvailable` **true 유지** → 재탭 시 1회 더 invoke.
- **A3-9 (보정)**: 선로딩 bbox와 임계 초과로 다른 INIT bbox가 `setBounds`로 오면 **1회** 자동 재조회. 그 뒤 임계 초과 이동은 다시 **0회**.
- **A3-10 (허용분 상한)**: 첫 진입 어떤 경로에서도 사용자 액션 없이 발생하는 invoke는 **≤2**.
- **A3-11 (span 기록)**: 세션 첫 `setBounds`의 span만 캐시 payload에 기록되고, 이후 `setBounds`의 span은 payload를 바꾸지 않는다.
- **A3-12 (prune)**: 하이드레이션된 area 중 첫 bbox 중심에서 span 3배 밖 area는 폐기되어 `items`에 포함되지 않는다.
- **A3-13 (쓰기 디바운스)**: 조회 성공 3회 연속 → `saveNearbyCache` 호출 **1회**(2s 후). 언마운트 시 대기 중 쓰기는 **flush된다**.
- **A3-14 (언마운트 가드)**: 선로딩 in-flight 중 언마운트 → setState 경고 0, invoke 취소(0틱 타이머 cleanup).
- **A3-15 (레이스)**: 기존 12번 케이스 무수정 통과.

### W4. 화면 배선 + 버튼 (ui-publisher `MapResearchButton` 선행 필요)
- [ ] `MapTabScreen`: 마운트 effect에서 `nearbyPreloadBbox`로 bbox 산출 → `nearby.preload({bbox})` **1회**(첫 non-null bbox만; 좌표가 늦게 와도 재발사 0). `researchAvailable` 조건 렌더 + `onPress={nearby.research}`.
- **A4-1**: `permission.coords`가 있는 상태로 마운트 → `preload`가 **정확히 1회** 호출된다(coords가 warm→fresh로 승격돼도 재호출 0).
- **A4-2**: `coords: null` · `pins: []`로 마운트 → `preload` 호출 **0**(스킵), 첫 `BOUNDS_CHANGED`에서 조회.
- **A4-3**: `researchAvailable === true`일 때만 `map-research-button` testID가 렌더된다.
- **A4-4**: 버튼 탭 → `nearby.research`가 1회 호출된다.
- **A4-5**: **INIT 페이로드에 nearby 마커가 포함된다** — READY 수신 시 `items`에 nearby가 있으면 `buildInitScript`의 `markers`에 `kind:'nearby'`가 섞여 들어간다(`sendInit` 코드 변경 없이 성립함을 테스트가 lock).
- **A4-6**: 버튼 오버레이의 `top`이 `insets.top`을 흡수한다(inset 0이면 현행과 동일) — `map-headerless` 규율 준수, **inset이 하단으로 새지 않는다**.

### W5. 회귀 · 뮤테이션 · 게이트
- [ ] `npm test` 전량 green(직전 기록 **199 suites / 2,038 tests** 기준 회귀 0 — 착수 시 재측정해 dev-notes에 baseline 기록).
- [ ] `npx tsc --noEmit` 오류 0.
- [ ] 폐기 심볼 잔재 0: `grep -rn "NEARBY_DEBOUNCE_MS\|NEARBY_MIN_MOVE\|isBelowMinMove" src` → **0건**.
- [ ] `mapHtml.ts` · `searchNearby.ts` · `accumulateNearbyItems.ts` · `supabase/functions/nearby-search/` **diff 0** 확인.
- [ ] 뮤테이션(§5-1 M표) 전부 killed. **격리 사본은 `src/` 밖**(스크래치패드) + testMatch 미매치 파일명 + 즉시 삭제.

---

## §5-1. 테스트 케이스 (TDD)

### 단위 테스트 대상 (jest-expo + @testing-library/react-native)
- **순수 유틸**: `bboxDrift` · `nearbyPreloadBbox` — 경계값 중심(임계 직전/직후, 0폭, 극단 좌표, NaN 0).
- **저장소**: `nearbyCache` — AsyncStorage **모킹**. 정상/버전불일치/파싱실패/TTL/빈 userId/쓰기 reject.
- **훅**: `useNearbyPlaces` — `searchNearby` 모킹 + `nearbyCache` 모킹 + fake timers.
- **화면**: `MapTabScreen` — 훅 모킹으로 preload 호출 횟수·버튼 조건 렌더·INIT 페이로드 검증.

### 모킹/스모크 경계 (`docs/testing-strategy.md`)
- `nearby-search` Edge Function · Kakao Local: **모킹**(`searchNearby` 모킹으로 대체). 이 스프린트는 Edge를 건드리지 않는다.
- AsyncStorage: **모킹**(`@react-native-async-storage/async-storage` jest mock — `pinsCache.spec.ts` 선례).
- 실제 WebView·Kakao SDK·실기기 타이밍: **디바이스 스모크 단독 권위**(§9).

### 비용 가드레일 케이스 (invoke 호출 횟수를 테스트가 강제)

| # | 시나리오 | 기대 invoke |
|---|---|---|
| **C1** | 캐시 hit 재진입 + 선로딩 | **0** |
| **C2** | 캐시 miss + 선로딩 성공 + INIT bbox 임계 미만 | **1** |
| **C3** | 캐시 miss + 선로딩 스킵(신호 없음) | **1**(첫 bounds) |
| **C4** | 캐시 miss + 선로딩 + INIT bbox 임계 초과(보정) | **2** ← 유일한 순증 경로, 상한 |
| **C5** | 임의 진입 후 팬·줌 10회 | 추가 **0** |
| **C6** | 팬 10회 후 버튼 1탭 | 추가 **1** |
| **C7** | 버튼 연타 5회(in-flight) | **1** |
| **C8** | 같은 area로 되돌아와 버튼 탭 | **0**(양자화 캐시 히트) |
| **C9** | 첫 emit + 60ms 재emit(mapHtml 이중 emit) | **1** |

### 뮤테이션 (재작성 단언의 하중 실증)

| # | 뮤턴트 | 죽여야 할 케이스 |
|---|---|---|
| M1 | `setBounds`에서 허용분 가드를 제거(항상 조회) | A3-4 / C5 |
| M2 | 하이드레이션과 선로딩의 순서를 뒤집음 | A3-2 |
| M3 | `researchAvailable`에서 `status!=='loading'` 조건 제거 | A3-7 |
| M4 | `research()` 실패 시에도 `lastQueried`를 갱신 | A3-8 |
| M5 | `exceedsResearchThreshold`를 `shift`만으로 판정(zoom 무시) | A2-2 |
| M6 | `nearbyCache`에서 `userId` 가드 제거 | A1-1 / A1-4 |
| M7 | TTL 초과 시 `span`까지 폐기 | A1-3 |
| M8 | prune(span 3배) 제거 | A3-12 |
| M9 | 보정 조회를 1회 제한 없이 허용 | A3-9 / A3-10 |
| M10 | `traceNearby`의 `__DEV__` 가드 제거 | A0-1 |
| M11 | `preload` 재호출 가드(1회) 제거 | A4-1 |
| M12 | 쓰기 디바운스 flush를 취소로 변경 | A3-13 |

---

## §7. 엣지케이스

| # | 상황 | 계약된 동작 |
|---|---|---|
| **E1** | 캐시 없음(최초 설치) | 선로딩이 유일한 조회. 실패해도 지도·saved·wish 핀 정상(무음) |
| **E2** | 캐시 payload 손상·버전 불일치 | 조용한 miss → 선로딩으로 진행. 예외 0 |
| **E3** | mapHtml의 0ms/60ms **이중 emit** | 양자화 키 dedup + 허용분 1회로 invoke **1회**(C9). idle 리스너도 유지되지만 이제 네트워크를 태우지 않는다 |
| **E4** | 여행·이동 후 재진입(캐시가 타 도시) | 첫 bbox 확정 시 span 3배 밖 area **prune** → 타 도시 핀이 누적·카드 lookup을 오염시키지 않는다 |
| **E5** | 계정 전환 / 로그아웃 후 재로그인 | `userId` 키잉으로 타 계정 캐시 미노출. `userId` 미확보면 read/write **no-op** |
| **E6** | `userId` 없음(세션 만료) + 조회 시도 | 캐시는 no-op, `searchNearby`는 JWT 부재로 실패 → 무음 error, 누적 유지 |
| **E7** | 오프라인 진입 | 캐시 hit면 핀 표시(오프라인에서도 지난 핀 보임 = 캐시 영속의 부수 이득). miss면 무음 error |
| **E8** | 조회 중 탭 이탈·언마운트 | 0틱 타이머 cleanup으로 유령 invoke 0, setState 경고 0. 대기 중 캐시 쓰기는 flush |
| **E9** | 바텀탭 왕복(지도 탭은 언마운트되지 않음) | 훅 state 유지 → 누적·버튼 상태 그대로. `useRefreshOnFocus`는 saved·wish만 갱신(nearby 무관) |
| **E10** | 지도 SDK 에러 → "다시 시도"(재-INIT) | `resetMarkers` 후 누적 핀 전량 재렌더로 복원. **자동 재조회 없음**(허용분 소진) — 필요하면 사용자가 버튼 |
| **E11** | 권한 거부 | `coords: null` → 핀 bbox 폴백, 둘 다 없으면 선로딩 스킵(E-C3 경로). 지도 차단 0 |
| **E12** | nearby 조회 실패 | 누적 유지 · `status='error'` · **배너 없음**(현행 무음 정책) · 버튼 유지(재시도 어포던스) |
| **E13** | 극단 줌아웃(전국 뷰) | rect가 커져 15건이 성기게 온다(현행과 동일). zoom 임계로 버튼은 켜진다 |
| **E14** | 누적 cap(100) 도달 | LRU 퇴출(무변경). 하이드레이션도 **cap 재적용** |
| **E15** | 캐시 area cap(8) 초과 | 가장 오래된 area 퇴출. 저장 규모 ≈24KB 상한 유지 |
| **E16** | 커플 2명 동시 사용 | nearby는 **개인 뷰포트 파생**이라 공유 상태 0. 캐시는 userId·기기별 → 동시성 충돌 경로 **없음**(확인 항목) |
| **E17** | `MapPrewarm`(숨김 WebView) | `__muklogInit`을 받지 않아 `BOUNDS_CHANGED`를 내지 않는다 → 선로딩·조회 트리거 **0**. `MapPrewarm`이 `useNearbyPlaces`를 import하지 않는 정적 규율 **유지** |
| **E18** | 시계 조작·`savedAt` 미래값 | `ageMs < 0` → 만료로 보지 않고 유효 처리(방어). NaN이면 miss |

---

## §8. QA(qa-logic)가 교차검증할 경계면

| # | 생산자 ↔ 소비자 | 확인 포인트 |
|---|---|---|
| **B1** | `useNearbyPlaces` 반환 shape ↔ `MapTabScreen` | 신규 3종(`preload`·`research`·`researchAvailable`) 배선. **`setBounds`가 더 이상 조회 트리거가 아님**을 소비자가 전제하는지(주석·테스트) |
| **B2** | `mapHtml.emitBounds`(idle + 0ms/60ms) ↔ `setBounds` | 이중 emit·idle 다발이 invoke를 늘리지 않는지(C9·C5). **mapHtml diff 0** |
| **B3** | `nearbyCache` ↔ `pinsCache` | 키 네임스페이스 분리, 계정 격리 규율 동일(userId no-op·버전·조용한 miss·no-throw). **보안 최우선 검토면** |
| **B4** | `nearbyCache` ↔ `useNearbyPlaces` 하이드레이션 | TTL 부분 폐기(span 보존), cap 재적용, prune, 쓰기 디바운스·flush |
| **B5** | `nearbyPreloadBbox` ↔ `initialRegion` | **센터 우선순위가 동일**한지(현재위치 → 핀 bbox). 어긋나면 선로딩이 지도와 다른 곳을 미리 받는다. `initialRegion` **무수정** 확인 |
| **B6** | 삭제 심볼 ↔ 기존 spec 17행 | §4.5 처분표대로인지 — `it()` 16건 중 존속 10 **무수정**, 재작성 6이 **동등 이상 강도**, 완화 0, 폐기 심볼 잔재 0. (17번 행은 `it()`가 아니라 import 1행 교체라 존속 계수에 넣지 않는다) |
| **B7** | `searchNearby` ↔ Edge `nearby-search` | **양쪽 diff 0**. 요청 body가 여전히 `{sw, ne}`뿐인지 |
| **B8** | `nearbyTrace` ↔ 프로덕션 번들 | `__DEV__` 가드로 no-op, 타이머·리스너·전역 0, 앱 경로 오버헤드 0 |
| **B9** | `MapPrewarm` ↔ 선로딩 | 프리워머가 nearby 조회를 트리거하지 않는지(import 0 정적 규율 유지, E17) |
| **B10** | `MapResearchButton`(ui-publisher) ↔ `MapTabScreen` | 컴포넌트가 노출 조건을 모르는지(props에 `visible` 없음), 배치가 범례·필터바·FAB·카드와 무간섭인지, `insets.top` 흡수가 하단으로 새지 않는지 |
| **B11** | 비용 | C1~C9 상한이 테스트로 잠겨 있는지. **자동(사용자 액션 없는) invoke 상한 2**가 코드로 강제되는지 |
| **B12** | 코드 컨벤션(`docs/code-convention.md`) | useCallback/useMemo 지양 · 화살표 함수 · named-object 인자 · `useEffect` 명명 함수 · enum-style 상수 |

---

## §9. 디바이스 스모크 (실기기 단독 권위)

| # | 시나리오 | 기대 |
|---|---|---|
| **S1** | 앱 재설치 후 첫 진입(캐시 없음) | 지도와 거의 동시에 주변 핀 등장. gapMs를 dev-notes에 기록 |
| **S2** | 앱 재시작 후 재진입(캐시 hit) | **지도가 뜨는 순간 이미 핀이 있다**(gapMs = 0). invoke 0 |
| **S3** | 지도를 여러 번 팬 | 핀이 **전혀 바뀌지 않는다**. 임계 넘으면 상단 버튼 등장 |
| **S4** | 버튼 탭 | 버튼 사라지고 새 핀만 증분 추가. 기존 핀 깜빡임 0 |
| **S5** | 기내모드에서 버튼 탭 | 핀 불변, 배너 없음, 버튼 다시 노출 |
| **S6** | 다른 지역으로 이동 후 재진입 | 이전 도시 핀이 붙어 있지 않다(prune 동작) |
| **S7** | 버튼과 범례·필터칩·FAB·스팟 카드 동시 노출 | 겹침·가림 0(qa-visual 항목) |
| **S8** | 계정 전환 | 이전 계정 주변 핀이 보이지 않는다 |
| **S9** | `NEARBY_FALLBACK_SPAN` 교정 | 첫 세션 `BOUNDS_CHANGED`의 실제 span을 로그로 확인해 상수 교정 여부 판단(§10 D1) |

---

## §10. 비용 가드레일 체크 (architecture §6)

| 항목 | 영향 |
|---|---|
| **Kakao Local 호출** | **순감.** 오늘: 첫 진입 1 + 팬 1회당 1(구조적으로 ~1초 지연 보장). 개편 후: 첫 진입 0~2(캐시 hit면 0), 팬 N회에 **0**, 명시 탭당 1. 세션당 호출 수가 사용자 팬 횟수에 비례하던 것이 **사용자 의도 횟수에 비례**로 바뀐다 |
| **Supabase Edge invoke** | 위와 동일(nearby-search는 Edge 경유). **순증 0 이하** — 유일한 순증 경로 C4(첫 진입 2회)는 팬 1회만으로 상쇄 |
| **Supabase DB / Storage / Realtime** | **0** (마이그레이션·쿼리·구독 0) |
| **폴링 / 타이머 / 리스너** | **0 순증.** 신규 타이머는 0틱 조회 1개 + 캐시 쓰기 디바운스 1개뿐이며 둘 다 cleanup 대상. 폴링·`AppState`·Realtime 0 |
| **AWS** | **0** |
| **로컬 저장소** | AsyncStorage ≈**24KB** 상한(area 8 × 15건). `pinsCache`와 별도 키 |
| **디바이스 자원** | 감소 — 팬 중 SET_MARKERS 재주입이 사라진다(0814 증분 렌더와 합쳐 DOM 작업 추가 0) |
| **번들** | 신규 모듈 4개(순수 유틸 2 + 저장소 1 + trace 1) 수 KB. `nearbyTrace`는 `__DEV__` 가드 no-op |

**D1 — 이월 측정**: `NEARBY_FALLBACK_SPAN`은 계산 근사값이다. W0 계측으로 **실제 level 5 span을 1회 관측**해 dev-notes에 기록하고, 20% 이상 어긋나면 상수를 교정한다(캐시가 없는 최초 진입 정확도에만 영향).

---

## §11. 미결 질문 (리더 확인 요청)

| # | 질문 | 기획 권고 |
|---|---|---|
| **Q1** | 첫 진입에서 "캐시 miss + 선로딩 bbox 드리프트"일 때 invoke **2회**를 허용하는가? | **허용 권고.** 대안(선로딩 결과를 버리고 1회만)은 첫 화면이 오히려 느려진다. 상한 2를 테스트(C4·A3-10)로 잠근다 |
| **Q2** | nearby 조회 실패를 UI로 노출할 것인가? | **현행 무음 유지 권고.** 버튼이 계속 떠 있는 것이 재시도 어포던스이고, 지도 위 배너는 saved 핀 에러와 우선순위 경합이 생긴다 |
| **Q3** | 버튼 카피 확정 — "이 지역에서 검색" / "이 지역 다시 검색" / "여기서 다시 찾기" | **"이 지역에서 검색"** 권고(레퍼런스 관용구, 해요체 예외로 지도 관용 표현 허용) |
| **Q4** | 케치테이블 우하단 "내주변" 버튼을 신설하는가? | **불요 권고.** 기존 `MapLocateButton`이 같은 자리(`right/bottom: 16`)에서 현재위치 재취득+RECENTER를 이미 담당한다. 신설하면 중복. 단 **"내 위치로 이동 후 자동 재검색"** 을 붙일지는 별도 결정 — 붙이면 명시 모델에 자동 조회가 되살아나므로 **붙이지 않기를 권고** |
| **Q5** | wish 핀 캐시 영속(같은 팝인 증상)을 다음 스프린트로 확정하는가? | **확정 권고.** `pinsCache` 패턴 3번째 적용이라 표면이 작고, 이번 스프린트에 넣으면 1기능 규칙을 깬다 |

---

## §12. 완료 정의 (Definition of Done)

- [ ] W0~W5 완료 · A0-1~A4-6 전부 테스트로 커버
- [ ] `npm test` 전량 green(회귀 0) · `npx tsc --noEmit` 0
- [ ] 기존 `useNearbyPlaces.spec.ts` 17행 §4.5 처분표대로 처리(`it()` 16건 = 존속 10 무수정 + 재작성 6, import 1행 교체 · **완화 0**)
- [ ] 폐기 심볼 잔재 0(grep) · `mapHtml`·`searchNearby`·`accumulateNearbyItems`·Edge Function **diff 0**
- [ ] 뮤턴트 M1~M12 전부 killed(격리 사본 `src/` 밖 · testMatch 미매치 · 즉시 삭제)
- [ ] `ui-spec.md`(ui-publisher) · `dev-notes.md`(developer) 작성 — dev-notes에 **baseline·개선 후 gapMs 실측** 포함
- [ ] `qa-report-logic.md` · `qa-report-visual.md` 병렬 작성
- [ ] 디바이스 스모크 S1~S9 수행·기록 (S2·S3·S6가 핵심)
- [ ] `architecture.md` §5 백로그에 `map-pin-loading` 행 추가(nearby 로딩 모델 = 선로딩 + 영속 캐시 + 명시 재검색으로 전환됐음을 설계 문서에 반영)

---

## §13. 개정 이력

| # | 날짜 | 개정 내용 | 제기 | 반영 위치 |
|---|---|---|---|---|
| R0 | 2026-08-20 | 최초 작성 | 리더 지시 | 전체 |
| R1 | 2026-08-20 | **§4.5 처분 요약 산술 정정** — "존속 11 · 재작성 6"을 **"존속 10 · 재작성 6 · 교체 1"** 로 고쳤다. 17번 행은 `it()` 케이스가 아니라 `NEARBY_DEBOUNCE_MS` **import 문 1행**이라 존속으로 합산할 수 없었다(`it()` 실측 16건). **처분표 본문은 원래 정확했고 요약 산술만 어긋난 것**이라 계약·인수조건 변경 0. 리더 지시는 §4.5·§12 두 곳이었으나 **같은 숫자가 §6 W3(개발 지시)·§8 B6(QA 판정 기준)에도 있어 4곳 전부 정정** — 특히 B6는 qa-logic이 대조할 기준값이라 11로 두면 검증이 틀린 수를 찾게 된다 | qa-logic **P1**(B6 기준선 실측, 비차단) | 리더 2026-08-20 | §4.5 · §6 W3 · §8 B6 · §12 |
