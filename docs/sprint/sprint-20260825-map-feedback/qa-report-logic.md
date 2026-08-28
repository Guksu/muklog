# QA Report — Logic / 통합 정합성 (sprint-20260825-map-feedback · U55 · U4 · U5)

> 검증자: qa-logic · 범위: 로직·통합 정합성·비용/보안 가드레일·TDD·코드 컨벤션 (**비주얼 충실도 제외** — `qa-report-visual.md`가 단독 권위)
> 기준: `plan.md` §3 계약 · §5-1 테스트 케이스 · §7 qa-logic 7쌍 · §8 비용 · §9 완료 기준 / `docs/code-convention.md` · `docs/testing-strategy.md`
> 방법: 생산자↔소비자 양쪽 동시 읽기 + **뮤테이션 21종**(dev-notes M1~M4 재현 4 + 신규 17) + 렌더 프로브 4종

---

## 최종 판정: **PASS — 계약 위반(불일치) 0건**

plan §3의 모든 계약(상수 실값·핸들러 시그니처·등록 위치/순서·`researchAvailable` 식·CSS 2곳·토큰 위치·적용 대상)과 §5-1 인수조건이 코드·테스트 양쪽에서 충족된다. 회귀 0(`map-clustering`·`map-pin-loading` 계약 전량 무수정 green).

다만 **신규 발견 5건**(차단 0)을 아래 §6에 라우팅한다 — 기능 1(U10 경계), 문서 정확성 2, 테스트 인프라 1, 스코프 스필오버 1.

| 구분 | 건수 |
|------|------|
| 통과 | §7 경계면 7쌍 전부 · 비용 가드레일 전 항목 · 컨벤션 전 항목 |
| 불일치(계약 위반 → 즉시 수정) | **0** |
| 신규 발견(라우팅 대상, 차단 아님) | 5 (F1~F5) + 관찰 2 (F6·F7) |
| 미검증(스모크 이월) | S1~S8 유지 + **S9 신규**(F1 실환경 확인) |

### 소스 동결 확인

검증 시작·종료 시점 11개 파일 SHA-256 **전부 동일**(뮤테이션 후 원본 복원 완료, 임시 파일 0):

```
734cfba1…  src/features/map/mapHtml/mapHtml.ts
b72eafb4…  src/features/map/useNearbyPlaces/useNearbyPlaces.ts
ec950992…  src/navigation/screens/MapTabScreen/MapTabScreen.tsx
4b85f7f8…  src/theme/tokens/tokens.ts
af4fd667…  src/features/map/components/MapWebView/MapWebView.tsx
4465358c…  src/test/createMapSandbox/createMapSandbox.ts
6a63ea1c…  src/features/map/mapHtml/mapHtml.spec.ts
f833165e…  src/features/map/useNearbyPlaces/useNearbyPlaces.spec.ts
c7e9b2e4…  src/navigation/screens/MapTabScreen/MapTabScreen.spec.tsx
0c563fae…  src/theme/tokens/tokens.spec.ts
c759b65c…  src/features/map/components/MapWebView/MapWebView.spec.tsx
```

- 시작: `npm test` 207 suites / 2233 tests green · `npx tsc --noEmit` exit 0
- **종료: `npm test` 207 suites / 2233 tests green · `npx tsc --noEmit` exit 0** (재측정 완료)
- `git status` 기준 신규 파일 0(프로브 spec 2건은 실행 직후 삭제 확인). 프로덕션 영구 수정 0.

---

## 1. §7 qa-logic 경계면 7쌍 — 판정

### 1) `ensureClusterer`(등록) ↔ `mkClusterZoomIn`(모듈 변수 `mkMap`) ↔ `__muklogInit`(mkMap 교체) — **통과**

- 생산자 `mapHtml.ts:187` `addListener(created, 'clusterclick', mkClusterZoomIn)` — 핸들러는 **인자 `cluster` 하나만** 받는다(`mapHtml.ts:145`).
- 소비자 `mapHtml.ts:146-152` — `mkMap`을 클로저/인자로 잡지 않고 **모듈 변수를 매번 읽는다**. `__muklogInit`(`mapHtml.ts:392`)이 `mkMap`을 새 인스턴스로 교체해도 항상 현행 지도에 걸린다.
- **뮤테이션 확인(N4a)**: 생성 시점 지도를 캡처(`mkBoundMap`)하도록 바꾸면 **U55-4 + 구조 문자열 단언 2건 동시 red**. 이중 잠금.

### 2) 강등 경로(`demoteClusterer`·`applyOverlayDelta` catch) ↔ 신규 리스너 — **통과(전제 정정 필요 → F3·F4)**

- `demoteClusterer`(`mapHtml.ts:285-293`)는 `mkClusterer.clear()` 후 `mkClusterer=null`로 두고 **리스너를 해제하지 않는다.** 실 SDK는 `addListener(target,…)` 기준 **타깃별 디스패치**이고, 폐기된 클러스터러는 `clear()`로 마커 0 → 버블 0이라 클릭 자체가 불가능하다 → **실환경 부작용 0**.
- 단, 부작용이 0인 근거는 dev-notes §2 표 3행이 적은 "`mkClusterZoomIn`의 `!mkMap`/`typeof getCenter` 가드"가 **아니다**. 프로브로 확인: 런타임 강등(`throwOnAddMarkers`) 후 샌드박스에서 `clusterclick`을 강제 발화하면 리스너가 살아 있어 `setLevel`이 **1건 걸린다**(`{"level":3,…animate:{duration:300}}`). 즉 가드는 이 경로를 막지 않는다 → **F3**(문서 정확성) · **F4**(샌드박스가 타깃을 무시해 실 SDK와 다르게 발화).
- `U55 E1`(`available:false` / `constructThrows`)는 애초에 리스너가 등록되지 않아 **vacuous하게 green**이다(N7 참조).

### 3) `researchAvailable`(생산) ↔ 재검색 pill 렌더(소비) ↔ `research()`의 `currentBoundsRef` 가드 — **통과**

- 생산 `useNearbyPlaces.ts:422-427`, 소비 `MapTabScreen.tsx:429-440`(`nearby.researchAvailable ? … <MapResearchButton onPress={nearby.research}/>`), 실행 가드 `useNearbyPlaces.ts:328-329`(`currentBoundsRef.current` null이면 return).
- `currentBounds !== null`이 **AND 밖 공통 전제**로 유지돼 노출 조건 ⊆ 실행 가능 조건. **"눌러도 no-op인 버튼" 0**.
- 두 값(`currentBounds` state / `currentBoundsRef`)은 `setBounds`(`:333-335`)에서 **같은 틱에 함께** 갱신되므로 어긋날 구간이 없다.
- 캐시 히트 경로(`startQuery` → `applyCachedArea`)도 `status='ready'` + `commitQueried`를 수행하므로 탭이 무반응으로 보이지 않는다.
- **뮤테이션 확인(M4 재현)**: 전제를 드리프트 절 안으로만 옮기면 **U4-3 red**.

### 4) `useNearbyPlaces` 에러 경로 ↔ 비용 상한(자동 invoke ≤2) — **통과**

- `git diff` 기준 이 파일의 프로덕션 변경은 **`researchAvailable` 식 + 주석뿐**이다. `startQuery` 호출 지점은 그대로 4곳(`runPreload` 1 · `setBounds` 2 · `research` 1)이고 신규 자동 경로 0.
- `C1`~`C9`(자동 invoke 상한) 전량 무수정 green. 에러 후 자동 재시도 0 — 열린 것은 **사용자 탭 경로뿐**.

### 5) `overlay` 우선순위 사슬 ↔ `mapReady` 배선 — **통과**

- 사슬(`MapTabScreen.tsx:366-400`): `mapErrored` → 핀 `error` → **로딩(`state.status==='loading' || !mapReady`)** → 권한 거부. `mapReady`는 `MapInboundType.Ready` 수신 시 true(`:229-237`), 이후 false로 되돌아가는 경로 없음.
- **비동기 완료 순서 순열(프로브 4종)**: ① 핀 error가 READY보다 먼저/나중 — 둘 다 핀 에러 배너 유지(로딩이 가로채지 않음) ② READY 후 ERROR(늦은 실패) — 지도 에러 배너 ③ READY 전 ERROR — 지도 에러 배너 ④ pill+로딩 동시 노출은 **구조적으로 불가**(pill은 `currentBounds`≠null ⇒ BOUNDS_CHANGED ⇒ INIT ⇒ READY 선행).
- **뮤테이션 확인(N13/N14)**: 로딩을 최상위로 올리면 핀 에러·SDK 에러 2건 red / 권한 아래로 내리면 U5-3b red. 사슬 4단 전부 하중 있음.

### 6) `createMapSandbox` 확장 ↔ `mapHtml` 실제 코드(§3.1 문서 근거 대조) — **통과(충실도 지적 1건 → F4)**

| 샌드박스가 모사한 표면 | 실제 사용처 | 문서 근거(plan §3.1) | 판정 |
|---|---|---|---|
| `Map.getLevel()` / `setLevel(level, options)` | `mapHtml.ts:147·152` | Kakao 공식 `Map` 메서드 | 실존 ✅ |
| `clusterclick` + handler(cluster) | `mapHtml.ts:187` | 공식 이벤트 목록 + `addClustererClickEvent` 샘플 | 실존 ✅ |
| `Cluster.getCenter()` | `mapHtml.ts:153` | 공식 `Cluster` 클래스 | 실존 ✅ |
| `MarkerClustererOptions.disableClickZoom` | `mapHtml.ts:94·181` | 공식 샘플 | 실존 ✅ |
| `listenerCount` / `fireClusterEvent` | 테스트 관측용(앱 도달 0) | — | 관측 API(모사 아님) |

**지어낸 API 0.** 샌드박스는 `mapHtml`이 실제로 호출하는 표면만 갖는다(`fireClusterEvent`도 `getCenter`만 노출). 단 디스패치 모델이 실 SDK와 다르다 → **F4**.

### 7) `mapHtml.spec` 문자열 단언 ↔ 주석/다른 분기 — **통과(단, 3건은 주석 공격에 죽음 — 실행 단언이 전부 커버)**

§2 뮤테이션 표 참조. 요지:
- `disableClickZoom: true`(옵션 블록) → **정의가 남으면 생존**(M1). 호출부는 U55-2가 잠근다.
- 줌인 상수 3종 → **주석에 원문을 남기면 생존**(N1·N2·N3). 실값은 U55-1(STEP·DURATION)·U55-5(MIN_LEVEL)가 잠근다.
- `mkClusterZoomIn` 시그니처/구조 단언 → 가드 제거를 **유일하게** 잡는다(N7). 실행 단언 중복 없음.
- 등록 순서 단언 → 순서 뒤집기를 **유일하게** 잡는다(N5). U55-6은 순서와 무관하게 green(→ F2).
- 등록 개수(`/'clusterclick'/g` 길이 1) → 중복 등록을 U55-3·U55-4와 함께 삼중으로 잡는다(N6).
- `#EFEAE3` 3곳 개수 + 블록 추출 → 개수를 주석으로 채우는 우회도 red(N15).

---

## 2. 뮤테이션 표 (21종 · 전량 원본 복원 후 재-green 확인)

기준선: 207 suites / 2233 tests green. 각 뮤턴트는 **전체 `npm test`**로 판정.

### dev-notes M1~M4 재현

| # | 뮤턴트 | 기대 | 실제 red 스펙 | 판정 |
|---|--------|------|--------------|------|
| M1 | 생성자에서 `disableClickZoom: MK_CLUSTER_OPTIONS.disableClickZoom` 줄만 삭제(정의·주석 유지) | red | **U55-2만**(1 failed / 2232 passed). 옵션 블록 문자열 단언은 정의가 남아 **생존** | 재현 ✅ dev-notes 기술 정확 |
| M2 | `#map` 규칙의 `background: #EFEAE3` 1곳 삭제 | red | **U5-1**(1 failed) | 재현 ✅ |
| M3 | `lastQueried !== null &&` 절 제거 | red | **36건 대량 red**(A2 포함) — null 참조로 훅 전체 붕괴 | 재현 ✅ (단 뮤턴트가 거칠다 → N8로 보완) |
| M4 | `currentBounds !== null`을 드리프트 절 **안**으로 이동 | red | **U4-3만**(1 failed) | 재현 ✅ |

> 참고: `currentBounds !== null`을 **양쪽 절 모두**에 복제한 등가 재배치는 green(2233 passed) — 의미 보존이므로 정상이다(테스트 결함 아님).

### qa-logic 신규 뮤턴트 17종

| # | 뮤턴트 | 기대 | 실제 red 스펙 | 판정 |
|---|--------|------|--------------|------|
| N1 | `MK_CLUSTER_ZOOM_STEP` 1→2 **+ 주석에 원문 문자열 유지** | red | **U55-1만**. 문자열 단언은 주석이 대신 충족해 **생존** | 실행 단언이 커버 ✅ / 문자열 단언 취약 확인 |
| N2 | `MK_CLUSTER_ZOOM_DURATION_MS` 300→200 + 주석 유지 | red | **U55-1만**(문자열 단언 생존) | 동일 ✅ |
| N3 | `MK_MAP_MIN_LEVEL` 1→0 + 주석 유지 | red | **U55-5만**(하한 클램프) | 동일 ✅ |
| N4a | 생성 시점 지도를 캡처(`mkBoundMap`) — 재-INIT 후 옛 지도 참조 | red | **U55-4** + 구조 문자열 단언 | 이중 잠금 ✅ |
| N5 | `addListener`를 `mkClusterer = created` **후**로 이동 | red | **문자열 순서 단언만**. **U55-6은 green** | ⚠️ **F2** |
| N6 | 재사용(재-INIT) 분기에서도 `clusterclick` 등록 | red | **U55-3 + U55-4 + 개수 단언**(3건) | 삼중 잠금 ✅ |
| N7 | `mkClusterZoomIn` 가드 전량 제거(`!mkMap`·`!cluster`·`typeof getCenter`·`typeof level`) | red | **문자열 구조 단언만**. 실행 테스트 **0건** red | ⚠️ **F3** |
| N8 | 드리프트 절(`exceedsResearchThreshold`)만 제거 | red | 임계 스펙·**A3-5**·A3-6·U4-2 (4건) | ✅ |
| N9 | `status !== 'loading'` 공통 전제 제거 | red | **A3-7**(연타 중 버튼 숨김) | ✅ |
| N10 | `status === 'error'` 복구 절 제거(U4 되돌리기) | red | **U4-1 · U4-2** | ✅ |
| N11 | 로딩 분기에서 `|| !mapReady` 제거(U5 되돌리기) | red | **U5-2 · U5-3 · U5-3b** | ✅ |
| N12 | 핀 `loading` 항 제거(`!mapReady`만) | red | **B3**("핀 loading이면 로딩 오버레이") | ✅ B3 보정이 하중 복원 확인 |
| N13 | 로딩 분기를 우선순위 **최상위**로 | red | 핀 에러 스펙 · SDK 에러 스펙 (2건) | ✅ |
| N14 | 로딩 분기를 권한 안내 **아래**로 | red | **U5-3b** | ✅ |
| N15 | `html, body` 배경 삭제 **+ 주석으로 `#EFEAE3` 개수 유지** | red | **U5-1**(블록 추출 단언이 잡음) | ✅ 개수 우회 방어 확인 |
| N16 | `tokens.mapSurface` → `#FFFFFF` | red | U5-4 2건 + U5-5 (3건, 2 suites) | ✅ |
| N17 | `MapWebView` 컨테이너 `backgroundColor` 제거 | red | **U5-5** | ✅ |

**요약**: 21/21 뮤턴트가 의도대로 red(또는 등가 변형으로 정당하게 green). **살아남은 뮤턴트 0.** 새로 드러난 "죽은 단언"은 문자열 계약 4건(N1·N2·N3·M1)이나 모두 **실행 단언이 같은 계약을 중복 잠그고** 있어 커버리지 구멍이 아니다. 실행 단언이 없는 유일한 계약은 **가드(N7)와 등록 순서(N5)** 두 건이며, 각각 F3·F2로 기록한다.

---

## 3. 비용 가드레일 (plan §8) — 전 항목 통과

| 항목 | 검증 방법 | 결과 |
|------|----------|------|
| Kakao Local(`nearby-search`) 호출 | `git diff`로 `startQuery` 호출 지점 불변 확인(4곳) + `C1`~`C9` 무수정 green | **증가 0** |
| 자동(액션 없는) invoke 상한 | `C1`~`C9` green + N9/N10 뮤턴트로 테스트 생존 확인 | **불변 2회**(선로딩 1 + 보정 1) |
| U55 확대의 네트워크 영향 | `setLevel` → `idle` → `emitBounds` → `setBounds`는 통지 경로일 뿐(`useNearbyPlaces.ts:357` "아무 일도 하지 않는다") | **네트워크 0** |
| Kakao Map SDK 다운로드 | `sdk.src` 문자열 불변(`libraries=clusterer`), 기존 단언 유지 | 불변 |
| Supabase(DB·RPC·Storage·Realtime·Edge Function) | 마이그레이션·정책 파일 변경 0 | **0건** |
| 신규 타이머 | `git diff` 전수 — `setTimeout` 신규 0 | **0** |
| 신규 리스너 | WebView 내부 `clusterclick` **클러스터러당 1개**. 재-INIT 재사용 분기 증가 0(U55-3·N6로 잠김) | +1(설계대로) |
| Kakao 키 노출 | `mapHtml`은 placeholder 치환 유지, REST 키 미접촉 | 노출 0 |
| 신규 의존성 · 에셋 · AWS | `package.json` 변경은 `testPathIgnorePatterns` 1줄뿐(dev-notes §10 메모와 일치) | 0 / 0 / 미사용 |

---

## 4. TDD · 테스트 품질 (plan §5-1 ↔ spec 대응)

| 인수조건 | 대응 테스트 | 존재 | 유의미(뮤턴트) |
|---|---|---|---|
| U55-1 중심 anchor 300ms 1단계 확대 | `mapHtml.spec:975` | ✅ | N1·N2·N4a |
| U55-2 `disableClickZoom:true` + 옵션 회귀 0 | `:990` | ✅ | M1 |
| U55-3 재-INIT 후 리스너 1개 | `:1001` | ✅ | N6 |
| U55-4 새 Map에 적용 | `:1013` | ✅ | N4a·N6 |
| U55-5 최소 레벨 클램프 | `:1025` | ✅ | N3 |
| U55-6 등록 실패 → 강등 | `:1036` | ✅ | (순서와 무관 — F2) |
| U55 E1 강등 상태 강제 발화 | `:1053` | ✅ | ⚠️ vacuous(F3) |
| U4-1/2/3 · A2 재작성 | `useNearbyPlaces.spec:723·735·755·772` | ✅ | N8·N9·N10·M3·M4 |
| U5-1 CSS 2곳 + 개수 | `mapHtml.spec:457` | ✅ | M2·N15 |
| U5-2/3/3b 로딩 배너 | `MapTabScreen.spec:1343·1352·1364` | ✅ | N11·N14 |
| U5-4 토큰 · U5-5 컨테이너 | `tokens.spec:129` · `MapWebView.spec:61` | ✅ | N16·N17 |
| B1~B3 보정 | `:255` · `:389` · `:245` | ✅ | N12(B3 하중 복원 확인) |

- `npm test` **207 suites / 2233 tests green**, `npx tsc --noEmit` **exit 0**(종료 시점 재측정).
- 단위 경계 준수: Kakao SDK 실동작·줌 애니메이션 체감은 단위 대상 아님 → 스모크로 분리(§5).
- 경계·실패 경로 커버: 최소 레벨(U55-5)·등록 실패(U55-6)·강등(E1)·뷰포트 미수신(U4-3)·0틱 발사 전(A2)·권한 거부 후순위(U5-3b).
- **B3 외에 "대신 충족돼 죽은" 단언 추가 탐색**: `!mapReady` 도입으로 하중이 옮겨갈 후보(오버레이를 단언하는 전 스펙)를 N11·N12·N13·N14 4종으로 전수 공격 — B1·B2는 READY 발화로 깨짐이 해소됐고, B3은 하중이 복원됐으며, **추가로 죽은 단언은 발견되지 않았다.**

---

## 5. 코드 컨벤션 (`docs/code-convention.md`) — 통과

| 항목 | 확인 | 결과 |
|---|---|---|
| `useCallback`/`useMemo` 실제 호출 0 | `grep -rn "useCallback\|useMemo" src/` | 주석 언급 외 실제 호출은 `useRefreshOnFocus`의 문서화된 단일 예외뿐(기존, 이번 스프린트 신규 0) |
| 컴포넌트·훅 화살표 `const` | `grep -rn "^export function" src/` | **0건**. `MapWebView`가 표현식 본문 → 블록 본문으로 바뀐 것은 `useTheme` 도입 때문이며 화살표 `const` 유지 |
| named-object 인자 | 신규/변경 함수 전수 | 준수. 예외 2곳은 **외부 API 강제**로 정당: `mkClusterZoomIn(cluster)`(Kakao 이벤트 핸들러 계약) · `FakeMap.setLevel(level, options)`(SDK 시그니처 모사, 파일에 사유 주석 있음) |
| useEffect 명명 함수 | `grep -rn "useEffect(() =>" src/` | 프로덕션 **0건**(히트 3건은 spec 내부 목 컴포넌트, 기존) |
| enum-style 상수 | `MapInboundType.Ready` · `MapStatusTone.Loading` 사용 | 준수. WebView 내부 `'clusterclick'`은 격리 HTML(TS 상수 도달 불가) |
| 파일명 = 대표 심볼 | 변경 5파일 | 준수 |
| 토큰 경유(raw hex 0) | `MapWebView`가 `theme.color.mapSurface` 경유 | 준수. `mapHtml`/`tokens.ts` palette의 hex 직박음은 격리 HTML·토큰 원천이라는 기존 선례(`.mk-pin`·`mapWishPin`)와 동일 |
| 튜닝 단일 지점 | 줌인 상수 3종이 `MK_CLUSTER_OPTIONS` 이웃 블록에 모임 | 준수(`map-clustering` §3.7 규율 계승) |

---

## 6. 신규 발견 (라우팅 대상 — 차단 0)

### F1 — SDK 로드 실패 후 "다시 시도"가 **영구 로딩 스피너 + 재시도 버튼 소실**로 끝난다 → `developer`/`sprint-planner`(U10)

- **경로**: 오프라인 진입 등으로 `sdk.onerror` → `ERROR(SDK_LOAD_FAILED)` → 에러 배너 + "다시 시도" → `handleRetry`(`MapTabScreen.tsx:335-339`)가 `setMapErrored(false)` + `sendInit()`. 그런데 SDK가 죽은 페이지라 `__muklogInit`이 없어 **READY도 ERROR도 다시 오지 않는다**. `mapReady`는 여전히 false → `MapTabScreen.tsx:392` 로딩 분기가 걸려 **"지도를 불러오는 중이에요" 스피너가 영구 잔류**하고, 배너에 액션이 없어 재시도 어포던스가 사라진다.
- **증거(렌더 프로브)**: `에러배너=true` → 다시 시도 → `에러배너=false · 스피너=true · 로딩카피=true · 다시시도버튼=false`.
- **탭이 언마운트되지 않는 바텀탭**이라 세션 내내 갇힌다. plan §6 **E6**("READY도 ERROR도 안 오면 로딩 영구 잔류 — U10 대상")의 구체 사례지만, E6은 "조용한 실패"로만 기술돼 **사용자가 버튼을 누른 뒤 도달하는 경로**는 문서화돼 있지 않다.
- **이번 스프린트 차단 아님**(U10이 실패 배너·타임아웃 소유). 수정안 2택:
  1. 최소 조치 — `handleRetry`에서 `!mapReady`이면 `setMapErrored(false)`를 하지 않는다(READY 수신 시 `:230`이 어차피 false로 되돌린다). 에러 배너가 유지돼 재시도 어포던스가 남는다.
  2. U10 본안 — 재시도 후 N초 내 READY 미수신이면 에러 톤으로 복귀(타임아웃 배너).
- **스모크 이월 S9 신설**: 기내모드로 지도 탭 진입 → 에러 배너 → "다시 시도" 탭 → 화면 상태 기록.

### F2 — plan §3.1 C / dev-notes §4의 "대입 전 등록" 근거가 사실과 다르다 → `developer`(문서 정정)

- 주장: "대입을 먼저 했다면 탭이 죽은 클러스터가 실제로 만들어진다(회복 불가)".
- 실제: `ensureClusterer`의 **외부 `catch`(`mapHtml.ts:189-191`)가 `mkClusterer = null`로 되돌리므로** 대입 순서와 무관하게 강등된다. **뮤턴트 N5**(등록을 대입 후로 이동)에서 **U55-6은 green**이고 문자열 순서 단언 1건만 red였다.
- 즉 순서는 defense-in-depth이고 **계약을 잠그는 것은 문자열 단언 단독**이다. 코드 자체는 안전하므로 수정 불필요 — `mapHtml.ts:183-186` 주석과 dev-notes §4의 인과 서술만 정정 권고("catch가 이미 보장하며, 순서는 catch가 사라질 미래 리팩터에 대한 이중 안전망").

### F3 — dev-notes §2 표 3행의 "가드가 강등 후 부작용을 막는다"가 사실과 다르다 / `mkClusterZoomIn` 가드는 **실행 테스트 0건** → `developer`

- `U55 E1`은 `available:false`·`constructThrows` 상태라 **리스너가 애초에 등록되지 않는다** → 핸들러가 호출되지 않아 "throw 0 · setLevel 0"이 vacuous하게 성립한다.
- **뮤턴트 N7**(가드 4개 전량 제거) 결과: 실행 스펙 **0건 red**, 문자열 구조 단언 1건만 red.
- 조치: (a) dev-notes §2 근거 문구 정정, (b) 선택적 보강 — 샌드박스에 타깃 인자를 준 뒤(F4) "런타임 강등 후 강제 발화 → `setLevel` 0"을 실행으로 잠그는 케이스 추가.

### F4 — `createMapSandbox.fireClusterEvent`/`listenerCount`가 **`target`을 무시**한다(실 SDK는 타깃별 디스패치) → `developer`(테스트 인프라)

- `createMapSandbox.ts:437-444` — 둘 다 `entry.type === type`만으로 필터한다.
- 결과 ①(과잉 발화): 폐기·강등된 클러스터러의 리스너까지 발화한다. 프로브에서 런타임 강등 후 발화 시 `setLevel` 1건 기록 — 실 SDK에서는 발생 불가능한 사건이다.
- 결과 ②(과잉 계수): 재사용 분기가 실패해 **폐기 후 재생성**되는 경로(`hasSetMap:false`, 또는 `clear()`/`setMap()` throw)에서 `listenerCount === 2`가 되고 탭 1회에 `setLevel` 2건이 기록된다. 실 SDK에서는 새 클러스터러 타깃으로만 디스패치되므로 **실제 결함이 아니다**(고아 리스너 잔존은 미세 누수뿐).
- 현행 단언 방향은 보수적이라 **거짓 green을 만들지 않는다**(U55-3의 `=== 1`은 오히려 더 엄격). 다만 F3의 보강 케이스를 쓰려면 충실도가 필요하다.
- 권고: `fireClusterEvent({ target?, type, center })` · `listenerCount({ target?, type })`로 타깃 필터 추가(기본값 = 현재 `mkClusterer`).

### F5 — `MapWebView` 배경 토큰이 **`MuklogMiniMap`(먹로그 상세 미니맵)에도 전파**된다(계획 미기재) → `qa-visual`

- plan §3.3 ③과 dev-notes §2 표 7행은 적용 대상을 "MapTabScreen · MapPrewarm"으로만 적었으나, `MapWebView`의 실제 소비처는 **3곳**이다: `MapTabScreen.tsx:404` · `MapPrewarm.tsx:53` · **`MuklogMiniMap.tsx:37`**.
- `muklogMiniMapHtml`은 `html, body`에 배경을 지정하지 않으므로(`muklogMiniMapHtml.ts:19`), 미니맵 박스가 로드 전 `#EFEAE3`으로 보인다.
- 로직상 결함 없음(스타일 배열에서 caller `style`이 뒤에 오므로 오버라이드 가능). **킷 대비 적절성 판정은 qa-visual 범위** — 위임한다.

### 관찰(수정 불필요)

- **F6** — `MapWebView`가 신규로 `useTheme()`를 호출한다(`MapWebView.tsx:46`). `useTheme`은 Provider 밖에서 **throw**한다(`ThemeProvider.tsx:31`). 소비처 3곳 모두 `App.tsx`의 `ThemeProvider` 하위임을 코드로 확인(→ 크래시 없음). 단 3곳의 spec이 모두 `renderWithTheme`를 쓰므로 **Provider 밖 회귀는 테스트로 잡히지 않는다**(메모리 `context-hook-probe-position` 선례). 새 소비처를 Provider 밖에 두지 않도록 주의만.
- **F7**(nit) — `createMapSandbox.ts:217-226`의 `config` 기본값 객체에 `throwOnClusterListener`가 빠져 있다(미지정 시 `undefined`로 동작은 정상). 다른 플래그와 대칭을 맞춰 `throwOnClusterListener: false`를 명시하면 읽기 쉽다.

---

## 7. 미검증 · 스모크 이월

단위로 관측 불가(`docs/testing-strategy.md` 경계 — Kakao SDK 실동작·렌더 픽셀). dev-notes §9의 S1~S8을 그대로 유지하고 아래를 추가한다.

| # | 항목 | 합격 기준 | 사유 |
|---|------|----------|------|
| S1~S8 | dev-notes §9 그대로 | — | 이월 |
| **S9(신규)** | 기내모드로 지도 탭 진입 → 에러 배너 → **"다시 시도" 탭** | 영구 로딩 스피너에 갇히지 않는다(갇히면 F1 수정 트리거) | F1 실환경 확인 |
| (인지) O1 | WebView 자체 배경이 첫 프레임을 흰색으로 칠하는지 | qa-visual §5 O1 — **S5 종속** | 중복 조사 안 함(qa-visual 소유) |

---

## 8. plan §9 완료 기준 — qa-logic 담당분

- [x] `npm test` 전량 green(207 suites / 2233 tests) — `map-clustering`·`map-pin-loading` 계약 회귀 **0**
- [x] §5-1 신규 케이스 전부 작성·통과(U55 6+E1 · U4 3+A2 · U5 1/2/3/3b/4/5 · 문자열 계약 3)
- [x] §5-1 "기존 테스트 보정" B1~B3 반영 — B3 하중 복원을 N12로 실측 확인
- [x] `qa-report-logic.md`(본 문서) 작성
- [x] `dev-notes.md`에 SDK 근거(§3)·spec:722 충돌 경위(§5)·스모크 이월(§9) 기록 — **단 §2 표 3행·§4의 인과 서술 정정 필요**(F2·F3)
- [ ] `docs/ux/ux-backlog.md` U55·U4·U5 → `완료` 전환 — **리더 종료 판정 후**(현재 `진행`)
- [ ] `docs/design/architecture.md` 스프린트 표 추가 — **미반영**(리더 소관)
- [ ] `qa-report-visual.md` 통과 — qa-visual **PASS 기수령**

---

## 9. developer 라우팅 요약 (파일:라인 + 수정 방법)

| # | 파일:라인 | 무엇을 | 어떻게 |
|---|-----------|--------|--------|
| F1 | `src/navigation/screens/MapTabScreen/MapTabScreen.tsx:335-339` (+`:392`) | 재시도 후 영구 로딩 dead-end | `handleRetry`에서 `!mapReady`이면 `setMapErrored(false)` 생략(READY 수신 시 `:230`이 해제) **또는** U10에서 타임아웃 배너로 본안 처리. 백로그 U10에 이 경로 명시 |
| F2 | `src/features/map/mapHtml/mapHtml.ts:183-186` + `dev-notes.md §4` | 등록 순서의 인과 서술이 사실과 다름 | 코드 변경 불필요. "외부 catch가 이미 `mkClusterer=null`을 보장하며, 순서는 그 catch가 사라질 미래 리팩터 대비 이중 안전망"으로 정정 |
| F3 | `dev-notes.md §2 표 3행` (+선택: `mapHtml.spec` U55 케이스 1건 추가) | 가드가 강등 경로를 막는다는 근거 오기 / 가드 실행 커버리지 0 | 근거 문구 정정. F4 선행 후 "런타임 강등 → 강제 발화 → `setLevel` 0" 실행 케이스 추가 권고 |
| F4 | `src/test/createMapSandbox/createMapSandbox.ts:437-444` | 이벤트 디스패치가 타깃을 무시 | `fireClusterEvent`/`listenerCount`에 `target?` 추가(기본값 현재 `mkClusterer`)해 실 SDK의 타깃별 디스패치를 모사 |
| F7 | `src/test/createMapSandbox/createMapSandbox.ts:217-226` | 기본값 비대칭(nit) | `config` 기본값에 `throwOnClusterListener: false` 명시 |

**qa-visual 위임**: F5(`MuklogMiniMap`에 `mapSurface` 전파 — `MuklogMiniMap.tsx:37` ↔ `muklogMiniMapHtml.ts:19`).

---

## 10. 재검증 — 후속 조치 델타 (F1~F4 · F7)

> §1~§9는 **본편(2233 tests) 시점**의 기록이며 감사 추적을 위해 원문 그대로 보존한다. 본 절은 developer의 후속 수정분만 **델타로** 재검증한 결과다.
> 델타 기준선: `npm test` **207 suites / 2239 tests green**(2233 + 6) · `npx tsc --noEmit` **exit 0**

### 10.1 델타 판정: **PASS**

F1~F4·F7 다섯 건 모두 의도대로 반영됐고, **기존 하중을 옮기거나 죽인 곳이 없다**. 오히려 잠금이 늘었다(아래 10.6). 신규 발견은 **nit 1건(F8)** 뿐이며 차단 아님.

| 항목 | 조치 | 재검증 결과 |
|---|---|---|
| F1 | `handleRetry`가 `if (mapReady) setMapErrored(false)` (`MapTabScreen.tsx:341-345`) | ✅ dead-end 해소(프로브 직접 확인) · 정상 복구 경로 무손상 · 가드가 **양방향 하중** |
| F2 | `mapHtml.ts:183-189` 주석 + dev-notes §4 정정 | ✅ "catch가 이미 보장, 순서는 이중 안전망, 계약은 문자열 단언이 잠근다"로 정확히 서술 |
| F3 | U55 E2·E3 추가 | ✅ **vacuous 아님** — 직접 뮤턴트로 확인(E3가 가드를 실행으로 잠근다) |
| F4 | `fireClusterEvent`/`listenerCount`에 `target?` 필터 | ✅ 충실도 개선 + **엄격해짐**(역효과 0) |
| F7 | `config` 기본값에 `throwOnClusterListener: false` | ✅ 반영 |
| F5 | 라우팅 안 함(qa-visual §5 O2가 판정) | ✅ **이견 없음**(10.7) |

### 10.2 F1 — dead-end 해소 여부 (렌더 프로브 재실행)

§6 F1에서 썼던 프로브를 그대로 다시 돌렸다(임시 spec, 실행 직후 삭제).

| 시나리오 | 수정 전(§6 기록) | **수정 후** |
|---|---|---|
| ERROR → "다시 시도" | `에러배너=false · 스피너=true · 로딩카피=true · 다시시도=false` | **`에러배너=true · 액션(map-status-action)=true · 스피너=false · 로딩카피=false · 다시시도=true`** |
| 위에서 **2회 연속** 재시도 | — | 에러배너 유지(반복 탭도 갇히지 않는다) |
| 재시도 후 READY 도착 | — | **오버레이 소멸 · 지도 렌더**(정상 복구 경로 회귀 0) |
| READY 후 늦은 ERROR → 재시도 | — | **오버레이 즉시 소멸**(SDK 생존 경로 보존) |
| 핀 error + SDK error 동시 → 재시도 | — | SDK 배너 유지 · 스피너 0. `refresh()`는 호출되므로 핀 재조회는 돈다. 지도 SDK가 실제로 죽은 상태라 최상위 배너가 SDK 에러인 것이 맞다 — **결함 아님** |

→ **F1이 실제로 dead-end를 막는다.** 스피너 영구 잔류·재시도 어포던스 소실 모두 재현되지 않는다.

### 10.3 `if (mapReady)` 가드의 하중 (양방향 뮤턴트)

| # | 뮤턴트 | 실제 red | 판정 |
|---|--------|---------|------|
| D1 | 가드 제거(`setMapErrored(false)` 무조건) | **F1-1** | ✅ 하중 있음 |
| D2 | 가드 반전(`if (!mapReady)`) | **F1-1 + F1-4** | ✅ 반대 방향도 잠김(정상 복구 경로가 F1-4로 보호) |
| D3 | `sendInit()` 제거 | **F1-2** | ✅ "배너 유지"가 재주입을 삼키지 않음이 잠김 |

가드는 **제거·반전 양쪽 모두** red를 만든다. 조건 자체가 load-bearing이며 F1-1 단독이 아니라 F1-1/F1-4 두 방향으로 고정돼 있다.

### 10.4 F3 — E2·E3가 vacuous가 아닌가 (developer 보고를 믿지 않고 직접 확인)

| # | 뮤턴트 | 본편 결과(§2 N7) | **델타 결과** | 판정 |
|---|--------|-----------------|--------------|------|
| D4 | `mkClusterZoomIn` 가드 4개 전량 제거 | 실행 스펙 **0건** red(문자열 단언만) | **U55 E3 red** + 문자열 단언 red | ✅ **F3 해소** — 가드가 이제 실행으로 잠긴다 |
| D4b | `!mkMap` 가드만 제거 | — | 문자열 단언만 red | ⓘ 구조적 한계(아래) |
| D5 | `fireClusterEvent` 타깃 필터 제거 | — | **U55 E2 red** | ✅ E2 load-bearing |
| D6 | `listenerCount` 타깃 필터만 제거 | — | **U55 E2 red** | ✅ E2가 양쪽 필터를 모두 잠근다 |

- **E3는 프로덕션 가드를 실행으로 잠근다**(`!cluster` 경로). 가드를 빼면 `cluster.getCenter()` 접근에서 던져 red — vacuous 아님.
- **E2는 "프로덕션 분기"가 아니라 "샌드박스 충실도 계약"을 잠근다.** D5·D6 어느 쪽을 깨도 red이므로 껍데기는 아니지만, 이 케이스가 보장하는 것은 *실 SDK가 타깃별로 디스패치한다는 모델*이지 `mapHtml`의 코드 경로가 아니다 — dev-notes §11도 같은 취지로 적혀 있어 오해 소지 없음.
- **D4b 한계(결함 아님)**: `!mkMap` 항만은 실행으로 잠글 수 없다. `mkMap`은 `__muklogInit`에서 대입된 뒤 null이 되는 경로가 없고, 클러스터러 없이는 `clusterclick` 자체가 없기 때문이다(= 도달 불가 방어 코드). 문자열 구조 단언이 유일한 잠금인 것이 정상이다.

### 10.5 F4 — 기존 U55 케이스의 하중 이동 여부 · 역효과

**하중 유지 확인(본편 뮤턴트 재실행)**

| # | 뮤턴트 | 본편 결과 | **델타 결과** | 판정 |
|---|--------|----------|--------------|------|
| D7 | 재사용 분기에서도 `clusterclick` 등록(중복) | U55-3·U55-4·개수 단언 | **동일 3건 red** | ✅ 불변 |
| D8 | 생성 시점 지도 캡처(옛 지도 참조) | U55-4 + 구조 단언 | **동일 2건 red** | ✅ 불변 |
| D9(신규) | 리스너를 **잘못된 타깃**(`mkMap`)에 등록 | *(본편에선 타깃 무시라 실행 단언이 못 잡았을 경로)* | **U55-1·U55-3·U55-4·E2 + 순서 단언 = 5건 red** | ✅ **더 엄격해짐** |

→ 리더 우려("기본 타깃 필터에 걸러져 조용히 통과")의 **반대**다. 타깃 필터는 잘못된 타깃 등록이라는 회귀 유형을 새로 잡아내며, 조용히 통과하게 된 케이스는 없다.

**역효과(과잉 엄격) 점검 — 프로브**

| 시나리오 | 본편(타깃 무시) | **델타(타깃 필터)** | 실 SDK 기준 |
|---|---|---|---|
| 폐기·재생성 경로(`hasSetMap:false`, INIT 2회) | `listenerCount=2` · 탭 1회에 `setLevel` **2건**(거짓 경보) | **`listenerCount=1` · `setLevel` 1건**(`maps[0]`=0 / `maps[1]`=1) | ✅ 실 SDK와 일치 |
| 런타임 강등 후 기본 타깃 발화 | `setLevel` 1건(실환경 불가 사건) | **`setLevel` 0** | ✅ 실 SDK와 일치 |
| 런타임 강등 후 **고아 타깃 명시** 발화 | — | **`setLevel` 1건(도달 가능)** | ✅ 테스트 도달 범위 손실 0 |

→ 본편 §6 F4에서 내가 보고한 "재생성 경로 2단계 점프"는 **샌드박스 아티팩트였음이 확정**됐고(수정 후 1건), 필요할 때는 `target`을 명시해 고아 리스너까지 그대로 관측할 수 있다. **관측 능력 손실 없음.**

**타깃 확정 시점**: `fireClusterEvent`가 `dispatchTarget`을 발화 **전에** 고정한다(`createMapSandbox.ts`) — 핸들러가 강등을 유발해도 남은 리스너의 디스패치 대상이 중간에 흔들리지 않는다. 올바른 설계다.

### 10.6 기존 하중 회귀 — 오버레이 우선순위 사슬 · B1~B3 · U5-3b

| # | 뮤턴트 | 본편 결과 | **델타 결과** | 판정 |
|---|--------|----------|--------------|------|
| D10 | 로딩 분기의 `|| !mapReady` 제거 | U5-2·U5-3·U5-3b | **동일 3건** | ✅ 불변 |
| D11 | 핀 `loading` 항 제거(B3 하중) | B3 | **동일 1건** | ✅ 불변 |
| D12 | 로딩 분기를 최상위로 | 2건(핀 에러·SDK 에러) | **5건**(+F1-1·F1-2·F1-3) | ✅ **하중 증가** |
| D13 | 로딩 분기를 권한 안내 아래로 | U5-3b | **동일 1건** | ✅ 불변 |

→ **죽은 단언 0.** F1 테스트 4건이 우선순위 사슬에 추가 하중을 실었다(D12가 2→5건).

### 10.7 F5 — qa-visual 판정에 대한 이견 없음

`qa-report-visual.md:117`(§5 O2)이 `MuklogMiniMap.tsx:36-37`을 **명시적으로 열거하고** 킷 `mk-log.jsx:354` `#ECE6DD`와 같은 웜 계열이라 회귀 아님으로 판정했다. 내 F5의 실질은 "계획 문서에 세 번째 소비처가 빠져 있다"는 **기록 누락 지적**이었고, 이제 스프린트 산출물에 소비처 3곳이 모두 남았으므로 목적이 달성됐다. **비주얼 적절성 판정은 qa-visual 소유 — 이견 없음.**

### 10.8 비용 가드레일 · 컨벤션 재확인

| 항목 | 확인 | 결과 |
|---|---|---|
| 자동(액션 없는) invoke 상한 | `useNearbyPlaces.ts` 델타 변경 **0**(해시 불변 `b72eafb4…`), `C1`~`C9` green | **불변 2회** |
| 신규 타이머 | 델타 `+` 라인 전수 스캔 — `setTimeout`/`setInterval` **0건**. `handleRetry`도 타이머 없이 조건 분기만 | **0** |
| 신규 리스너 | `mapHtml.ts` 델타는 **주석만**(코드행 diff 0). WebView 내부 리스너 수 불변 | **0** |
| Kakao Local 호출 · SDK URL · Supabase · AWS · 의존성 | 변경 파일에 해당 코드 없음 | 불변 / 0 / 미사용 |
| `handleRetry` 스타일 | `MapTabScreen.tsx:341` `const handleRetry = () => {` | 화살표 `const` 유지 ✅ |
| `useCallback`/`useMemo` · `export function` · `useEffect(() =>` | 변경 파일 + `src/` 전수 grep | 프로덕션 신규 위반 **0** |
| 테스트 증가 | 2233 → **2239**(F1-1~F1-4 4건 + E2·E3 2건 = 정확히 +6) | 보고와 일치 |

### 10.9 신규 발견

**F8(nit, 차단 아님) — `fireMapEvent`는 타깃 필터를 못 받았고, 애초에 호출처가 0이다**
`src/test/createMapSandbox/createMapSandbox.ts` `fireMapEvent`는 여전히 `type`만으로 필터한다(F4는 클러스터 이벤트만 고쳤다). 재-INIT 후엔 Map 인스턴스가 2개고 각각 `'click'`·`'idle'` 리스너를 가지므로, 이 API를 쓰면 옛 지도의 리스너까지 발화해 `BOUNDS_CHANGED`가 이중 emit될 수 있다.
다만 `grep -rn "fireMapEvent" src/` 결과 **spec 어디에서도 호출하지 않는다**(본편부터 미사용 표면). 현재 위험 0이므로 조치는 선택이다 — **쓸 때 타깃 필터를 함께 주거나, 안 쓸 거면 표면에서 제거**(컨벤션 "미사용 코드 없음"). `MapSandbox` 타입에서 지우면 `src/test/` 한 파일 수정으로 끝난다.

### 10.10 재검증 종료 상태

- `npm test` **207 suites / 2239 tests green** · `npx tsc --noEmit` **exit 0**
- 델타 뮤턴트 **13종(D1~D13)** 전량 원본 복원 + 재-green 확인. 살아남은 뮤턴트 **0**.
- 임시 프로브 spec 2건(`probe.spec.ts` · `probeMapTab.spec.tsx`) 실행 직후 삭제 — `git status` 기준 신규 파일 **0**(`.ua/`·`docs/sprint/…`는 본 스프린트 산출물).
- git 명령은 읽기(`status`·`diff`·`show`)만 사용. 프로덕션 영구 수정 **0**.

**재검증 전후 해시 동일**(11개 파일, 델타 반영본 기준):

```
b906eb75fb5cf8c5abe2339f4fc040d95fb383dc42ce06e6f63a04b07a34e9f4  src/features/map/mapHtml/mapHtml.ts
b72eafb49a3a45bb05edb0f6d2fc4b800a246a5bb0dfb1fb55ba57ce6450000a  src/features/map/useNearbyPlaces/useNearbyPlaces.ts
6a4fc7c1aab27e74b7e33e23d75f98bfd28d13ee24debc0bb18fd343f34b7c56  src/navigation/screens/MapTabScreen/MapTabScreen.tsx
4b85f7f85529087a9b4f7792aefc3bd362dc34d7d633b73d523bb076e1453a63  src/theme/tokens/tokens.ts
af4fd66785e0b528c2d434075157fd4392747b29e289dc6cd1416b26997ee2ae  src/features/map/components/MapWebView/MapWebView.tsx
6e780f8f4b68afa8bbfda83f8b8b8339fc5439e8449263bd5902d7f89a226053  src/test/createMapSandbox/createMapSandbox.ts
aa9595490656b03380ae861d93d7829d7ff078c20ddcb9e2a342e3da6b35990d  src/features/map/mapHtml/mapHtml.spec.ts
f833165e5482ad27ca44696a383ab2d05021e744ec3f02b0c1150c5253256f2c  src/features/map/useNearbyPlaces/useNearbyPlaces.spec.ts
d873fd63aaee42c62c37b8ee95013d6b0035b6d50d779b0c9be692926d75282e  src/navigation/screens/MapTabScreen/MapTabScreen.spec.tsx
0c563fae6a24cbfceda3072d69a620d3ba6910cad9c7af527ee139c516f42adc  src/theme/tokens/tokens.spec.ts
c759b65c7132a9fb4f3f0c47ce4e0474aa55baaedfe363570bf5dac22e9bfb55  src/features/map/components/MapWebView/MapWebView.spec.tsx
```

(본편 §"소스 동결 확인"의 해시와 비교하면 **델타로 바뀐 파일은 5개** — `mapHtml.ts`(주석만) · `MapTabScreen.tsx` · `createMapSandbox.ts` · `mapHtml.spec.ts` · `MapTabScreen.spec.tsx`. 나머지 6개는 본편과 해시가 동일하다.)

### 10.11 스모크 이월 갱신

- **S9**(dev-notes §9에 반영 확인) — 기내모드 진입 → 에러 배너 → "다시 시도" → **에러 배너·"다시 시도"가 그대로 남는지** 실기기 확인. 단위로는 통과했으나 실 WebView의 ERROR 재발신 여부는 기기에서만 확정된다.
- S1~S8 및 E6(진입 직후의 조용한 실패 = READY도 ERROR도 안 옴)은 **여전히 U10 소유**로 이월. F1은 "사용자가 재시도를 누른 뒤"의 dead-end만 막는다.
