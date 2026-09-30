// src/navigation/screens/MapTabScreen/MapTabScreen.recovery.spec.tsx
// 지도 WebView 종료 복구 연결 검증(map-webview-recovery plan §5-1 C MRE1~MRE3) — **실물 MapWebView**를 거친다.
//   MapTabScreen.spec은 MapWebView를 더블로 바꿔 "넘기는 키가 바뀐다"까지만 본다. 키 → 안쪽 WebView 새 인스턴스 →
//   ref 재연결 → READY 뒤 INIT이 새 인스턴스에 들어가는 연결과, 떼어 낸 뒤 ref가 비어 주입이 0인 것은 여기서 본다(seam ①+②).
//   모킹은 바깥 경계만 — react-native-webview(외부 SDK: 인스턴스마다 번호·주입 기록) · 화면의 훅(핀·권한·주변·위시) ·
//   네비게이션 · 위시 담기 · env · safe-area · expo-linking. 실제 WebView 프로세스 종료는 디바이스 스모크 몫이다.
import React from 'react';
import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

/** 만들어진 WebView 인스턴스(마운트 순서대로 번호) — 인스턴스별 주입 기록. */
type MockWebViewInstance = { id: number; injected: string[] };
const mockWebViewInstances: MockWebViewInstance[] = [];

// react-native-webview 모킹 — 실물처럼 ref에 주입 핸들을 붙이고(forwardRef + useImperativeHandle) prop을 전부 전달한다.
//   인스턴스(마운트)마다 번호를 매기고 주입을 따로 기록해 "어느 WebView에 무엇이 들어갔나"를 본다.
jest.mock(
  'react-native-webview',
  () => {
    const Rn = require('react-native');
    const ReactLib = require('react');
    const WebView = ReactLib.forwardRef((props: any, ref: any) => {
      const instanceRef = ReactLib.useRef(null);
      if (instanceRef.current === null) {
        instanceRef.current = { id: mockWebViewInstances.length, injected: [] };
        mockWebViewInstances.push(instanceRef.current);
      }
      ReactLib.useImperativeHandle(ref, () => ({
        injectJavaScript: (script: string) => {
          instanceRef.current.injected.push(script);
        },
      }));
      return <Rn.View {...props} webviewInstanceId={instanceRef.current.id} />;
    });
    return { WebView };
  },
  { virtual: true },
);
jest.mock('expo-linking', () => ({ ...jest.requireActual('expo-linking'), openSettings: jest.fn() }));
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return { ...actual, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@/lib/env', () => ({ env: { KAKAO_JS_KEY: 'TEST_KEY' } }));
jest.mock('@/features/map/useMuklogPins', () => ({ useMuklogPins: jest.fn() }));
jest.mock('@/features/map/useLocationPermission', () => ({ useLocationPermission: jest.fn() }));
jest.mock('@/features/map/useNearbyPlaces', () => ({ useNearbyPlaces: jest.fn() }));
jest.mock('@/features/map/useWishPins', () => ({ useWishPins: jest.fn() }));
// 지도 탭은 화면에 있다(isFocused true) — 종료는 즉시 재마운트된다. 화면 밖 종료(Q1-B)는 MapTabScreen.spec G1~G4 몫이다.
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
  useNavigation: () => ({ navigate: jest.fn(), isFocused: () => true }),
}));
jest.mock('@/features/wishlist', () => ({
  useAddNearbyWish: () => ({
    requestAdd: jest.fn(),
    chooseLog: jest.fn(),
    dismiss: jest.fn(),
    choosing: null,
    submitting: false,
  }),
}));

import {
  LocationCoordsSource,
  LocationPermissionStatus,
  NearbyResearchOutcome,
  NearbyResearchState,
} from '@/features/map/types';
import { useLocationPermission } from '@/features/map/useLocationPermission';
import { useMuklogPins } from '@/features/map/useMuklogPins';
import { useNearbyPlaces } from '@/features/map/useNearbyPlaces';
import { useWishPins } from '@/features/map/useWishPins';

import { MapTabScreen } from './MapTabScreen';

// 카피는 문자 그대로 적는다(줄바꿈은 RNTL 기본 정규화가 공백 하나로 바꾼다).
const COPY = {
  loading: '지도를 불러오는 중이에요',
  restartApp: '지도를 불러오지 못했어요. 앱을 껐다가 다시 켜 주세요',
} as const;

const refreshCoordsMock = jest.fn();
// 개발 계측(`[nearby] …`) 콘솔 줄 — 출력 소음을 막고, 재마운트 계측 줄 수를 실제로 만들어진 WebView 수와 대조한다.
let logSpy: jest.SpyInstance;

/** 지금 붙어 있는 안쪽 WebView(실물 MapWebView가 testID "map-webview"를 준다). */
const webview = () => screen.getByTestId('map-webview');
/** 붙어 있는 WebView 요소에 플랫폼 종료 이벤트를 보낸다(우리 헬퍼라 인자는 객체 — code-convention). */
type FireTermination = ({ element }: { element: ReturnType<typeof webview> }) => void;
/** 지금 붙어 있는 WebView의 인스턴스 기록. */
const currentInstance = (): MockWebViewInstance =>
  mockWebViewInstances[webview().props.webviewInstanceId as number];
const scriptsOfType = ({ instance, type }: { instance: MockWebViewInstance; type: string }) =>
  instance.injected.filter((script) => script.includes(`"type":"${type}"`));
/** 지금 붙어 있는 WebView가 READY를 보낸다. */
const emitReady = () =>
  fireEvent(webview(), 'message', { nativeEvent: { data: JSON.stringify({ type: 'READY' }) } });
const pressLocate = async () => {
  await act(async () => {
    fireEvent.press(screen.getByTestId('map-locate-button'));
  });
};

beforeEach(() => {
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  mockWebViewInstances.length = 0;
  refreshCoordsMock.mockReset();
  (useMuklogPins as jest.Mock).mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
  (useLocationPermission as jest.Mock).mockReturnValue({
    status: LocationPermissionStatus.Granted,
    coords: { lat: 37.5, lng: 127.0 },
    coordsSource: LocationCoordsSource.Fresh,
    request: jest.fn(),
    refreshCoords: refreshCoordsMock,
  });
  (useNearbyPlaces as jest.Mock).mockReturnValue({
    setBounds: jest.fn(),
    preload: jest.fn(),
    research: jest.fn().mockResolvedValue(NearbyResearchOutcome.Skipped),
    researchState: NearbyResearchState.Hidden,
    researchAvailable: false,
    markers: [],
    items: [],
    status: 'idle',
  });
  (useWishPins as jest.Mock).mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
});
afterEach(() => {
  logSpy.mockRestore();
});

describe('MapTabScreen × MapWebView — 종료 복구 연결(map-webview-recovery)', () => {
  /**
   * READY(인스턴스 0) → 주어진 종료 이벤트 → 새 인스턴스의 READY까지 흘리며 연결을 확인한다.
   * @param fire 지금 붙어 있는 WebView 요소({ element })에 플랫폼 종료 이벤트를 보내는 함수
   */
  const expectRecoveredAfter = ({ fire }: { fire: FireTermination }) => {
    renderWithTheme(<MapTabScreen />);
    emitReady();
    const first = webview();
    const filterBar = screen.getByTestId('category-filter-bar');
    const instance0 = currentInstance();
    expect(instance0.id).toBe(0);
    expect(scriptsOfType({ instance: instance0, type: 'INIT' })).toHaveLength(1);
    const injectedIntoFirst = instance0.injected.length;

    fire({ element: first });

    expect(screen.getByText(COPY.loading)).toBeTruthy();
    // 안쪽 WebView만 새 요소다 — 오버레이(필터 바)는 같은 요소로 남아 다시 만들어지지 않는다.
    expect(webview() !== first).toBe(true);
    expect(screen.getByTestId('category-filter-bar') === filterBar).toBe(true);
    const instance1 = currentInstance();
    expect(instance1.id).toBe(1);
    expect(instance1.injected).toHaveLength(0);

    emitReady();

    expect(screen.queryByTestId('map-status-overlay')).toBeNull();
    // ref가 새 인스턴스로 다시 이어져 INIT이 새 WebView에만 1건 들어간다.
    expect(scriptsOfType({ instance: instance1, type: 'INIT' })).toHaveLength(1);
    // 끝난 WebView에는 종료 뒤 어떤 스크립트도 들어가지 않는다.
    expect(instance0.injected).toHaveLength(injectedIntoFirst);
  };

  it('MRE1 iOS 콘텐츠 프로세스 종료 → 로딩 · 안쪽 WebView만 새것 → 새 WebView의 READY 뒤 INIT은 새 인스턴스에만 1건', () => {
    expectRecoveredAfter({
      fire: ({ element }) => fireEvent(element, 'contentProcessDidTerminate', { nativeEvent: {} }),
    });
  });

  it.each([true, false])(
    'MRE2 Android 렌더 프로세스 종료(didCrash=%s)도 MRE1과 같게 복구된다',
    (didCrash) => {
      expectRecoveredAfter({
        fire: ({ element }) => fireEvent(element, 'renderProcessGone', { nativeEvent: { didCrash } }),
      });
    },
  );

  it('MRE3 종료 4번(상한 소진) → WebView 없음(컨테이너는 남음) · 소진 안내 · 현재위치 버튼을 눌러도 어떤 WebView에도 RECENTER 0 — 대조: 소진 전엔 지금 WebView에 1건', async () => {
    refreshCoordsMock.mockResolvedValue({
      coords: { lat: 37.6, lng: 127.1 },
      source: LocationCoordsSource.Fresh,
    });
    renderWithTheme(<MapTabScreen />);
    emitReady();

    // 대조군: 소진 전 같은 탭은 지금 붙어 있는 WebView에 RECENTER 1건 — 이게 없으면 아래 0건 단언이 늘 초록이다.
    await pressLocate();
    expect(scriptsOfType({ instance: currentInstance(), type: 'RECENTER' })).toHaveLength(1);

    for (let i = 0; i < 4; i += 1) {
      fireEvent(webview(), 'contentProcessDidTerminate', { nativeEvent: {} });
    }

    expect(mockWebViewInstances).toHaveLength(4);
    expect(screen.queryByTestId('map-webview')).toBeNull();
    expect(screen.getByTestId('map-webview-container')).toBeTruthy();
    expect(screen.getByText(COPY.restartApp)).toBeTruthy();
    const recenterCounts = () =>
      mockWebViewInstances.map((instance) => scriptsOfType({ instance, type: 'RECENTER' }).length);
    const before = recenterCounts();

    await pressLocate();

    // 위치는 다시 받지만(기존 동작) 떼어 낸 WebView의 ref가 비어 있어 어디에도 주입되지 않는다.
    expect(refreshCoordsMock).toHaveBeenCalledTimes(2);
    expect(recenterCounts()).toEqual(before);
    expect(before).toEqual([1, 0, 0, 0]);
    // 디바이스 스모크의 판정식(plan §7.8): 재마운트 계측 줄 수 = 새로 만든 WebView 수 = 카카오 SDK 페이지 재요청 수.
    const remountLines = logSpy.mock.calls.filter(
      (call) => String(call[0]) === '[nearby] map:webview-remount',
    );
    expect(remountLines).toHaveLength(mockWebViewInstances.length - 1);
  });
});
