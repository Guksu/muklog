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
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; }
    /* WKWebView(loadHTMLString)에서 body height:100%가 0으로 붕괴 → #map은 뷰포트를 절대배치로 직접 채운다(빈 타일 방지). */
    #map { position: absolute; top: 0; left: 0; right: 0; bottom: 0; }
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
    var mkOverlays = [];
    var mkMeOverlay = null; // INIT에서 생성한 현재위치(파란 점) 오버레이 참조 보관(재센터 시 위치 갱신용).
    // map-pin-select: id→{el,overlay,kind} 추적(SET_SELECTED가 매칭 핀만 토글) + 현재 선택 id.
    //   mkSelectedId는 renderMarkers(SET_MARKERS 재주입)에서 재적용돼 선택이 유지된다(§3.6).
    var mkPins = {};
    var mkSelectedId = null;
    // map-clustering: 인접 핀을 개수 버블로 묶는 Kakao MarkerClusterer. null이면 강등 상태
    //   (라이브러리 미로드/생성 실패) → 기존 개별 핀 렌더 경로가 그대로 동작한다(§3.6 E4).
    var mkClusterer = null;

    // ── 클러스터 설정(plan §3.4 실값 계약) — 스모크 튜닝은 이 블록 한 곳에서만 만진다(§3.7). ──
    var MK_CLUSTER_OPTIONS = {
      averageCenter: true,   // 멤버 좌표 중심(centroid)에 버블 배치 — 첫 마커 위치보다 정확.
      minClusterSize: 2,     // 2개부터 묶음(1개는 개별 핀 유지).
      gridSize: 60,          // px, Kakao 기본.
      minLevel: 2,           // 레벨 1(최대 확대)에서는 핀 34px가 실제로 겹치지 않아 클러스터하지 않는다.
      calculator: [10, 100], // 개수 경계 → 스타일 3단계(S0 2~9 / S1 10~99 / S2 100+).
    };
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
    function ensureClusterer() {
      if (mkClusterer) {
        try {
          mkClusterer.clear();
          if (typeof mkClusterer.setMap === 'function') mkClusterer.setMap(mkMap);
          else mkClusterer = null; // setMap 미제공 SDK → 폐기 후 재생성(없는 API에 기대지 않는다).
        } catch (e) {
          mkClusterer = null;
        }
      }
      if (mkClusterer) return;
      try {
        if (!kakao.maps.MarkerClusterer) return;
        mkClusterer = new kakao.maps.MarkerClusterer({
          map: mkMap,
          averageCenter: MK_CLUSTER_OPTIONS.averageCenter,
          minClusterSize: MK_CLUSTER_OPTIONS.minClusterSize,
          gridSize: MK_CLUSTER_OPTIONS.gridSize,
          minLevel: MK_CLUSTER_OPTIONS.minLevel,
          calculator: MK_CLUSTER_OPTIONS.calculator,
          styles: MK_CLUSTER_STYLES,
          // disableClickZoom 미설정(기본 false) → 클러스터 탭 = Kakao 기본 줌인. 신규 inbound 메시지 0(§3.3).
        });
      } catch (e) {
        mkClusterer = null; // 강등.
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

    function clearMarkers() {
      // map-clustering: 클러스터러가 오버레이의 표시 소유권을 갖고 있으므로 먼저 해제한다.
      //   빠지면 고스트 핀이 지도에 영구히 남는다(§3.6 C2). clear()가 실패해도 아래 setMap(null)
      //   정리는 반드시 수행되도록 예외를 격리한다.
      if (mkClusterer) { try { mkClusterer.clear(); } catch (e) {} }
      for (var i = 0; i < mkOverlays.length; i++) { mkOverlays[i].setMap(null); }
      mkOverlays = [];
      mkPins = {}; // id→핀 추적도 함께 비운다(mkSelectedId는 유지 — SET_MARKERS 재주입 시 재적용).
    }

    function renderMarkers(markers) {
      clearMarkers();
      if (!mkMap || !markers) return;
      for (var i = 0; i < markers.length; i++) {
        (function (m) {
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
          // map-clustering: 클러스터러가 있으면 표시는 클러스터러가 관리한다(여기서 setMap하면 이중 표시).
          //   없으면(강등) 기존대로 각 오버레이를 직접 지도에 붙인다(§3.6 C2 폴백).
          if (!mkClusterer) overlay.setMap(mkMap);
          mkOverlays.push(overlay);
          mkPins[m.id] = { el: el, overlay: overlay, kind: m.kind };
        })(markers[i]);
      }
      if (mkClusterer) {
        try {
          mkClusterer.addMarkers(mkOverlays); // me 오버레이는 mkOverlays에 없다 → 클러스터 대상 아님(§3.6 C4).
        } catch (e) {
          // 강등(E4): 클러스터러가 CustomOverlay를 받지 못하면 이후로도 개별 핀 경로로 렌더한다.
          try { mkClusterer.clear(); } catch (e2) {}
          mkClusterer = null;
          for (var j = 0; j < mkOverlays.length; j++) { mkOverlays[j].setMap(mkMap); }
        }
      }
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
