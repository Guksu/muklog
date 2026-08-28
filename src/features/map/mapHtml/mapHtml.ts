// src/features/map/mapHtml.ts
// Kakao Map JS SDK 임베드 HTML 생성 (plan §3.5·§9.2 라이브러리 확정·§7 경계면).
//   생산자: MapWebView가 source.html로 주입. 소비자: WebView 런타임(Kakao JS SDK).
//   계약: SDK 로드 완료→READY postMessage / 마커 탭→MARKER_TAP(id) / 로드 실패→ERROR(reason).
//         RN→WebView는 window.__muklogInit(INIT)·window.__muklogSetMarkers(SET_MARKERS)·
//         window.__muklogRecenter(RECENTER: panTo + me 마커 갱신) 핸들러로 수신.
//   ⚠️ jsKey는 호출부에서 env/extra(KAKAO_JS_KEY)로 주입 — 이 파일/plan/dev-notes에 키 값 미기록(placeholder만).
//   현재위치는 RN expo-location이 INIT.me로 주입(WebView geolocation 미사용 — plan §9.2 리스크 메모).
//   마커 색: 킷 --mk-accent(#3366FF) 정합. 비주얼 토큰의 단일 출처는 RN theme이나, WebView 내부는
//   HTML 격리 환경이라 킷 brand hex를 그대로 쓴다(번역 불가 영역 — ui-publisher 합의 시 갱신).

const KEY_PLACEHOLDER = '__KAKAO_JS_KEY__';

// Kakao JS SDK 로드 HTML 템플릿. services 라이브러리는 슬라이스 1에 불필요(Local 호출 0) → 미포함.
// READY 후 RN이 INIT을 주입하면 지도/마커를 그린다. 마커는 이모지 CustomOverlay로 렌더(킷 Pin 정합).
const HTML_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <!-- https 페이지(baseUrl)에서 Kakao 타일이 http로 오면 WKWebView가 mixed-content로 차단 → 자동 https 승격. -->
  <meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    /* map-feedback U5: 지도 부팅(WebView + SDK ≈1.2s) 동안 흰 여백 대신 킷 지도 톤을 깐다
       (킷 mk-home.jsx:336 지도 영역 background — RN theme.color.mapSurface와 같은 값. WebView는 격리
       HTML이라 hex 직박음, .mk-pin 선례 동일). RN 컨테이너도 같은 톤이라 첫 프레임부터 전환이 매끈하다. */
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #EFEAE3; }
    /* WKWebView(loadHTMLString)에서 body height:100%가 0으로 붕괴 → #map은 뷰포트를 절대배치로 직접 채운다(빈 타일 방지).
       ⚠️ #map이 body를 통째로 덮으므로 body 배경만으로는 타일 도착 전 이 레이어가 그 위를 기본색으로 덮는다 → 여기도 명시한다. */
    #map { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: #EFEAE3; }
    /* saved(내 맛집)=primary border. nearby(주변 음식점)=.mk-pin--nearby 웜그레이 border.
       map-wish-pins: wish(위시 장소)=.mk-pin--wish (border-color·강조는 ui-publisher가 킷 기준 Phase 2 확정). */
    .mk-pin {
      display: flex; align-items: center; justify-content: center;
      width: 34px; height: 34px; border-radius: 17px;
      background: #ffffff; border: 2px solid #3366FF;
      font-size: 18px; box-sizing: border-box;
    }
    .mk-pin--nearby { border-color: #B6ABA0; }
    /* map-wish-pins: 위시("가고 싶은 곳") 핀 — 킷 warm 앰버 #FFB23E(= mapWishPin 토큰·범례 dot과 값 일치).
       saved(#3366FF blue)·nearby(#B6ABA0 gray)와 3-way 시각 구분. WebView 격리 HTML이라 hex 직박음(ui-publisher 소유 색).
       kind→className 분기(el.className)와 pinZIndex(active5/saved3/wish2/nearby1) 배선은 developer(T6). */
    .mk-pin--wish { border-color: #FFB23E; }
    /* 선택된(활성) 핀 — 킷 Pin active 규칙 번역(mk-home.jsx:401-416): teardrop size 44 → 원형 44px,
       filter drop-shadow(0 6px 10px rgba(0,0,0,.25)) → box-shadow 동값, 이모지 base 비례(18/34)로 23px,
       킷 MapScreen active zIndex 5(mk-home.jsx:350) → z-index 5. saved/nearby 공통(border-color 미변경 →
       각자 border 유지). developer가 선택 시 이 클래스를 토글(클래스 정의만 ui-publisher 소유). */
    .mk-pin--active {
      width: 44px; height: 44px; border-radius: 22px;
      font-size: 23px;
      box-shadow: 0 6px 10px rgba(0,0,0,0.25);
      position: relative; z-index: 5;
    }
</style>
</head>
<body>
  <div id="map"></div>
  <script>
    function post(msg) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(msg));
      }
    }

    var mkMap = null;
    var mkMeOverlay = null; // INIT에서 생성한 현재위치(파란 점) 오버레이 참조 보관(재센터 시 위치 갱신용).
    // map-pin-select: id→{el,overlay,kind} 추적(SET_SELECTED가 매칭 핀만 토글) + 현재 선택 id.
    //   mkSelectedId는 renderMarkers(SET_MARKERS 재주입)에서 재적용돼 선택이 유지된다(§3.6).
    // map-nearby-load: 항목에 sig를 추가해 {el,overlay,kind,sig}가 됐다(§4.2). sig는 "이 핀을 재사용해도
    //   되는가"의 단일 판별자다. 표시 중 오버레이 배열은 폐기하고 mkPins에서 파생한다 —
    //   두 구조가 어긋나면 유령 핀이 되는데, 파생시키면 어긋날 여지 자체가 없다. 순서는 어떤 계약에도
    //   쓰이지 않는다(핀 stacking은 overlay.setZIndex가 단독 결정).
    var mkPins = {};
    var mkSelectedId = null;
    // map-clustering: 인접 핀을 개수 버블로 묶는 Kakao MarkerClusterer. null이면 강등 상태
    //   (라이브러리 미로드/생성 실패) → 기존 개별 핀 렌더 경로가 그대로 동작한다(§3.6 E4).
    var mkClusterer = null;
    // map-nearby-load: 오버레이 "표시 소유권" 모드(§4.4).
    //   'none'    = 클러스터러 없음 → 오버레이를 지도에 직접 붙였다 뗀다(setMap).
    //   'partial' = removeMarkers 실존 → 멤버십을 delta로만 동기화(권장 경로).
    //   'full'    = 클러스터러는 있으나 removeMarkers 부재 → clear() 후 전량 재등록(오버레이·DOM은 재사용).
    //   ensureClusterer 말미에 1회 확정하고 렌더마다 재판정하지 않는다.
    var mkClusterMode = 'none';

    // ── 클러스터 설정(plan §3.4 실값 계약) — 스모크 튜닝은 이 블록 한 곳에서만 만진다(§3.7). ──
    var MK_CLUSTER_OPTIONS = {
      averageCenter: true,   // 멤버 좌표 중심(centroid)에 버블 배치 — 첫 마커 위치보다 정확.
      minClusterSize: 2,     // 2개부터 묶음(1개는 개별 핀 유지).
      gridSize: 60,          // px, Kakao 기본.
      minLevel: 2,           // 레벨 1(최대 확대)에서는 핀 34px가 실제로 겹치지 않아 클러스터하지 않는다.
      calculator: [10, 100], // 개수 경계 → 스타일 3단계(S0 2~9 / S1 10~99 / S2 100+).
      // map-feedback U55: 기본 클릭줌은 무애니메이션 즉시 전환이라 클러스터 해체 재렌더와 겹쳐 "깜박임"이 된다.
      //   끄고 clusterclick에서 우리가 애니메이션 줌인을 건다. ⚠️ 되돌리는 setter가 SDK에 없어 생성자에서 1회 확정이다.
      disableClickZoom: true,
    };
    // 클러스터 탭 줌인 실값(§3.1 A) — 스모크 튜닝은 이 세 줄에서만 만진다.
    var MK_CLUSTER_ZOOM_STEP = 1;          // 탭당 확대 단계. Kakao 공식 샘플(getLevel()-1) 동일. animate 가능 상한이 2라 1~2만 허용.
    var MK_CLUSTER_ZOOM_DURATION_MS = 300; // 원칙 4(150~300ms) 상단 + Kakao animate 기본값과 일치.
    var MK_MAP_MIN_LEVEL = 1;              // ROADMAP 최소 레벨(1~14). 하한 클램프.
    // MarkerClusterer의 styles는 클러스터 DOM에 인라인 CSS로 적용되는 JS 객체다(<style> 클래스가 아님).
    //   WebView 격리 HTML이라 킷 hex를 직박는 기존 선례(.mk-pin)를 그대로 따른다.
    //   ⚠️ zIndex는 넣지 않는다 — 오버레이마다 컨테이너가 달라 element z-index는 stacking에 무효(L69-71).
    function mkClusterStyle(size, fontSize) {
      return {
        width: size, height: size,
        lineHeight: size, // 텍스트 노드 1줄이라 flex 대신 line-height 센터링(Kakao 공식 샘플 방식).
        fontSize: fontSize,
        background: '#3366FF',                  // 킷 --mk-accent(브랜드 파랑).
        color: '#FFFFFF',
        border: '2px solid #FFFFFF',            // 지도 배경(#EFEAE3 계열) 대비 분리.
        borderRadius: '999px',                  // 원형.
        textAlign: 'center',
        fontWeight: '700',
        boxShadow: '0 3px 5px rgba(0,0,0,0.18)', // 킷 Pin 비활성 drop-shadow 동값.
      };
    }
    var MK_CLUSTER_STYLES = [
      mkClusterStyle('40px', '13px'), // S0: 2~9
      mkClusterStyle('48px', '14px'), // S1: 10~99
      mkClusterStyle('56px', '15px'), // S2: 100+
    ];

    // 클러스터러 1회 생성(§3.6 C3). 재-INIT(handleRetry)에서 재생성하면 이전 클러스터러가 붙잡은
    //   버블이 유령으로 남으므로 이미 있으면 재사용한다(E8).
    //   ⚠️ 단, 재-INIT은 mkMap을 새 Map 인스턴스로 교체한다(아래 __muklogInit). 클러스터러를 그대로
    //   재사용하면 옛 Map에 묶인 채라 새 지도에 핀이 하나도 안 그려진다(예외가 없어 강등도 안 걸리는
    //   조용한 실패). 재사용 전에 clear() + 새 Map 재바인딩을 먼저 하고, setMap이 없거나 던지면
    //   폐기해 아래에서 재생성한다(clear()를 선행했으므로 유령 버블 없음).
    //   라이브러리 미로드·MarkerClusterer 미정의·생성 예외는 전부 삼키고 mkClusterer=null로 둔다 →
    //   renderMarkers가 기존 개별 핀 경로로 강등된다(E4). 지도 자체는 멀쩡하므로 ERROR는 발신하지 않는다.
    // map-nearby-load: 표시 소유권 모드를 확정한다(§4.4). Kakao MarkerClusterer 문서에는 removeMarkers·
    //   redraw가 있으나 SDK 버전에 따라 없을 수 있어 typeof로 실존 확인한 뒤에만 그 경로를 고른다 —
    //   "없는 API를 지어내지 않는다"(map-clustering dev-notes) 규율을 그대로 계승한다.
    function syncClusterMode() {
      if (!mkClusterer) {
        mkClusterMode = 'none';
        return;
      }
      mkClusterMode = typeof mkClusterer.removeMarkers === 'function' ? 'partial' : 'full';
    }

    // map-feedback U55: 클러스터 탭 → 클러스터 중심을 기준점으로 한 단계 부드럽게 확대한다.
    //   ⚠️ mkMap을 인자로 받거나 클로저에 가두지 않는다 — 재-INIT이 mkMap을 새 인스턴스로 교체하므로
    //      반드시 모듈 변수를 매번 읽어야 옛 지도에 대고 setLevel 하는 조용한 실패를 피한다.
    function mkClusterZoomIn(cluster) {
      if (!mkMap || !cluster || typeof cluster.getCenter !== 'function') return;
      var level = mkMap.getLevel();
      if (typeof level !== 'number') return;
      var next = level - MK_CLUSTER_ZOOM_STEP;
      if (next < MK_MAP_MIN_LEVEL) next = MK_MAP_MIN_LEVEL;
      if (next === level) return; // 더 확대할 수 없다 — 같은 레벨 재설정도 하지 않는다(불필요한 재렌더 = 깜박임).
      mkMap.setLevel(next, {
        anchor: cluster.getCenter(),
        animate: { duration: MK_CLUSTER_ZOOM_DURATION_MS },
      });
    }

    function ensureClusterer() {
      if (mkClusterer) {
        try {
          mkClusterer.clear();
          if (typeof mkClusterer.setMap === 'function') mkClusterer.setMap(mkMap);
          else mkClusterer = null; // setMap 미제공 SDK → 폐기 후 재생성(없는 API에 기대지 않는다).
        } catch (e) {
          mkClusterer = null;
        }
        syncClusterMode(); // 재사용 확정분 — 아래 early-return을 타므로 여기서 확정한다.
      }
      if (mkClusterer) return;
      try {
        if (!kakao.maps.MarkerClusterer) return;
        var created = new kakao.maps.MarkerClusterer({
          map: mkMap,
          averageCenter: MK_CLUSTER_OPTIONS.averageCenter,
          minClusterSize: MK_CLUSTER_OPTIONS.minClusterSize,
          gridSize: MK_CLUSTER_OPTIONS.gridSize,
          minLevel: MK_CLUSTER_OPTIONS.minLevel,
          calculator: MK_CLUSTER_OPTIONS.calculator,
          styles: MK_CLUSTER_STYLES,
          // 기본 클릭줌(무애니메이션 즉시 전환)을 끄고 아래 clusterclick으로 우리가 애니메이션 확대한다(U55).
          disableClickZoom: MK_CLUSTER_OPTIONS.disableClickZoom,
        });
        // ⚠️ 등록을 mkClusterer 대입보다 **먼저** 한다. 던지면 mkClusterer는 null로 남아 기존 강등 경로
        //   (개별 핀 setMap)를 그대로 타고, created는 마커를 한 번도 못 받아 버블을 그리지 않는다 →
        //   "클러스터는 보이는데 탭이 죽은" 상태가 구조적으로 불가능하다(disableClickZoom을 되돌릴 setter가 없으므로).
        //   ※ 강등 자체는 아래 catch(mkClusterer = null)가 이미 보장한다 — 대입을 먼저 해도 되돌려진다
        //     (qa-report-logic F2, 뮤턴트 N5에서 U55-6 green 확인). 이 순서는 그 catch가 사라질 미래
        //     리팩터에 대한 이중 안전망이며, 계약을 잠그는 것은 spec의 순서 문자열 단언이다.
        //   재사용 분기(재-INIT)에서는 등록하지 않는다 — INIT 회수만큼 쌓이면 탭 1회가 여러 단계를 건너뛴다.
        kakao.maps.event.addListener(created, 'clusterclick', mkClusterZoomIn);
        mkClusterer = created;
      } catch (e) {
        mkClusterer = null; // 강등.
      } finally {
        // 신규 생성분(실패 시 'none') — 매 렌더가 아니라 여기서 1회 확정한다.
        //   finally인 이유: 라이브러리 미로드(MarkerClusterer 미정의) 조기 return도 반드시 확정을 거쳐야 한다.
        syncClusterMode();
      }
    }

    // 핀 stacking 값(킷 MapScreen L350 유도). map-wish-pins: 3-way 우선순위와 정합 —
    //   active 5 / saved 3 / wish 2 / nearby 1. element z-index만으론 kakao 오버레이 간 stacking이
    //   안 돼(각 오버레이가 별도 컨테이너) overlay.setZIndex로 적용(ui-spec §4).
    function pinZIndex(kind, active) {
      if (active) return 5;
      if (kind === 'saved') return 3;
      if (kind === 'wish') return 2;
      return 1;
    }

    // 현재 viewport(bbox)를 RN에 통지(slice2). idle 다발/과호출 억제는 RN(useNearbyPlaces)이 전담.
    function emitBounds() {
      if (!mkMap) return;
      var bounds = mkMap.getBounds();
      var sw = bounds.getSouthWest();
      var ne = bounds.getNorthEast();
      post({
        type: 'BOUNDS_CHANGED',
        sw: { lat: sw.getLat(), lng: sw.getLng() },
        ne: { lat: ne.getLat(), lng: ne.getLng() },
      });
    }

    // ── map-nearby-load: 증분 마커 조정(§4.2~§4.5) ──────────────────────────────────
    // 핀 시그니처 — "이 핀을 재사용해도 되는가"의 단일 판별자. 키는 m.id(동일성)이므로 sig에는 넣지 않고,
    //   DOM/오버레이 생성에 실제로 반영되는 4개만 담는다: kind→className·zIndex / emoji→textContent /
    //   lat·lng→position. ⚠️ selected는 넣지 않는다 — 선택은 SET_SELECTED가 클래스 토글로 단독 처리하며
    //   (map-pin-select §3.4), sig에 넣으면 선택할 때마다 핀이 재생성돼 그 결정을 되돌린다.
    function pinSig(m) {
      return m.kind + '|' + m.emoji + '|' + m.lat + '|' + m.lng;
    }

    // 핀 1건의 DOM + 오버레이를 만들고 레지스트리에 등록한다. 지도 표시는 하지 않는다 —
    //   표시 소유권은 모드별로 갈리므로 applyOverlayDelta가 단독으로 반영한다(§4.4 이중 표시 방지).
    function createPinOverlay(m) {
      var el = document.createElement('div');
      // map-wish-pins: kind 분기 — nearby=웜그레이(.mk-pin--nearby), wish=앰버(.mk-pin--wish), saved=primary(base).
      el.className = m.kind === 'nearby' ? 'mk-pin mk-pin--nearby'
        : (m.kind === 'wish' ? 'mk-pin mk-pin--wish' : 'mk-pin');
      el.dataset.pinId = m.id; // map-pin-select: id로 추적(SET_SELECTED 토글 대상).
      el.textContent = m.emoji;
      // map-pin-select: SET_MARKERS 재주입 후에도 선택 유지 — 현재 선택 id면 active 클래스 재적용.
      var active = m.id === mkSelectedId;
      if (active) el.classList.add('mk-pin--active');
      el.addEventListener('click', function markerTap(event) {
        // map-pin-select: 마커 탭이 지도 배경 click(MAP_TAP)으로 새어 즉시 해제되지 않게 경합 차단.
        if (event && event.stopPropagation) event.stopPropagation();
        // map-wish-pins: kind 동봉(MapTabScreen이 SelectedSpotCard/NearbySpotCard/WishSpotCard 분기).
        post({ type: 'MARKER_TAP', id: m.id, kind: m.kind });
      });
      var overlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(m.lat, m.lng),
        content: el,
        yAnchor: 1,
        zIndex: pinZIndex(m.kind, active), // active 5 / saved 3 / wish 2 / nearby 1.
      });
      mkPins[m.id] = { el: el, overlay: overlay, kind: m.kind, sig: pinSig(m) };
      return overlay;
    }

    // 레지스트리에 등록된 오버레이 전량(= 지금 표시되어야 할 전부). mkMeOverlay는 mkPins에 등록되지
    //   않으므로 여기 절대 섞이지 않는다 → 현재위치 점은 클러스터 대상이 아니다(§3.6 C4 유지).
    function allPinOverlays() {
      var list = [];
      for (var id in mkPins) {
        if (!mkPins.hasOwnProperty(id)) continue;
        list.push(mkPins[id].overlay);
      }
      return list;
    }

    // 레지스트리에서 특정 오버레이의 핀 항목을 지운다(부착 실패 롤백 전용, qa-logic L1).
    //   실패 경로에서만 도는 O(n) 스캔이라 정상 경로 비용은 0이다.
    function forgetPinByOverlay(overlay) {
      for (var id in mkPins) {
        if (!mkPins.hasOwnProperty(id)) continue;
        if (mkPins[id].overlay === overlay) {
          delete mkPins[id];
          return;
        }
      }
    }

    // 강등(§3.6 E4 / §4.4): 클러스터러 조작이 던지면 폐기하고 이후 개별 핀 경로로 간다.
    //   ⚠️ delta(added)만 다시 붙이면 클러스터러가 그리고 있던 "유지" 핀들이 어디에도 안 붙어 핀이
    //   통째로 사라진다 → 반드시 레지스트리 전량을 지도에 부착한다. 지도 자체는 멀쩡하므로 ERROR는
    //   발신하지 않는다(기존 정책). 강등은 단방향이며 클러스터러 부활 경로는 재-INIT뿐이다.
    function demoteClusterer() {
      if (mkClusterer) { try { mkClusterer.clear(); } catch (e) {} }
      mkClusterer = null;
      mkClusterMode = 'none';
      var all = allPinOverlays();
      for (var i = 0; i < all.length; i++) {
        try { all[i].setMap(mkMap); } catch (e2) {}
      }
    }

    // 조정 결과(added/removed)를 실제 표시에 반영한다 — 표시 소유권 규칙(§3.6 C2)에 따라 모드별로 갈린다.
    //   변화가 0이면 아무것도 하지 않는다(E1: 같은 집합 재주입 시 redraw조차 돌지 않는다).
    function applyOverlayDelta(added, removed) {
      if (added.length === 0 && removed.length === 0) return;
      if (mkClusterMode === 'none') {
        // 핀별 격리(qa-logic L1) — 한 오버레이의 실패가 나머지 조정을 막지 않는다(E7과 같은 원칙).
        //   여기가 유일하게 무방비였다: partial/full은 catch→강등으로 보호되고 resetMarkers도 핀별 격리다.
        //   예외가 새면 __muklogSetMarkers 밖으로 전파되는데 RN 주입부에는 try/catch가 없어 조용히 실패한다.
        for (var i = 0; i < removed.length; i++) {
          try { removed[i].setMap(null); } catch (e) {}
        }
        for (var j = 0; j < added.length; j++) {
          try {
            added[j].setMap(mkMap);
          } catch (e2) {
            // 부착 실패 핀은 레지스트리에서 되돌린다. 남겨두면 sig가 맞아 다음 주입에서 "유지"로 판정돼
            //   영원히 안 붙는다 — §4.1이 명령형 패치를 기각하며 내세운 "전체 집합 재주입 1회로 자기치유"가
            //   이 분기에서만 깨지는 경로다. 되돌려 두면 다음 주입이 새로 만들어 붙인다.
            forgetPinByOverlay(added[j]);
          }
        }
        return;
      }
      try {
        if (mkClusterMode === 'partial') {
          // nodraw로 다시 그리기를 미룬 뒤 마지막에 redraw() 1회 — redraw가 없는 SDK면 nodraw도 쓰지 않는다.
          var canRedraw = typeof mkClusterer.redraw === 'function';
          if (removed.length) {
            if (canRedraw) mkClusterer.removeMarkers(removed, true);
            else mkClusterer.removeMarkers(removed);
          }
          if (added.length) {
            if (canRedraw) mkClusterer.addMarkers(added, true);
            else mkClusterer.addMarkers(added);
          }
          if (canRedraw) mkClusterer.redraw();
        } else {
          // full: 멤버십만 전량 재구성한다. 오버레이·DOM은 재사용하므로 깜빡임은 버블 수준에 그친다.
          mkClusterer.clear();
          mkClusterer.addMarkers(allPinOverlays());
        }
      } catch (e) {
        // 제거 대상은 renderMarkers 2단계에서 이미 mkPins에서 빠졌다 — 클러스터러가 못 떼고 강등되면
        //   레지스트리에도 없고 화면에만 남는 영구 유령이 된다(회수 수단 0). 강등 전에 직접 떼어낸다
        //   (qa-logic L2: removeMarkers 실패 + clear() 실패의 이중 고장 경로).
        for (var k = 0; k < removed.length; k++) {
          try { removed[k].setMap(null); } catch (e3) {}
        }
        demoteClusterer();
      }
    }

    // 재-INIT 전용 전량 폐기(§4.5). __muklogInit은 새 kakao.maps.Map을 만들기 때문에 레지스트리에 남은
    //   오버레이는 "죽은 지도"에 묶여 있다. 리셋이 없으면 조정 알고리즘이 sig 일치를 보고 "유지"로 판정해
    //   새 지도에 아무것도 안 붙는 조용한 실패(빈 지도)가 된다. 개별 setMap(null)은 죽은 지도에서 던질 수
    //   있으므로 핀별로 격리한다 — 한 핀의 실패가 나머지 정리를 막지 않는다.
    function resetMarkers() {
      for (var id in mkPins) {
        if (!mkPins.hasOwnProperty(id)) continue;
        try { mkPins[id].overlay.setMap(null); } catch (e) {}
      }
      mkPins = {}; // mkSelectedId는 유지 — 재주입 시 같은 id 핀에 active가 재적용된다(§4.5).
    }

    // SET_MARKERS는 여전히 "표시되어야 할 마커 전체 집합"이라는 선언적 의미다(RN 무변경 §4.1).
    //   증분화는 여기 내부 구현 — 목표 집합과 레지스트리를 비교해 add/remove/keep으로 나눈다.
    //   ⚠️ 기존과 달리 선행 전량 삭제를 하지 않는다. 유지 핀은 DOM·오버레이·리스너까지 그대로 산다.
    function renderMarkers(markers) {
      if (!mkMap || !markers) return;
      // 1) 목표 집합 — 중복 id는 뒤가 이긴다(RN mergeMapMarkers가 이미 dedup하지만 방어, E3).
      var next = {};
      for (var i = 0; i < markers.length; i++) next[markers[i].id] = markers[i];
      // 2) 제거 대상: 목표에 없거나(사라짐) sig가 달라진(내용 변경) 기존 핀.
      var removed = [];
      for (var id in mkPins) {
        if (!mkPins.hasOwnProperty(id)) continue;
        var keep = next.hasOwnProperty(id) && pinSig(next[id]) === mkPins[id].sig;
        if (!keep) {
          removed.push(mkPins[id].overlay);
          delete mkPins[id];
        }
      }
      // 3) 추가 대상: 레지스트리에 없는 목표 핀(= 신규 + sig 변경으로 방금 빠진 것).
      var added = [];
      for (var id2 in next) {
        if (!next.hasOwnProperty(id2)) continue;
        if (mkPins.hasOwnProperty(id2)) continue; // 유지 핀 — 절대 손대지 않는다(I1).
        added.push(createPinOverlay(next[id2]));
      }
      // 4) 표시 반영(§4.4). 이 시점의 mkPins 키 집합 == 주입 id 집합(I2).
      applyOverlayDelta(added, removed);
    }

    // RN → WebView: 초기화(center/markers/me).
    window.__muklogInit = function (payload) {
      try {
        var center = new kakao.maps.LatLng(payload.center.lat, payload.center.lng);
        mkMap = new kakao.maps.Map(document.getElementById('map'), {
          center: center,
          level: payload.center.zoom,
        });
        if (payload.me) {
          var meEl = document.createElement('div');
          meEl.style.cssText = 'width:16px;height:16px;border-radius:8px;background:#3366FF;border:3px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,0.15);';
          // 모듈 스코프 보관 — __muklogRecenter가 위치를 갱신할 수 있도록 참조 유지.
          mkMeOverlay = new kakao.maps.CustomOverlay({
            position: new kakao.maps.LatLng(payload.me.lat, payload.me.lng),
            content: meEl,
          });
          mkMeOverlay.setMap(mkMap);
        }
        // map-nearby-load(§4.5): 실행 순서를 계약으로 고정한다 —
        //   new Map → me 오버레이 → 레지스트리 리셋 → 클러스터러 준비 → 마커 렌더.
        //   resetMarkers가 ensureClusterer보다 **앞**이어야 한다: 뒤로 가면 ensureClusterer의 clear()가
        //   이미 참조를 놓은 뒤라 setMap(null)이 무의미해질 수 있고, 앞에 두면 clear()가 클러스터러
        //   내부 목록까지 비워 유령 버블 0(E8)이 유지된다.
        resetMarkers();
        // map-clustering: mkMap 생성 후 · 첫 renderMarkers 전에 클러스터러를 준비한다(§3.6 C3).
        ensureClusterer();
        renderMarkers(payload.markers);
        // map-pin-select: 지도 빈 곳 탭 → MAP_TAP 발신(RN이 선택 해제). 마커 탭은 stopPropagation으로 여기 안 옴.
        kakao.maps.event.addListener(mkMap, 'click', function mkMapBackgroundTap() {
          post({ type: 'MAP_TAP' });
        });
        // slice2: 드래그·줌 종료(idle)마다 현재 bbox 통지 → RN이 nearby 조회(디바운스/캐시/임계는 RN).
        //   이후 사용자 이동 전용 — INIT 직후 같은 센터 relayout/setCenter는 idle을 발화하지 않아
        //   첫 nearby 트리거를 여기에 의존하면 안 됨(nearby-first-load 버그). 첫 emit은 아래 명시 호출이 담당.
        kakao.maps.event.addListener(mkMap, 'idle', emitBounds);
        // 컨테이너 사이즈 확정 전 생성 시 빈 타일 방지 — 다음 틱에 relayout + 센터 재설정.
        //   relayout로 컨테이너 사이즈가 확정된 뒤라야 getBounds()가 유효한 bbox를 반환.
        //   ⚠️ 같은 센터 relayout/setCenter는 idle을 발화하지 않으므로, 첫 BOUNDS_CHANGED를
        //   사용자 동작 없이 보장하려면 idle 의존이 아니라 여기서 emitBounds()를 명시 호출해야 한다.
        setTimeout(function initEmitFirstBounds() {
          if (!mkMap) return;
          mkMap.relayout();
          mkMap.setCenter(center);
          emitBounds(); // 첫 viewport nearby 로딩 트리거(사용자 idle 불필요).
        }, 0);
        // belt-and-suspenders: 초기 레이아웃이 늦게 안정화되는 기기 대비 한 번 더 약간 지연 emit.
        //   중복 emit이 와도 RN(useNearbyPlaces) 양자화 키 dedup + 첫조회 0틱 cleanup으로 invoke ≤1 보장(비용 안전).
        setTimeout(function initEmitFirstBoundsRetry() {
          if (!mkMap) return;
          emitBounds();
        }, 60);
      } catch (e) {
        post({ type: 'ERROR', reason: String(e) });
      }
    };

    // RN → WebView: 마커 갱신(refresh).
    window.__muklogSetMarkers = function (payload) {
      renderMarkers(payload.markers);
    };

    // RN → WebView: 선택 반영(SET_SELECTED). id-only — 마커 재생성 없이 활성 클래스만 토글(깜빡임·비용 최소).
    //   selectedId=null이면 전 핀 비활성(해제). 매칭 핀만 active + zIndex 5, 나머지는 kind별(saved 3 / wish 2 / nearby 1)로 원복.
    window.__muklogSetSelected = function (payload) {
      mkSelectedId = payload && payload.selectedId != null ? payload.selectedId : null;
      for (var id in mkPins) {
        if (!mkPins.hasOwnProperty(id)) continue;
        var pin = mkPins[id];
        var active = id === mkSelectedId;
        if (active) pin.el.classList.add('mk-pin--active');
        else pin.el.classList.remove('mk-pin--active');
        pin.overlay.setZIndex(pinZIndex(pin.kind, active));
      }
    };

    // RN → WebView: 현재위치로 재센터(panTo) + me 마커 갱신. 지도 재init 없음(경량 — 마커 깜빡임/중복 없음).
    window.__muklogRecenter = function (payload) {
      if (!mkMap || !payload || !payload.me) return;
      var pos = new kakao.maps.LatLng(payload.me.lat, payload.me.lng);
      mkMap.panTo(pos); // 부드러운 이동, 줌 레벨 미변경.
      if (mkMeOverlay) {
        mkMeOverlay.setPosition(pos); // 기존 파란 점 위치만 갱신.
      } else {
        // INIT 시 me 없던 경우(권한 늦게 허용) → 마커 신규 생성(INIT.me와 동일 비주얼).
        var meEl = document.createElement('div');
        meEl.style.cssText = 'width:16px;height:16px;border-radius:8px;background:#3366FF;border:3px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,0.15);';
        mkMeOverlay = new kakao.maps.CustomOverlay({ position: pos, content: meEl });
        mkMeOverlay.setMap(mkMap);
      }
    };

    function loadKakao() {
      if (!window.kakao || !window.kakao.maps) {
        post({ type: 'ERROR', reason: 'SDK_UNAVAILABLE' });
        return;
      }
      kakao.maps.load(function () {
        post({ type: 'READY' });
      });
    }

    var sdk = document.createElement('script');
    // map-clustering: libraries=clusterer 추가 — kakao.maps.load 콜백 시점에 MarkerClusterer가 준비된다.
    //   클러스터러 생성은 READY 이후 __muklogInit에서만 하므로 타이밍 안전. services는 여전히 불필요
    //   (Local 호출은 Edge Function 경유 — 비용 가드레일).
    sdk.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KEY_PLACEHOLDER}&autoload=false&libraries=clusterer';
    sdk.onload = loadKakao;
    sdk.onerror = function () { post({ type: 'ERROR', reason: 'SDK_LOAD_FAILED' }); };
    document.head.appendChild(sdk);
  </script>
</body>
</html>`;

/**
 * Kakao JS SDK를 로드하는 지도 HTML 문자열을 생성한다(JS 키 주입).
 * READY/MARKER_TAP/ERROR를 postMessage로 송신하고, __muklogInit/__muklogSetMarkers로 RN 입력을 받는다.
 * @param jsKey Kakao JavaScript 키(env/extra에서 주입 — 코드/문서에 값 미기록)
 * @returns WebView source.html로 쓸 완성 HTML
 */
export const mapHtml = ({ jsKey }: { jsKey: string }): string =>
  HTML_TEMPLATE.split(KEY_PLACEHOLDER).join(jsKey);
