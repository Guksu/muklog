// src/features/map/mapHtml.ts
// Kakao Map JS SDK 임베드 HTML 생성 (plan §3.5·§9.2 라이브러리 확정·§7 경계면).
//   생산자: MapWebView가 source.html로 주입. 소비자: WebView 런타임(Kakao JS SDK).
//   계약: SDK 로드 완료→READY postMessage / 마커 탭→MARKER_TAP(id) / 로드 실패→ERROR(reason).
//         RN→WebView는 window.__muklogInit(INIT)·window.__muklogSetMarkers(SET_MARKERS) 핸들러로 수신.
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
    .mk-pin {
      display: flex; align-items: center; justify-content: center;
      width: 34px; height: 34px; border-radius: 17px;
      background: #ffffff; border: 2px solid #3366FF;
      font-size: 18px; box-sizing: border-box;
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

    function clearMarkers() {
      for (var i = 0; i < mkOverlays.length; i++) { mkOverlays[i].setMap(null); }
      mkOverlays = [];
    }

    function renderMarkers(markers) {
      clearMarkers();
      if (!mkMap || !markers) return;
      for (var i = 0; i < markers.length; i++) {
        (function (m) {
          var el = document.createElement('div');
          el.className = 'mk-pin';
          el.textContent = m.emoji;
          el.addEventListener('click', function () {
            post({ type: 'MARKER_TAP', id: m.id });
          });
          var overlay = new kakao.maps.CustomOverlay({
            position: new kakao.maps.LatLng(m.lat, m.lng),
            content: el,
            yAnchor: 1,
          });
          overlay.setMap(mkMap);
          mkOverlays.push(overlay);
        })(markers[i]);
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
          var meOverlay = new kakao.maps.CustomOverlay({
            position: new kakao.maps.LatLng(payload.me.lat, payload.me.lng),
            content: meEl,
          });
          meOverlay.setMap(mkMap);
        }
        renderMarkers(payload.markers);
        // 컨테이너 사이즈 확정 전 생성 시 빈 타일 방지 — 다음 틱에 relayout + 센터 재설정.
        setTimeout(function () {
          if (mkMap) {
            mkMap.relayout();
            mkMap.setCenter(center);
          }
        }, 0);
      } catch (e) {
        post({ type: 'ERROR', reason: String(e) });
      }
    };

    // RN → WebView: 마커 갱신(refresh).
    window.__muklogSetMarkers = function (payload) {
      renderMarkers(payload.markers);
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
    sdk.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KEY_PLACEHOLDER}&autoload=false';
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
