// src/features/map/mapHtml.spec.ts
// Kakao JS SDK 로드 HTML 생성 함수 단위 테스트 (plan §3.5·§5-1 HTML 템플릿).
//   JS 키 주입(placeholder 치환) / Kakao SDK 스크립트 src / READY·MARKER_TAP·ERROR postMessage 송신부
//   / 마커 직렬화(이모지 렌더)·INIT/SET_MARKERS 핸들러 정의 존재를 문자열로 검증. 실 SDK는 스모크.
import { mapHtml } from './mapHtml';

describe('mapHtml', () => {
  const html = mapHtml({ jsKey: 'TEST_JS_KEY_123' });

  it('주입된 JS 키를 Kakao SDK appkey 쿼리에 담는다(키 placeholder 치환)', () => {
    expect(html).toContain('appkey=TEST_JS_KEY_123');
    expect(html).not.toContain('__KAKAO_JS_KEY__');
  });

  it('Kakao Maps JS SDK를 로드한다', () => {
    expect(html).toContain('dapi.kakao.com/v2/maps/sdk.js');
    expect(html).toContain('kakao.maps.load');
  });

  it('READY/MARKER_TAP/ERROR를 RN으로 postMessage 한다', () => {
    expect(html).toContain('READY');
    expect(html).toContain('MARKER_TAP');
    expect(html).toContain('ERROR');
    expect(html).toContain('ReactNativeWebView.postMessage');
  });

  it('RN→WebView 핸들러(__muklogInit/__muklogSetMarkers)를 정의한다', () => {
    expect(html).toContain('__muklogInit');
    expect(html).toContain('__muklogSetMarkers');
  });

  it('마커 이모지를 렌더하는 마커 생성부를 포함한다(emoji 직렬화)', () => {
    expect(html).toContain('emoji');
    expect(html).toContain('CustomOverlay');
  });

  it('SDK 로드 실패를 ERROR로 송신한다(onerror)', () => {
    expect(html).toContain('onerror');
  });

  // ── slice2 증분 ────────────────────────────────────────────────
  it('kind 분기 핀 색을 직박힌다(saved primary #3366FF / nearby 웜그레이 #B6ABA0)', () => {
    expect(html).toContain('#3366FF');
    expect(html).toContain('#B6ABA0');
    // map-wish-pins: m.kind로 className 분기(saved 잔재 0 — 단일 판별자).
    expect(html).toContain('m.kind');
    expect(html).not.toContain('m.saved');
  });

  it('MARKER_TAP에 kind를 동봉한다', () => {
    expect(html).toContain('kind: m.kind');
  });

  it('kind별 className을 분기한다(nearby→--nearby, wish→--wish, saved→base)', () => {
    expect(html).toContain("m.kind === 'nearby'");
    expect(html).toContain("m.kind === 'wish'");
    expect(html).toContain('mk-pin mk-pin--wish');
  });

  it('idle 이벤트로 BOUNDS_CHANGED(sw/ne)를 post한다', () => {
    expect(html).toContain("'idle'");
    expect(html).toContain('BOUNDS_CHANGED');
    expect(html).toContain('getSouthWest');
    expect(html).toContain('getNorthEast');
  });

  // ── nearby-first-load 보완: 첫 bounds 명시 emit ────────────────
  // 버그: 첫 nearby 로딩 트리거가 idle 리스너 하나뿐이라 INIT 직후 같은 센터 relayout/setCenter는
  //   idle을 발화하지 않아 첫 BOUNDS_CHANGED가 안 나감 → 사용자가 지도를 움직여야만 조회됨.
  //   수정: init 경로(idle 콜백 밖)에서 relayout 직후 emitBounds()를 명시 1회 호출(사용자 idle 불필요).
  // setTimeout(...) 콜백 본문을 함수명으로 추출(함수 선언 ~ 그 콜백을 마는 `}, <delay>)` 까지).
  //   문자열 매칭이 primary/retry를 구분하도록 콜백 단위로 좁힌다(qa-logic 강화 요청).
  const callbackBody = ({ fnName }: { fnName: string }): string => {
    const start = html.indexOf('function ' + fnName);
    if (start === -1) return '';
    const close = html.slice(start).search(/\}\s*,\s*\d+\s*\)/);
    return close === -1 ? html.slice(start) : html.slice(start, start + close);
  };

  it('primary 0틱 경로(initEmitFirstBounds) 본문에서 첫 bounds를 명시 emit한다 — 사용자 idle 없이 nearby 트리거', () => {
    // 강한 단언: retry(60ms)가 아니라 0틱 즉시 경로 자체에 emit이 있어야 한다(primary만 제거해도 red).
    const primary = callbackBody({ fnName: 'initEmitFirstBounds' });
    expect(primary).not.toBe('');
    expect(primary).toContain('emitBounds()');
    // idle 콜백 등록(addListener(..., emitBounds))이 아닌 직접 호출임도 보장(이 본문엔 addListener 없음).
    expect(primary).not.toContain('addListener');
  });

  it('belt-and-suspenders retry(initEmitFirstBoundsRetry) 본문도 emit을 유지한다(분리 단언)', () => {
    const retry = callbackBody({ fnName: 'initEmitFirstBoundsRetry' });
    expect(retry).not.toBe('');
    expect(retry).toContain('emitBounds()');
  });

  it('emitBounds 명시 호출은 relayout/setCenter(컨테이너 사이즈 확정) 이후에 위치한다', () => {
    const relayoutIdx = html.indexOf('mkMap.relayout()');
    const explicitEmitIdx = html.indexOf('emitBounds();');
    expect(relayoutIdx).toBeGreaterThan(-1);
    expect(explicitEmitIdx).toBeGreaterThan(-1);
    // relayout로 bbox가 유효해진 뒤 emit해야 유효 bbox가 나간다.
    expect(explicitEmitIdx).toBeGreaterThan(relayoutIdx);
  });

  it('idle 리스너는 유지된다(이후 사용자 이동용) — 회귀 0', () => {
    expect(html).toContain("addListener(mkMap, 'idle', emitBounds)");
  });

  // ── map-locate-button 증분 ─────────────────────────────────────
  it('__muklogRecenter 핸들러를 정의하고 panTo로 재센터한다', () => {
    expect(html).toContain('window.__muklogRecenter');
    expect(html).toContain('panTo');
  });

  it('__muklogInit이 me 오버레이를 mkMeOverlay에 보관한다(재센터 시 갱신용)', () => {
    expect(html).toContain('mkMeOverlay');
    // INIT에서 보관(할당)하고 재센터에서 위치 갱신(setPosition).
    expect(html).toContain('mkMeOverlay =');
    expect(html).toContain('setPosition');
  });

  it('__muklogRecenter는 !mkMap / !payload.me 가드를 둔다(런타임 null 방어)', () => {
    expect(html).toContain('!mkMap');
    expect(html).toContain('!payload.me');
  });

  // ── map-pin-select 증분: 선택(활성) 핀 비주얼(ui-publisher 소유 CSS) ──────────────
  // 킷 Pin active 규칙(mk-home.jsx:401-416: size 36/26→44·drop-shadow 강화·icon 0.46 비례)과
  //   MapScreen active zIndex 5(mk-home.jsx:350)를 원형 RN 핀으로 번역. CSS 실값만 검증(렌더는 스모크).
  // .mk-pin--active { ... } 블록만 좁혀 단언(base .mk-pin 34px와 혼동 방지).
  const cssBlock = ({ selector }: { selector: string }): string => {
    const start = html.indexOf(selector + ' {');
    if (start === -1) return '';
    const end = html.indexOf('}', start);
    return end === -1 ? '' : html.slice(start, end + 1);
  };

  it('활성 핀 클래스(.mk-pin--active)를 정의한다(선택 시 developer가 토글)', () => {
    expect(html).toContain('.mk-pin--active');
  });

  it('활성 핀은 킷 Pin active=44 규칙으로 확대된다(원형 44px)', () => {
    const active = cssBlock({ selector: '.mk-pin--active' });
    expect(active).toContain('width: 44px');
    expect(active).toContain('height: 44px');
    expect(active).toContain('border-radius: 22px'); // 44/2 — 원형 유지
  });

  it('활성 핀 그림자는 킷 active drop-shadow(0 6px 10px rgba(0,0,0,.25))를 box-shadow로 번역한다', () => {
    expect(cssBlock({ selector: '.mk-pin--active' })).toContain('box-shadow: 0 6px 10px rgba(0,0,0,0.25)');
  });

  it('활성 핀 이모지는 base 비례(18/34)로 확대된다(23px)', () => {
    expect(cssBlock({ selector: '.mk-pin--active' })).toContain('font-size: 23px');
  });

  it('활성 핀은 킷 MapScreen active zIndex 5로 스택된다', () => {
    expect(cssBlock({ selector: '.mk-pin--active' })).toContain('z-index: 5');
  });

  it('비활성 base 핀은 34px 유지 — 활성만 바꾼다(회귀 0)', () => {
    const base = cssBlock({ selector: '.mk-pin' });
    expect(base).toContain('width: 34px');
    expect(base).toContain('height: 34px');
    expect(html).toContain('.mk-pin--nearby { border-color: #B6ABA0; }'); // nearby border 불변
  });

  // map-wish-pins: 위시 핀 색(ui-publisher 소유). kind→className/pinZIndex 배선은 developer(T6).
  it('위시 핀 클래스(.mk-pin--wish)를 킷 앰버 #FFB23E border로 정의한다', () => {
    expect(html).toContain('.mk-pin--wish { border-color: #FFB23E; }');
  });

  // ── map-pin-select 증분: 선택 브리지 JS(developer 소유) ──────────────
  // id-only 선택 반영(SET_SELECTED): 마커 재생성 없이 활성 클래스만 토글 + 빈곳 탭(MAP_TAP) 발신.
  //   문자열 계약만 검증(실제 이벤트 발화·렌더는 디바이스 스모크 — WebView JS는 단위 실행 아님).
  it('__muklogSetSelected 핸들러를 정의한다(id-only 선택 반영)', () => {
    expect(html).toContain('window.__muklogSetSelected');
  });

  it('선택 상태 모듈 변수(mkSelectedId)를 두고 renderMarkers에서 재적용한다(SET_MARKERS 유지)', () => {
    expect(html).toContain('mkSelectedId');
    // 마커를 id로 추적(dataset.pinId) — SET_SELECTED가 매칭 element만 토글.
    expect(html).toContain('dataset.pinId');
  });

  it('지도 배경 click을 MAP_TAP으로 post한다(빈곳 탭 → 선택 해제 신호)', () => {
    expect(html).toContain("addListener(mkMap, 'click'");
    expect(html).toContain('MAP_TAP');
  });

  it('마커 element click은 stopPropagation으로 지도 click(MAP_TAP) 경합을 막는다', () => {
    expect(html).toContain('stopPropagation');
  });

  it('활성 반영은 마커 재생성이 아니라 클래스 토글이다(mk-pin--active add/remove)', () => {
    expect(html).toContain("classList.add('mk-pin--active')");
    expect(html).toContain("classList.remove('mk-pin--active')");
    // overlay stacking은 setZIndex로(active 5 / saved 3 / nearby 1) — element z-index 한계 보완.
    expect(html).toContain('setZIndex');
  });

  // ── map-clustering 증분 (plan §3.4·§3.5·§3.6·§5-1) ──────────────────────────
  // ⚠️ 단언의 한계: 여기서 증명되는 건 "계약 코드가 템플릿에 들어 있다"까지다. 실제 클러스터 생성·
  //   탭 줌인·강등 발동의 검증자는 디바이스 스모크(plan §5-2 S1~S9)다. 이 단언들은 계약 문자열이
  //   실수로 사라지는 회귀를 막는 안전망 역할만 한다.
  // 파일 전역 매칭의 위양성(예: .mk-pin의 #3366FF)을 피하려고 중괄호 매칭으로 함수 본문만 좁힌다.
  const fnBody = ({ fnName }: { fnName: string }): string => {
    const start = html.indexOf('function ' + fnName);
    if (start === -1) return '';
    const open = html.indexOf('{', start);
    if (open === -1) return '';
    let depth = 0;
    for (let i = open; i < html.length; i += 1) {
      if (html[i] === '{') depth += 1;
      else if (html[i] === '}') {
        depth -= 1;
        if (depth === 0) return html.slice(start, i + 1);
      }
    }
    return '';
  };

  it('SDK를 clusterer 라이브러리와 함께 로드한다(appkey·autoload 계약 유지)', () => {
    expect(html).toContain('libraries=clusterer');
    // 기존 SDK 쿼리 회귀 0 — 한 URL에 셋이 함께 있어야 한다.
    expect(html).toContain('appkey=TEST_JS_KEY_123&autoload=false&libraries=clusterer');
    // Local 호출은 Edge Function 경유라 services 라이브러리는 여전히 불필요(비용 가드레일).
    expect(html).not.toContain('libraries=services');
  });

  it('MarkerClusterer를 생성한다(§3.6 C3)', () => {
    expect(html).toContain('new kakao.maps.MarkerClusterer(');
    expect(html).toContain('mkClusterer');
  });

  // 뮤테이션 검증에서 발견한 구멍 보강: ensureClusterer 정의만 단언하면 __muklogInit의 호출부를
  //   통째로 지워도 전 테스트가 green이었다(클러스터링이 조용히 죽는 회귀). 호출부와 순서를 직접 단언한다.
  it('__muklogInit이 mkMap 생성 후·첫 renderMarkers 전에 클러스터러를 준비한다(§3.6 C3)', () => {
    const initStart = html.indexOf('window.__muklogInit');
    const init = html.slice(initStart, html.indexOf('window.__muklogSetMarkers'));
    expect(init).toContain('ensureClusterer();');
    // 순서: new kakao.maps.Map → ensureClusterer() → renderMarkers(payload.markers).
    expect(init.indexOf('ensureClusterer();')).toBeGreaterThan(init.indexOf('new kakao.maps.Map('));
    expect(init.indexOf('ensureClusterer();')).toBeLessThan(init.indexOf('renderMarkers(payload.markers)'));
  });

  it('클러스터러 옵션 실값이 §3.4 계약과 일치한다', () => {
    const options = html.slice(html.indexOf('MK_CLUSTER_OPTIONS = {'));
    expect(options).toContain('averageCenter: true');
    expect(options).toContain('minClusterSize: 2');
    expect(options).toContain('gridSize: 60');
    expect(options).toContain('minLevel: 2'); // 레벨 1(최대 확대)에서는 클러스터 안 함
    expect(options).toContain('calculator: [10, 100]');
  });

  it('클러스터 버블 스타일 공통 실값이 §3.4 계약과 일치한다(브랜드 파랑·흰 테두리·킷 Pin 그림자)', () => {
    const style = fnBody({ fnName: 'mkClusterStyle' });
    expect(style).not.toBe('');
    expect(style).toContain("background: '#3366FF'"); // 킷 --mk-accent
    expect(style).toContain("color: '#FFFFFF'");
    expect(style).toContain("border: '2px solid #FFFFFF'");
    expect(style).toContain("borderRadius: '999px'");
    expect(style).toContain("textAlign: 'center'");
    expect(style).toContain("fontWeight: '700'");
    expect(style).toContain("boxShadow: '0 3px 5px rgba(0,0,0,0.18)'"); // 킷 Pin 비활성 drop-shadow 동값
    // 오버레이별 컨테이너라 element z-index는 stacking에 무효 → 스타일에 넣지 않는다(§3.4 주석).
    expect(style).not.toContain('zIndex');
  });

  it('클러스터 스타일을 S0/S1/S2 3단계 실값으로 정의한다(40·48·56px / 13·14·15px)', () => {
    const styles = html.slice(html.indexOf('MK_CLUSTER_STYLES = ['), html.indexOf('];', html.indexOf('MK_CLUSTER_STYLES = [')));
    expect(styles).toContain("mkClusterStyle('40px', '13px')"); // S0: 2~9
    expect(styles).toContain("mkClusterStyle('48px', '14px')"); // S1: 10~99
    expect(styles).toContain("mkClusterStyle('56px', '15px')"); // S2: 100+
    expect(styles.match(/mkClusterStyle\(/g)).toHaveLength(3); // calculator [10,100]과 짝이 맞는 3단계
  });

  it('renderMarkers가 클러스터러에 mkOverlays를 넘긴다(me 오버레이 제외 — §3.6 C4)', () => {
    const render = fnBody({ fnName: 'renderMarkers' });
    expect(render).toContain('mkClusterer.addMarkers(mkOverlays)');
    // me 오버레이(mkMeOverlay)는 mkOverlays에 push되지 않으므로 클러스터 대상이 아니다.
    expect(html).not.toContain('mkOverlays.push(mkMeOverlay)');
    expect(html.match(/mkOverlays\.push\(/g)).toHaveLength(1);
  });

  it('clearMarkers가 클러스터러를 먼저 비운다(고스트 핀 방지 — §3.6 C2)', () => {
    const clear = fnBody({ fnName: 'clearMarkers' });
    expect(clear).toContain('mkClusterer.clear()');
    // 클러스터러 밖 오버레이까지 확실히 제거하는 기존 루프도 유지된다.
    //   ⚠️ 'setMap(null)'로만 보면 바로 위 주석 문장이 단언을 통과시킨다(qa-logic L3 — 죽은 단언).
    //   강등 상태에선 이 루프가 오버레이를 지우는 유일한 수단이라 사라지면 고스트가 누적된다.
    expect(clear).toContain('mkOverlays[i].setMap(null)');
  });

  it('클러스터러 미정의·생성 실패 시 예외를 삼키고 강등한다 — ERROR 미발신(§3.6 E4)', () => {
    const ensure = fnBody({ fnName: 'ensureClusterer' });
    expect(ensure).not.toBe('');
    // 존재 여부 검사 — 가드 문장 자체를 단언한다. 'kakao.maps.MarkerClusterer'만 보면
    //   가드를 지워도 바로 아래 생성자(new kakao.maps.MarkerClusterer)가 대신 통과시킨다(qa-logic L4).
    expect(ensure).toContain('if (!kakao.maps.MarkerClusterer) return;');
    expect(ensure).toContain('catch'); // 생성 예외 흡수
    expect(ensure).not.toContain('ERROR'); // 지도는 멀쩡하므로 에러 배너를 띄우지 않는다
    // ERROR 발신 지점은 기존 3곳(SDK_UNAVAILABLE·SDK_LOAD_FAILED·INIT catch) 그대로.
    expect(html.match(/type: 'ERROR'/g)).toHaveLength(3);
  });

  it('클러스터러가 없으면 기존 개별 핀 경로(setMap(mkMap))로 렌더한다(강등 경로 잔존)', () => {
    const render = fnBody({ fnName: 'renderMarkers' });
    expect(render).toContain('setMap(mkMap)');
    expect(render).toContain('!mkClusterer'); // 클러스터러 유무 분기
  });

  // qa-logic L2: addMarkers 런타임 강등(클러스터러가 CustomOverlay를 거부하는 T0 실패 형태)을 직접 잠근다.
  //   위 단언들은 생성 루프의 `if (!mkClusterer)` 가드로도 충족돼, try/catch를 통째로 지워도 green이었다.
  it('addMarkers가 던지면 클러스터러를 폐기하고 개별 핀으로 되돌린다(런타임 강등 — §3.6 E4)', () => {
    const render = fnBody({ fnName: 'renderMarkers' });
    const afterAdd = render.slice(render.indexOf('addMarkers'));
    expect(afterAdd).toContain('catch');
    expect(afterAdd).toContain('mkClusterer = null'); // 이후 렌더도 개별 핀 경로 유지
    expect(afterAdd).toContain('setMap(mkMap)'); // 이번 렌더분 오버레이 복구
  });

  // qa-logic L1 [중대 회귀]: 재-INIT(handleRetry→sendInit)은 같은 WebView에 INIT을 재주입하므로
  //   JS 컨텍스트(=mkClusterer)는 살아 있는데 mkMap은 새 Map 인스턴스로 교체된다. 클러스터러를 그대로
  //   재사용하면 옛 Map에 묶인 채라 새 지도에 핀이 하나도 안 그려진다(예외가 없어 강등도 ERROR도 없는 조용한 실패).
  //   → 재사용 early-return **앞에서** clear() + 새 Map 재바인딩, 불가하면 폐기하고 재생성한다.
  it('재-INIT 시 클러스터러를 새 Map에 재바인딩한다 — 옛 Map에 묶인 채 재사용 금지(qa-logic L1)', () => {
    const ensure = fnBody({ fnName: 'ensureClusterer' });
    const reuseGuard = ensure.indexOf('if (mkClusterer) return;');
    expect(reuseGuard).toBeGreaterThan(-1);
    const rebind = ensure.slice(0, reuseGuard); // 재사용 판정 이전 구간에서만 찾는다.
    expect(rebind).toContain('mkClusterer.clear()'); // 옛 Map에 남은 버블 제거(E8 유령 방지)
    expect(rebind).toContain('mkClusterer.setMap(mkMap)'); // 새 Map으로 재바인딩
    // 폐기 경로가 둘이다(setMap 미제공 SDK → else / clear·setMap 예외 → catch). 존재만 보면 한쪽을
    //   지워도 다른 쪽이 단언을 충족시켜 살아남으므로 개수로 잠근다(qa-logic L5 — 같은 파일 안 다른
    //   코드 경로가 같은 문자열을 제공하는 경우. L3의 "주석이 단언을 살린다"의 한 단계 안쪽 사례다).
    expect(rebind.match(/mkClusterer = null/g)).toHaveLength(2);
  });

  it('클러스터러는 1회만 생성하고 재-INIT 시 재사용한다(유령 버블 방지 — §3.6 C3·E8)', () => {
    const ensure = fnBody({ fnName: 'ensureClusterer' });
    expect(ensure).toContain('if (mkClusterer) return;');
    // 생성은 ensureClusterer 한 곳에서만 일어난다.
    expect(html.match(/new kakao\.maps\.MarkerClusterer\(/g)).toHaveLength(1);
  });
});
