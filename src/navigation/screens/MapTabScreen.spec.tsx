// src/navigation/screens/MapTabScreen.spec.tsx
// 지도 탭 상태 오케스트레이션 — 훅(useMuklogPins·useLocationPermission)·지도뷰 모킹으로 상태별 렌더 검증.
//   (plan §4·§5-1 MapTabScreen) loading/denied/empty/마커탭→선택카드/error+refresh.
//   네이티브 지도 렌더는 스모크(디바이스) → WebView는 MapWebView 모킹으로 대체, onMessage만 직접 호출.
import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

// react-native-webview 모킹(requireActual('@/features/map/components')가 실 MapWebView를 로드 → 네이티브 모듈 부재 방지).
jest.mock(
  'react-native-webview',
  () => {
    const Rn = require('react-native');
    return { WebView: (props: any) => <Rn.View {...props} /> };
  },
  { virtual: true },
);

// env 모킹 — KAKAO_JS_KEY만 필요(실 env throw 회피, setup 더미와 무관하게 결정적).
jest.mock('@/lib/env', () => ({ env: { KAKAO_JS_KEY: 'TEST_KEY' } }));

// 훅 모킹 — 상태 주입 지점.
jest.mock('@/features/map/useMuklogPins', () => ({ useMuklogPins: jest.fn() }));
jest.mock('@/features/map/useLocationPermission', () => ({ useLocationPermission: jest.fn() }));
// slice2: nearby 훅 모킹(setBounds 호출/마커 주입/카드 분기 검증 지점).
jest.mock('@/features/map/useNearbyPlaces', () => ({ useNearbyPlaces: jest.fn() }));

// injectJavaScript로 주입된 스크립트 캡처(slice2: SET_MARKERS 머지 마커 주입 검증).
const injectedScripts: string[] = [];

// MapWebView 모킹 — onMessage를 testID로 노출해 직접 발화(MARKER_TAP 등)하고,
//   webviewRef.injectJavaScript를 캡처해 SET_MARKERS 주입을 검증한다.
jest.mock('@/features/map/components', () => {
  const Rn = require('react-native');
  const ReactLib = require('react');
  const actual = jest.requireActual('@/features/map/components');
  return {
    ...actual,
    MapWebView: ({ onMessage, webviewRef, children }: any) => {
      ReactLib.useImperativeHandle(webviewRef, () => ({
        injectJavaScript: (script: string) => {
          injectedScripts.push(script);
        },
      }));
      return (
        <Rn.View testID="map-webview-mock" onMessage={onMessage}>
          {children}
        </Rn.View>
      );
    },
  };
});

import { useMuklogPins } from '@/features/map/useMuklogPins';
import { useLocationPermission } from '@/features/map/useLocationPermission';
import { useNearbyPlaces } from '@/features/map/useNearbyPlaces';
import { LocationPermissionStatus, type MapMarker } from '@/features/map/types';

import { MapTabScreen } from './MapTabScreen';

const useMuklogPinsMock = useMuklogPins as jest.Mock;
const useLocationPermissionMock = useLocationPermission as jest.Mock;
const useNearbyPlacesMock = useNearbyPlaces as jest.Mock;

const setBoundsSpy = jest.fn();
// nearby 훅 상태 주입(기본: idle·빈 마커·빈 items). 테스트에서 markers/items/status 오버라이드.
const setNearby = (over?: { markers?: MapMarker[]; items?: unknown[]; status?: string }) => {
  useNearbyPlacesMock.mockReturnValue({
    setBounds: setBoundsSpy,
    markers: over?.markers ?? [],
    items: over?.items ?? [],
    status: over?.status ?? 'idle',
  });
};

const nearbyItem = (over?: Record<string, unknown>) => ({
  kakaoPlaceId: 'k7',
  placeName: '연남 칼국수',
  categoryName: '음식점 > 한식 > 칼국수',
  categoryGroupCode: 'FD6',
  lat: 37.5,
  lng: 127.0,
  distance: 320,
  ...over,
});

const pin = (over?: Record<string, unknown>) => ({
  muklogId: 'm1',
  roomId: 'r1',
  placeName: '트라토리아 보나',
  category: 'pasta',
  area: '연남동',
  rating: 5,
  lat: 37.5,
  lng: 127.0,
  ...over,
});

const setPermission = (over?: Record<string, unknown>) => {
  useLocationPermissionMock.mockReturnValue({
    status: LocationPermissionStatus.Granted,
    coords: { lat: 37.5, lng: 127.0 },
    request: jest.fn(),
    ...over,
  });
};

// MapWebView 모킹이 노출한 onMessage를 통해 WebView 메시지를 발화한다.
const emitMessage = ({ raw }: { raw: string }) => {
  const webview = screen.getByTestId('map-webview-mock');
  fireEvent(webview, 'message', { nativeEvent: { data: raw } });
};

beforeEach(() => {
  useMuklogPinsMock.mockReset();
  useLocationPermissionMock.mockReset();
  useNearbyPlacesMock.mockReset();
  setBoundsSpy.mockReset();
  injectedScripts.length = 0;
  setPermission();
  setNearby();
});

describe('MapTabScreen', () => {
  it('범례 라벨(우리 맛집/주변 음식점)을 렌더한다', () => {
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    renderWithTheme(<MapTabScreen />);
    expect(screen.getByText('우리 맛집')).toBeTruthy();
    expect(screen.getByText('주변 음식점')).toBeTruthy();
  });

  it('핀 loading이면 로딩 오버레이를 띄운다 (지도는 함께 렌더)', () => {
    useMuklogPinsMock.mockReturnValue({ state: { status: 'loading' }, refresh: jest.fn() });
    renderWithTheme(<MapTabScreen />);
    expect(screen.getByTestId('map-status-spinner')).toBeTruthy();
    expect(screen.getByTestId('map-webview-mock')).toBeTruthy();
  });

  it('권한 거부면 현재위치 안내를 노출하되 지도는 계속 렌더한다(차단 아님)', () => {
    setPermission({ status: LocationPermissionStatus.Denied, coords: null });
    useMuklogPinsMock.mockReturnValue({
      state: { status: 'ready', pins: [pin()] },
      refresh: jest.fn(),
    });
    renderWithTheme(<MapTabScreen />);
    expect(screen.getByText('위치 권한을 허용하면 현재 위치를 볼 수 있어요')).toBeTruthy();
    expect(screen.getByTestId('map-webview-mock')).toBeTruthy();
  });

  it('빈 상태(pins:[])여도 빈 안내를 노출하지 않는다(사용자 요청으로 제거 — 지도만 표시)', () => {
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    renderWithTheme(<MapTabScreen />);
    expect(screen.queryByText('좌표가 있는 먹로그가 아직 없어요')).toBeNull();
    expect(screen.getByTestId('map-webview-mock')).toBeTruthy();
  });

  it('MARKER_TAP(saved:true) 수신 시 선택 스팟 카드에 해당 먹로그를 표시한다', () => {
    useMuklogPinsMock.mockReturnValue({
      state: { status: 'ready', pins: [pin({ muklogId: 'm9', placeName: '스시 오마카세' })] },
      refresh: jest.fn(),
    });
    renderWithTheme(<MapTabScreen />);
    // 탭 전엔 선택 카드 없음.
    expect(screen.queryByTestId('selected-spot-card')).toBeNull();
    emitMessage({ raw: JSON.stringify({ type: 'MARKER_TAP', id: 'm9', saved: true }) });
    expect(screen.getByTestId('selected-spot-card')).toBeTruthy();
    expect(screen.getByText('스시 오마카세')).toBeTruthy();
  });

  it('잘못된(비JSON) 메시지는 무시한다(선택 카드 미표시·throw 없음)', () => {
    useMuklogPinsMock.mockReturnValue({
      state: { status: 'ready', pins: [pin()] },
      refresh: jest.fn(),
    });
    renderWithTheme(<MapTabScreen />);
    emitMessage({ raw: 'not-json{' });
    expect(screen.queryByTestId('selected-spot-card')).toBeNull();
  });

  it('핀 에러면 에러 배너 + 다시 시도 → refresh를 호출한다', () => {
    const refresh = jest.fn();
    useMuklogPinsMock.mockReturnValue({
      state: { status: 'error', message: '먹로그를 불러오지 못했어요' },
      refresh,
    });
    renderWithTheme(<MapTabScreen />);
    expect(screen.getByTestId('map-status-action')).toBeTruthy();
    fireEvent.press(screen.getByText('다시 시도'));
    expect(refresh).toHaveBeenCalled();
  });

  it('지도 SDK ERROR 메시지 수신 시 지도 에러 오버레이를 띄운다', () => {
    useMuklogPinsMock.mockReturnValue({
      state: { status: 'ready', pins: [pin()] },
      refresh: jest.fn(),
    });
    renderWithTheme(<MapTabScreen />);
    emitMessage({ raw: JSON.stringify({ type: 'ERROR', reason: 'SDK_LOAD_FAILED' }) });
    expect(screen.getByText('지도를 불러오지 못했어요')).toBeTruthy();
  });

  it('진입 시 위치 권한을 1회 요청한다(undetermined일 때)', () => {
    const request = jest.fn();
    setPermission({ status: LocationPermissionStatus.Undetermined, coords: null, request });
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    renderWithTheme(<MapTabScreen />);
    expect(request).toHaveBeenCalledTimes(1);
  });

  // ── slice2 증분 ────────────────────────────────────────────────
  it('BOUNDS_CHANGED 수신 시 useNearbyPlaces.setBounds를 sw/ne로 호출한다', () => {
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    renderWithTheme(<MapTabScreen />);
    const sw = { lat: 37.5, lng: 126.9 };
    const ne = { lat: 37.6, lng: 127.1 };
    emitMessage({ raw: JSON.stringify({ type: 'BOUNDS_CHANGED', sw, ne }) });
    expect(setBoundsSpy).toHaveBeenCalledWith({ sw, ne });
  });

  it('saved 핀 + nearby 마커를 머지해 SET_MARKERS로 주입한다', () => {
    useMuklogPinsMock.mockReturnValue({
      state: { status: 'ready', pins: [pin({ muklogId: 'm1', lat: 37.5, lng: 127.0 })] },
      refresh: jest.fn(),
    });
    setNearby({
      status: 'ready',
      markers: [{ id: 'k1', lat: 38.0, lng: 128.0, emoji: '🍜', saved: false }],
    });
    renderWithTheme(<MapTabScreen />);
    // READY → INIT 주입(머지 마커 포함). saved id(m1) + nearby id(k1) 둘 다 직렬화.
    emitMessage({ raw: JSON.stringify({ type: 'READY' }) });
    const joined = injectedScripts.join('\n');
    expect(joined).toContain('"id":"m1"');
    expect(joined).toContain('"id":"k1"');
    expect(joined).toContain('"saved":false');
  });

  it('MARKER_TAP(saved:false) 수신 시 NearbySpotCard(거리)를 표시한다', () => {
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    setNearby({
      status: 'ready',
      markers: [{ id: 'k7', lat: 37.5, lng: 127.0, emoji: '🍜', saved: false }],
      items: [nearbyItem()],
    });
    renderWithTheme(<MapTabScreen />);
    expect(screen.queryByTestId('nearby-spot-card')).toBeNull();
    emitMessage({ raw: JSON.stringify({ type: 'MARKER_TAP', id: 'k7', saved: false }) });
    expect(screen.getByTestId('nearby-spot-card')).toBeTruthy();
    expect(screen.getByText('연남 칼국수')).toBeTruthy();
    expect(screen.getByText(/320m/)).toBeTruthy();
  });

  it('nearby 에러여도 slice1 오버레이/saved 카드를 깨뜨리지 않는다(회귀 0)', () => {
    setPermission({ status: LocationPermissionStatus.Denied, coords: null });
    useMuklogPinsMock.mockReturnValue({
      state: { status: 'ready', pins: [pin()] },
      refresh: jest.fn(),
    });
    setNearby({ status: 'error', markers: [] });
    renderWithTheme(<MapTabScreen />);
    // slice1 권한 안내는 그대로(nearby 에러가 덮지 않음).
    expect(screen.getByText('위치 권한을 허용하면 현재 위치를 볼 수 있어요')).toBeTruthy();
    expect(screen.getByTestId('map-webview-mock')).toBeTruthy();
  });
});
