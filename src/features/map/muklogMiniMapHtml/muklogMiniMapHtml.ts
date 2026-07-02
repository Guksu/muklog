// src/features/map/muklogMiniMapHtml.ts
// 먹로그 상세 "위치" 미니맵 HTML (단일 핀, 정적) — mapHtml(인터랙티브 풀맵)과 달리 핸드셰이크 없이 자기완결.
//   좌표를 HTML에 직접 박아 SDK 로드 시 그 위치를 중심으로 지도+마커 1개를 그린다(RN↔WebView 메시지 불필요).
//   드래그/줌 비활성(미니맵 — 위치 확인용). READY/ERROR만 postMessage(상태 관찰용, 선택).
//   ⚠️ jsKey는 호출부에서 env(KAKAO_JS_KEY) 주입 — 값 미기록(placeholder만). 키 없으면 호출부가 미니맵 자체를 안 그림.
//   마커 색: 킷 --mk-accent(#3366FF) — WebView 격리 환경이라 brand hex 직접 사용(번역 불가 영역, mapHtml과 동일 정책).

const KEY_PLACEHOLDER = '__KAKAO_JS_KEY__';
const LAT_PLACEHOLDER = '__MK_LAT__';
const LNG_PLACEHOLDER = '__MK_LNG__';

const HTML_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; }
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
      if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(JSON.stringify(msg)); }
    }
    var MK_LAT = ${LAT_PLACEHOLDER};
    var MK_LNG = ${LNG_PLACEHOLDER};

    function drawMiniMap() {
      try {
        var center = new kakao.maps.LatLng(MK_LAT, MK_LNG);
        var map = new kakao.maps.Map(document.getElementById('map'), {
          center: center,
          level: 3,
          draggable: false,
          zoomable: false,
        });
        var el = document.createElement('div');
        el.className = 'mk-pin';
        el.textContent = '📍';
        var overlay = new kakao.maps.CustomOverlay({ position: center, content: el, yAnchor: 1 });
        overlay.setMap(map);
        // 컨테이너 사이즈 확정 전 빈 타일 방지(WKWebView) — 다음 틱 relayout + 센터 재설정.
        setTimeout(function () { map.relayout(); map.setCenter(center); }, 0);
        post({ type: 'READY' });
      } catch (e) {
        post({ type: 'ERROR', reason: String(e) });
      }
    }

    function loadKakao() {
      if (!window.kakao || !window.kakao.maps) { post({ type: 'ERROR', reason: 'SDK_UNAVAILABLE' }); return; }
      kakao.maps.load(drawMiniMap);
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
 * 단일 핀 미니맵 HTML을 생성한다(좌표·JS 키 주입). SDK 로드 시 (lat,lng) 중심 지도+마커를 그린다.
 * @param lat 위도
 * @param lng 경도
 * @param jsKey Kakao JavaScript 키(env에서 주입 — 값 미기록)
 * @returns WebView source.html로 쓸 완성 HTML
 */
export const muklogMiniMapHtml = ({
  lat,
  lng,
  jsKey,
}: {
  lat: number;
  lng: number;
  jsKey: string;
}): string =>
  HTML_TEMPLATE.split(KEY_PLACEHOLDER)
    .join(jsKey)
    .split(LAT_PLACEHOLDER)
    .join(String(lat))
    .split(LNG_PLACEHOLDER)
    .join(String(lng));
