# 스프린트: map-nearby-load (주변 로드 최적화)

- **작성일**: 2026-08-14
- **기획**: sprint-planner
- **설계 단일 출처**: `docs/design/architecture.md` (§4 지도 탭 · §5 화면 · L238 `map-tab-nearby` 백로그 행)
- **선행 스프린트 의존**: `sprint-20260813-map-clustering`(mapHtml 클러스터러 도입 — 이번 슬라이스가 같은 파일을 만진다), `sprint-20260702-nearby-accumulate`(누적 병합), `sprint-20260615-map-tab-nearby`(nearby-search Edge)

---

## §1. 기능 한 줄 정의

> 지도 탭에서 주변 음식점 핀이 **"순차적으로 하나씩 뜨는 것처럼" 보이는 체감**을, 마커 렌더·조회량·콜드스타트 3축에서 없앤다.

사용자 관측: *"주변 가게 아이콘이 한 번에 다 로드되지 않고 순차적으로 뜬다."*
확정된 대응 레버(사용자 승인, 2026-08-13): **A 증분 마커 렌더** · **D Edge 페이지 팬아웃(page 1~3)** · **B 누적 캐시 영속**. (C 누적 cap 상향·로딩 인디케이터는 제외 확정.)

---

## §2. 규모 판정과 슬라이스 분해 ★리더 요청 항목

### 2.1 판정: **한 스프린트에 3종 동시 투입은 과대 — 3 슬라이스로 분해한다.**

근거는 "작업량"이 아니라 **검증면(surface)이 서로 겹치지 않는다**는 데 있다. 세 레버는 파일·테스트 러너·실패 모드가 전부 다르다.

| 레버 | 변경 레이어 | 테스트 러너 | 실패 시 증상 | 롤백 단위 |
|---|---|---|---|---|
| **A** 증분 마커 렌더 | WebView HTML 문자열(`mapHtml.ts`) | jest(문자열 + 신규 샌드박스 실행) | 핀 유령/빈 지도 — **시각적·조용한 실패** | mapHtml 1파일 |
| **D** Edge 페이지 팬아웃 | Deno Edge Function + 카카오 호출 정책 | `npm run test:functions`(deno) | 429·부분 실패·쿼터 — **비용/외부 API** | Edge 배포 1건 |
| **B** 누적 캐시 영속 | RN 훅 + AsyncStorage | jest | 계정 간 캐시 오염 — **보안(격리)** | 훅 + 신규 모듈 |

A가 조용한 실패(빈 지도)를 낼 수 있고 D가 외부 쿼터를 3배로 늘린다. 둘을 한 번에 배포하면 라이브에서 "핀이 안 뜬다"가 났을 때 원인이 렌더인지 조회인지 분리되지 않는다. **1 스프린트 = 1 기능** 규칙의 취지가 정확히 이 상황이다.

### 2.2 권장 순서와 근거

**S1 = A → S2 = D → S3 = B.**

1. **A를 먼저** — (a) 체감 개선 대비 비용이 0이다(카카오·Supabase 호출 증가 없음). (b) **D의 안전장치다**: 현재 `renderMarkers`는 매 배치마다 전 오버레이를 파괴 후 재생성하므로, D로 1뷰포트 유입이 15 → 45건이 되면 파괴·재생성 비용과 깜빡임이 그대로 3배가 된다. A 없이 D를 넣으면 "더 많이 받았는데 더 깜빡인다"가 된다. (c) `mapHtml`을 직전 스프린트(map-clustering)가 방금 바꿨다 — 클러스터러 소유권 규칙(§3.6 C2·C3·E4)이 아직 뜨거운 지금 만지는 편이 회귀 위험이 낮다.
2. **D를 두 번째** — 사용자 관측의 근본 원인 중 "1뷰포트당 15건뿐이라 팬을 해야 채워진다"를 직접 해소한다. 카카오 호출 3배는 **사용자가 명시 승인**했으나, 429/부분 실패 계약을 새로 만들어야 해서 A보다 계약 표면이 크다.
3. **B를 마지막** — 다른 둘과 의존이 없다(독립). 다만 해소하는 증상이 다르다(세션 내 팝인이 아니라 **콜드스타트 첫 화면 공백**). 보안(계정 격리) 검토가 필요한 유일한 슬라이스라 A·D가 안정된 뒤가 낫다.

**이번 스프린트는 S1(A)만 상세 기획한다.** S2·S3는 §11에 개요만 남기고, 착수 시점에 각각 별도 plan.md를 쓴다.

### 2.3 리더 보고용 사실 정정 ⚠

리더 지시문의 *"기존 'page 미사용' 가드레일은 테스트로 강제돼 있으니 그 테스트도 함께 갱신"* 은 **사실과 다르다.**

- `supabase/functions/` 하위 테스트 파일은 `delete-account/index.test.ts` · `place-search/index.test.ts` · `send-muklog-push/index.test.ts` **3개뿐이고, `nearby-search`용 deno 테스트는 존재하지 않는다**(확인: `find supabase -name "*test*"`).
- "page 미사용"을 강제하는 것은 **주석 3곳**(`nearby-search/index.ts:11,25,131`)과 **architecture.md L238 백로그 행** 뿐이다.
- 클라이언트 쪽 "비용 가드레일 테스트"(`useNearbyPlaces.spec.ts`)가 강제하는 것은 **invoke 호출 횟수**(디바운스·캐시·임계)이지 page 파라미터가 아니다. → **D는 이 테스트들을 건드릴 필요가 없다.**
- 따라서 S2(D)의 실제 작업은 "기존 테스트 갱신"이 아니라 **`nearby-search/index.test.ts` 신규 작성**(팬아웃·부분 성공·429 계약을 처음으로 테스트로 못박기) + 주석·architecture 문구 갱신이다. 지금은 **무테스트 상태**라는 점을 S2 착수 전에 알고 있어야 한다.

---

## §3. 이번 슬라이스(S1 = A) 범위

### 3.1 In-scope

- `src/features/map/mapHtml/mapHtml.ts`의 `renderMarkers`를 **전량 파괴·재생성 → 증분 조정(reconcile)** 으로 전환.
- 클러스터러 멤버십 **부분 동기화**(`addMarkers`/`removeMarkers`) 및 미지원·예외 시 폴백 경로 정의.
- **재-INIT(재시도) 시 레지스트리 리셋** — 새 `Map` 인스턴스와 옛 오버레이가 어긋나 빈 지도가 되는 경로 차단.
- 테스트 인프라: **WebView 스크립트 실행 샌드박스**(`src/test/mapHtmlSandbox/`) 신설 — 지금까지 문자열 단언 + `node --check`뿐이던 mapHtml에 **실행 커버리지**를 준다.
- `mapHtml.spec.ts` 증분(기존 42건 **삭제·완화 0**).

### 3.2 Out-of-scope (이번 슬라이스에서 안 한다)

| 항목 | 사유 |
|---|---|
| Edge 페이지 팬아웃(D) | S2 |
| 누적 캐시 영속(B) | S3 |
| 누적 cap(`NEARBY_ACCUM_CAP=100`) 상향 / 로딩 인디케이터 | 사용자가 제외 확정(C) |
| RN 측 변경(`MapTabScreen`·`useNearbyPlaces`·`mapMessages`) | **0건.** SET_MARKERS 계약이 그대로라 RN은 무변경이 정답이다(§4.1) |
| 비주얼 변경(핀 색·크기·클러스터 스타일·카피) | **신규 비주얼 0** — §5 참조 |
| DB 마이그레이션 / RLS / 신규 Edge | 0건 |
| `markersKey`에 데이터 해시 추가 | 알려진 한계로 수용(§8 F1) |

### 3.3 퍼블리싱(ui-publisher) 투입 판정: **불필요**

렌더되는 최종 DOM(핀 el의 className·textContent·zIndex, 클러스터 버블 스타일)은 **바뀌지 않는다**. 바뀌는 것은 "같은 결과를 만드는 경로"(파괴 후 재생성 → 유지)뿐이다. 킷 `templates/muklog` 대비 신규 시안 0 → **ui-spec.md 산출물 없음, ui-publisher 미투입**.
`qa-visual`도 미투입 권고 — 다만 **디바이스 스모크에서 "핀·클러스터 외형이 이전과 동일한가"를 회귀 항목으로 확인**한다(§7 S1~S4).

---

## §4. 계약 (Contract)

### 4.1 메시지 계약: **무변경** (가장 중요한 설계 결정)

`SET_MARKERS`는 지금처럼 **"이것이 표시되어야 할 마커 전체 집합"** 이라는 선언적(declarative) 의미를 유지한다. 증분화는 **WebView 내부 구현**이며, RN은 여전히 전체 집합만 보낸다.

```
RN → WebView   SET_MARKERS { type, markers: MapMarker[] }   ← 형·의미 무변경
WebView → RN   READY / MARKER_TAP / MAP_TAP / BOUNDS_CHANGED / ERROR   ← 무변경(신규 0)
```

**대안(RN에서 delta를 계산해 `PATCH_MARKERS`로 전송)을 기각한 근거**: RN이 "WebView가 지금 무엇을 그리고 있는지"를 ref로 미러링해야 하는데, 그 미러는 WebView 리로드·재-INIT·주입 유실 시 즉시 desync되고 **한 번 어긋나면 스스로 복구되지 않는다**(명령형 패치의 구조적 결함). 반면 전체 집합 선언 + WebView 조정은 **다음 주입 1회로 항상 자기 치유**된다. 직전 스프린트가 겪은 재-INIT desync 버그(clustering qa-logic L1)와 같은 계열의 위험을 새로 만들 이유가 없다.

> **⚠ 전제 정정 (qa-logic L1 지적, 2026-08-19 반영) — 결론은 유지, 근거는 무조건이 아니다.**
>
> 위의 "다음 주입 1회로 항상 자기 치유"는 **무조건 성립하지 않는다.** 자기 치유는 `mkPins`(레지스트리)와 실제 표시 상태가 일치할 때만 성립하는데, 조정 알고리즘은 **레지스트리를 먼저 갱신하고 표시를 나중에 반영한다**(§4.3의 2·3단계 → 4단계). 그 사이에서 부착이 실패하면 레지스트리에는 있고 화면에는 없는 핀이 생기고, 그 핀은 다음 주입에서 sig가 같아 **"유지"로 판정돼 다시 붙을 기회를 얻지 못한다.**
>
> QA가 실측한 구체 경로(L1): `applyOverlayDelta`의 **`none` 분기만** 예외 격리가 없어 `overlay.setMap`이 던지면 예외가 `__muklogSetMarkers` 밖으로 새고, 그 시점 `mkPins`는 이미 갱신을 마친 상태다(`partial`/`full`은 catch→강등으로, `resetMarkers`·`demoteClusterer`는 핀별 try/catch로 이미 보호된다). **따라서 §4.4 표의 `none` 행에도 다른 경로와 동일한 best-effort 격리가 적용돼야 한다**(L1 하드닝 — 진행 중).
>
> **그럼에도 명령형 패치 기각 결론은 그대로다.** 차이는 결함의 범위다. 선언형은 격리를 넣으면 **한 핀의 부착 실패가 나머지 핀에 전파되지 않는** 국소 결함이고, 도달 조건도 "살아 있는 지도에서 `setMap`이 던지는" 극단이다. 명령형 미러는 **정상 동작 중에도** 메시지 1건 유실로 전역 desync가 나고 복구 수단이 없다. 국소·희귀 결함을 이유로 전역·상시 결함을 택할 근거는 없다.
>
> **잔여 한계(수용, S1 범위 밖)**: 예외 격리는 "전파 차단 + 나머지 핀 보호"까지 달성하고, **실패한 그 핀 1개의 미부착은 재-INIT 전까지 남는다**(격리는 자기 치유와 다르다). 문자 그대로의 자기 치유까지 가려면 부착 실패 시 해당 항목을 `mkPins`에서 **되돌려** 다음 주입의 재생성 대상으로 만들어야 한다. 도달 가능성이 극히 낮아 S1에서는 격리까지만 하고, 이 한계를 계약에 명시하는 것으로 갈음한다.

### 4.2 WebView 내부 상태 계약

```js
// 변경 전
var mkOverlays = [];            // 표시 중 오버레이 배열
var mkPins = {};                // id -> { el, overlay, kind }

// 변경 후
var mkPins = {};                // id -> { el, overlay, kind, sig }   ★ sig 추가
// mkOverlays 폐기 — mkPins에서 파생한다(두 구조가 어긋날 여지를 제거).
//   순서는 어떤 계약에도 쓰이지 않는다(스태킹은 overlay.setZIndex가 단독 결정).
var mkClusterMode = 'none';     // 'none' | 'partial' | 'full'  ★ 신설(§4.4)
```

**핀 시그니처(`sig`) — 재사용 가능 여부의 단일 판별자**

```js
function pinSig(m) { return m.kind + '|' + m.emoji + '|' + m.lat + '|' + m.lng; }
```

- **키는 `m.id`, 시그니처에 id는 넣지 않는다.** id는 동일성(identity), sig는 내용(content)이다.
- sig에 들어가는 4개는 오버레이/DOM 생성에 실제로 반영되는 전부다: `kind`→className·zIndex, `emoji`→textContent, `lat/lng`→position.
- **`selected` 상태는 sig에 넣지 않는다** — 선택은 `SET_SELECTED` 채널이 클래스 토글로 단독 처리하며(마커 재생성 없음, map-pin-select §3.4), sig에 넣으면 선택할 때마다 핀이 재생성돼 그 스프린트의 결정을 되돌린다.

### 4.3 조정 알고리즘 계약 (`renderMarkers`)

```js
function renderMarkers(markers) {
  if (!mkMap || !markers) return;          // ⚠ 기존과 달리 clearMarkers()를 선행하지 않는다.

  // 1) 목표 집합 — 중복 id는 뒤가 이긴다(RN mergeMapMarkers가 이미 dedup하지만 방어).
  var next = {};
  for (var i = 0; i < markers.length; i++) next[markers[i].id] = markers[i];

  // 2) 제거 대상: 목표에 없거나(사라짐) sig가 달라진(내용 변경) 기존 핀.
  var removed = [];
  for (var id in mkPins) {
    if (!mkPins.hasOwnProperty(id)) continue;
    var keep = next.hasOwnProperty(id) && pinSig(next[id]) === mkPins[id].sig;
    if (!keep) { removed.push(mkPins[id].overlay); delete mkPins[id]; }
  }

  // 3) 추가 대상: 레지스트리에 없는 목표 핀(= 신규 + sig 변경으로 방금 빠진 것).
  var added = [];
  for (var id2 in next) {
    if (!next.hasOwnProperty(id2)) continue;
    if (mkPins.hasOwnProperty(id2)) continue;                 // 유지 핀 — 절대 손대지 않는다.
    added.push(createPinOverlay(next[id2]));                  // el 생성 + mkPins 등록까지 수행
  }

  // 4) 표시 반영(§4.4).
  detachOverlays(removed);
  attachOverlays(added);
}
```

**불변식(invariant) — QA가 이 4개를 확인한다**

| # | 불변식 |
|---|---|
| I1 | 목표 집합에 있고 sig가 같은 핀은 **DOM 요소도 오버레이 객체도 재생성되지 않는다**(`document.createElement` 호출 0) |
| I2 | `mkPins`의 키 집합 == 마지막 SET_MARKERS의 id 집합 (조정 후 항상) |
| I3 | 지도에 표시 중인 오버레이 == `mkPins`의 오버레이 (유령 0 · 미부착 0) |
| I4 | `mkSelectedId`와 일치하는 핀은 유지되든 새로 만들어지든 `mk-pin--active`를 갖는다 |

**유지 핀의 탭 핸들러 재사용이 안전한 근거**: 리스너 클로저는 `m.id`와 `m.kind`만 읽어 `MARKER_TAP`을 post한다. 둘 다 identity(키)와 sig에 포함되므로, "유지"로 판정된 핀의 클로저가 낡은 값을 post하는 경로는 존재하지 않는다.

### 4.4 클러스터러 정합 계약 ★직전 스프린트와의 상호작용

클러스터러가 살아 있으면 **오버레이 표시 소유권은 클러스터러에 있다**(map-clustering §3.6 C2). 증분화는 이 소유권 규칙을 깨면 즉시 유령 핀/이중 표시가 된다. 표시 전략을 3가지로 명시한다.

| 모드 | 진입 조건 | 추가 | 제거 |
|---|---|---|---|
| **`none`** (직접) | `mkClusterer === null` (미로드/생성 실패/강등 후) | `overlay.setMap(mkMap)` | `overlay.setMap(null)` |
| **`partial`** (권장) | 클러스터러 존재 **and** `typeof mkClusterer.removeMarkers === 'function'` | `addMarkers(added, nodraw)` | `removeMarkers(removed, nodraw)` → 마지막에 `redraw()` 1회 |
| **`full`** (보수) | 클러스터러 존재 **but** `removeMarkers` 부재 | `clear()` 후 `addMarkers(전체 오버레이)` — **오버레이·DOM은 재사용**, 클러스터러 멤버십만 전량 재구성 | 동일 |

- 모드는 `ensureClusterer()` 말미에 **1회 확정**한다(`mkClusterMode`). 매 렌더 재판정하지 않는다.
- `nodraw`/`redraw`도 `typeof mkClusterer.redraw === 'function'`으로 **실존 확인 후에만** 사용한다. 없으면 `nodraw` 없이 호출한다. → 직전 스프린트가 세운 규율 **"없는 API를 지어내지 않는다"**(clustering dev-notes L176)를 그대로 계승한다. `removeMarkers`/`redraw`는 Kakao MarkerClusterer 문서상 존재하지만 **T0 스파이크에서 실측 확인**한다(§6 T0).
- `partial`/`full`에서 던지면 → **강등(E4)**: `clear()` 시도 → `mkClusterer = null` → `mkClusterMode = 'none'` → **레지스트리 전체**(delta가 아니라 `mkPins` 전량)를 `setMap(mkMap)`으로 직접 부착. delta만 부착하면 클러스터러가 그리던 유지 핀들이 어디에도 안 붙어 **핀이 통째로 사라진다.** `ERROR`는 발신하지 않는다(지도 자체는 정상 — 기존 정책 유지).
- **예외 격리는 3모드 전부에 적용한다** (qa-logic L1·L2, 2026-08-19 추가 — 하드닝 진행 중):
  - **`none` 분기도 핀별 try/catch로 감싼다.** 지금은 이 분기만 무방비라 `setMap` 1건의 예외가 `__muklogSetMarkers` 밖으로 새고, 남은 핀들의 부착까지 통째로 중단된다(§4.1 전제 정정 참조). `resetMarkers`·`demoteClusterer`가 이미 쓰는 best-effort 원칙과 통일한다.
  - **`removed` 오버레이는 강등 전에 반드시 뗀다**(L2). `removed`는 §4.3 2단계에서 **이미 `mkPins`에서 빠진** 상태로 넘어오므로, 지역 배열이 유일한 참조다. 여기서 못 떼면 레지스트리에도 없고 화면에는 남는 **영구 유령**이 된다. `partial`의 `removeMarkers`가 던지면 현재는 `demoteClusterer()`의 `clear()`에만 의존하는데 그 `clear()`도 예외를 삼키므로, **이중 고장에서 유령이 남는다.** catch 진입 직후 `removed`를 `setMap(null)`로 명시 탈착한 뒤 강등한다.
- 강등은 **단방향**이다(clustered → none). `none`에서 클러스터러가 부활하는 경로는 재-INIT뿐이고 그때는 §4.5로 전량 재구성된다.

### 4.5 재-INIT 정합 계약 ★최고 위험 경로

`__muklogInit`은 **새 `kakao.maps.Map` 인스턴스를 만든다**. 이때 `mkPins`에 남은 오버레이는 **죽은 지도에 묶여 있다**. 조정 알고리즘은 sig가 같으면 "유지"로 판정하므로 — 리셋이 없으면 **재시도 후 지도가 텅 빈 채 예외도 안 나는 조용한 실패**가 된다. (직전 스프린트의 clustering L1과 정확히 같은 계열의 함정이다.)

```js
function resetMarkers() {                     // 신설 — clearMarkers 대체
  for (var id in mkPins) {
    if (!mkPins.hasOwnProperty(id)) continue;
    try { mkPins[id].overlay.setMap(null); } catch (e) {}   // 죽은 지도라 던질 수 있다 → 개별 격리
  }
  mkPins = {};                                // mkSelectedId는 유지(재주입 시 재적용 — 기존 정책)
}
```

`__muklogInit` 내부 실행 순서를 **계약으로 고정**한다:

```
new kakao.maps.Map(...)  →  me 오버레이  →  resetMarkers()  →  ensureClusterer()  →  renderMarkers(payload.markers)
```

`resetMarkers()`가 `ensureClusterer()`보다 **앞**이어야 한다: 뒤로 가면 `ensureClusterer`의 `clear()`가 이미 참조를 놓은 뒤라 `setMap(null)`이 무의미해질 수 있고, 앞에 두면 `clear()`가 클러스터러 내부 목록까지 비워 유령 버블 0(E8 유지)이 된다.

### 4.6 변경/삭제되는 기존 심볼

| 심볼 | 처리 |
|---|---|
| `clearMarkers()` | **삭제** → `resetMarkers()`로 대체(호출부는 `__muklogInit` 1곳뿐) |
| `mkOverlays` | **삭제** → `mkPins`에서 파생 |
| `renderMarkers(markers)` | 시그니처 유지, 내부 전면 교체 |
| `mkPins[id]` | `{el, overlay, kind}` → `{el, overlay, kind, sig}` |
| `pinZIndex` · `__muklogSetSelected` · `__muklogRecenter` · `emitBounds` | **무변경** |

**폐기 심볼에 묶인 기존 단언의 처리 방침** (qa-logic D1 지적 반영, 2026-08-19)

기존 `mapHtml.spec.ts` 42건 중 일부는 위 폐기 심볼(`clearMarkers` · `mkOverlays`)을 **문자열로 직접** 단언한다. 이 단언들은 원문 그대로 존속시킬 수 없다 — 유일한 방법이 "삭제된 심볼 이름을 코드에 되살려 단언만 통과시키는 것"이고 그건 죽은 단언이다.

- **원칙: 문장이 아니라 의도를 보존한다.** 폐기 심볼에 묶인 단언은 후속 심볼(`allPinOverlays` · `resetMarkers` · `applyOverlayDelta` · `demoteClusterer`) 위에서 **동등 이상 강도로 재작성**한다.
- 재작성 시 원 단언이 지키던 **불변식이 무엇이었는지**를 주석으로 남긴다(예: "me 오버레이는 클러스터 대상 제외", "고스트 핀 방지 정리 순서").
- **완화(강도 하향)는 0건**이어야 한다. 재작성본이 실제로 하중을 받는지는 뮤테이션으로 실증한다(§6 T8).
- 폐기 심볼의 **잔재 0**을 단언하는 항목을 추가한다(`expect(html).not.toContain('mkOverlays' | 'clearMarkers')`) — 삭제가 실제로 일어났음을 테스트가 지킨다.

---

## §5. 화면 · UX

**신규 화면 0 · 신규 컴포넌트 0 · 카피 변경 0 · 토큰 변경 0.**

관찰되는 변화는 단 하나: **지도를 이동/줌 했을 때 이미 떠 있던 핀이 사라졌다 다시 나타나지 않는다.** 새로 유입된 핀만 추가로 나타난다. 클러스터 버블도 멤버가 바뀐 것만 갱신된다.

체감 기준(디바이스 스모크에서 육안 확인):
- 팬 → nearby 응답 도착 시 **기존 핀 깜빡임 0**.
- 카테고리 필터 칩 전환 시 남아 있는 카테고리 핀은 그대로, 빠지는 핀만 사라진다.
- 선택된 핀(확대 + 그림자)이 다른 핀 유입으로 **선택 해제되거나 깜빡이지 않는다**.

---

## §6. 작업 목록 (TDD: Red → Green → Refactor)

### T0. 스파이크 — Kakao MarkerClusterer API 실존 확인 (선행, 코드 0)
- [ ] `kakao.maps.MarkerClusterer` 인스턴스에 `removeMarkers` · `redraw` · `addMarkers`의 **실존과 인자 형태**를 디바이스/시뮬레이터 스모크로 확인(콘솔 `typeof`).
- **인수조건**: 세 메서드의 존재 여부를 dev-notes에 **실측값으로** 기록한다. `removeMarkers` 부재로 확인되면 §4.4 `partial` 모드는 코드에 남기되(typeof 가드가 자연 폴백) 스모크는 `full` 모드로 수행한다.
- **왜 먼저인가**: 없는 API 위에 계약을 쌓으면 강등 경로에서만 도는 죽은 코드가 된다(직전 스프린트 규율).

### T1. 테스트 인프라 — WebView 스크립트 실행 샌드박스 신설
- [ ] `src/test/mapHtmlSandbox/mapHtmlSandbox.ts` (+ `index.ts`) 작성. **테스트 전용**이며 앱 번들 도달 경로 0(스펙에서만 import — `src/test/setDevMode.ts` 선례와 동일한 위치·성격).
- 구현: `mapHtml({jsKey})` 결과에서 인라인 `<script>` 본문을 추출 → Node `vm.runInNewContext`로 **가짜 전역** 위에서 실행.
  - 가짜 `document`: `createElement(tag)`가 `{ className, dataset, textContent, style, classList(add/remove/contains), addEventListener, click() }` 스텁을 돌려주고 **태그별 생성 횟수를 계수**한다. `getElementById('map')`도 제공.
  - 가짜 `kakao.maps`: `Map`(인스턴스 식별자 보유) · `LatLng` · `CustomOverlay`(`setMap`/`setPosition`/`setZIndex` 호출 로그 보유) · `MarkerClusterer`(`addMarkers`/`removeMarkers`/`clear`/`redraw`/`setMap` 호출 인자 로그, **메서드 존재 여부와 throw 여부를 옵션으로 주입**) · `event.addListener` · `load(cb)`.
  - 가짜 `window.ReactNativeWebView.postMessage`: 발신 메시지 배열 수집.
  - SDK 로드 시뮬레이션: 생성된 script 스텁의 `onload()`를 호출 → `READY` 수신 확인.
- 노출 API(권고): `createMapSandbox({ clusterer })` → `{ init, setMarkers, setSelected, recenter, posted, counts, pins, clusterer, map }`.
- **인수조건**:
  - `createMapSandbox()` 후 SDK onload 시뮬레이션 → `posted`에 `{type:'READY'}`가 1건 담긴다.
  - `init({center, markers:[핀2], me})` → `CustomOverlay` 2개 생성, `MarkerClusterer.addMarkers`가 길이 2로 1회 호출.
  - 파일명이 `*.spec.*`/`*.test.*`가 아니어서 **jest testMatch에 잡히지 않는다**(`npm test` 스위트 수 증가는 실제 spec 증분만큼만).
- **왜 필요한가**: 지금까지 mapHtml 검증은 문자열 `toContain` + `node --check`뿐이라 **"코드가 실제로 무엇을 하는지"는 한 줄도 검증되지 않는다.** 증분 조정은 분기·상태가 있는 알고리즘이라 문자열 단언으로는 회귀를 못 잡는다. 이 인프라는 이후 모든 지도 스프린트가 재사용한다. (메모리 `qa-layout-blind-spot`: QA가 렌더 결과를 안 보는 사각지대를 좁히는 조치이기도 하다.)
- **한계 명시**: 샌드박스는 Kakao SDK의 *문서화된 표면*을 모사할 뿐 실제 동작이 아니다. **실 SDK 동작은 디바이스 스모크가 단독 권위**(§7).

### T2. `pinSig` + `createPinOverlay` 추출 (Red → Green)
- [ ] HTML 템플릿 안에 `pinSig(m)`·`createPinOverlay(m)` 함수를 만들고, 기존 `renderMarkers`의 el/overlay 생성부를 그대로 이관(동작 동일).
- **인수조건**: 기존 `mapHtml.spec.ts` 42건 전부 green 유지(리팩터링 단계 — 관측 동작 변화 0). `node --check` 통과.

### T3. 증분 조정 구현 (Red → Green) — §4.3
- [ ] `renderMarkers`를 §4.3 알고리즘으로 교체. `clearMarkers` 삭제, `mkOverlays` 제거, `mkPins`에 `sig` 추가.
- **인수조건 (샌드박스 실행 단언)**:
  - **AC1** 동일 마커 3건을 `setMarkers`로 **2회** 주입 → 2회차의 `div` 생성 수 **0**, `CustomOverlay` 생성 수 **0**, 유지 핀의 `overlay.setMap` 호출 **0**.
  - **AC2** 핀 10건 → 15건(기존 10 유지 + 신규 5) 주입 → 신규 `div` 생성 **5**, 제거 목록 길이 **0**.
  - **AC3** 15건 → 12건(3건 이탈) 주입 → 신규 생성 **0**, 제거 대상 오버레이 정확히 **그 3개**(id 일치), 나머지 12개 미접촉.
  - **AC4** id는 같고 `emoji`만 바뀐 1건 포함해 주입 → 그 1건만 제거+재생성(`div` 생성 **1**), 나머지 재생성 **0**.
  - **AC5** `setMarkers({markers: []})` → 전 핀 제거, `mkPins` 비고, 예외 0.
  - **AC6** 조정 후 `mkPins` 키 집합 == 주입한 id 집합 (I2).

### T4. 클러스터러 3모드 정합 (Red → Green) — §4.4
- [ ] `ensureClusterer()` 말미에 `mkClusterMode` 확정. `detachOverlays`/`attachOverlays`를 모드별로 분기. 예외 시 강등 처리.
- **인수조건**:
  - **AC7** `partial` 모드: 3건 추가 시 `addMarkers` 인자 길이 3 · `removeMarkers` 미호출, 3건 제거 시 `removeMarkers` 인자 길이 3 · `addMarkers` 미호출, 두 경우 모두 `clear()` 호출 **0**, `redraw()` 호출 **1**(존재할 때).
  - **AC8** `full` 모드(가짜 클러스터러에서 `removeMarkers` 제거): 변경 시 `clear()` 1회 + `addMarkers`가 **현재 전체 오버레이**를 받는다. 단 **`div` 생성은 delta분만**(오버레이 재사용 확인).
  - **AC9** `none` 모드(클러스터러 미생성): 추가 핀만 `setMap(mkMap)`, 제거 핀만 `setMap(null)`, 유지 핀 `setMap` 호출 0.
  - **AC10** 강등: `addMarkers`가 throw하도록 주입 → 이후 `mkClusterer`가 null이 되고, **레지스트리 전체 오버레이**가 `setMap(mkMap)`로 부착되며(유지 핀 포함), `posted`에 `ERROR` **0건**. 다음 `setMarkers` 호출은 `none` 모드로 동작한다.

### T5. 재-INIT 리셋 (Red → Green) — §4.5
- [ ] `resetMarkers()` 신설 + `__muklogInit` 실행 순서 고정.
- **인수조건**:
  - **AC11** `init` → `setMarkers(3건)` → **`init` 재호출(동일 3건)** → 3개 오버레이 전부 **새 Map 인스턴스**에 부착된다(`none` 모드: `setMap` 인자가 새 map / `partial`·`full`: `addMarkers`가 길이 3으로 호출). **"유지"로 판정돼 아무것도 안 붙는 상태가 되지 않는다.**
  - **AC12** 재-INIT 시 이전 오버레이의 `setMap(null)`이 호출된다(유령 0). `setMap`이 throw해도 `mkPins`는 비워지고 이후 렌더가 정상 진행된다.
  - **AC13** 재-INIT 후 `mkSelectedId`가 유지돼, 같은 id의 핀이 다시 만들어질 때 `mk-pin--active`가 적용된다(I4).

### T6. 선택(SET_SELECTED) 상호작용 (Red → Green)
- **인수조건**:
  - **AC14** 핀 A 선택 후 핀 D 추가 주입 → A의 el은 **동일 객체**이고 `mk-pin--active`를 계속 갖는다(재생성 0 → 선택 깜빡임 0).
  - **AC15** 현재 선택 id와 같은 핀이 **새로** 추가되면 생성 시점에 `mk-pin--active` + `zIndex 5`가 적용된다.
  - **AC16** 선택된 핀이 제거되면 그 오버레이만 detach되고 `mkSelectedId`는 그대로 남는다(RN의 `clearSelectionWhenPinGone`이 해제를 담당 — 기존 분업 유지).

### T7. 문자열 단언 증분 + 회귀 (`mapHtml.spec.ts`)
- [ ] 기존 42건의 **의도 보존 · 완화 0**. 폐기 심볼(`clearMarkers`·`mkOverlays`)에 묶인 단언은 §4.6 방침대로 후속 심볼 위에서 **동등 이상 강도로 재작성**하고, 그 외 단언은 무수정 존속.
- [ ] 증분 단언 추가: `pinSig` 존재, `resetMarkers` 존재, `clearMarkers` **부재**, `mkOverlays` **부재**, `removeMarkers`/`redraw`의 `typeof` 가드 존재, `mkClusterMode` 존재.
- **인수조건**:
  - 재작성된 단언은 **원 단언이 지키던 불변식을 명시한 주석과 함께** 후속 심볼을 대상으로 한다. 재작성 대상이 아닌 단언의 **수정 0**.
  - **완화 0** — 단언 개수 감소 없음, 조건 약화 없음. 재작성본의 하중은 §6 T8 뮤테이션으로 실증한다(재작성본이 죽이는 뮤턴트가 최소 1개 있어야 한다).
  - 생성 스크립트를 `node --check`로 문법 검증 통과(직전 스프린트 규율 계승 — 템플릿 안 JS는 어떤 파서도 검증하지 않는다).

### T8. 뮤테이션 점검 (격리 사본으로만)
- [ ] 아래 뮤턴트가 **전부 killed**임을 확인한다. 뮤턴트 코드는 **`src/` 밖 격리 사본**에서 실행하고(testMatch 미매치) **즉시 삭제**한다.

| # | 뮤턴트 | 죽여야 할 테스트 |
|---|---|---|
| M1 | `__muklogInit`에서 `resetMarkers()` 제거 | AC11 |
| M2 | `pinSig`에서 `lat/lng` 제외 | AC4 변형(좌표만 바뀐 케이스 — T3에 1건 추가) |
| M3 | 유지 판정을 무시하고 항상 재생성(기존 동작) | AC1 |
| M4 | `removed` 오버레이를 detach하지 않음 | AC3(유령) |
| M5 | 강등 시 delta만 재부착(레지스트리 전량 아님) | AC10 |
| M6 | `mkClusterMode` 판정에서 `typeof` 가드 제거 | AC8 |
| M7 | `__muklogInit`에서 `resetMarkers()`/`ensureClusterer()` **순서 뒤집기** | §4.6 재작성 단언(`resetMarkers`가 `ensureClusterer`보다 앞) — qa-logic 추가, killed 확인 |
| M10 | `full` 모드가 `allPinOverlays()`가 아니라 **delta만** `addMarkers` | §4.6 재작성 단언(`addMarkers(allPinOverlays())`) — qa-logic 추가, killed 확인 |

> M7·M10은 qa-logic이 **폐기 심볼 단언의 재작성본이 실제로 하중을 받는지**를 실증하려고 추가한 뮤턴트다. 둘 다 재작성 단언에 의해 죽었다 → "완화 0"이 형식이 아니라 실효임이 확인됐다.

### T9. 완료 게이트
- [ ] `npm test` 전량 green (기존 스위트 회귀 0).
- [ ] `npx tsc --noEmit` 오류 0.
- [ ] `node --check`로 추출 스크립트 문법 통과.
- [ ] dev-notes.md 작성(T0 실측값·모드 판정 결과 포함).
- [ ] 디바이스 스모크(§7) 수행 및 결과 기록.

---

## §7. 디바이스 스모크 (실 SDK 단독 권위 — 샌드박스로 대체 불가)

| # | 시나리오 | 기대 |
|---|---|---|
| **S1** | 지도 탭 진입 → 첫 핀 표시 | 기존과 동일하게 핀·클러스터 버블이 뜬다(회귀 0) |
| **S2** | 지도를 짧게 여러 번 팬 | **이미 떠 있던 핀이 깜빡이지 않는다.** 신규 핀만 추가로 나타난다 |
| **S3** | 줌 인/아웃 반복 | 클러스터 버블 개수·위치가 자연스럽게 갱신, 유령 버블/이중 핀 0 |
| **S4** | 카테고리 칩 전환(전체 → 한식 → 전체) | 남는 핀 유지, 빠진 핀만 사라짐. 되돌리면 복구 |
| **S5** | 핀 선택 후 지도 이동(신규 핀 유입) | 선택 핀의 확대·그림자가 **끊기지 않는다** |
| **S6** | 기내모드로 SDK 에러 유발 → 온라인 복귀 → "다시 시도" | 재-INIT 후 핀이 **정상 표시**(빈 지도 0) — AC11의 실기기 확인 |
| **S7** | 앱 백그라운드 → 복귀 | 핀 유지, 중복 0 |
| **S8** | T0 결과가 `full` 모드였다면 그 경로로 S2~S4 재수행 | 깜빡임은 클러스터 버블 수준으로만 남고 핀 DOM은 유지 |

---

## §8. 엣지케이스

| # | 상황 | 계약된 동작 |
|---|---|---|
| **E1** | 같은 마커 집합 재주입(`markersKey` 동일이라 원래 발화 안 하지만 방어) | 조정 결과 add·remove 모두 0 → 아무 일도 안 일어난다(클러스터러 `redraw`도 호출 안 함) |
| **E2** | 빈 배열 주입 | 전 핀 detach, `mkPins={}`, 예외 0. 클러스터러는 빈 상태(버블 0) |
| **E3** | `markers`에 중복 id | 뒤가 이긴다(§4.3 1단계). RN `mergeMapMarkers`가 이미 dedup하므로 방어적 처리 |
| **E4** | 클러스터러 `addMarkers`/`removeMarkers` throw | 강등 — `mkClusterer=null`, **레지스트리 전량** 직접 부착, `ERROR` 미발신, 이후 `none` 모드 (§4.4) |
| **E5** | 클러스터러 라이브러리 미로드 | `ensureClusterer`가 `null` → `mkClusterMode='none'` → 직접 add/remove. 기존 강등 경로와 동일 |
| **E6** | 재-INIT(에러 후 재시도) | `resetMarkers()`로 레지스트리 전량 폐기 후 전량 재생성 (§4.5) — **이 한 번은 의도적으로 전량 재생성이다** |
| **E7** | `overlay.setMap`이 죽은 지도에서 throw | `resetMarkers`가 핀별 try/catch로 격리 — 한 핀의 실패가 나머지 정리를 막지 않는다(메모리 `definer-storage-and-best-effort`의 "부수 정리가 핵심 mutation을 막지 않게 격리"와 동일 원칙) |
| **E8** | 선택된 핀이 viewport 이탈로 제거 | 오버레이만 detach. `mkSelectedId`는 유지, RN이 `clearSelectionWhenPinGone`으로 카드/선택 해제 (기존 분업 무변경) |
| **E9** | `SET_MARKERS`가 READY 전에 주입 | `mkMap === null`이라 early return — 기존과 동일. READY 후 RN이 재주입 |
| **E10** | 누적 cap(100) 도달로 LRU 퇴출 발생 | 퇴출된 id가 목표 집합에서 빠지므로 정상 remove 경로. cap은 이번 슬라이스에서 안 바꾼다 |
| **E11** | 100건 규모에서의 조정 비용 | 조정은 O(n) 두 번(해시 조회). 파괴·재생성 O(n) DOM 작업보다 항상 싸다 — 성능 회귀 경로 없음 |
| **E12** | nearby 응답 실패(status='error') | `items` 무변경 → 마커 무변경 → 조정 no-op. 기존 "누적 유지" 정책이 그대로 관철된다 |
| **F1** | **알려진 한계(수용)**: `markersKey`는 `id:kind`만 담아 emoji/좌표만 바뀐 갱신은 `SET_MARKERS`를 발화시키지 않는다 | **오늘과 동일한 동작이므로 회귀 아님**(현재도 같은 조건에서 재렌더가 없다). sig의 emoji/lat/lng 분기는 *다른 핀 변경으로 발화한 주입*에서 함께 반영된다. 필요해지면 별도 슬라이스에서 `markersKey`에 데이터 해시를 넣는다 |

---

## §9. QA(qa-logic)가 교차검증할 경계면

| # | 생산자 ↔ 소비자 | 확인 포인트 |
|---|---|---|
| **B1** | `MapTabScreen.reinjectMarkersOnChange` → `buildSetMarkersScript` → `__muklogSetMarkers` | RN 측 **변경 0**인지. `SET_MARKERS`가 여전히 **전체 집합** 의미인지(부분 패치로 변질 금지) |
| **B2** | `renderMarkers` ↔ `mkPins` 레지스트리 | I1~I4 불변식. 특히 `mkPins` 키 집합 == 주입 id 집합 |
| **B3** | `renderMarkers` ↔ `mkClusterer` (직전 스프린트 산출물) | 소유권 규칙 — 클러스터 모드에서 `overlay.setMap`을 직접 호출하는 코드가 **없어야** 한다(강등 처리 내부 제외). 이중 표시/유령의 유일한 원인 |
| **B4** | `__muklogInit` ↔ `resetMarkers`/`ensureClusterer` 실행 순서 | §4.5 순서가 코드에 그대로 있는지. 순서가 바뀌면 재시도 후 빈 지도 |
| **B5** | `__muklogSetSelected` ↔ 조정 로직 | sig에 selected가 **없는지**(있으면 선택마다 재생성 — map-pin-select 결정 회귀) |
| **B6** | `mapHtml.spec.ts` 기존 42건 | **의도 보존 · 완화 0.** 폐기 심볼(`clearMarkers`·`mkOverlays`)에 묶인 단언만 후속 심볼 위에서 동등 이상 강도로 재작성 허용(§4.6) — 재작성본이 원 불변식을 더 약하게 잠그지 않는지, 그 외 단언이 무수정인지, 폐기 심볼 잔재 0 단언이 있는지 |
| **B7** | `src/test/mapHtmlSandbox` ↔ 번들 | 앱 코드에서 import 0 · jest testMatch 미매치 · `tsc` 통과 |
| **B8** | 코드 컨벤션(`docs/code-convention.md`) | 샌드박스/스펙은 RN 컨벤션(화살표 함수·named-object 인자) 준수. **HTML 템플릿 내부 JS는 예외** — WebView 격리 ES5 환경이라 기존 `var`/`function` 스타일을 유지한다(기존 선례) |
| **B9** | 비용 | 카카오/Supabase 호출 코드 경로 **미접촉** 확인(`searchNearby`·`useNearbyPlaces` diff 0) |

---

## §10. 비용 가드레일 체크

| 항목 | 이번 슬라이스 영향 |
|---|---|
| Kakao Local API 호출 | **0 증가** (조회 코드 미접촉) |
| Kakao Map JS SDK 로드 | **0 증가** (HTML 1회 생성 유지) |
| Supabase Edge invoke | **0 증가** |
| Supabase DB/Storage/Realtime | **0** (마이그레이션·쿼리 0) |
| AWS | **0** |
| 디바이스 자원 | **감소** — DOM 생성/파괴가 배치당 N개 → delta개로. 클러스터러 전량 재계산도 delta 갱신으로 |
| 번들 크기 | HTML 문자열 수십 줄 증가(무시 가능). 샌드박스는 테스트 전용이라 번들 도달 0 |

---

## §11. 후속 슬라이스 개요 (이번 스프린트 밖)

### S2 — D: Edge 페이지 팬아웃 (`nearby-search` page 1~3)

- **한 줄**: `nearby-search`가 Kakao `category.json`을 page 1~3까지 호출해 1뷰포트 최대 45건을 **1회 invoke로** 돌려준다.
- **사전 사실**: nearby-search에는 **deno 테스트가 아예 없다**(§2.3). 이 슬라이스가 첫 테스트를 만든다.
- **정의해야 할 계약**:
  - 조기 종료: 응답 `meta.is_end === true` 또는 `documents.length < size`면 다음 page를 **호출하지 않는다**(불필요한 호출 억제 — 승인받은 3배는 상한이지 목표가 아니다).
  - **부분 성공**: page1 성공 + page2/3 실패 → **200 + page1 결과**(빈 배열 아님). 응답에 `partial: true` 같은 플래그를 넣을지 / 조용히 성공 처리할지 결정 필요 → 클라 `NearbyPlaceItem[]` 계약을 깨지 않는 형태 권장.
  - page1 실패 → 기존대로 502 `KAKAO_REQUEST_FAILED`.
  - **429(rate limit)**: 재시도·백오프 **없이 즉시 중단**하고 그때까지 모은 결과로 응답(재시도는 쿼터를 더 태운다). 429가 page1에서 나면 502.
  - 순차 vs 병렬: 병렬(`Promise.allSettled`)이 지연은 낮지만 429 위험이 크다 → **순차 + 조기 종료** 권장, 결정 근거를 plan에 명시.
  - 페이지 간 **id 중복 제거**(Kakao가 경계에서 중복을 줄 수 있다).
- **동반 갱신**: `index.ts` 주석 3곳(L11·25·131), `architecture.md` L238 백로그 행의 "size15·page 미사용" 문구, 변경 이력 표.
- **A 선행이 필요한 이유**: 45건이 한 번에 유입될 때 전량 파괴·재생성이면 깜빡임이 3배가 된다.

### S3 — B: 누적 캐시 영속 (AsyncStorage)

- **한 줄**: 세션 누적 `items`를 AsyncStorage에 영속해 앱 재시작 직후에도 이전 핀을 즉시 표시한다.
- **선례 그대로**: `pinsCache.ts` — **userId 키잉(계정 격리 필수)** · 버전 태깅 · 실패는 전부 조용한 miss · 미확보 userId면 read/write no-op.
- **결정해야 할 것**: (a) 쓰기 시점 — `items` 변경마다 쓰면 I/O 과다이므로 디바운스(2초 권고) 또는 탭 blur 시. (b) TTL — 음식점 이름/좌표는 거의 불변이나 폐업이 있으므로 24h 정도의 만료를 둘지. (c) 로드 시 `NEARBY_ACCUM_CAP` 재적용. (d) 저장 규모 ≈ 100건 × 약 200B = 20KB 수준(안전).
- **독립성**: A·D와 코드 경로가 겹치지 않아 언제 해도 되지만, 보안(계정 격리) 검토가 필요한 유일한 슬라이스다.

---

## §12. 완료 정의 (Definition of Done — S1)

- [ ] T0~T9 전 작업 완료, 모든 AC 충족
- [ ] `npm test` 전량 green · `npx tsc --noEmit` 0 · `node --check` 통과
- [ ] `mapHtml.spec.ts` 기존 42건 의도 보존 · 완화 0 (폐기 심볼 단언만 §4.6 방침대로 재작성)
- [ ] 뮤턴트 M1~M6 전부 killed (격리 사본 삭제 완료)
- [ ] 디바이스 스모크 S1~S8 수행·기록 (S2/S5/S6가 핵심)
- [ ] RN 코드(`MapTabScreen`·`useNearbyPlaces`·`mapMessages`·`searchNearby`) diff **0**
- [ ] `dev-notes.md` · `qa-report-logic.md` 작성 (qa-visual 미투입 판정 기록)
- [ ] **qa-logic L1·L2 하드닝 반영** — `none` 분기 예외 격리 / 강등 전 `removed` 명시 탈착 (§4.4, 2026-08-19 **진행 중**)

**현재 상태(2026-08-19)**: S1은 qa-logic **조건부 PASS**(직전 안정 지표 199 스위트 · 2,035 테스트 green · tsc 0, 블로커 0). 조건은 위 L1·L2 하드닝 2건이며 둘 다 Low(도달 가능성 낮음)라 블로커가 아니다.
⚠ **하드닝은 착수했으나 완료 전 중단됐다** — 상위 루프(`docs/loops/ux-improvements.md`)가 토큰 예산 초과로 종료되면서 **작업 트리가 중간 편집 상태(1 스위트 fail)로 남았다.** 재개 시 트리 상태·복구 절차는 인계 문서 `docs/handoff/2026-08-19-map-nearby-load.md`를 먼저 읽는다. 위 DoD 체크박스는 그 하드닝이 끝나고 `npm test`가 다시 전량 green이 된 시점에 닫는다. N1(`mapHtmlSandbox` 파일명 ≠ 대표 export `createMapSandbox`)은 기능 영향 0이라 다음 지도 스프린트로 이월 가능. S2(D 페이지 팬아웃)·S3(B 캐시 영속)은 §11 개요를 바탕으로 **각각 별도 plan.md**로 착수한다.

---

## §13. 개정 이력

| # | 날짜 | 개정 내용 | 제기 | 승인 | 반영 위치 |
|---|---|---|---|---|---|
| **R1** | 2026-08-19 | **"기존 42건 삭제·완화 0(diff 삭제 라인 0)" 문구 정정.** §4.6이 `clearMarkers`·`mkOverlays` 폐기를 지시하면서 그 심볼에 묶인 단언의 삭제 라인 0을 요구해 **계획 내부가 양립 불가**였다(그대로 지키는 유일한 길이 삭제된 심볼을 되살려 단언만 통과시키는 죽은 코드). 형태 기준(diff 삭제 라인)을 실질 기준(의도 보존·완화 0·뮤테이션으로 하중 실증)으로 교체 | qa-logic-nearby-render §9 **D1** (dev 자진 신고를 QA가 diff로 검증: 삭제 4건 전부 폐기 심볼 결속, 완화 0, 나머지 38건 무수정) | 리더 2026-08-19 | §4.6(방침 블록 신설) · §6 T7 · §9 B6 · §12 |
| **R2** | 2026-08-19 | **폐기 심볼 단언 처리 방침을 규칙으로 승격.** 일회성 예외 처리가 아니라 "문장이 아니라 의도를 보존한다" 4개 항목(후속 심볼 위 동등 이상 재작성 / 원 불변식 주석 명시 / 완화 0 / 폐기 심볼 잔재 0 단언 추가)으로 명문화 | 동상(D1 후속) | 리더 2026-08-19 | §4.6 |
| **R3** | 2026-08-19 | **뮤턴트 M7·M10 편입.** QA가 재작성 단언의 하중을 실증하려고 추가한 2종(INIT 순서 뒤집기 / full 모드가 delta만 `addMarkers`)과 killed 결과를 계획에 기록 → "완화 0"이 형식이 아니라 실효임을 문서에서 추적 가능 | qa-logic §6 | 리더 2026-08-19 | §6 T8 |
| **R4** | 2026-08-19 | **§4.1 "다음 주입 1회로 항상 자기 치유" 전제 정정.** 자기 치유는 레지스트리와 표시 상태가 일치할 때만 성립하는데 조정은 레지스트리를 먼저 갱신하므로, 부착 실패 시 그 핀이 "유지"로 판정돼 복구되지 않는다. `none` 분기에만 예외 격리가 없어 이 경로가 실재함을 QA가 탐침 P6으로 실측. **명령형 패치 기각 결론은 유지**(국소·희귀 결함 ≠ 명령형 미러의 전역·상시 desync). 잔여 한계(격리는 전파 차단이지 자기 치유가 아님)를 계약에 명시 | qa-logic §9 **L1** | 리더 2026-08-19 | §4.1(전제 정정 블록) |
| **R5** | 2026-08-19 | **3모드 공통 예외 격리 계약 추가.** `none` 분기 핀별 try/catch(L1) + 강등 **전** `removed` 명시 탈착(L2 — `removed`는 이미 `mkPins`에서 빠져 지역 배열이 유일 참조라, `removeMarkers`와 `clear`가 연달아 실패하면 영구 유령) | qa-logic §9 **L1·L2** | 리더 2026-08-19 | §4.4 · §12 |

**미반영(계획 문서 밖 · 리더 결정 대기)**: qa-logic이 권고한 sprint-planning **스킬** 규칙 추가 — *"심볼 삭제를 지시하는 계획은 그 심볼에 묶인 기존 단언의 처리 방침을 함께 명시한다."* `.claude/skills/`는 하네스 설정 영역이라 팀 내 합의만으로 sprint-planner가 수정하지 않는다. 승인 시 이 plan의 §4.6 블록을 규칙 문안의 실사용 예시로 그대로 옮긴다(CLAUDE.md 변경 이력에도 1행 필요).
