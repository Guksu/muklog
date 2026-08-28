// src/features/map/mapHtml.spec.ts
// Kakao JS SDK 로드 HTML 생성 함수 단위 테스트 (plan §3.5·§5-1 HTML 템플릿).
//   JS 키 주입(placeholder 치환) / Kakao SDK 스크립트 src / READY·MARKER_TAP·ERROR postMessage 송신부
//   / 마커 직렬화(이모지 렌더)·INIT/SET_MARKERS 핸들러 정의 존재를 문자열로 검증. 실 SDK는 스모크.
//   ⚠️ map-nearby-load: 아래 describe('mapHtml')는 여전히 **문자열 계약** 단위다. 증분 조정 알고리즘처럼
//      분기·상태가 있는 코드는 문자열로 회귀를 못 잡으므로, 파일 하단 describe('mapHtml 실행')이
//      createMapSandbox로 스크립트를 실제 실행해 동작을 단언한다(plan §6 T1~T6).
import { MapPinKind, type MapMarker, type Region } from '../types';
import { createMapSandbox, type ClustererConfig } from '@/test/createMapSandbox';
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
    // map-feedback U55: 기본 클릭줌(무애니메이션 즉시 전환) 차단은 **옵션 블록 한 곳**에서만 튜닝한다(§3.1 A).
    //   실효 여부는 실행 단언(U55-2)이 따로 잠근다 — 여기선 튜닝 지점이 흩어지지 않는지만 본다.
    expect(options).toContain('disableClickZoom: true');
  });

  // map-feedback U55: 줌인 상수는 클러스터 옵션과 같은 블록 이웃에 모은다(스모크 튜닝 단일 지점).
  //   실값 계약: STEP 1(= Kakao 공식 샘플 getLevel()-1) / DURATION 300ms(원칙 4 상단·SDK 기본값) / MIN_LEVEL 1(ROADMAP 하한).
  it('클러스터 줌인 상수 실값이 §3.1 계약과 일치한다(STEP 1 · DURATION 300 · MIN_LEVEL 1)', () => {
    expect(html).toContain('var MK_CLUSTER_ZOOM_STEP = 1;');
    expect(html).toContain('var MK_CLUSTER_ZOOM_DURATION_MS = 300;');
    expect(html).toContain('var MK_MAP_MIN_LEVEL = 1;');
  });

  // ⚠️ mkMap을 인자·클로저로 받으면 재-INIT이 교체한 새 지도 대신 옛 지도에 setLevel 하는 조용한 실패가 된다.
  //   실행 단언(U55-4)이 결과를 잠그지만, 여기선 그 결과를 만드는 **구조**(무인자 모듈 변수 참조)를 직접 잠근다.
  it('mkClusterZoomIn은 cluster만 받고 mkMap을 모듈 변수로 매번 읽는다(옛 지도 참조 금지)', () => {
    expect(html).toContain('function mkClusterZoomIn(cluster)');
    const zoom = fnBody({ fnName: 'mkClusterZoomIn' });
    expect(zoom).not.toBe('');
    expect(zoom).toContain('if (!mkMap'); // 모듈 변수 가드 — 인자로 받았다면 이 이름이 나올 수 없다
    expect(zoom).toContain('mkMap.getLevel()');
    expect(zoom).toContain('mkMap.setLevel(');
    expect(zoom).toContain('cluster.getCenter()');
  });

  // 등록 실패가 "클러스터는 보이는데 탭이 죽은" 상태를 만들지 않으려면 대입 **전에** 등록해야 한다(§3.1 C).
  //   실행 단언(U55-6)은 강등 결과를 보고, 이 단언은 그 결과를 보장하는 순서 자체를 본다.
  it("clusterclick 리스너를 신규 생성 분기에서 mkClusterer 대입 **전에** 등록한다(§3.1 C)", () => {
    const ensure = fnBody({ fnName: 'ensureClusterer' });
    expect(ensure).toContain("addListener(created, 'clusterclick', mkClusterZoomIn)");
    expect(ensure.indexOf("addListener(created, 'clusterclick'")).toBeLessThan(
      ensure.indexOf('mkClusterer = created;'),
    );
    // 재사용(재-INIT) 분기에는 등록이 없다 — 등록 지점이 하나뿐임을 개수로 잠근다(중복 등록 = 탭 1회에 여러 단계 점프).
    expect(html.match(/'clusterclick'/g)).toHaveLength(1);
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

  // ⚠️ map-nearby-load(§4.6)로 `mkOverlays` 배열과 `clearMarkers()`가 폐기됐다. 아래 두 건은 그 심볼에
  //   직접 묶여 있어 문장 그대로는 유지가 불가능한 유일한 케이스다 — **의도(클러스터 대상에서 me 오버레이
  //   제외 / 고스트 핀 방지 정리)는 후속 심볼(allPinOverlays·resetMarkers) 위에서 더 강하게 다시 잠근다.**
  it('클러스터러에 넘기는 오버레이는 레지스트리(mkPins)에서만 파생된다(me 오버레이 제외 — §3.6 C4)', () => {
    const all = fnBody({ fnName: 'allPinOverlays' });
    expect(all).toContain('mkPins[id].overlay');
    // me 오버레이(mkMeOverlay)는 mkPins에 등록되지 않으므로 클러스터 대상이 될 경로가 없다.
    //   레지스트리 등록 지점이 createPinOverlay 한 곳뿐임을 개수로 잠근다(다른 곳에서 끼워 넣으면 red).
    expect(html.match(/mkPins\[[^\]]+\] = \{/g)).toHaveLength(1);
    // 클러스터러가 받는 오버레이는 delta(added/removed) 또는 allPinOverlays() 결과뿐이다.
    const apply = fnBody({ fnName: 'applyOverlayDelta' });
    expect(apply).toContain('mkClusterer.addMarkers(added');
    expect(apply).toContain('mkClusterer.addMarkers(allPinOverlays())');
    expect(apply).not.toContain('mkMeOverlay');
  });

  it('resetMarkers가 레지스트리 오버레이를 전량 떼고 클러스터러 정리보다 먼저 돈다(고스트 핀 방지 — §3.6 C2·§4.5)', () => {
    const reset = fnBody({ fnName: 'resetMarkers' });
    expect(reset).not.toBe('');
    // ⚠️ 'setMap(null)'로만 보면 바로 위 주석 문장이 단언을 통과시킨다(qa-logic L3 — 죽은 단언).
    //   강등 상태에선 이 루프가 오버레이를 지우는 유일한 수단이라 사라지면 고스트가 누적된다.
    expect(reset).toContain('mkPins[id].overlay.setMap(null)');
    expect(reset).toContain('catch'); // 죽은 지도에서 던져도 나머지 정리를 막지 않는다(E7)
    expect(reset).toContain('mkPins = {}');
    // 클러스터러 내부 목록 비우기는 ensureClusterer의 clear()가 이어받는다 → 순서가 계약이다(§4.5).
    const init = html.slice(html.indexOf('window.__muklogInit'), html.indexOf('window.__muklogSetMarkers'));
    expect(init).toContain('resetMarkers();');
    expect(init.indexOf('resetMarkers();')).toBeLessThan(init.indexOf('ensureClusterer();'));
    expect(html).not.toContain('clearMarkers'); // 폐기된 심볼의 잔재 0(§4.6)
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

  it("클러스터러가 없으면(mkClusterMode 'none') 기존 개별 핀 경로(setMap)로 표시한다(강등 경로 잔존)", () => {
    const apply = fnBody({ fnName: 'applyOverlayDelta' });
    expect(apply).toContain("mkClusterMode === 'none'"); // 클러스터러 유무 분기(모드로 대체 — §4.4)
    expect(apply).toContain('setMap(mkMap)'); // 추가분 부착
    expect(apply).toContain('setMap(null)'); // 제거분 탈착
  });

  // qa-logic L2: addMarkers 런타임 강등(클러스터러가 CustomOverlay를 거부하는 T0 실패 형태)을 직접 잠근다.
  //   위 단언들은 모드 분기로도 충족돼, try/catch를 통째로 지워도 green이었다.
  it('addMarkers가 던지면 클러스터러를 폐기하고 개별 핀으로 되돌린다(런타임 강등 — §3.6 E4)', () => {
    const apply = fnBody({ fnName: 'applyOverlayDelta' });
    const afterAdd = apply.slice(apply.indexOf('addMarkers'));
    expect(afterAdd).toContain('catch');
    expect(afterAdd).toContain('demoteClusterer()');
    const demote = fnBody({ fnName: 'demoteClusterer' });
    expect(demote).toContain('mkClusterer = null'); // 이후 렌더도 개별 핀 경로 유지
    expect(demote).toContain("mkClusterMode = 'none'");
    // ⚠️ delta가 아니라 **레지스트리 전량**을 다시 붙인다 — delta만 붙이면 클러스터러가 그리던 유지 핀이
    //   어디에도 안 붙어 핀이 통째로 사라진다(§4.4).
    expect(demote).toContain('allPinOverlays()');
    expect(demote).toContain('setMap(mkMap)');
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

  // ── map-nearby-load 증분(문자열 계약, plan §6 T7) ─────────────────────────────
  // 실행 검증은 아래 createMapSandbox describe가 담당한다. 여기 단언들은 계약 심볼이 실수로 사라지거나
  //   폐기 심볼이 되살아나는 회귀를 막는 안전망이다.
  it('핀 시그니처(pinSig)를 두고 id는 넣지 않는다(키=동일성 / sig=내용 — §4.2)', () => {
    expect(html).toContain('function pinSig(m)');
    const sig = fnBody({ fnName: 'pinSig' });
    expect(sig).toContain('m.kind');
    expect(sig).toContain('m.emoji');
    expect(sig).toContain('m.lat');
    expect(sig).toContain('m.lng');
    expect(sig).not.toContain('m.id'); // id는 레지스트리 키다 — sig에 넣으면 내용 비교가 무의미해진다
    // selected는 SET_SELECTED가 클래스 토글로 단독 처리한다(map-pin-select 결정 회귀 금지 — §4.2).
    expect(sig).not.toContain('mkSelectedId');
  });

  it('폐기 심볼(mkOverlays·clearMarkers)의 잔재가 0이다(§4.6)', () => {
    expect(html).not.toContain('mkOverlays');
    expect(html).not.toContain('clearMarkers');
  });

  it('renderMarkers는 선행 전량 삭제 없이 add/remove/keep으로 조정한다(§4.3)', () => {
    const render = fnBody({ fnName: 'renderMarkers' });
    expect(render).toContain('pinSig(next[id]) === mkPins[id].sig'); // 유지 판정의 단일 기준
    expect(render).toContain('if (mkPins.hasOwnProperty(id2)) continue;'); // 유지 핀 미접촉
    expect(render).toContain('createPinOverlay(next[id2])');
    expect(render).toContain('applyOverlayDelta(added, removed)');
  });

  it('클러스터 모드를 mkClusterMode로 1회 확정하고 typeof로 API 실존을 확인한다(§4.4)', () => {
    expect(html).toContain("var mkClusterMode = 'none';");
    const sync = fnBody({ fnName: 'syncClusterMode' });
    expect(sync).toContain("typeof mkClusterer.removeMarkers === 'function'");
    expect(sync).toContain("'partial'");
    expect(sync).toContain("'full'");
    // 모드 확정은 ensureClusterer에서만 한다(렌더마다 재판정 금지).
    expect(html.match(/syncClusterMode\(\);/g)).toHaveLength(2); // 재사용 경로 + 신규 생성 경로
    const apply = fnBody({ fnName: 'applyOverlayDelta' });
    expect(apply).not.toContain('syncClusterMode');
    // redraw/nodraw도 실존 확인 후에만 쓴다("없는 API를 지어내지 않는다").
    expect(apply).toContain("typeof mkClusterer.redraw === 'function'");
  });

  it('변화가 0이면 클러스터러를 건드리지 않는다(E1 — redraw조차 돌지 않는다)', () => {
    const apply = fnBody({ fnName: 'applyOverlayDelta' });
    expect(apply).toContain('if (added.length === 0 && removed.length === 0) return;');
  });

  // ── map-feedback U5: 부팅 여백 톤 (plan §3.3 ①) ──────────────────────────────
  //   CSS 실값은 실행으로 관측할 수 없어 문자열 단언이 유일한 수단이다 → 블록 추출 + **개수**로 잠근다
  //   (한 곳만 지워도 red. 주석·다른 분기가 대신 충족시키지 못하게 — 메모리 "문자열 단언은 쉽게 죽는다").
  it('U5-1 지도 캔버스 배경을 킷 지도 톤(#EFEAE3)으로 칠한다 — html/body와 #map 둘 다', () => {
    // body만 칠하면 뷰포트를 절대배치로 덮는 #map이 타일 도착 전 그 위를 기본색으로 덮는다 → 두 곳 모두 필요.
    expect(cssBlock({ selector: 'html, body' })).toContain('background: #EFEAE3');
    expect(cssBlock({ selector: '#map' })).toContain('background: #EFEAE3');
    // 실측 3 = html/body 1 + #map 1 + 클러스터 버블 테두리 주석 1. 한 곳이라도 빠지면 red.
    expect(html.match(/#EFEAE3/g)).toHaveLength(3);
  });
});

// ── map-nearby-load: WebView 스크립트 실행 검증 (plan §6 T1~T6 / §4 불변식 I1~I4) ────────────────
// 여기서부터는 "코드가 무엇을 하는지"를 실제로 돌려서 본다. 위 문자열 단언과 달리 유지/추가/제거 판정,
//   클러스터 3모드, 재-INIT 리셋 같은 상태 기계가 검증 대상이다.
//   ⚠️ 샌드박스는 Kakao SDK의 문서화된 표면을 모사할 뿐이다 — 실 SDK 동작의 단독 권위는 디바이스 스모크(§7).
describe('mapHtml 실행(createMapSandbox)', () => {
  const CENTER: Region = { lat: 37.5665, lng: 126.978, zoom: 4 };

  const makeMarker = ({
    id,
    kind = MapPinKind.Nearby,
    emoji = '🍜',
    lat = 37.5,
    lng = 127.0,
  }: {
    id: string;
    kind?: MapPinKind;
    emoji?: string;
    lat?: number;
    lng?: number;
  }): MapMarker => ({ id, kind, emoji, lat, lng });

  // p0..p{count-1} — 앞부분이 항상 동일해서 "10건 → 15건"처럼 상위집합 주입을 만들기 쉽다.
  const makeMarkers = ({ count, from = 0 }: { count: number; from?: number }): MapMarker[] =>
    Array.from({ length: count }, (_unused, index) =>
      makeMarker({ id: 'p' + (from + index), lat: 37.5 + (from + index) / 1000 }),
    );

  const idsOf = ({ markers }: { markers: MapMarker[] }): string[] =>
    markers.map((marker) => marker.id).sort();

  const boot = ({
    clusterer,
    markers,
  }: { clusterer?: ClustererConfig; markers?: MapMarker[] } = {}) => {
    const sandbox = createMapSandbox({ clusterer });
    sandbox.loadSdk();
    sandbox.init({ center: CENTER, markers: markers ?? [], me: null });
    return sandbox;
  };

  const errorsOf = ({ posted }: { posted: Array<Record<string, unknown>> }) =>
    posted.filter((message) => message.type === 'ERROR');

  // ── T1. 샌드박스 인프라 자체 ────────────────────────────────────────────────
  it('T1 SDK onload 시뮬레이션으로 READY가 1건 post된다', () => {
    const sandbox = createMapSandbox();
    expect(sandbox.posted).toHaveLength(0);
    sandbox.loadSdk();
    expect(sandbox.posted).toEqual([{ type: 'READY' }]);
  });

  it('T1 SDK 로드 실패는 ERROR(SDK_LOAD_FAILED)로 post된다', () => {
    const sandbox = createMapSandbox();
    sandbox.failSdk();
    expect(sandbox.posted).toEqual([{ type: 'ERROR', reason: 'SDK_LOAD_FAILED' }]);
  });

  it('T1 init(핀 2건)이 CustomOverlay 2개 + addMarkers(길이 2) 1회로 이어진다', () => {
    const sandbox = boot({ markers: makeMarkers({ count: 2 }) });
    expect(sandbox.overlays).toHaveLength(2);
    expect(sandbox.counts.div).toBe(2);
    expect(sandbox.clusterer?.addMarkersCalls).toHaveLength(1);
    expect(sandbox.clusterer?.addMarkersCalls[0].markers).toHaveLength(2);
  });

  // ── 기존 핀 계약(6종) 회귀 — 증분화로 바뀌면 안 되는 것들 ───────────────────
  it('핀 계약 불변: 이모지·3-way className·pinId·zIndex·MARKER_TAP(stopPropagation)', () => {
    const sandbox = boot({
      markers: [
        makeMarker({ id: 's1', kind: MapPinKind.Saved, emoji: '🍜' }),
        makeMarker({ id: 'w1', kind: MapPinKind.Wish, emoji: '🍕', lat: 37.51 }),
        makeMarker({ id: 'n1', kind: MapPinKind.Nearby, emoji: '🍣', lat: 37.52 }),
      ],
    });
    expect(sandbox.pins.s1.el.className).toBe('mk-pin');
    expect(sandbox.pins.w1.el.className).toBe('mk-pin mk-pin--wish');
    expect(sandbox.pins.n1.el.className).toBe('mk-pin mk-pin--nearby');
    expect(sandbox.pins.s1.el.textContent).toBe('🍜');
    expect(sandbox.pins.s1.el.dataset.pinId).toBe('s1');
    expect(sandbox.pins.s1.overlay.options.zIndex).toBe(3);
    expect(sandbox.pins.w1.overlay.options.zIndex).toBe(2);
    expect(sandbox.pins.n1.overlay.options.zIndex).toBe(1);
    const tap = sandbox.pins.n1.el.click();
    expect(tap.propagationStopped).toBe(true);
    expect(sandbox.posted.at(-1)).toEqual({ type: 'MARKER_TAP', id: 'n1', kind: 'nearby' });
  });

  it('me 오버레이는 레지스트리에도 클러스터에도 들어가지 않는다(§3.6 C4)', () => {
    const sandbox = createMapSandbox();
    sandbox.loadSdk();
    sandbox.init({ center: CENTER, markers: makeMarkers({ count: 2 }), me: { lat: 37.5, lng: 127 } });
    expect(sandbox.overlays).toHaveLength(3); // me 1 + 핀 2
    expect(sandbox.pinIds).toHaveLength(2);
    expect(sandbox.clusterer?.addMarkersCalls[0].markers).toHaveLength(2);
  });

  // ── T3. 증분 조정 (§4.3, AC1~AC6) ──────────────────────────────────────────
  it('AC1 동일 집합 재주입은 DOM·오버레이·표시를 전혀 건드리지 않는다(I1·E1)', () => {
    const markers = makeMarkers({ count: 3 });
    const sandbox = boot({ markers });
    const divsAfterFirst = sandbox.counts.div;
    const overlaysAfterFirst = sandbox.overlays.length;

    sandbox.setMarkers({ markers });

    expect(sandbox.counts.div).toBe(divsAfterFirst);
    expect(sandbox.overlays).toHaveLength(overlaysAfterFirst);
    sandbox.overlays.forEach((overlay) => expect(overlay.setMapCalls).toHaveLength(0));
    // E1: 변화가 0이면 클러스터러도 안 건드린다(첫 렌더의 addMarkers 1 + redraw 1에서 멈춘다).
    expect(sandbox.clusterer?.addMarkersCalls).toHaveLength(1);
    expect(sandbox.clusterer?.redrawCalls).toBe(1);
  });

  it('AC2 10건 → 15건: 신규 5건만 생성되고 제거는 0이다', () => {
    const sandbox = boot({ markers: makeMarkers({ count: 10 }) });
    const divsAfterFirst = sandbox.counts.div;

    sandbox.setMarkers({ markers: makeMarkers({ count: 15 }) });

    expect(sandbox.counts.div - divsAfterFirst).toBe(5);
    expect(sandbox.clusterer?.addMarkersCalls.at(-1)?.markers).toHaveLength(5);
    expect(sandbox.clusterer?.removeMarkersCalls).toHaveLength(0);
    expect(sandbox.pinIds).toEqual(idsOf({ markers: makeMarkers({ count: 15 }) }));
  });

  it('AC3 15건 → 12건: 생성 0, 이탈한 3건의 오버레이만 정확히 제거되고 나머지는 미접촉', () => {
    const sandbox = boot({ markers: makeMarkers({ count: 15 }) });
    const droppedOverlays = ['p12', 'p13', 'p14'].map((id) => sandbox.pins[id].overlay);
    const keptOverlays = makeMarkers({ count: 12 }).map((marker) => sandbox.pins[marker.id].overlay);
    const divsAfterFirst = sandbox.counts.div;

    sandbox.setMarkers({ markers: makeMarkers({ count: 12 }) });

    expect(sandbox.counts.div).toBe(divsAfterFirst);
    const removed = sandbox.clusterer?.removeMarkersCalls.at(-1)?.markers ?? [];
    expect(removed).toHaveLength(3);
    droppedOverlays.forEach((overlay) => expect(removed).toContain(overlay));
    keptOverlays.forEach((overlay) => expect(removed).not.toContain(overlay));
    expect(sandbox.pinIds).toEqual(idsOf({ markers: makeMarkers({ count: 12 }) }));
  });

  it('AC4 emoji만 바뀐 1건은 그 핀만 재생성된다(sig 불일치)', () => {
    const first = makeMarkers({ count: 3 });
    const sandbox = boot({ markers: first });
    const divsAfterFirst = sandbox.counts.div;
    const keptOverlay = sandbox.pins.p0.overlay;
    const staleOverlay = sandbox.pins.p1.overlay;

    sandbox.setMarkers({
      markers: first.map((marker) => (marker.id === 'p1' ? { ...marker, emoji: '🍕' } : marker)),
    });

    expect(sandbox.counts.div - divsAfterFirst).toBe(1);
    expect(sandbox.pins.p1.el.textContent).toBe('🍕');
    expect(sandbox.pins.p1.overlay).not.toBe(staleOverlay);
    expect(keptOverlay.setMapCalls).toHaveLength(0);
    expect(sandbox.clusterer?.removeMarkersCalls.at(-1)?.markers).toEqual([staleOverlay]);
  });

  it('AC4-b 좌표만 바뀐 1건도 재생성된다(sig에 lat/lng이 들어 있다)', () => {
    const first = makeMarkers({ count: 3 });
    const sandbox = boot({ markers: first });
    const divsAfterFirst = sandbox.counts.div;
    const staleOverlay = sandbox.pins.p2.overlay;

    sandbox.setMarkers({
      markers: first.map((marker) => (marker.id === 'p2' ? { ...marker, lat: 38.1 } : marker)),
    });

    expect(sandbox.counts.div - divsAfterFirst).toBe(1);
    expect(sandbox.pins.p2.overlay).not.toBe(staleOverlay);
    expect(sandbox.clusterer?.removeMarkersCalls.at(-1)?.markers).toEqual([staleOverlay]);
  });

  it('AC5 빈 배열 주입은 전 핀을 제거하고 레지스트리를 비운다(예외 0 — E2)', () => {
    const sandbox = boot({ markers: makeMarkers({ count: 4 }) });

    sandbox.setMarkers({ markers: [] });

    expect(sandbox.pinIds).toEqual([]);
    expect(sandbox.clusterer?.removeMarkersCalls.at(-1)?.markers).toHaveLength(4);
    expect(errorsOf({ posted: sandbox.posted })).toHaveLength(0);
  });

  it('AC6 조정 후 mkPins 키 집합 == 주입 id 집합이다(I2)', () => {
    const sandbox = boot({ markers: makeMarkers({ count: 5 }) });
    expect(sandbox.pinIds).toEqual(idsOf({ markers: makeMarkers({ count: 5 }) }));

    const next = [...makeMarkers({ count: 2 }), ...makeMarkers({ count: 3, from: 20 })];
    sandbox.setMarkers({ markers: next });

    expect(sandbox.pinIds).toEqual(idsOf({ markers: next }));
  });

  it('E3 중복 id는 뒤가 이긴다(RN dedup의 방어선)', () => {
    const sandbox = boot({
      markers: [makeMarker({ id: 'dup', emoji: '🍜' }), makeMarker({ id: 'dup', emoji: '🍕' })],
    });
    expect(sandbox.pinIds).toEqual(['dup']);
    expect(sandbox.pins.dup.el.textContent).toBe('🍕');
    expect(sandbox.overlays).toHaveLength(1);
  });

  it('E9 INIT 전 SET_MARKERS는 조용히 무시된다(mkMap null — READY 후 RN이 재주입)', () => {
    const sandbox = createMapSandbox();
    sandbox.loadSdk();

    sandbox.setMarkers({ markers: makeMarkers({ count: 2 }) });

    expect(sandbox.pinIds).toEqual([]);
    expect(sandbox.counts.div ?? 0).toBe(0);
    expect(errorsOf({ posted: sandbox.posted })).toHaveLength(0);
  });

  // ── T4. 클러스터러 3모드 (§4.4, AC7~AC10) ──────────────────────────────────
  it('AC7 partial: delta만 동기화하고 clear 0 · redraw 1회/배치', () => {
    const sandbox = boot({ markers: makeMarkers({ count: 3 }) });
    expect(sandbox.clusterMode).toBe('partial');
    const clusterer = sandbox.clusterer;
    expect(clusterer).not.toBeNull();

    sandbox.setMarkers({ markers: makeMarkers({ count: 6 }) }); // 추가만
    expect(clusterer?.addMarkersCalls.at(-1)?.markers).toHaveLength(3);
    expect(clusterer?.addMarkersCalls.at(-1)?.nodraw).toBe(true); // 재계산은 redraw 1회로 모은다
    expect(clusterer?.removeMarkersCalls).toHaveLength(0);
    expect(clusterer?.redrawCalls).toBe(2);

    const addCallsBefore = clusterer?.addMarkersCalls.length;
    sandbox.setMarkers({ markers: makeMarkers({ count: 3 }) }); // 제거만
    expect(clusterer?.removeMarkersCalls.at(-1)?.markers).toHaveLength(3);
    expect(clusterer?.addMarkersCalls).toHaveLength(addCallsBefore ?? 0);
    expect(clusterer?.redrawCalls).toBe(3);
    expect(clusterer?.clearCalls).toBe(0); // 전량 재구성 0 — 그게 partial의 존재 이유다
  });

  it('AC7-b redraw가 없는 SDK면 nodraw 없이 호출한다(없는 API를 지어내지 않는다)', () => {
    const sandbox = boot({ clusterer: { hasRedraw: false }, markers: makeMarkers({ count: 2 }) });
    expect(sandbox.clusterMode).toBe('partial');
    expect(sandbox.clusterer?.addMarkersCalls.at(-1)?.nodraw).toBeUndefined();
    expect(sandbox.clusterer?.redrawCalls).toBe(0);
  });

  it('AC8 full(removeMarkers 부재): clear + 전체 재등록, DOM 생성은 delta분만', () => {
    const sandbox = boot({
      clusterer: { hasRemoveMarkers: false },
      markers: makeMarkers({ count: 3 }),
    });
    expect(sandbox.clusterMode).toBe('full');
    const clusterer = sandbox.clusterer;
    expect(clusterer?.clearCalls).toBe(1);
    const divsAfterFirst = sandbox.counts.div;

    sandbox.setMarkers({ markers: makeMarkers({ count: 5 }) });

    expect(sandbox.counts.div - divsAfterFirst).toBe(2); // 오버레이·DOM은 재사용
    expect(clusterer?.clearCalls).toBe(2);
    expect(clusterer?.addMarkersCalls.at(-1)?.markers).toHaveLength(5); // 현재 전체 오버레이
    expect(errorsOf({ posted: sandbox.posted })).toHaveLength(0);
  });

  it('AC9 none(클러스터러 미로드): 추가만 부착·제거만 탈착, 유지 핀 setMap 0', () => {
    const sandbox = boot({ clusterer: { available: false }, markers: makeMarkers({ count: 3 }) });
    expect(sandbox.clusterMode).toBe('none');
    expect(sandbox.clusterer).toBeNull();
    const keptOverlay = sandbox.pins.p0.overlay;
    const droppedOverlay = sandbox.pins.p2.overlay;
    expect(keptOverlay.setMapCalls).toHaveLength(1);
    expect(keptOverlay.setMapCalls[0]).toBe(sandbox.map);

    sandbox.setMarkers({
      markers: [...makeMarkers({ count: 2 }), makeMarker({ id: 'p9', lat: 37.509 })],
    });

    expect(keptOverlay.setMapCalls).toHaveLength(1); // 유지 핀 미접촉
    expect(droppedOverlay.setMapCalls).toHaveLength(2);
    expect(droppedOverlay.setMapCalls[1]).toBeNull();
    expect(sandbox.pins.p9.overlay.setMapCalls[0]).toBe(sandbox.map);
  });

  it('AC10 클러스터 조작이 던지면 강등하고 레지스트리 **전량**을 직접 부착한다(ERROR 0)', () => {
    const sandbox = boot({ markers: makeMarkers({ count: 3 }) });
    const clusterer = sandbox.clusterer;
    const keptOverlays = makeMarkers({ count: 3 }).map((marker) => sandbox.pins[marker.id].overlay);
    keptOverlays.forEach((overlay) => expect(overlay.setMapCalls).toHaveLength(0));

    if (clusterer) clusterer.throwOnAddMarkers = true; // 두 번째 렌더부터 거부
    sandbox.setMarkers({ markers: makeMarkers({ count: 5 }) });

    expect(sandbox.clusterer).toBeNull();
    expect(sandbox.clusterMode).toBe('none');
    // ⚠️ delta(신규 2건)가 아니라 5건 전부가 붙어야 한다 — 유지 3건이 빠지면 핀이 통째로 사라진다.
    expect(sandbox.pinIds).toHaveLength(5);
    sandbox.pinIds.forEach((id) => {
      expect(sandbox.pins[id].overlay.setMapCalls.at(-1)).toBe(sandbox.map);
    });
    keptOverlays.forEach((overlay) => expect(overlay.setMapCalls).toHaveLength(1));
    expect(errorsOf({ posted: sandbox.posted })).toHaveLength(0);

    // 이후 렌더는 none 모드로 이어진다(강등은 단방향).
    const divsBefore = sandbox.counts.div;
    sandbox.setMarkers({ markers: makeMarkers({ count: 6 }) });
    expect(sandbox.counts.div - divsBefore).toBe(1);
    expect(sandbox.pins.p5.overlay.setMapCalls[0]).toBe(sandbox.map);
  });

  it('E5 클러스터러 생성이 던져도 지도는 살아서 개별 핀으로 렌더된다(ERROR 0)', () => {
    const sandbox = boot({ clusterer: { constructThrows: true }, markers: makeMarkers({ count: 2 }) });
    expect(sandbox.clusterMode).toBe('none');
    expect(sandbox.pinIds).toHaveLength(2);
    expect(sandbox.pins.p0.overlay.setMapCalls[0]).toBe(sandbox.map);
    expect(errorsOf({ posted: sandbox.posted })).toHaveLength(0);
  });

  // ── T5. 재-INIT 리셋 (§4.5, AC11~AC13) ─────────────────────────────────────
  it('AC11 재-INIT(none): 동일 집합이어도 전 핀이 **새 Map**에 다시 부착된다(빈 지도 0)', () => {
    const markers = makeMarkers({ count: 3 });
    const sandbox = boot({ clusterer: { available: false }, markers });
    const firstMap = sandbox.map;
    const oldOverlays = markers.map((marker) => sandbox.pins[marker.id].overlay);

    sandbox.init({ center: CENTER, markers, me: null });

    expect(sandbox.maps).toHaveLength(2);
    expect(sandbox.map).not.toBe(firstMap);
    expect(sandbox.pinIds).toEqual(idsOf({ markers }));
    // AC12: 이전 오버레이는 setMap(null)로 떨어진다(유령 0).
    oldOverlays.forEach((overlay) => {
      expect(overlay.setMapCalls).toHaveLength(2);
      expect(overlay.setMapCalls[1]).toBeNull();
    });
    markers.forEach((marker) => {
      const overlay = sandbox.pins[marker.id].overlay;
      expect(oldOverlays).not.toContain(overlay);
      expect(overlay.setMapCalls.at(-1)).toBe(sandbox.map);
    });
  });

  it('AC11-b 재-INIT(partial): 클러스터러를 재사용하되 새 Map 재바인딩 + 전량 재등록한다', () => {
    const markers = makeMarkers({ count: 3 });
    const sandbox = boot({ markers });
    const firstClusterer = sandbox.clusterer;

    sandbox.init({ center: CENTER, markers, me: null });

    expect(sandbox.clusterer).toBe(firstClusterer); // 1회 생성·재사용(§3.6 C3·E8)
    expect(sandbox.clusterers).toHaveLength(1);
    expect(firstClusterer?.setMapCalls.at(-1)).toBe(sandbox.map);
    expect(firstClusterer?.addMarkersCalls.at(-1)?.markers).toHaveLength(3);
  });

  it('AC12 재-INIT에서 setMap이 던져도 레지스트리는 비워지고 렌더가 정상 진행된다(E7)', () => {
    const markers = makeMarkers({ count: 3 });
    const sandbox = boot({ clusterer: { available: false }, markers });
    markers.forEach((marker) => {
      sandbox.pins[marker.id].overlay.setMap = () => {
        throw new Error('죽은 지도');
      };
    });

    sandbox.init({ center: CENTER, markers, me: null });

    expect(errorsOf({ posted: sandbox.posted })).toHaveLength(0);
    expect(sandbox.pinIds).toEqual(idsOf({ markers }));
    expect(sandbox.overlays).toHaveLength(6); // 3건 전량 재생성
    markers.forEach((marker) =>
      expect(sandbox.pins[marker.id].overlay.setMapCalls.at(-1)).toBe(sandbox.map),
    );
  });

  it('AC13 재-INIT 후에도 선택 id가 유지돼 재생성된 핀에 active가 적용된다(I4)', () => {
    const markers = makeMarkers({ count: 3 });
    const sandbox = boot({ markers });
    sandbox.setSelected({ selectedId: 'p1' });
    expect(sandbox.pins.p1.el.classList.contains('mk-pin--active')).toBe(true);

    sandbox.init({ center: CENTER, markers, me: null });

    expect(sandbox.selectedId).toBe('p1');
    expect(sandbox.pins.p1.el.classList.contains('mk-pin--active')).toBe(true);
    expect(sandbox.pins.p1.overlay.options.zIndex).toBe(5);
  });

  // ── T6. 선택(SET_SELECTED) 상호작용 (AC14~AC16) ────────────────────────────
  it('AC14 선택 핀은 신규 핀 유입에도 같은 el을 유지하고 active가 끊기지 않는다', () => {
    const sandbox = boot({ markers: makeMarkers({ count: 3 }) });
    sandbox.setSelected({ selectedId: 'p0' });
    const selectedEl = sandbox.pins.p0.el;
    const selectedOverlay = sandbox.pins.p0.overlay;

    sandbox.setMarkers({ markers: makeMarkers({ count: 4 }) });

    expect(sandbox.pins.p0.el).toBe(selectedEl);
    expect(sandbox.pins.p0.overlay).toBe(selectedOverlay);
    expect(selectedEl.classList.contains('mk-pin--active')).toBe(true);
  });

  it('AC15 선택 id와 같은 핀이 새로 추가되면 생성 시점에 active + zIndex 5가 적용된다', () => {
    const sandbox = boot({ markers: makeMarkers({ count: 2 }) });
    sandbox.setSelected({ selectedId: 'p5' }); // 아직 뷰포트에 없던 핀

    sandbox.setMarkers({
      markers: [...makeMarkers({ count: 2 }), makeMarker({ id: 'p5', lat: 37.505 })],
    });

    expect(sandbox.pins.p5.el.classList.contains('mk-pin--active')).toBe(true);
    expect(sandbox.pins.p5.overlay.options.zIndex).toBe(5);
  });

  it('AC16 선택된 핀이 제거돼도 mkSelectedId는 남는다(해제는 RN 담당 — E8)', () => {
    const sandbox = boot({ markers: makeMarkers({ count: 3 }) });
    sandbox.setSelected({ selectedId: 'p2' });
    const removedOverlay = sandbox.pins.p2.overlay;

    sandbox.setMarkers({ markers: makeMarkers({ count: 2 }) });

    expect(sandbox.pinIds).toEqual(['p0', 'p1']);
    expect(sandbox.selectedId).toBe('p2');
    expect(sandbox.clusterer?.removeMarkersCalls.at(-1)?.markers).toContain(removedOverlay);
  });

  it('선택 상태는 sig에 없다 — 선택 후 같은 집합 재주입에도 재생성 0(B5)', () => {
    const markers = makeMarkers({ count: 3 });
    const sandbox = boot({ markers });
    sandbox.setSelected({ selectedId: 'p1' });
    const divsAfterSelect = sandbox.counts.div;

    sandbox.setMarkers({ markers });

    expect(sandbox.counts.div).toBe(divsAfterSelect);
    expect(sandbox.pins.p1.el.classList.contains('mk-pin--active')).toBe(true);
  });

  it('SET_SELECTED는 유지 핀의 클래스·zIndex만 토글한다(재생성 0 — map-pin-select 회귀)', () => {
    const sandbox = boot({
      markers: [
        makeMarker({ id: 's1', kind: MapPinKind.Saved }),
        makeMarker({ id: 'n1', kind: MapPinKind.Nearby, lat: 37.51 }),
      ],
    });
    const divsAfterInit = sandbox.counts.div;

    sandbox.setSelected({ selectedId: 'n1' });
    expect(sandbox.pins.n1.el.className).toBe('mk-pin mk-pin--nearby mk-pin--active');
    expect(sandbox.pins.n1.overlay.setZIndexCalls.at(-1)).toBe(5);
    expect(sandbox.pins.s1.overlay.setZIndexCalls.at(-1)).toBe(3);

    sandbox.setSelected({ selectedId: null });
    expect(sandbox.pins.n1.el.className).toBe('mk-pin mk-pin--nearby');
    expect(sandbox.pins.n1.overlay.setZIndexCalls.at(-1)).toBe(1);
    expect(sandbox.counts.div).toBe(divsAfterInit);
  });

  // ── qa-logic 하드닝(L1·L2): 표시 반영 실패가 남기는 흔적 ────────────────────
  it('L1 none 모드: 한 오버레이의 setMap 실패가 나머지 조정을 막지 않는다(E7과 동일 원칙)', () => {
    const sandbox = boot({ clusterer: { available: false }, markers: makeMarkers({ count: 3 }) });
    sandbox.pins.p1.overlay.setMap = () => {
      throw new Error('죽은 오버레이');
    };

    expect(() =>
      sandbox.setMarkers({
        markers: [
          makeMarker({ id: 'p0', lat: 37.5 }),
          makeMarker({ id: 'p2', lat: 37.502 }),
          makeMarker({ id: 'p9', lat: 37.509 }),
        ],
      }),
    ).not.toThrow();

    // 제거 1건이 던져도 신규 1건은 정상 부착된다(RN 주입부엔 try/catch가 없어 새면 조용히 실패).
    expect(sandbox.pins.p9.overlay.setMapCalls.at(-1)).toBe(sandbox.map);
  });

  it('L1-b 부착에 실패한 핀은 레지스트리에서 되돌아가 다음 주입에서 다시 만들어진다(§4.1 자기치유)', () => {
    const markers = makeMarkers({ count: 2 });
    const nextMarkers = [...markers, makeMarker({ id: 'p9', lat: 37.509 })];
    const sandbox = boot({ clusterer: { available: false }, markers });

    sandbox.setOverlayFault({ throwOnSetMap: true });
    sandbox.setMarkers({ markers: nextMarkers });
    // ⚠️ 여기서 mkPins에 남겨두면 sig가 맞아 다음 주입에서 "유지"로 판정돼 영원히 안 붙는다.
    expect(sandbox.pinIds).toEqual(['p0', 'p1']);

    sandbox.setOverlayFault({ throwOnSetMap: false });
    sandbox.setMarkers({ markers: nextMarkers });

    expect(sandbox.pinIds).toEqual(['p0', 'p1', 'p9']);
    expect(sandbox.pins.p9.overlay.setMapCalls.at(-1)).toBe(sandbox.map);
  });

  it('L2 강등 시 제거 대상 오버레이를 직접 떼어낸다(레지스트리에도 없고 화면에만 남는 유령 0)', () => {
    const sandbox = boot({ markers: makeMarkers({ count: 4 }) });
    const clusterer = sandbox.clusterer;
    const droppedOverlays = [sandbox.pins.p2.overlay, sandbox.pins.p3.overlay];
    if (clusterer) clusterer.throwOnRemoveMarkers = true;

    sandbox.setMarkers({ markers: makeMarkers({ count: 2 }) });

    expect(sandbox.clusterer).toBeNull();
    expect(sandbox.pinIds).toEqual(['p0', 'p1']);
    // removed는 renderMarkers 2단계에서 이미 mkPins에서 빠졌다 → 여기서 못 떼면 회수 수단이 없다.
    droppedOverlays.forEach((overlay) => expect(overlay.setMapCalls.at(-1)).toBeNull());
  });

  // ── map-feedback U55: 클러스터 탭 → 중심 anchor 애니메이션 줌인 (plan §3.1·§5-1) ──────────
  //   ⚠️ 샌드박스는 문서화된 SDK 표면(setLevel(level,{anchor,animate})·clusterclick·Cluster.getCenter)만
  //      모사한다. "실제로 부드럽게 보이는가"의 단독 권위는 디바이스 스모크(§7 S1~S3)다.
  const CLUSTER_CENTER = { lat: 37.55, lng: 126.98 };

  it('U55-1 클러스터 탭 1회 → 중심 anchor로 한 단계(300ms) 확대한다', () => {
    const sandbox = boot({ markers: makeMarkers({ count: 3 }) });
    expect(sandbox.map?.setLevelCalls).toHaveLength(0); // 탭 전엔 줌 조작 0

    sandbox.fireClusterEvent({ type: 'clusterclick', center: CLUSTER_CENTER });

    const calls = sandbox.map?.setLevelCalls ?? [];
    expect(calls).toHaveLength(1);
    expect(calls[0].level).toBe(CENTER.zoom - 1); // STEP 1 — 한 번에 한 단계만
    const options = calls[0].options as { anchor: { lat: number; lng: number }; animate: { duration: number } };
    expect(options.anchor.lat).toBe(CLUSTER_CENTER.lat); // 화면 중앙이 아니라 **클러스터 중심**을 파고든다
    expect(options.anchor.lng).toBe(CLUSTER_CENTER.lng);
    expect(options.animate.duration).toBe(300); // 무애니메이션 즉시 전환(=깜박임)이 아니다
  });

  it('U55-2 클러스터러는 disableClickZoom:true로 생성된다(기존 옵션 실값 회귀 0)', () => {
    const sandbox = boot({ markers: makeMarkers({ count: 3 }) });
    const options = sandbox.clusterer?.options ?? {};
    expect(options.disableClickZoom).toBe(true); // 기본 클릭줌을 끄지 않으면 우리 애니메이션과 겹쳐 이중 전환된다
    expect(options.averageCenter).toBe(true);
    expect(options.minClusterSize).toBe(2);
    expect(options.gridSize).toBe(60);
    expect(options.minLevel).toBe(2);
    expect(options.calculator).toEqual([10, 100]);
  });

  it('U55-3 재-INIT 후에도 clusterclick 리스너는 1개다(탭 1회 = 확대 1회)', () => {
    const markers = makeMarkers({ count: 3 });
    const sandbox = boot({ markers });
    sandbox.init({ center: CENTER, markers, me: null }); // 지도 에러 → "다시 시도" 경로

    expect(sandbox.listenerCount({ type: 'clusterclick' })).toBe(1);
    sandbox.fireClusterEvent({ type: 'clusterclick', center: CLUSTER_CENTER });
    // 리스너가 쌓였다면 한 번의 탭이 여러 단계를 건너뛴다 — 전 Map 인스턴스의 합으로 잠근다.
    const total = sandbox.maps.reduce((sum, map) => sum + map.setLevelCalls.length, 0);
    expect(total).toBe(1);
  });

  it('U55-4 재-INIT 후 탭은 **새** Map에 적용된다(옛 Map은 0건 — 조용한 실패 방지)', () => {
    const markers = makeMarkers({ count: 3 });
    const sandbox = boot({ markers });
    sandbox.init({ center: CENTER, markers, me: null });
    expect(sandbox.maps).toHaveLength(2);

    sandbox.fireClusterEvent({ type: 'clusterclick', center: CLUSTER_CENTER });

    expect(sandbox.maps[0].setLevelCalls).toHaveLength(0);
    expect(sandbox.maps[1].setLevelCalls).toHaveLength(1);
  });

  it('U55-5 최대 확대(레벨 1)에서 탭하면 setLevel 자체를 호출하지 않는다(하한 클램프)', () => {
    const sandbox = createMapSandbox();
    sandbox.loadSdk();
    sandbox.init({ center: { ...CENTER, zoom: 1 }, markers: makeMarkers({ count: 3 }), me: null });

    sandbox.fireClusterEvent({ type: 'clusterclick', center: CLUSTER_CENTER });

    // 같은 레벨 재설정도 하지 않는다 — 불필요한 재렌더가 곧 깜박임이다.
    expect(sandbox.map?.setLevelCalls).toHaveLength(0);
  });

  it('U55-6 clusterclick 등록이 실패하면 클러스터러를 폐기하고 개별 핀으로 강등한다(탭 죽은 클러스터 0)', () => {
    const sandbox = boot({
      clusterer: { throwOnClusterListener: true },
      markers: makeMarkers({ count: 3 }),
    });

    // disableClickZoom을 끄는 setter가 SDK에 없으므로, 등록에 실패한 클러스터러는 되살릴 수 없다 → 폐기가 유일한 안전 상태.
    expect(sandbox.clusterer).toBeNull();
    expect(sandbox.clusterMode).toBe('none');
    expect(sandbox.pinIds).toHaveLength(3);
    sandbox.pinIds.forEach((id) => {
      expect(sandbox.pins[id].overlay.setMapCalls.at(-1)).toBe(sandbox.map);
    });
    // 지도 자체는 멀쩡하므로 에러 배너를 띄우지 않는다(기존 강등 정책 계승).
    expect(errorsOf({ posted: sandbox.posted })).toHaveLength(0);
  });

  it('U55 E1 강등 상태에서 클러스터 이벤트를 강제 발화해도 throw 0 · setLevel 0', () => {
    const unavailable = boot({ clusterer: { available: false }, markers: makeMarkers({ count: 3 }) });
    expect(() =>
      unavailable.fireClusterEvent({ type: 'clusterclick', center: CLUSTER_CENTER }),
    ).not.toThrow();
    expect(unavailable.map?.setLevelCalls).toHaveLength(0);

    const broken = boot({ clusterer: { constructThrows: true }, markers: makeMarkers({ count: 3 }) });
    expect(() =>
      broken.fireClusterEvent({ type: 'clusterclick', center: CLUSTER_CENTER }),
    ).not.toThrow();
    expect(broken.map?.setLevelCalls).toHaveLength(0);
  });

  it('U55 E2 런타임 강등 후 폐기된 클러스터러는 이벤트를 못 받는다(setLevel 0 · 고아 리스너만 잔존)', () => {
    const sandbox = boot({ markers: makeMarkers({ count: 4 }) });
    const orphan = sandbox.clusterer;
    if (orphan) orphan.throwOnAddMarkers = true;

    sandbox.setMarkers({ markers: makeMarkers({ count: 5 }) }); // addMarkers throw → 강등
    expect(sandbox.clusterer).toBeNull();

    // 실 SDK는 타깃별 디스패치이고, demoteClusterer의 clear()로 버블이 0이라 클릭 자체가 도달 불가다.
    //   → 폐기 후 남은 고아 리스너는 미세 누수일 뿐 확대를 일으키지 않는다.
    sandbox.fireClusterEvent({ type: 'clusterclick', center: CLUSTER_CENTER });
    expect(sandbox.map?.setLevelCalls).toHaveLength(0);
    expect(sandbox.listenerCount({ type: 'clusterclick' })).toBe(0);
    expect(sandbox.listenerCount({ target: orphan, type: 'clusterclick' })).toBe(1);
  });

  it('U55 E3 Cluster 인자 없이 발화돼도 throw 0 · setLevel 0(SDK 표면 변동 방어)', () => {
    const sandbox = boot({ markers: makeMarkers({ count: 3 }) });

    // center 생략 = 리스너가 cluster 없이 호출된 경우. 가드가 없으면 getCenter 접근에서 던진다.
    expect(() => sandbox.fireClusterEvent({ type: 'clusterclick' })).not.toThrow();
    expect(sandbox.map?.setLevelCalls).toHaveLength(0);
  });

  // ── 성능 회귀 방지: 100건 규모에서도 조정 비용은 delta에 비례한다(E11) ──────
  it('E11 100건 유지 + 1건 유입 시 DOM 생성은 1건뿐이다(전량 재생성이면 101)', () => {
    const sandbox = boot({ markers: makeMarkers({ count: 100 }) });
    expect(sandbox.counts.div).toBe(100);

    sandbox.setMarkers({ markers: makeMarkers({ count: 101 }) });

    expect(sandbox.counts.div).toBe(101);
    expect(sandbox.overlays).toHaveLength(101);
  });
});
