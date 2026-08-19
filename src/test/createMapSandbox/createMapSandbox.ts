// src/test/createMapSandbox/createMapSandbox.ts
// 테스트 전용 — mapHtml 템플릿 안 인라인 <script>를 Node vm에서 실제로 실행시키는 샌드박스.
//   지금까지 mapHtml 검증은 문자열 toContain + `node --check`뿐이라 "코드가 무엇을 하는지"는 한 줄도
//   검증되지 않았다(메모리 qa-layout-blind-spot의 렌더 사각지대와 같은 계열). 증분 마커 조정은 분기·상태가
//   있는 알고리즘이라 문자열 단언으로는 회귀를 못 잡는다 → 실행 커버리지를 준다.
//
//   ⚠️ 한계: 여기 있는 kakao.maps는 Kakao SDK의 *문서화된 표면*을 모사할 뿐 실제 동작이 아니다.
//      실 SDK 동작(클러스터 버블 배치·탭 줌인·타일 렌더)의 단독 권위는 여전히 디바이스 스모크다.
//   ⚠️ 앱 번들 도달 경로 0 — spec에서만 import한다(src/test/setDevMode.ts와 동일한 위치·성격).
//      파일명이 *.spec.*/*.test.*가 아니라 jest testMatch에도 잡히지 않는다.
import vm from 'vm';

import { mapHtml } from '@/features/map/mapHtml';
import type { Coords, MapMarker, Region } from '@/features/map/types';

const INLINE_SCRIPT_OPEN = '<script>';
const INLINE_SCRIPT_CLOSE = '</script>';
const SANDBOX_JS_KEY = 'SANDBOX_JS_KEY';

/** 가짜 DOM element — mapHtml이 실제로 건드리는 표면(className/dataset/textContent/classList/click)만 모사. */
export type FakeElement = {
  tagName: string;
  className: string;
  textContent: string;
  dataset: Record<string, string>;
  style: { cssText: string };
  classList: {
    add: (name: string) => void;
    remove: (name: string) => void;
    contains: (name: string) => boolean;
  };
  addEventListener: (type: string, handler: (event: unknown) => void) => void;
  /** 등록된 click 리스너를 발화하고 stopPropagation 호출 여부를 돌려준다(MAP_TAP 경합 단언용). */
  click: () => { propagationStopped: boolean };
  src?: string;
  onload?: () => void;
  onerror?: () => void;
};

/** 가짜 CustomOverlay — 호출 이력을 남겨 "유지 핀 미접촉"을 길이 0으로 단언할 수 있게 한다. */
export type FakeOverlay = {
  id: number;
  options: Record<string, unknown>;
  content: FakeElement | null;
  setMapCalls: unknown[];
  setZIndexCalls: number[];
  setPositionCalls: unknown[];
  setMap: (map: unknown) => void;
  setZIndex: (zIndex: number) => void;
  setPosition: (position: unknown) => void;
};

/** 가짜 kakao.maps.Map — 재-INIT이 만드는 "새 인스턴스"를 id로 구분한다(AC11). */
export type FakeMap = {
  id: number;
  container: unknown;
  options: Record<string, unknown>;
  relayoutCalls: number;
  setCenterCalls: unknown[];
  panToCalls: unknown[];
  relayout: () => void;
  setCenter: (center: unknown) => void;
  panTo: (position: unknown) => void;
  getBounds: () => unknown;
};

/** 가짜 MarkerClusterer — 메서드 실존/throw를 주입해 partial·full·강등 3경로를 전부 돌린다. */
export type FakeClusterer = {
  id: number;
  options: Record<string, unknown>;
  addMarkersCalls: Array<{ markers: FakeOverlay[]; nodraw: unknown }>;
  removeMarkersCalls: Array<{ markers: FakeOverlay[]; nodraw: unknown }>;
  clearCalls: number;
  redrawCalls: number;
  setMapCalls: unknown[];
  /** 런타임에 뒤집어 강등(E4)을 유발한다 — 첫 렌더는 성공시키고 두 번째부터 던지게 할 수 있다. */
  throwOnAddMarkers: boolean;
  throwOnRemoveMarkers: boolean;
  addMarkers?: (markers: FakeOverlay[], nodraw?: unknown) => void;
  removeMarkers?: (markers: FakeOverlay[], nodraw?: unknown) => void;
  clear: () => void;
  redraw?: () => void;
  setMap?: (map: unknown) => void;
};

/** 클러스터러 가짜 구성 — 미지정 항목은 "정상 SDK"(전 메서드 실존·throw 없음)로 채운다. */
export type ClustererConfig = {
  /** false면 kakao.maps.MarkerClusterer 자체가 없다(라이브러리 미로드 — E5). */
  available?: boolean;
  /** 생성자가 던진다(생성 실패 강등). */
  constructThrows?: boolean;
  /** false면 removeMarkers 부재 → mkClusterMode가 'full'로 확정된다(§4.4). */
  hasRemoveMarkers?: boolean;
  /** false면 redraw 부재 → nodraw 인자 없이 호출된다(§4.4). */
  hasRedraw?: boolean;
  /** false면 setMap 부재 → 재-INIT에서 폐기 후 재생성된다. */
  hasSetMap?: boolean;
  throwOnAddMarkers?: boolean;
  throwOnRemoveMarkers?: boolean;
};

/** WebView 레지스트리(mkPins) 1건. */
export type SandboxPin = {
  el: FakeElement;
  overlay: FakeOverlay;
  kind: string;
  sig: string;
};

export type MapSandbox = {
  /** SDK <script>의 onload를 발화한다 → kakao.maps.load → READY post. */
  loadSdk: () => void;
  /** SDK <script>의 onerror를 발화한다 → ERROR(SDK_LOAD_FAILED) post. */
  failSdk: () => void;
  init: (payload: { center: Region; markers: MapMarker[]; me?: Coords | null }) => void;
  setMarkers: (payload: { markers: MapMarker[] }) => void;
  setSelected: (payload: { selectedId: string | null }) => void;
  recenter: (payload: { me: Coords }) => void;
  /** setTimeout 큐를 비운다(INIT의 relayout/emitBounds 지연 경로). */
  runTimers: () => void;
  /** kakao.maps.event.addListener로 등록된 지도 이벤트를 발화한다. */
  fireMapEvent: (payload: { type: string }) => void;
  /** 이후 생성/조작되는 모든 오버레이의 setMap이 던지게 한다(부착 실패 경로 — qa-logic L1). */
  setOverlayFault: (payload: { throwOnSetMap: boolean }) => void;
  posted: Array<Record<string, unknown>>;
  /** document.createElement 태그별 누적 생성 수 — DOM 재생성 0을 여기서 단언한다. */
  counts: Record<string, number>;
  elements: FakeElement[];
  overlays: FakeOverlay[];
  maps: FakeMap[];
  clusterers: FakeClusterer[];
  readonly map: FakeMap | null;
  readonly clusterer: FakeClusterer | null;
  readonly pins: Record<string, SandboxPin>;
  readonly pinIds: string[];
  readonly clusterMode: string;
  readonly selectedId: string | null;
};

/**
 * mapHtml 결과에서 인라인 <script> 본문만 잘라낸다(SDK 스크립트는 createElement로 만들어지므로 1개뿐).
 * @param html mapHtml({ jsKey })가 만든 완성 HTML
 * @returns 실행 가능한 JS 소스
 */
const extractInlineScript = ({ html }: { html: string }): string => {
  const open = html.indexOf(INLINE_SCRIPT_OPEN);
  const close = html.indexOf(INLINE_SCRIPT_CLOSE, open);
  if (open === -1 || close === -1) throw new Error('mapHtml: 인라인 <script> 블록을 찾지 못했다');
  return html.slice(open + INLINE_SCRIPT_OPEN.length, close);
};

/**
 * 가짜 DOM element를 만든다(classList는 className 문자열을 단일 출처로 파생).
 * @param tagName 생성할 태그명
 * @returns FakeElement
 */
const createFakeElement = ({ tagName }: { tagName: string }): FakeElement => {
  const listeners: Record<string, Array<(event: unknown) => void>> = {};
  const classNames = (): string[] => el.className.split(' ').filter((name) => name !== '');
  const el: FakeElement = {
    tagName,
    className: '',
    textContent: '',
    dataset: {},
    style: { cssText: '' },
    classList: {
      add: (name: string) => {
        const parts = classNames();
        if (!parts.includes(name)) parts.push(name);
        el.className = parts.join(' ');
      },
      remove: (name: string) => {
        el.className = classNames()
          .filter((part) => part !== name)
          .join(' ');
      },
      contains: (name: string) => classNames().includes(name),
    },
    addEventListener: (type: string, handler: (event: unknown) => void) => {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(handler);
    },
    click: () => {
      let propagationStopped = false;
      const event = {
        stopPropagation: () => {
          propagationStopped = true;
        },
      };
      (listeners.click ?? []).forEach((handler) => handler(event));
      return { propagationStopped };
    },
  };
  return el;
};

/**
 * mapHtml의 WebView 스크립트를 실행하는 샌드박스를 만든다(가짜 document·kakao.maps·ReactNativeWebView 위에서).
 * @param clusterer MarkerClusterer 가짜 구성(메서드 실존·throw 주입). 미지정 시 정상 SDK로 동작
 * @returns RN→WebView 핸들러 호출기와 관측 지점(posted/counts/pins/clusterer/map 등)
 */
export const createMapSandbox = ({
  clusterer,
}: { clusterer?: ClustererConfig } = {}): MapSandbox => {
  const config = {
    available: true,
    constructThrows: false,
    hasRemoveMarkers: true,
    hasRedraw: true,
    hasSetMap: true,
    throwOnAddMarkers: false,
    throwOnRemoveMarkers: false,
    ...(clusterer ?? {}),
  };

  const posted: Array<Record<string, unknown>> = [];
  const counts: Record<string, number> = {};
  const elements: FakeElement[] = [];
  const overlays: FakeOverlay[] = [];
  const maps: FakeMap[] = [];
  const clusterers: FakeClusterer[] = [];
  const scripts: FakeElement[] = [];
  const mapListeners: Array<{ target: unknown; type: string; handler: () => void }> = [];
  const timers: Array<() => void> = [];
  const mapContainer = createFakeElement({ tagName: 'div' });

  // ── 가짜 Kakao SDK 생성자들 ──────────────────────────────────────────────────
  // Kakao SDK는 `new kakao.maps.X(...)`로만 쓰이므로 화살표가 아닌 function 표현식이 필요하다
  //   (외부 API가 형태를 강제 — 컨벤션 예외). 생성자가 객체를 반환하면 `new`의 결과가 그 객체가 되므로
  //   `this` 타이핑 없이 순수 팩토리로 쓸 수 있다.
  const LatLngCtor = function (lat: number, lng: number) {
    return { lat, lng, getLat: () => lat, getLng: () => lng };
  };

  const MapCtor = function (container: unknown, options: Record<string, unknown>) {
    const center = options.center as { lat: number; lng: number };
    const instance: FakeMap = {
      id: maps.length + 1,
      container,
      options,
      relayoutCalls: 0,
      setCenterCalls: [],
      panToCalls: [],
      relayout: () => {
        instance.relayoutCalls += 1;
      },
      setCenter: (next: unknown) => {
        instance.setCenterCalls.push(next);
      },
      panTo: (position: unknown) => {
        instance.panToCalls.push(position);
      },
      getBounds: () => ({
        getSouthWest: () => ({ getLat: () => center.lat - 0.01, getLng: () => center.lng - 0.01 }),
        getNorthEast: () => ({ getLat: () => center.lat + 0.01, getLng: () => center.lng + 0.01 }),
      }),
    };
    maps.push(instance);
    return instance;
  };

  // 오버레이 공통 고장 주입 — 생성 시점과 무관하게 런타임에 뒤집을 수 있어야 "부착 도중 실패"를 만든다.
  const overlayFault = { throwOnSetMap: false };

  const CustomOverlayCtor = function (options: Record<string, unknown>) {
    const instance: FakeOverlay = {
      id: overlays.length + 1,
      options,
      content: (options.content as FakeElement | undefined) ?? null,
      setMapCalls: [],
      setZIndexCalls: [],
      setPositionCalls: [],
      setMap: (map: unknown) => {
        instance.setMapCalls.push(map); // 시도는 기록하고 던진다(호출 여부와 성공 여부를 구분할 수 있게).
        if (overlayFault.throwOnSetMap) throw new Error('setMap 거부(sandbox)');
      },
      setZIndex: (zIndex: number) => {
        instance.setZIndexCalls.push(zIndex);
      },
      setPosition: (position: unknown) => {
        instance.setPositionCalls.push(position);
      },
    };
    overlays.push(instance);
    return instance;
  };

  const MarkerClustererCtor = function (options: Record<string, unknown>) {
    if (config.constructThrows) throw new Error('MarkerClusterer 생성 실패(sandbox)');
    const instance: FakeClusterer = {
      id: clusterers.length + 1,
      options,
      addMarkersCalls: [],
      removeMarkersCalls: [],
      clearCalls: 0,
      redrawCalls: 0,
      setMapCalls: [],
      throwOnAddMarkers: config.throwOnAddMarkers,
      throwOnRemoveMarkers: config.throwOnRemoveMarkers,
      clear: () => {
        instance.clearCalls += 1;
      },
    };
    instance.addMarkers = (markers: FakeOverlay[], nodraw?: unknown) => {
      instance.addMarkersCalls.push({ markers: markers.slice(), nodraw });
      if (instance.throwOnAddMarkers) throw new Error('addMarkers 거부(sandbox)');
    };
    if (config.hasRemoveMarkers) {
      instance.removeMarkers = (markers: FakeOverlay[], nodraw?: unknown) => {
        instance.removeMarkersCalls.push({ markers: markers.slice(), nodraw });
        if (instance.throwOnRemoveMarkers) throw new Error('removeMarkers 거부(sandbox)');
      };
    }
    if (config.hasRedraw) {
      instance.redraw = () => {
        instance.redrawCalls += 1;
      };
    }
    if (config.hasSetMap) {
      instance.setMap = (map: unknown) => {
        instance.setMapCalls.push(map);
      };
    }
    clusterers.push(instance);
    return instance;
  };

  const kakao: Record<string, unknown> = {
    maps: {
      LatLng: LatLngCtor,
      Map: MapCtor,
      CustomOverlay: CustomOverlayCtor,
      ...(config.available ? { MarkerClusterer: MarkerClustererCtor } : {}),
      event: {
        addListener: (target: unknown, type: string, handler: () => void) => {
          mapListeners.push({ target, type, handler });
        },
      },
      load: (callback: () => void) => callback(),
    },
  };

  const fakeDocument = {
    createElement: (tagName: string) => {
      counts[tagName] = (counts[tagName] ?? 0) + 1;
      const el = createFakeElement({ tagName });
      elements.push(el);
      if (tagName === 'script') scripts.push(el);
      return el;
    },
    getElementById: (id: string) => (id === 'map' ? mapContainer : null),
    head: {
      appendChild: () => undefined,
    },
  };

  const context: Record<string, unknown> = {
    kakao,
    document: fakeDocument,
    ReactNativeWebView: {
      postMessage: (payload: string) => {
        posted.push(JSON.parse(payload) as Record<string, unknown>);
      },
    },
    setTimeout: (handler: () => void) => {
      timers.push(handler);
      return timers.length;
    },
    console,
  };
  context.window = context; // window.X = ... 가 컨텍스트 전역에 그대로 꽂히도록 자기참조.

  vm.createContext(context);
  vm.runInContext(extractInlineScript({ html: mapHtml({ jsKey: SANDBOX_JS_KEY }) }), context);

  const callHandler = ({ name, payload }: { name: string; payload: unknown }): void => {
    const handler = context[name];
    if (typeof handler !== 'function') throw new Error(name + ' 핸들러가 정의되지 않았다');
    (handler as (value: unknown) => void)(payload);
  };

  const sdkScript = (): FakeElement => {
    const script = scripts[scripts.length - 1];
    if (!script) throw new Error('SDK <script>가 생성되지 않았다');
    return script;
  };

  return {
    loadSdk: () => {
      const onload = sdkScript().onload;
      if (onload) onload();
    },
    failSdk: () => {
      const onerror = sdkScript().onerror;
      if (onerror) onerror();
    },
    init: ({ center, markers, me }) =>
      callHandler({ name: '__muklogInit', payload: { center, markers, me: me ?? null } }),
    setMarkers: ({ markers }) => callHandler({ name: '__muklogSetMarkers', payload: { markers } }),
    setSelected: ({ selectedId }) =>
      callHandler({ name: '__muklogSetSelected', payload: { selectedId } }),
    recenter: ({ me }) => callHandler({ name: '__muklogRecenter', payload: { me } }),
    runTimers: () => {
      while (timers.length > 0) {
        const handler = timers.shift();
        if (handler) handler();
      }
    },
    fireMapEvent: ({ type }) => {
      mapListeners.filter((entry) => entry.type === type).forEach((entry) => entry.handler());
    },
    setOverlayFault: ({ throwOnSetMap }) => {
      overlayFault.throwOnSetMap = throwOnSetMap;
    },
    posted,
    counts,
    elements,
    overlays,
    maps,
    clusterers,
    get map() {
      return (context.mkMap as FakeMap | null) ?? null;
    },
    get clusterer() {
      return (context.mkClusterer as FakeClusterer | null) ?? null;
    },
    get pins() {
      return (context.mkPins as Record<string, SandboxPin>) ?? {};
    },
    get pinIds() {
      return Object.keys((context.mkPins as Record<string, SandboxPin>) ?? {}).sort();
    },
    get clusterMode() {
      return context.mkClusterMode as string;
    },
    get selectedId() {
      return (context.mkSelectedId as string | null) ?? null;
    },
  };
};
