# QA Report (Logic): 지도 핀 클러스터링 (map-clustering)

> 작성: qa-logic-map-cluster · 2026-08-13
> 대상: `plan.md`(D1~D4·§3 계약·E4 강등) · `dev-notes.md` · `src/features/map/mapHtml/mapHtml.ts`·`mapHtml.spec.ts` · `docs/design/architecture.md`
> 범위: 로직·통합 정합성·보안/비용·TDD·컨벤션 (**비주얼 충실도는 qa-visual 담당** — §3.4 실값 대조 1건)

## 최종 판정: **로직 합격** (R2에서 L1~L4 해소 확인 · 디바이스 스모크 이월)

> R1 "조건부 불합격" → R2에서 L1~L4 해소(**§7**) → R3에서 L5 해소(**§9**). **잔여 지적 0.** R2에서 제기한 D1은 QA 측정 레이스로 인한 **오탐이라 철회**했다(§8).
> ⚠️ 단, **T0 스파이크·S1~S10 디바이스 스모크가 전량 미실행**이므로 기능 전체는 여전히 "검증되지 않음"이다(§5). 로직·통합 축만 합격이다.

---

## R1 판정(이력): **조건부 불합격 — L1 수정 후 재검증 필요**

기능 계약(§3.1 제1 제약·§3.4 실값·§3.5 SDK·비용 0·RN diff 0)은 전부 정확히 구현됐고 `npm test` 1991/1991 green·`tsc --noEmit` 0이다. 다만 **재-INIT(재시도 버튼) 경로에서 핀이 전부 사라지는 신규 회귀(L1)** 를 발견했다. 계획 E8이 "클러스터러 재사용"만 규정하고 `__muklogInit`이 **매번 새 `kakao.maps.Map`을 만든다**는 사실과 교차시키지 않아 생긴 경계면 구멍이다.

또한 독립 뮤테이션 표본에서 **강등 안전망(E4)의 핵심 분기가 테스트로 잠겨 있지 않고(L2), 단언 2건이 주석·생성자 문자열로 충족되는 죽은 단언(L3·L4)** 임을 확인했다.

---

## 1. 착수/종료 체크섬 (소스 동결 확인)

| 파일 | 착수 시 SHA-256 | 종료 시 | 결과 |
|---|---|---|---|
| `src/features/map/mapHtml/mapHtml.ts` | `0a521613…97e8eb` | 동일 | 불변 ✅ |
| `src/features/map/mapHtml/mapHtml.spec.ts` | `58d5b4f5…276266` | 동일 | 불변 ✅ |

dev-notes §0의 체크섬과 일치한다. QA 중 원본 소스를 **일절 수정하지 않았다**(뮤테이션은 전부 격리 사본). git 명령은 읽기(`status`·`diff`)만 사용했다.

---

## 2. 실패 (수정 필요)

### L1 — [중대·신규 회귀] 재-INIT 시 클러스터러가 **이전 Map 인스턴스에 묶인 채 재사용**되어 핀이 전부 사라진다

**경계면(양쪽 동시 읽기)**

| 생산자 | 소비자 |
|---|---|
| `mapHtml.ts:208-211` — `__muklogInit`이 호출될 때마다 `mkMap = new kakao.maps.Map(document.getElementById('map'), {...})`로 **새 Map 인스턴스**를 만든다 | `mapHtml.ts:107-108` — `ensureClusterer()`는 `if (mkClusterer) return;`로 **이전 클러스터러를 그대로 재사용**한다. 그 클러스터러는 생성 시점(`mapHtml.ts:111-112`)에 `map: mkMap`으로 **옛 Map 인스턴스**를 붙잡고 있다 |

**발동 경로(실재함)**: `MapTabScreen.tsx:264-268` `handleRetry` → `sendInit()` → `MapTabScreen.tsx:152-160`이 `buildInitScript`를 **같은 WebView에 재주입**한다(WebView 리마운트·키 변경 없음 → JS 컨텍스트 유지 → `mkClusterer`가 살아 있다). 지도 에러 배너의 "재시도"(`MapTabScreen.tsx:305·313`)가 정확히 이 경로다.

**결과**: 재-INIT 후 `renderMarkers`는 `mapHtml.ts:187`의 `if (!mkClusterer) overlay.setMap(mkMap);`을 **건너뛰고**(mkClusterer가 truthy) `mapHtml.ts:194`에서 옛 Map에 묶인 클러스터러에 오버레이를 넘긴다. 새로 보이는 지도에는 **saved·wish·nearby 핀이 하나도 그려지지 않는다.** 예외가 나지 않으므로 **E4 강등도 발동하지 않고 `ERROR`도 안 나간다** — 조용한 실패다.

**회귀임**: 이 스프린트 이전에는 모든 오버레이가 매 `renderMarkers`마다 `overlay.setMap(mkMap)`으로 **그때의 mkMap**에 붙어서 재-INIT이 정상 동작했다(삭제된 줄 `- overlay.setMap(mkMap);`). 사용자는 이미 에러 상태에서 재시도를 누른 것이라 체감 피해가 크다.

**보강 근거**: 같은 INIT 경로의 `mkMeOverlay`(`mapHtml.ts:216-220`)도 재-INIT마다 **새 Map에 새로 생성**된다. 즉 "재-INIT = map 바인딩 객체 전부 새로 만든다"가 이 파일의 기존 성질이고, 클러스터러만 그 성질에서 빠져 있다.

**수정안(택1, `ensureClusterer` 한 곳)**
```js
function ensureClusterer() {
  // 재-INIT은 새 kakao.maps.Map을 만든다 → 재사용 시 현재 map으로 재바인딩해야 한다(E8 + 새 Map 교차).
  if (mkClusterer) { try { mkClusterer.clear(); mkClusterer.setMap(mkMap); } catch (e) { mkClusterer = null; } }
  if (mkClusterer) return;
  ...
}
```
`MarkerClusterer.setMap(map)`의 실존은 **T0 스파이크에서 함께 확인**할 것(없는 API를 지어내지 않는다는 이 스프린트 규율 유지). 만약 `setMap`이 없다면 대안은 "재-INIT 시 `mkClusterer.clear()` 후 `mkClusterer = null`로 두고 재생성" — E8의 유령 버블 우려는 `clear()`가 선행하므로 해소된다.

**테스트 요구**: `ensureClusterer`가 재사용 분기에서 현재 `mkMap`에 재바인딩한다는 단언 1건 + 스모크에 **S10(지도 에러 배너 → 재시도 탭 → 핀이 다시 보이는가)** 추가.

---

### L2 — [테스트 락 공백] `addMarkers` 실패 시 **런타임 강등 경로가 어떤 테스트로도 잠겨 있지 않다**

`mapHtml.ts:192-201`의 try/catch(= dev-notes §1이 "계획 대비 강화한 지점 1건"으로 명시한, **T0 실패를 치명적이지 않게 만드는 유일한 장치**)를 통째로 지우고 `mkClusterer.addMarkers(mkOverlays);` 한 줄만 남겨도 **40건 전부 green**이다(뮤턴트 Q2 survived).

원인: 강등을 검사하는 단언(`mapHtml.spec.ts:302-306`)이 `render`에서 `setMap(mkMap)`·`!mkClusterer`만 찾는데, 이 두 문자열은 catch 블록이 아니라 **`mapHtml.ts:187`의 생성 루프 가드**로도 충족된다.

**런타임 영향(현재 코드는 안전, 회귀 시 심각)**: try/catch가 사라지면 `addMarkers` throw가 ① `__muklogInit` 경유일 땐 `mapHtml.ts:249-251`의 catch로 잡혀 **`ERROR` 배너 + `click`/`idle` 리스너 미등록 + `emitBounds` 미실행**(→ nearby 영구 미조회, MAP_TAP 불능)으로, ② `__muklogSetMarkers`(`mapHtml.ts:255-257`, try 없음) 경유일 땐 **WebView 미포착 예외**로 이어진다. 계획 E4가 막으려던 "지도가 죽는" 상태 그대로다.

**수정안**: `renderMarkers` 본문을 좁혀 catch 블록 고유의 문자열을 단언한다.
```ts
const render = fnBody({ fnName: 'renderMarkers' });
expect(render).toContain('catch');            // addMarkers 실패 흡수
expect(render).toContain('mkClusterer = null'); // 런타임 1회 강등(이후 렌더는 개별 핀 경로)
expect(render.slice(render.indexOf('addMarkers'))).toContain('setMap(mkMap)'); // catch 안 재부착 루프
```

---

### L3 — [죽은 단언] `clearMarkers`의 `setMap(null)` 정리 루프 단언이 **주석으로 충족**된다

`mapHtml.spec.ts:289` `expect(clear).toContain('setMap(null)')`는 `mapHtml.ts:154`의 실제 루프가 아니라 **`mapHtml.ts:151`의 주석**("…clear()가 실패해도 아래 setMap(null)")으로도 통과한다.

**인과 증명**: 루프만 삭제 → **survived**(Q5). 루프 + 같은 문자열을 담은 주석을 함께 삭제 → **killed**(Q5b). 주석이 단언을 살려주고 있음이 확정됐다.

**런타임 영향**: 이 루프는 **강등 상태(`mkClusterer === null`)에서 오버레이를 제거하는 유일한 수단**이다. 삭제되면 `SET_MARKERS`마다(카테고리 전환·nearby 누적) 이전 핀이 지도에 영구히 쌓인다 — 계획 §3.6 C2가 막으려던 고스트 핀 그 자체.

**수정안**: 주석과 코드가 같은 문자열을 공유하지 않게 단언을 좁힌다.
```ts
expect(clear).toContain('mkOverlays[i].setMap(null)'); // 주석엔 없는 실제 루프 표현
```

---

### L4 — [죽은 단언·경미] 강등 존재검사 단언이 **생성자 호출로 충족**된다

`mapHtml.spec.ts:295` `expect(ensure).toContain('kakao.maps.MarkerClusterer')`는 가드(`mapHtml.ts:110` `if (!kakao.maps.MarkerClusterer) return;`)를 지워도 `mapHtml.ts:111`의 `new kakao.maps.MarkerClusterer({`가 같은 부분문자열을 제공해 **항상 통과**한다(Q1 survived). 즉 이 단언은 "존재 검사 분기"(계획 §5-1 케이스 11)를 검증하지 못한다.

**런타임 영향은 없음**: 가드가 없어도 `new undefined(...)`가 던지고 `mapHtml.ts:121-123`의 catch가 삼켜 `mkClusterer = null` 강등으로 수렴한다. 순수 **테스트 품질** 이슈다.

**수정안**: `expect(ensure).toContain('if (!kakao.maps.MarkerClusterer) return;')`

---

## 3. 통과

### 3.1 제1 제약 — CustomOverlay 핀 6가지 계약 전량 잔존 ✅
`mapHtml.ts` 정독 + diff 확인. 삭제된 줄은 단 2개(`overlay.setMap(mkMap);` → `mapHtml.ts:187` 가드 형태로 이동 / SDK URL 1줄)이며 6계약은 **한 줄도 손대지 않았다**.

| 계약 | 위치 | 상태 |
|---|---|---|
| 이모지 `textContent` | `mapHtml.ts:169` | 불변 |
| 3-way 색 클래스(nearby/wish/base) | `mapHtml.ts:166-167` | 불변 |
| `SET_SELECTED` 활성 토글 | `mapHtml.ts:172` · `261-271` | 불변 |
| `MARKER_TAP` + `stopPropagation` | `mapHtml.ts:173-178` | 불변 |
| `dataset.pinId` + `mkPins` 추적 | `mapHtml.ts:168` · `189` | 불변 |
| `overlay.setZIndex(pinZIndex(...))` | `mapHtml.ts:183` · `269` | 불변 |

### 3.2 E4 강등 구조 ✅(L1·L2 제외)
- **미정의/생성 throw**: `ensureClusterer` 전체가 try/catch(`mapHtml.ts:109-123`), 실패 시 `mkClusterer = null`. try/catch를 제거하면 테스트가 죽는다(Q10 killed) → 잠김 확인.
- **강등 후 폴백 렌더**: `mapHtml.ts:187` 가드를 제거하면 테스트가 죽는다(Q9 killed) → 잠김 확인.
- **`ERROR` 미발신**: `ensureClusterer` 본문에 `ERROR` 없음 + `type: 'ERROR'` 발신 지점이 기존 3곳(SDK_UNAVAILABLE·SDK_LOAD_FAILED·INIT catch)으로 고정(`mapHtml.spec.ts:297-299`). ✅
- **강등 후 SET_MARKERS/SET_SELECTED**: `__muklogSetMarkers` → `renderMarkers` → `mkClusterer` null이므로 `overlay.setMap(mkMap)` 경로로 정상. `__muklogSetSelected`(`mapHtml.ts:261-271`)는 `mkPins` 참조만 쓰고 클러스터러를 경유하지 않아 강등과 **무관하게 동작**. ✅

### 3.3 클러스터러 수명주기 · 잔존 참조 ✅
`clearMarkers`(`mapHtml.ts:149-157`)가 `clusterer.clear()` → 전 오버레이 `setMap(null)` → `mkOverlays=[]`·`mkPins={}` 순. `clear()` 제거 시 테스트가 죽는다(Q8 killed). `clear()`가 던져도 `setMap(null)` 정리가 수행되도록 예외를 격리한 설계는 **고스트 방지 코드가 스스로 고스트를 만들지 않게 하는 올바른 순서**다. `mkPins` 추적과 클러스터러 멤버십은 `mkOverlays` 단일 배열을 공유해 일관되며, 재주입마다 양쪽이 함께 비워진다. ✅

### 3.4 `me` 마커 클러스터 제외(C4·T5) ✅
`mkMeOverlay`는 `mkOverlays`에 push되지 않는다 — `mkOverlays.push(` 전체 1회(`mapHtml.ts:188`)임을 spec이 카운트로 고정(`mapHtml.spec.ts:282`). ✅

### 3.5 SDK 로드 계약(T1) ✅
`mapHtml.ts:303` `...?appkey=${KEY_PLACEHOLDER}&autoload=false&libraries=clusterer`. `appkey`·`autoload=false` 유지, `libraries=services` 미추가(비용 가드레일, `mapHtml.spec.ts:227`). 키는 **placeholder만** 소스에 존재하고 실값은 `env.KAKAO_JS_KEY` 주입(`MapPrewarm.tsx:42` 등) — 번들 노출 0. `kakao.maps.load` 콜백 기반 로드 흐름 불변(`mapHtml.ts:294-297`). ✅

### 3.6 RN 측 diff 0 (Path A 약속) ✅
`git diff --name-only`: `src/` 변경은 **`mapHtml.ts`·`mapHtml.spec.ts` 2개뿐**. `supabase/` 0건, `package.json`/lock 0건. 브리지 파서(`parseMapMessage`)·`types.ts`·`MapTabScreen.tsx`·`MapWebView`·훅 전부 미변경 → `MapInboundType`/`MapOutboundType`/`MapMarker` 계약 불변, 신규 inbound 메시지 0. ✅

### 3.7 `MapPrewarm` 부작용 0 (경계면 #3) ✅
`MapPrewarm.tsx:5-7·42·53` — 같은 `mapHtml()`을 쓰지만 `injectJavaScript`를 호출하지 않는다 → `__muklogInit` 미실행 → **`ensureClusterer()`도 미실행**. 프리워머는 클러스터러를 만들지 않고 스크립트 HTTP 캐시만 데운다(`loadKakao`가 `kakao.maps.load`를 호출하므로 clusterer 라이브러리까지 fetch됨). ✅

### 3.8 미니맵 무회귀(E14·경계면 #9) ✅
`muklogMiniMapHtml.ts`는 자기완결 HTML로 `mapHtml`을 공유하지 않으며 `libraries`·`Clusterer` 문자열 0건, 파일 미변경. ✅

### 3.9 비용 가드레일 ✅
Kakao Local 호출 증가 **0**(`useNearbyPlaces`·`nearby-search` 미변경), Supabase 호출 0, 마이그레이션/RLS/Edge Function 0건, 신규 의존성 0, AWS 미사용, 폴링·타이머·리스너 추가 0(클러스터 재계산은 Kakao 내부 zoom/idle에 편승). 클러스터 계산 100% WebView 로컬. ✅

### 3.10 TDD·테스트 ✅(L2~L4 제외)
- `npm test`(직접 실행): **198 suites / 1991 tests 전량 green** — dev-notes §4.3과 일치.
- `npx tsc --noEmit`(직접 실행): **exit 0, 출력 0줄**.
- `mapHtml.spec.ts` diff는 **추가만**(삭제 라인 0) → 기존 29건 단언 삭제·완화 0 (T6 인수조건 충족). 총 40건(29+11).
- 계획 §5-1 케이스 1~10·12~17 대응 단언 존재. 케이스 11만 L4로 미달.
- 위양성 방지를 위한 `fnBody` 중괄호 매칭 헬퍼(`mapHtml.spec.ts:206-220`)는 적절한 설계다(전역 매칭이면 `.mk-pin`의 `#3366FF`가 클러스터 스타일 단언을 통과시킨다).

### 3.11 코드 컨벤션 ✅
`export const mapHtml = ({ jsKey }: {...}) =>` — 화살표 const + named-object 인자, 파일명=심볼명(`mapHtml.ts`/`mapHtml`). 신규 `useCallback`/`useMemo` 0, `export function` 컴포넌트/훅 0. 상수는 enum-style 대문자 블록(`MK_CLUSTER_OPTIONS`·`MK_CLUSTER_STYLES`)으로 §3.7대로 한 곳에 모였다. 템플릿 문자열 **안**의 ES5(`function`·`var`·`mkClusterStyle(size, fontSize)` 위치인자)는 WebView 런타임 코드로, 기존 `pinZIndex(kind, active)`·`post(msg)` 선례와 동일한 파일 내 확립된 패턴이라 위반으로 보지 않는다.
> 참고(스프린트 무관·기존): `src/navigation/useRefreshOnFocus/useRefreshOnFocus.ts:26`에 `React.useCallback` 1건이 남아 있다. 이번 변경과 무관하며 별도 처리 대상.

### 3.12 `architecture.md` 사실 정합 ✅
추가된 `map-clustering` 행과 `map-tab-nearby` 행의 "클러스터링 OUT → `map-clustering`(2026-08-13)에서 해소" 표기를 대조했다. **과대 서술 없음** — "완료(코드, 1991 green)"는 실측치와 일치하고, "`CustomOverlay`↔`MarkerClusterer` 호환은 문서상 미보장이라 T0 실기기 스파이크가 게이트"라고 미검증 상태를 명시하며, 강등·비용 0·대상 3종·탭 줌인 요약도 코드와 일치한다. (다만 L1 수정 시 강등 서술은 그대로 유효하나, 재-INIT 성질을 한 줄 보강하면 더 정확하다.)

---

## 4. 독립 뮤테이션 표본 (격리 사본)

계획 §5-1 규범 준수: 사본을 **`src/` 밖 세션 스크래치패드**에 두고 파일명을 jest `testMatch` 미매치(`check.mutcase.ts`)로 만든 뒤 `--roots`+`--testMatch` 명시 실행, **확인 즉시 디렉터리째 삭제**했다(원본 체크섬 불변 확인 완료 — §1).

| 뮤턴트 | 결과 | 의미 |
|---|---|---|
| Q1 `if (!kakao.maps.MarkerClusterer) return;` 제거 | ⚠️ **survived** | → **L4** (생성자 문자열이 단언을 충족) |
| Q2 `addMarkers` try/catch 런타임 강등 제거 | ⚠️ **survived** | → **L2** (E4 안전망 무방비) |
| Q3 `ensureClusterer` catch의 `mkClusterer = null` 제거 | survived | **equivalent mutant** — 생성자가 던지면 대입 자체가 없어 이미 null. 지적 아님 |
| Q4 `calculator: [10,100]` → `[5,50]` | ✅ killed | 경계 계약 잠김 |
| Q5 `clearMarkers`의 `setMap(null)` 루프 제거 | ⚠️ **survived** | → **L3** |
| Q5b Q5 + 동일 문자열 주석까지 제거 | ✅ killed | **L3 인과 증명**(주석이 단언을 살림) |
| Q6 `libraries=clusterer` 제거 | ✅ killed | 하네스 sanity |
| Q7 `MK_CLUSTER_STYLES` 3단계 → 2단계 | ✅ killed | 3단계 잠김 |
| Q8 `clusterer.clear()` 제거 | ✅ killed | 고스트 방지 잠김 |
| Q9 폴백 `if (!mkClusterer) overlay.setMap(mkMap)` 제거 | ✅ killed | 강등 렌더 잠김 |
| Q10 `ensureClusterer` 전체 try/catch 제거 | ✅ killed | 강등 흡수 잠김 |

dev-notes §4.2의 M1~M9와 겹치지 않는 축(Q1·Q2·Q5·Q5b·Q9·Q10)을 골라 독립 표본을 구성했고, 그중 3건에서 실제 구멍이 드러났다.

---

## 5. 미검증 (통과로 처리 금지)

| # | 항목 | 사유 |
|---|---|---|
| U1 | **T0 스파이크** — `CustomOverlay`↔`MarkerClusterer` 호환(버블 생성·핀 흡수·탭 줌인·콘솔 예외 0) | 실기기 dev build 필요. **이 스프린트의 게이트이자 실질 검증자**. dev-notes §5 체크리스트에 T0가 최우선(맨 위)으로 명시돼 있음을 확인함 ✅ |
| U2 | S1~S9 디바이스 스모크 전량 | 동일. 완료 기준(§9-4)의 S1·S2·S3·S5·S7 미실행 |
| U3 | **클러스터러의 조용한 no-op 가능성** | `addMarkers`가 throw하지 않으면서 오버레이를 표시하지 않는 형태로 실패하면 **강등이 발동하지 않고 핀만 사라진다**. E4 안전망은 throw만 잡는다. T0에서 "핀이 보이는가"를 예외 유무와 **별도로** 확인할 것 |
| U4 | 클러스터에 흡수(=`setMap(null)`)된 CustomOverlay에 대한 `overlay.setZIndex()` 호출 안전성(`mapHtml.ts:269`) | SDK 런타임 동작. S6에서 관찰 |
| U5 | 클러스터↔개별 핀 stacking(§3.4 `zIndex` 미포함 결정) | 계약상 관찰 항목(S8) |
| U6 | 클러스터 버블 실값(§3.4 표) 비주얼 대조 | **qa-visual 담당** |
| U7 | **(L1 수정 시 신규)** 재-INIT 후 핀 재표시 | 스모크 S10으로 추가 필요 |

---

## 6. 재검증 대상 요약 (developer 앞)

1. **L1** `mapHtml.ts:107-108` — 재사용 시 현재 `mkMap` 재바인딩(+ 단언 1건 + 스모크 S10). **필수**
2. **L2** `mapHtml.spec.ts:302-306` — `renderMarkers` catch 고유 문자열 단언 추가. **필수**(안전망이 잠기지 않으면 T0 실패 시 회귀를 못 막는다)
3. **L3** `mapHtml.spec.ts:289` — `mkOverlays[i].setMap(null)`로 좁히기. **필수**
4. **L4** `mapHtml.spec.ts:295` — 가드 전문 단언으로 교체. **권장**

L1~L4 반영 후 `npm test`·`npx tsc --noEmit` 재실행 결과와 함께 알려주면 재검증한다(재검증 라운드 상한 2회).

---

## 7. 재검증 (R2 — dev 수정분, 라운드 1/2)

### 7.1 R2 체크섬 (독립 측정, dev 보고와 일치)

| 파일 | R2 SHA-256 | 대조 |
|---|---|---|
| `mapHtml.ts` | `cfe7e442d82652a383ae6659c9e267706093fd7199312ff14435af41ae0fb725` | dev 보고와 일치 ✅ |
| `mapHtml.spec.ts` | `f5e88392a6ab57a7346c8b638f579d765a1c9bff791b40b8e96363b1b3212d63` | 일치 ✅ |

QA 종료 시 재측정해도 동일 — 재검증 중 원본 미수정(뮤테이션은 전부 격리 사본, 실행 후 삭제 확인).

### 7.2 재실행 결과 (직접 실행)
- `npm test` → **198 suites / 1993 tests 전량 green** (R1 1991 → +2). dev 보고와 일치 ✅
- `npx tsc --noEmit` → **exit 0, 출력 0줄** ✅
- `git diff --name-only -- src/ supabase/ package.json` → **여전히 `mapHtml.ts`·`mapHtml.spec.ts` 2개뿐** (RN 프로덕션 diff 0 유지) ✅
- `mapHtml.spec.ts` diff 삭제 라인 **0** — 기존 단언 삭제·완화 없음 ✅ (42건 = 기존 29 + 증분 13)

### 7.3 L1~L4 해소 확인

| # | 상태 | 근거 |
|---|---|---|
| **L1** | ✅ 해소 | `ensureClusterer`가 재사용 early-return **앞에서** `clear()` → `typeof mkClusterer.setMap === 'function'`이면 `setMap(mkMap)` 재바인딩, 아니거나 예외면 `mkClusterer = null` 폐기 후 재생성. `setMap` 실존을 `typeof` 가드로 코드 레벨에서 방어한 것은 "없는 API를 지어내지 않는다"는 이 스프린트 규율에 맞는 처리다. 스모크 **S10**(에러 배너 → 재시도 → 핀 재표시)이 dev-notes §5 표에 추가된 것도 확인 |
| **L2** | ✅ 해소 | `addMarkers` 이후 구간만 잘라 `catch`·`mkClusterer = null`·`setMap(mkMap)`을 요구하는 단언 추가 → 뮤턴트 **Q2 killed로 전환** |
| **L3** | ✅ 해소 | `toContain('mkOverlays[i].setMap(null)')`로 좁힘(주석에는 없는 표현) → **Q5 killed로 전환** |
| **L4** | ✅ 해소 | `toContain('if (!kakao.maps.MarkerClusterer) return;')`로 가드 문장 자체를 단언 → **Q1 killed로 전환** |

### 7.4 R2 독립 뮤테이션 (L1 수정을 겨냥한 신규 축 — dev의 N1~N3와 다름)

| 뮤턴트 | 결과 | 의미 |
|---|---|---|
| Q1 존재검사 가드 제거 | ✅ killed | L4 해소 확인 |
| Q2 `addMarkers` try/catch 제거 | ✅ killed | L2 해소 확인 |
| Q5 `clearMarkers` 정리 루프 제거(주석 유지) | ✅ killed | L3 해소 확인 |
| P1 재바인딩 대상을 `setMap(null)`로 변조 | ✅ killed | 재바인딩 대상이 새 Map임을 잠금 |
| P3 재바인딩 전 `clear()` 제거 | ✅ killed | E8 유령 버블 방지 잠금 |
| **P2** `else mkClusterer = null` 제거(setMap 미제공 SDK에서 폐기 안 함) | ⚠️ **survived** | → **L5** |
| **P4** 재바인딩 catch의 `mkClusterer = null` 제거 | ⚠️ **survived** | → **L5** |
| P5 `typeof` 가드 제거(bare `setMap` 호출) | survived | **equivalent** — `setMap` 부재 시 TypeError가 같은 catch로 잡혀 폐기·재생성으로 수렴(관측 동작 동일). 지적 아님 |

---

## 8. 잔여 권고 (비차단)

### L5 — [권장·테스트 락] L1 재바인딩의 **두 폐기 경로가 서로를 가려준다**

`mapHtml.spec.ts`의 L1 단언은 재바인딩 구간에 `mkClusterer = null`이 **있는지**만 본다. 그런데 이 구간에는 그 문자열이 **두 곳**(`else` 분기 / `catch` 블록) 있어, 한쪽을 지워도 다른 쪽이 단언을 통과시킨다(P2·P4 survived). L3·L4와 **같은 계열의 "한 문자열, 두 출처" 문제**가 한 단계 안쪽에 남은 형태다.

**런타임 영향(회귀 시)**: 두 경로 모두 지워지면 L1 회귀가 그대로 되살아난다 — `setMap` 미제공 SDK(P2) 또는 `clear()`/`setMap` 예외(P4) 시 클러스터러가 **옛 Map에 묶인 채 재사용**되어 새 지도에 핀 0개 + 예외 없음. 현재 코드는 두 경로가 다 있어 **정상**이고, 잠금만 비어 있다.

**수정안(spec 2줄, 프로덕션 무변경)**
```ts
// 폐기 경로가 둘(setMap 미제공 → else / clear·setMap 예외 → catch)이라 개수로 잠근다.
//   하나만 남아도 옛 Map 재사용(L1 회귀)이 되살아나는데, 존재 단언만으론 서로를 가려준다.
expect(rebind.match(/mkClusterer = null/g)).toHaveLength(2);
```

### ~~D1~~ — **철회 (QA 측정 오류)**

R2 리포트에서 "`dev-notes.md`가 `architecture.md`를 미변경으로 잘못 라벨했다"고 적었으나 **이는 QA 측정 레이스로 인한 오탐이었다. 철회한다.**

경위: R2 검증 착수 배치에서 `architecture.md` 해시를 `0063a2a5…`(= R1판, `1991 green`)로 측정했는데, 그 직후 dev가 §3.12 권고를 반영해 파일을 갱신했고(mtime 18:48:14 → `f96dfa6b…`), 검증 후반부의 `grep`이 **갱신된 내용**(`1993 green` + 재-INIT 문단)을 읽었다. 서로 다른 시점의 두 관측을 같은 시점으로 취급해 "해시는 그대로인데 내용이 바뀌었다"는 모순으로 오판한 것이다. dev가 R2 시점에 보고한 "`0063a2a5…`, R1과 동일" 표기는 **그 시점 기준으로 정확했다.**

교훈(QA 측): 동결 검증에서 **해시와 내용은 같은 배치에서 측정**해야 한다. 다른 에이전트가 동시에 쓰는 파일은 두 관측 사이에 바뀔 수 있다.

---

## 9. 재검증 (R3 — L5 반영분)

### 9.1 최종 동결 체크섬 (QA 독립 측정 — 해시·내용·테스트 **동일 배치**)

D1 오탐의 교훈을 적용해 해시·내용·테스트를 한 배치에서 측정하고, **배치 시작과 종료 시점의 해시가 동일함**을 확인했다(검증 중 쓰기 레이스 없음).

| 파일 | SHA-256 | dev `dev-notes` §0 표 |
|---|---|---|
| `src/features/map/mapHtml/mapHtml.ts` | `cfe7e442d82652a383ae6659c9e267706093fd7199312ff14435af41ae0fb725` | 일치 ✅ |
| `src/features/map/mapHtml/mapHtml.spec.ts` | `78a82d16b9b473d1cef2372960718563f040f523e413d0d547463064522a3961` | 일치 ✅ |
| `docs/design/architecture.md` | `f96dfa6bbaafe489c3afdf0a4017c86a2cf82f5cb289aab85515bb2d10b1a743` | 일치 ✅ |

R3 진행 중 dev 통지의 spec 해시가 한 차례 stale했으나(통지 후 L5 반영), **`dev-notes.md` §0·§9 표는 재측정값으로 갱신돼 현재 전부 일치**한다. dev도 §9에 "동결 통지는 마지막 편집 이후 해시 재측정 → 그 배치에서 바로 통지"로 프로세스를 고정했다. **잔여 조치 없음.**

> 참고: `dev-notes.md` 자신의 해시는 동결 표에서 제외하는 것이 맞다 — 파일이 자기 해시를 담는 순간 그 해시가 바뀌는 자기참조라 원리적으로 stale해진다. dev의 §0·§9 표가 소스 3종만 싣고 있어 이미 올바른 형태다.

### 9.2 L5 해소 확인 ✅

`mapHtml.spec.ts:336` — L1 재바인딩 단언에 `expect(rebind.match(/mkClusterer = null/g)).toHaveLength(2);` 추가. 두 폐기 경로(`else` / `catch`)를 **개수로** 잠갔다.

| 뮤턴트 | R2 | R3 | 의미 |
|---|---|---|---|
| P2 `else mkClusterer = null` 제거 | ⚠️ survived | ✅ **killed** | setMap 미제공 SDK에서 옛 Map 재사용(L1 회귀) 잠김 |
| P4 재바인딩 catch의 `mkClusterer = null` 제거 | ⚠️ survived | ✅ **killed** | clear·setMap 예외 시 L1 회귀 잠김 |
| Q2 `addMarkers` 강등 제거 | killed | ✅ killed | 회귀 없음 |
| Q5 `clearMarkers` 정리 루프 제거 | killed | ✅ killed | 회귀 없음 |
| N1 L1 재바인딩 블록 전체 삭제 | — | ✅ killed | 원 회귀 재현 잠김 |

### 9.3 R3 재실행 (직접 실행)
- `npm test` → **198 suites / 1993 tests 전량 green** ✅
- `npx tsc --noEmit` → **exit 0, 출력 0줄** ✅
- `mapHtml.spec.ts` diff 삭제 라인 **0**(L5는 순수 추가) ✅
- `git status` 변경 범위 불변 — `src/`는 여전히 `mapHtml.ts`·`mapHtml.spec.ts` 2개뿐 ✅

### 9.4 R3 판정

**로직 합격 — 잔여 지적 0.** L1~L5가 전부 해소됐고 R1에서 제기한 모든 항목이 닫혔다. §5의 미검증(T0·S1~S10 디바이스 스모크)만 남으며, 이는 실기기 없이는 원리적으로 닫을 수 없는 항목이다.

