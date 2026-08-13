// src/navigation/screens/MapTabScreen.spec.tsx
// 지도 탭 상태 오케스트레이션 — 훅(useMuklogPins·useLocationPermission)·지도뷰 모킹으로 상태별 렌더 검증.
//   (plan §4·§5-1 MapTabScreen) loading/denied/empty/마커탭→선택카드/error+refresh.
//   네이티브 지도 렌더는 스모크(디바이스) → WebView는 MapWebView 모킹으로 대체, onMessage만 직접 호출.
import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

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
// map-wish-pins: 위시 핀 훅 모킹(크로스-로그 조회는 useWishPins 단위 테스트가 검증 — 여기선 핀 합류·카드 분기·refresh 배선만).
jest.mock('@/features/map/useWishPins', () => ({ useWishPins: jest.fn() }));
// map-wish-pins: 포커스 refresh 배선 — 실제 NavigationContainer 없이 콜백만 캡처해 수동 발화.
const mockFocus: { cb: null | (() => void) } = { cb: null };
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => {
    mockFocus.cb = cb;
  },
}));

// map-nearby-wish: 위시 담기 오케스트레이션 훅 모킹 — 분기·중복 pre-check·insert·토스트는
//   useAddNearbyWish 단위 테스트가 검증한다. 여기선 화면 배선(액션→requestAdd, choosing→시트, 선택→chooseLog)만 본다.
//   map-wish-pins: onAdded(담기 성공 후 위시 refresh) 배선 지점도 캡처해 검증한다.
const mockRequestAdd = jest.fn();
const mockChooseLog = jest.fn();
const mockDismiss = jest.fn();
const mockNearbyWish: { choosing: unknown; submitting: boolean; onAdded: null | (() => void) } = {
  choosing: null,
  submitting: false,
  onAdded: null,
};
jest.mock('@/features/wishlist', () => ({
  useAddNearbyWish: (opts?: { onAdded?: () => void }) => {
    mockNearbyWish.onAdded = opts?.onAdded ?? null;
    return {
      requestAdd: mockRequestAdd,
      chooseLog: mockChooseLog,
      dismiss: mockDismiss,
      choosing: mockNearbyWish.choosing,
      submitting: mockNearbyWish.submitting,
    };
  },
}));

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
import { useWishPins } from '@/features/map/useWishPins';
import {
  LocationCoordsSource,
  LocationPermissionStatus,
  MapPinKind,
  type MapMarker,
} from '@/features/map/types';

import { MapTabScreen } from './MapTabScreen';

const useMuklogPinsMock = useMuklogPins as jest.Mock;
const useLocationPermissionMock = useLocationPermission as jest.Mock;
const useNearbyPlacesMock = useNearbyPlaces as jest.Mock;
const useWishPinsMock = useWishPins as jest.Mock;

const wishRefreshSpy = jest.fn();
const muklogRefreshSpy = jest.fn();
// 위시 핀 상태 주입(기본: ready·빈 핀). 테스트에서 pins/state 오버라이드.
const setWishPins = (over?: { pins?: unknown[]; state?: unknown }) => {
  useWishPinsMock.mockReturnValue({
    state: over?.state ?? { status: 'ready', pins: over?.pins ?? [] },
    refresh: wishRefreshSpy,
  });
};

const wishPin = (over?: Record<string, unknown>) => ({
  id: 'w7',
  roomId: 'r1',
  placeName: '연남 파스타',
  category: 'pasta',
  area: '연남동',
  lat: 37.5,
  lng: 127.0,
  ...over,
});

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

const requestSpy = jest.fn();
const refreshCoordsSpy = jest.fn();
// 훅 반환 주입 헬퍼. coordsSource를 명시하지 않으면 좌표 유무에서 파생한다(좌표 있음=fresh 픽스가
//   기본 시나리오, 없음=null) — 실제 훅이 좌표·출처를 짝으로 내보내는 계약과 일치시킨다(map-initial-location §3.4).
const setPermission = (over?: Record<string, unknown>) => {
  const merged = {
    status: LocationPermissionStatus.Granted,
    coords: { lat: 37.5, lng: 127.0 } as unknown,
    request: requestSpy,
    refreshCoords: refreshCoordsSpy,
    ...over,
  };
  const coordsSource =
    over && 'coordsSource' in over
      ? over.coordsSource
      : merged.coords
        ? LocationCoordsSource.Fresh
        : null;
  useLocationPermissionMock.mockReturnValue({ ...merged, coordsSource });
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
  useWishPinsMock.mockReset();
  wishRefreshSpy.mockReset();
  muklogRefreshSpy.mockReset();
  mockFocus.cb = null;
  setBoundsSpy.mockReset();
  requestSpy.mockReset();
  refreshCoordsSpy.mockReset();
  injectedScripts.length = 0;
  mockRequestAdd.mockReset();
  mockChooseLog.mockReset();
  mockDismiss.mockReset();
  mockNearbyWish.onAdded = null;
  mockNearbyWish.choosing = null;
  mockNearbyWish.submitting = false;
  setPermission();
  setNearby();
  setWishPins();
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
    emitMessage({ raw: JSON.stringify({ type: 'MARKER_TAP', id: 'm9', kind: 'saved' }) });
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
    // nearby 마커는 items에서 파생(MapTabScreen이 nearbyToMapMarkers로 생성) — 실제 useNearbyPlaces 동작과 일치.
    setNearby({
      status: 'ready',
      items: [nearbyItem({ kakaoPlaceId: 'k1', lat: 38.0, lng: 128.0 })],
    });
    renderWithTheme(<MapTabScreen />);
    // READY → INIT 주입(머지 마커 포함). saved id(m1) + nearby id(k1) 둘 다 직렬화.
    emitMessage({ raw: JSON.stringify({ type: 'READY' }) });
    const joined = injectedScripts.join('\n');
    expect(joined).toContain('"id":"m1"');
    expect(joined).toContain('"id":"k1"');
    expect(joined).toContain('"kind":"nearby"');
  });

  it('MARKER_TAP(saved:false) 수신 시 NearbySpotCard(거리)를 표시한다', () => {
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    setNearby({
      status: 'ready',
      markers: [{ id: 'k7', lat: 37.5, lng: 127.0, emoji: '🍜', kind: MapPinKind.Nearby }],
      items: [nearbyItem()],
    });
    renderWithTheme(<MapTabScreen />);
    expect(screen.queryByTestId('nearby-spot-card')).toBeNull();
    emitMessage({ raw: JSON.stringify({ type: 'MARKER_TAP', id: 'k7', kind: 'nearby' }) });
    expect(screen.getByTestId('nearby-spot-card')).toBeTruthy();
    expect(screen.getByText('연남 칼국수')).toBeTruthy();
    // 메타 = 마지막 세그먼트 + 거리(raw 브레드크럼 아님), 커버 = 종목 이모지(☕ 일괄 폴백 아님).
    expect(screen.getByText('칼국수 · 320m')).toBeTruthy();
    expect(screen.getByText('🍜')).toBeTruthy();
    expect(screen.queryByText('☕')).toBeNull();
  });

  it('MARKER_TAP(saved:false) 시 종목별 coverEmoji를 카드에 표시한다(한식>고기→🍖, ☕ 아님)', () => {
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    setNearby({
      status: 'ready',
      markers: [{ id: 'k7', lat: 37.5, lng: 127.0, emoji: '🍖', kind: MapPinKind.Nearby }],
      items: [nearbyItem({ placeName: '연남 고깃집', categoryName: '음식점 > 한식 > 고기' })],
    });
    renderWithTheme(<MapTabScreen />);
    emitMessage({ raw: JSON.stringify({ type: 'MARKER_TAP', id: 'k7', kind: 'nearby' }) });
    expect(screen.getByText('🍖')).toBeTruthy();
    expect(screen.getByText('고기 · 320m')).toBeTruthy();
    expect(screen.queryByText('☕')).toBeNull();
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

  // ── map-locate-button 증분 (plan §3.7·§5 T4·T5·T6) ──────────────
  it('현재위치 FAB를 항상 렌더한다(권한 거부에서도)', () => {
    setPermission({ status: LocationPermissionStatus.Denied, coords: null });
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    renderWithTheme(<MapTabScreen />);
    expect(screen.getByTestId('map-locate-button')).toBeTruthy();
  });

  it('T4: granted에서 FAB 탭 → refreshCoords 1회 → 반환 coords로 RECENTER inject 1회', async () => {
    refreshCoordsSpy.mockResolvedValueOnce({
      coords: { lat: 37.6, lng: 127.1 },
      source: LocationCoordsSource.Fresh,
    });
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    renderWithTheme(<MapTabScreen />);

    fireEvent.press(screen.getByTestId('map-locate-button'));

    await waitFor(() => expect(refreshCoordsSpy).toHaveBeenCalledTimes(1));
    expect(requestSpy).not.toHaveBeenCalled();
    const recenter = injectedScripts.filter((s) => s.includes('"type":"RECENTER"'));
    expect(recenter).toHaveLength(1);
    expect(recenter[0]).toContain('__muklogRecenter');
    expect(recenter[0]).toContain('"lat":37.6');
    expect(recenter[0]).toContain('"lng":127.1');
  });

  it('T5: 미결정에서 FAB 탭 → permission.request 호출(요청 후 거부면 inject 없음)', async () => {
    setPermission({ status: LocationPermissionStatus.Undetermined, coords: null });
    refreshCoordsSpy.mockResolvedValueOnce(null); // 요청 후 거부 → refreshCoords가 null(granted 아님).
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    renderWithTheme(<MapTabScreen />);
    // 진입 effect가 undetermined일 때 1회 request(기존 회귀 동작) — 탭 경로만 분리 검증.
    requestSpy.mockClear();

    fireEvent.press(screen.getByTestId('map-locate-button'));

    await waitFor(() => expect(requestSpy).toHaveBeenCalledTimes(1));
    expect(injectedScripts.some((s) => s.includes('"type":"RECENTER"'))).toBe(false);
  });

  it('T6: 거부에서 FAB 탭 → refreshCoords·RECENTER inject 모두 없음(no-op)', async () => {
    setPermission({ status: LocationPermissionStatus.Denied, coords: null });
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    renderWithTheme(<MapTabScreen />);

    fireEvent.press(screen.getByTestId('map-locate-button'));

    // 비동기 경로가 있더라도 호출이 일어나지 않음을 확정(다음 틱까지 대기).
    await waitFor(() => expect(screen.getByTestId('map-locate-button')).toBeTruthy());
    expect(requestSpy).not.toHaveBeenCalled();
    expect(refreshCoordsSpy).not.toHaveBeenCalled();
    expect(injectedScripts.some((s) => s.includes('"type":"RECENTER"'))).toBe(false);
  });

  it('T6: granted지만 refreshCoords가 null이면 RECENTER inject 없음(no-op, 에러배너 없음)', async () => {
    refreshCoordsSpy.mockResolvedValueOnce(null);
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    renderWithTheme(<MapTabScreen />);

    fireEvent.press(screen.getByTestId('map-locate-button'));

    await waitFor(() => expect(refreshCoordsSpy).toHaveBeenCalledTimes(1));
    expect(injectedScripts.some((s) => s.includes('"type":"RECENTER"'))).toBe(false);
    expect(screen.queryByText('지도를 불러오지 못했어요')).toBeNull();
  });

  // ── #4 첫 진입 자동 현위치 센터링 (READY 후 coords가 도착하면 1회 자동 RECENTER) ────
  it('#4: READY 후 현재위치(coords)가 도착하면 1회 자동 RECENTER inject(서울 폴백 고정 해제)', () => {
    // 첫 렌더: granted지만 coords 아직 null(GPS 첫 픽스 전) → INIT은 폴백 센터.
    setPermission({ status: LocationPermissionStatus.Granted, coords: null });
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    const { rerender } = renderWithTheme(<MapTabScreen />);

    emitMessage({ raw: JSON.stringify({ type: 'READY' }) });
    // 이 시점엔 coords 없음 → 자동 RECENTER 없음.
    expect(injectedScripts.some((s) => s.includes('"type":"RECENTER"'))).toBe(false);

    // coords 도착(첫 GPS 픽스) → 자동 RECENTER 1회.
    setPermission({ status: LocationPermissionStatus.Granted, coords: { lat: 37.6, lng: 127.1 } });
    rerender(<MapTabScreen />);

    const recenter = injectedScripts.filter((s) => s.includes('"type":"RECENTER"'));
    expect(recenter).toHaveLength(1);
    expect(recenter[0]).toContain('"lat":37.6');
    expect(recenter[0]).toContain('"lng":127.1');
  });

  it('#4: coords가 READY 전부터 있으면 INIT 센터가 현위치라 자동 RECENTER는 하지 않는다', () => {
    setPermission({ status: LocationPermissionStatus.Granted, coords: { lat: 37.6, lng: 127.1 } });
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    renderWithTheme(<MapTabScreen />);

    emitMessage({ raw: JSON.stringify({ type: 'READY' }) });

    // INIT center가 이미 현위치 → 중복 RECENTER 불필요.
    const joined = injectedScripts.join('\n');
    expect(joined).toContain('"type":"INIT"');
    expect(injectedScripts.some((s) => s.includes('"type":"RECENTER"'))).toBe(false);
  });

  it('#4: 자동 RECENTER는 1회만 — coords가 또 바뀌어도(사용자 이동) 재센터로 따라가지 않는다', () => {
    setPermission({ status: LocationPermissionStatus.Granted, coords: null });
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    const { rerender } = renderWithTheme(<MapTabScreen />);
    emitMessage({ raw: JSON.stringify({ type: 'READY' }) });

    setPermission({ status: LocationPermissionStatus.Granted, coords: { lat: 37.6, lng: 127.1 } });
    rerender(<MapTabScreen />);
    setPermission({ status: LocationPermissionStatus.Granted, coords: { lat: 37.7, lng: 127.2 } });
    rerender(<MapTabScreen />);

    const recenter = injectedScripts.filter((s) => s.includes('"type":"RECENTER"'));
    expect(recenter).toHaveLength(1);
    expect(recenter[0]).toContain('"lat":37.6'); // 첫 픽스만 따라감.
  });

  // ── map-initial-location 증분 (plan §3.6·§5 T6·T7) ──────────────
  //   INIT 스크립트 payload를 파싱해 center/me를 직접 읽는다(문자열 포함 검사보다 계약을 정확히 본다).
  const parseInitPayload = () => {
    const script = injectedScripts.find((s) => s.includes('"type":"INIT"'));
    if (!script) return null;
    const json = script.slice(script.indexOf('({') + 1, script.lastIndexOf(')'));
    return JSON.parse(json) as {
      center: { lat: number; lng: number };
      me: { lat: number; lng: number } | null;
    };
  };
  const recenterScripts = () => injectedScripts.filter((s) => s.includes('"type":"RECENTER"'));

  it('T7: warm 좌표 보유 시 INIT center·me가 warm 좌표다(서울시청 폴백 아님)', () => {
    setPermission({
      status: LocationPermissionStatus.Undetermined,
      coords: { lat: 37.55, lng: 126.99 },
      coordsSource: LocationCoordsSource.Warm,
    });
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    renderWithTheme(<MapTabScreen />);

    emitMessage({ raw: JSON.stringify({ type: 'READY' }) });

    const init = parseInitPayload();
    expect(init?.center).toEqual({ lat: 37.55, lng: 126.99, zoom: 5 });
    // center와 me가 같은 좌표원을 쓴다(§7 경계면 3).
    expect(init?.me).toEqual({ lat: 37.55, lng: 126.99 });
    // DEFAULT_REGION(서울시청)이 아니다.
    expect(init?.center.lat).not.toBe(37.5665);
  });

  it('T6: warm 좌표로 INIT된 뒤 fresh 픽스가 도착하면 RECENTER를 정확히 1회 주입한다', () => {
    setPermission({
      status: LocationPermissionStatus.Granted,
      coords: { lat: 37.55, lng: 126.99 },
      coordsSource: LocationCoordsSource.Warm,
    });
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    const { rerender } = renderWithTheme(<MapTabScreen />);
    emitMessage({ raw: JSON.stringify({ type: 'READY' }) });
    // warm INIT만으로는 자동 RECENTER 없음(이미 그 좌표로 그려졌으므로 중복 주입 0).
    expect(recenterScripts()).toHaveLength(0);

    // 정밀 픽스 도착 → 같은 동네 안에서 조용한 보정 1회.
    setPermission({
      status: LocationPermissionStatus.Granted,
      coords: { lat: 37.56, lng: 126.995 },
      coordsSource: LocationCoordsSource.Fresh,
    });
    rerender(<MapTabScreen />);

    const recenter = recenterScripts();
    expect(recenter).toHaveLength(1);
    expect(recenter[0]).toContain('"lat":37.56');
  });

  it('T6: warm 좌표가 갱신되기만 하면 RECENTER를 주입하지 않는다(정밀 픽스 아님)', () => {
    setPermission({
      status: LocationPermissionStatus.Granted,
      coords: { lat: 37.55, lng: 126.99 },
      coordsSource: LocationCoordsSource.Warm,
    });
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    const { rerender } = renderWithTheme(<MapTabScreen />);
    emitMessage({ raw: JSON.stringify({ type: 'READY' }) });

    setPermission({
      status: LocationPermissionStatus.Granted,
      coords: { lat: 37.551, lng: 126.991 },
      coordsSource: LocationCoordsSource.Warm,
    });
    rerender(<MapTabScreen />);

    expect(recenterScripts()).toHaveLength(0);
  });

  it('T6: warm INIT → fresh 도착 후 좌표가 또 바뀌어도 추가 RECENTER 0회(1회 가드 유지)', () => {
    setPermission({
      status: LocationPermissionStatus.Granted,
      coords: { lat: 37.55, lng: 126.99 },
      coordsSource: LocationCoordsSource.Warm,
    });
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    const { rerender } = renderWithTheme(<MapTabScreen />);
    emitMessage({ raw: JSON.stringify({ type: 'READY' }) });

    setPermission({
      status: LocationPermissionStatus.Granted,
      coords: { lat: 37.56, lng: 126.995 },
      coordsSource: LocationCoordsSource.Fresh,
    });
    rerender(<MapTabScreen />);
    setPermission({
      status: LocationPermissionStatus.Granted,
      coords: { lat: 37.57, lng: 127.0 },
      coordsSource: LocationCoordsSource.Fresh,
    });
    rerender(<MapTabScreen />);

    const recenter = recenterScripts();
    expect(recenter).toHaveLength(1);
    expect(recenter[0]).toContain('"lat":37.56'); // 첫 정밀 픽스만 따라감.
  });

  it('T7 회귀: 좌표 없음 + 핀 없음이면 INIT center는 DEFAULT_REGION(서울시청)이다', () => {
    setPermission({ status: LocationPermissionStatus.Undetermined, coords: null });
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    renderWithTheme(<MapTabScreen />);

    emitMessage({ raw: JSON.stringify({ type: 'READY' }) });

    const init = parseInitPayload();
    expect(init?.center).toEqual({ lat: 37.5665, lng: 126.978, zoom: 5 });
    expect(init?.me).toBeNull();
  });

  it('T7 회귀: 좌표 없음 + 핀 있음이면 INIT center는 핀 bbox 중심이다', () => {
    setPermission({ status: LocationPermissionStatus.Undetermined, coords: null });
    useMuklogPinsMock.mockReturnValue({
      state: {
        status: 'ready',
        pins: [
          pin({ muklogId: 'm1', lat: 37.4, lng: 126.9 }),
          pin({ muklogId: 'm2', lat: 37.6, lng: 127.1 }),
        ],
      },
      refresh: jest.fn(),
    });
    renderWithTheme(<MapTabScreen />);

    emitMessage({ raw: JSON.stringify({ type: 'READY' }) });

    const init = parseInitPayload();
    expect(init?.center.lat).toBeCloseTo(37.5, 5);
    expect(init?.center.lng).toBeCloseTo(127.0, 5);
  });

  // L1(qa-report-logic §7): 폴백(서울시청)으로 INIT된 뒤 warm이 도착하는 경로 — 손에 좌표를 쥐고도
  //   지도가 폴백에 고정되던 미실현 경로. warm 보정 1회 + 이후 정밀 픽스 보정 1회가 모두 살아있어야 한다.
  it('L1: 폴백 센터로 INIT된 뒤 warm 좌표가 도착하면 RECENTER를 1회 주입한다', () => {
    setPermission({ status: LocationPermissionStatus.Undetermined, coords: null });
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    const { rerender } = renderWithTheme(<MapTabScreen />);
    emitMessage({ raw: JSON.stringify({ type: 'READY' }) });
    // INIT은 서울시청 폴백·me null로 그려졌다.
    expect(parseInitPayload()?.center.lat).toBe(37.5665);
    expect(recenterScripts()).toHaveLength(0);

    // 뒤늦게 워밍/탭 진입 시드가 도착.
    setPermission({
      status: LocationPermissionStatus.Granted,
      coords: { lat: 37.55, lng: 126.99 },
      coordsSource: LocationCoordsSource.Warm,
    });
    rerender(<MapTabScreen />);

    const recenter = recenterScripts();
    expect(recenter).toHaveLength(1);
    expect(recenter[0]).toContain('"lat":37.55');
  });

  it('L1: 폴백 INIT → warm 보정 뒤 fresh가 도착하면 정밀 보정이 1회 더 주입된다(총 2회)', () => {
    setPermission({ status: LocationPermissionStatus.Undetermined, coords: null });
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    const { rerender } = renderWithTheme(<MapTabScreen />);
    emitMessage({ raw: JSON.stringify({ type: 'READY' }) });

    setPermission({
      status: LocationPermissionStatus.Granted,
      coords: { lat: 37.55, lng: 126.99 },
      coordsSource: LocationCoordsSource.Warm,
    });
    rerender(<MapTabScreen />);
    setPermission({
      status: LocationPermissionStatus.Granted,
      coords: { lat: 37.56, lng: 126.995 },
      coordsSource: LocationCoordsSource.Fresh,
    });
    rerender(<MapTabScreen />);

    const recenter = recenterScripts();
    expect(recenter).toHaveLength(2);
    expect(recenter[0]).toContain('"lat":37.55'); // warm 보정
    expect(recenter[1]).toContain('"lat":37.56'); // 정밀 보정
  });

  it('L1: 폴백 INIT → warm 보정 이후 warm이 또 갱신돼도 추가 주입 0회', () => {
    setPermission({ status: LocationPermissionStatus.Undetermined, coords: null });
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    const { rerender } = renderWithTheme(<MapTabScreen />);
    emitMessage({ raw: JSON.stringify({ type: 'READY' }) });

    setPermission({
      status: LocationPermissionStatus.Granted,
      coords: { lat: 37.55, lng: 126.99 },
      coordsSource: LocationCoordsSource.Warm,
    });
    rerender(<MapTabScreen />);
    setPermission({
      status: LocationPermissionStatus.Granted,
      coords: { lat: 37.551, lng: 126.991 },
      coordsSource: LocationCoordsSource.Warm,
    });
    rerender(<MapTabScreen />);

    expect(recenterScripts()).toHaveLength(1);
  });

  it('L2: warm INIT 상태에서 FAB 탭 → RECENTER 1회(자동 보정과 중복 주입 0)', async () => {
    setPermission({
      status: LocationPermissionStatus.Granted,
      coords: { lat: 37.55, lng: 126.99 },
      coordsSource: LocationCoordsSource.Warm,
    });
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    const { rerender } = renderWithTheme(<MapTabScreen />);
    emitMessage({ raw: JSON.stringify({ type: 'READY' }) });
    refreshCoordsSpy.mockResolvedValueOnce({
      coords: { lat: 37.6, lng: 127.1 },
      source: LocationCoordsSource.Fresh,
    });

    fireEvent.press(screen.getByTestId('map-locate-button'));
    await waitFor(() => expect(refreshCoordsSpy).toHaveBeenCalledTimes(1));

    // 실제 훅은 refreshCoords 성공 시 coords·source를 fresh로 전이시킨다 → 자동 보정 effect 재평가.
    setPermission({
      status: LocationPermissionStatus.Granted,
      coords: { lat: 37.6, lng: 127.1 },
      coordsSource: LocationCoordsSource.Fresh,
    });
    rerender(<MapTabScreen />);

    // 사용자가 직접 리센터했으므로 자동 1회 보정은 불요 — 총 1회여야 한다.
    expect(recenterScripts()).toHaveLength(1);
  });

  it('L2 후속: FAB가 실패 폴백(warm 좌표)으로 리센터했으면 이후 정밀 픽스 보정이 살아있다', async () => {
    setPermission({
      status: LocationPermissionStatus.Granted,
      coords: { lat: 37.55, lng: 126.99 },
      coordsSource: LocationCoordsSource.Warm,
    });
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    const { rerender } = renderWithTheme(<MapTabScreen />);
    emitMessage({ raw: JSON.stringify({ type: 'READY' }) });
    // 재취득 실패 → 훅이 직전 warm 좌표를 그 출처(warm)와 함께 폴백 반환(R6).
    refreshCoordsSpy.mockResolvedValueOnce({
      coords: { lat: 37.55, lng: 126.99 },
      source: LocationCoordsSource.Warm,
    });

    fireEvent.press(screen.getByTestId('map-locate-button'));
    await waitFor(() => expect(refreshCoordsSpy).toHaveBeenCalledTimes(1));
    expect(recenterScripts()).toHaveLength(1);

    // 지도는 여전히 warm 좌표로 센터돼 있으므로, 뒤늦은 정밀 픽스는 보정되어야 한다
    //   (FAB 탭을 무조건 fresh로 마킹하면 여기서 막힌다 — 정밀도 오마킹 금지).
    setPermission({
      status: LocationPermissionStatus.Granted,
      coords: { lat: 37.6, lng: 127.1 },
      coordsSource: LocationCoordsSource.Fresh,
    });
    rerender(<MapTabScreen />);

    const recenter = recenterScripts();
    expect(recenter).toHaveLength(2);
    expect(recenter[1]).toContain('"lat":37.6');
  });

  it('T7 회귀: denied면 me 마커를 주입하지 않고 권한 배너를 유지한다', () => {
    setPermission({ status: LocationPermissionStatus.Denied, coords: null });
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    renderWithTheme(<MapTabScreen />);

    emitMessage({ raw: JSON.stringify({ type: 'READY' }) });

    expect(parseInitPayload()?.me).toBeNull();
    expect(recenterScripts()).toHaveLength(0);
    expect(screen.getByText('위치 권한을 허용하면 현재 위치를 볼 수 있어요')).toBeTruthy();
  });

  // ── map-pin-select 증분 (plan §3.5·§5 T5·T6·T7) ─────────────────
  const setSelectedScripts = () =>
    injectedScripts.filter((s) => s.includes('"type":"SET_SELECTED"'));

  it('T5: 핀 탭(MARKER_TAP) 시 SET_SELECTED(id)를 주입한다(활성 반영)', () => {
    useMuklogPinsMock.mockReturnValue({
      state: { status: 'ready', pins: [pin({ muklogId: 'm9' })] },
      refresh: jest.fn(),
    });
    renderWithTheme(<MapTabScreen />);
    emitMessage({ raw: JSON.stringify({ type: 'READY' }) }); // mapReady → SET_SELECTED effect 활성
    emitMessage({ raw: JSON.stringify({ type: 'MARKER_TAP', id: 'm9', kind: 'saved' }) });

    const sel = setSelectedScripts();
    expect(sel[sel.length - 1]).toContain('"selectedId":"m9"');
    expect(sel[sel.length - 1]).toContain('__muklogSetSelected');
  });

  it('T5: 다른 핀 탭 시 활성 id가 이동한다(SET_SELECTED 새 id 주입)', () => {
    useMuklogPinsMock.mockReturnValue({
      state: { status: 'ready', pins: [pin({ muklogId: 'm9' }), pin({ muklogId: 'm10' })] },
      refresh: jest.fn(),
    });
    renderWithTheme(<MapTabScreen />);
    emitMessage({ raw: JSON.stringify({ type: 'READY' }) });
    emitMessage({ raw: JSON.stringify({ type: 'MARKER_TAP', id: 'm9', kind: 'saved' }) });
    emitMessage({ raw: JSON.stringify({ type: 'MARKER_TAP', id: 'm10', kind: 'saved' }) });

    const sel = setSelectedScripts();
    expect(sel[sel.length - 1]).toContain('"selectedId":"m10"');
  });

  it('T5: 지도 빈 곳 탭(MAP_TAP) 시 선택 해제 — 카드 닫힘 + SET_SELECTED(null)', () => {
    useMuklogPinsMock.mockReturnValue({
      state: { status: 'ready', pins: [pin({ muklogId: 'm9', placeName: '스시 오마카세' })] },
      refresh: jest.fn(),
    });
    renderWithTheme(<MapTabScreen />);
    emitMessage({ raw: JSON.stringify({ type: 'READY' }) });
    emitMessage({ raw: JSON.stringify({ type: 'MARKER_TAP', id: 'm9', kind: 'saved' }) });
    expect(screen.getByTestId('selected-spot-card')).toBeTruthy();

    emitMessage({ raw: JSON.stringify({ type: 'MAP_TAP' }) });
    expect(screen.queryByTestId('selected-spot-card')).toBeNull();
    const sel = setSelectedScripts();
    expect(sel[sel.length - 1]).toContain('"selectedId":null');
  });

  it('T5: READY 전(mapReady false)에는 SET_SELECTED를 주입하지 않는다', () => {
    useMuklogPinsMock.mockReturnValue({
      state: { status: 'ready', pins: [pin({ muklogId: 'm9' })] },
      refresh: jest.fn(),
    });
    renderWithTheme(<MapTabScreen />);
    // READY 미발화 → mapReady false. 탭이 와도 SET_SELECTED inject 0.
    emitMessage({ raw: JSON.stringify({ type: 'MARKER_TAP', id: 'm9', kind: 'saved' }) });
    expect(setSelectedScripts()).toHaveLength(0);
  });

  it('T6: nearby 갱신(SET_MARKERS 재주입)이 선택을 바꾸지 않는다(채널 독립)', () => {
    useMuklogPinsMock.mockReturnValue({
      state: { status: 'ready', pins: [pin({ muklogId: 'm9', placeName: '스시 오마카세' })] },
      refresh: jest.fn(),
    });
    setNearby({ status: 'ready', markers: [] });
    const { rerender } = renderWithTheme(<MapTabScreen />);
    emitMessage({ raw: JSON.stringify({ type: 'READY' }) });
    emitMessage({ raw: JSON.stringify({ type: 'MARKER_TAP', id: 'm9', kind: 'saved' }) });
    expect(screen.getByTestId('selected-spot-card')).toBeTruthy();
    const selBefore = setSelectedScripts().length;

    // nearby 마커 갱신(items → 파생) → SET_MARKERS 재주입(markersKey 변경). 선택은 유지되어야 한다.
    setNearby({
      status: 'ready',
      items: [nearbyItem({ kakaoPlaceId: 'k1', lat: 38.0, lng: 128.0 })],
    });
    rerender(<MapTabScreen />);

    // 카드(선택) 유지 + SET_MARKERS에 k1 포함 + selection 채널은 재발화하지 않음(selectedId 불변).
    expect(screen.getByTestId('selected-spot-card')).toBeTruthy();
    expect(injectedScripts.some((s) => s.includes('"type":"SET_MARKERS"') && s.includes('"id":"k1"'))).toBe(true);
    expect(setSelectedScripts().length).toBe(selBefore);
  });

  it('T7: 선택된 nearby 핀이 목록에서 사라지면 selected 정리(카드 닫힘 + SET_SELECTED(null))', () => {
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    setNearby({
      status: 'ready',
      markers: [{ id: 'k7', lat: 37.5, lng: 127.0, emoji: '🍜', kind: MapPinKind.Nearby }],
      items: [nearbyItem()],
    });
    const { rerender } = renderWithTheme(<MapTabScreen />);
    emitMessage({ raw: JSON.stringify({ type: 'READY' }) });
    emitMessage({ raw: JSON.stringify({ type: 'MARKER_TAP', id: 'k7', kind: 'nearby' }) });
    expect(screen.getByTestId('nearby-spot-card')).toBeTruthy();

    // 선택된 nearby 핀이 viewport 이탈/dedup으로 소실.
    setNearby({ status: 'ready', markers: [], items: [] });
    rerender(<MapTabScreen />);

    expect(screen.queryByTestId('nearby-spot-card')).toBeNull();
    const sel = setSelectedScripts();
    expect(sel[sel.length - 1]).toContain('"selectedId":null');
  });

  // ── map-nearby-wish 배선 (plan §5 T3·T4·T5, ui-spec §4) ─────────
  const selectNearby = () => {
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    setNearby({
      status: 'ready',
      markers: [{ id: 'k7', lat: 37.5, lng: 127.0, emoji: '🍜', kind: MapPinKind.Nearby }],
      items: [nearbyItem()],
    });
    renderWithTheme(<MapTabScreen />);
    emitMessage({ raw: JSON.stringify({ type: 'MARKER_TAP', id: 'k7', kind: 'nearby' }) });
  };

  it('T3: nearby 카드 "위시에 담기" 탭 → requestAdd({ item: 선택된 nearby })', () => {
    selectNearby();
    expect(screen.getByText('위시에 담기')).toBeTruthy();
    fireEvent.press(screen.getByTestId('nearby-add-wish'));
    expect(mockRequestAdd).toHaveBeenCalledWith({
      item: expect.objectContaining({ kakaoPlaceId: 'k7', placeName: '연남 칼국수' }),
    });
  });

  it('T5: submitting(담는 중)이면 카드 액션이 비활성이라 재탭이 requestAdd를 부르지 않는다', () => {
    mockNearbyWish.submitting = true;
    selectNearby();
    fireEvent.press(screen.getByTestId('nearby-add-wish'));
    expect(mockRequestAdd).not.toHaveBeenCalled();
  });

  it('T4: choosing이 있으면 LogPickerSheet를 로그 라벨과 함께 노출한다(2+개)', () => {
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    mockNearbyWish.choosing = {
      item: nearbyItem(),
      logs: [
        { roomId: 'r1', name: '성수 로그', memberCount: 2 },
        { roomId: 'r2', name: '연남 로그', memberCount: 1 },
      ],
    };
    renderWithTheme(<MapTabScreen />);
    expect(screen.getByText('성수 로그')).toBeTruthy();
    expect(screen.getByText('연남 로그')).toBeTruthy();
    expect(screen.getByTestId('log-picker-row-r1')).toBeTruthy();
  });

  it('T4: 이름 없는 로그는 displayLogName 폴백으로 표시한다(name=null)', () => {
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    mockNearbyWish.choosing = {
      item: nearbyItem(),
      logs: [
        { roomId: 'r1', name: null, memberCount: 2 },
        { roomId: 'r2', name: null, memberCount: 1 },
      ],
    };
    renderWithTheme(<MapTabScreen />);
    // selfNickname 미주입(null) → 커플 "우리 로그" / 솔로 "내 로그" 폴백.
    expect(screen.getByText('우리 로그')).toBeTruthy();
    expect(screen.getByText('내 로그')).toBeTruthy();
  });

  it('T4: LogPickerSheet 행 탭 → 그 roomId로 chooseLog', () => {
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    mockNearbyWish.choosing = {
      item: nearbyItem(),
      logs: [
        { roomId: 'r1', name: '성수 로그', memberCount: 2 },
        { roomId: 'r2', name: '연남 로그', memberCount: 1 },
      ],
    };
    renderWithTheme(<MapTabScreen />);
    fireEvent.press(screen.getByTestId('log-picker-row-r2'));
    expect(mockChooseLog).toHaveBeenCalledWith({ roomId: 'r2' });
  });

  it('T4: choosing이 없으면 LogPickerSheet를 렌더하지 않는다', () => {
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    renderWithTheme(<MapTabScreen />);
    expect(screen.queryByTestId('log-picker-row-r1')).toBeNull();
  });

  // ── map-wish-pins 배선 (plan §5 T7) ─────────────────────────────
  it('T7: 위시 핀을 SET_MARKERS에 합류시킨다(kind:wish)', () => {
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    setWishPins({ pins: [wishPin({ id: 'w7', lat: 37.7, lng: 127.3 })] });
    renderWithTheme(<MapTabScreen />);
    emitMessage({ raw: JSON.stringify({ type: 'READY' }) });
    const joined = injectedScripts.join('\n');
    expect(joined).toContain('"id":"w7"');
    expect(joined).toContain('"kind":"wish"');
  });

  it('T7: MARKER_TAP(kind:wish) 수신 시 WishSpotCard(이름·카테고리·area)를 표시한다', () => {
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    setWishPins({ pins: [wishPin({ id: 'w7', placeName: '연남 파스타', category: 'pasta', area: '연남동' })] });
    renderWithTheme(<MapTabScreen />);
    expect(screen.queryByText('연남 파스타')).toBeNull();
    emitMessage({ raw: JSON.stringify({ type: 'MARKER_TAP', id: 'w7', kind: 'wish' }) });
    expect(screen.getByText('연남 파스타')).toBeTruthy();
    // 메타 = 카테고리 라벨 · area(별점/heart/거리/액션 없음).
    expect(screen.getByText('· 파스타·양식 · 연남동')).toBeTruthy();
  });

  it('T7: 선택된 위시 핀이 사라지면 WishSpotCard가 닫힌다(refresh 후 소실)', () => {
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    setWishPins({ pins: [wishPin({ id: 'w7', placeName: '연남 파스타' })] });
    const { rerender } = renderWithTheme(<MapTabScreen />);
    emitMessage({ raw: JSON.stringify({ type: 'MARKER_TAP', id: 'w7', kind: 'wish' }) });
    expect(screen.getByText('연남 파스타')).toBeTruthy();

    setWishPins({ pins: [] }); // 삭제/refresh로 위시 소실.
    rerender(<MapTabScreen />);
    expect(screen.queryByText('연남 파스타')).toBeNull();
  });

  it('T7: 지도 탭 포커스 시 위시 핀을 refresh한다(폴링 아님 — 포커스 콜백 발화)', () => {
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    renderWithTheme(<MapTabScreen />);
    // useFocusEffect 콜백을 수동 발화 → wishPins.refresh 호출.
    expect(mockFocus.cb).not.toBeNull();
    mockFocus.cb?.();
    expect(wishRefreshSpy).toHaveBeenCalled();
  });

  it('H1: 지도 탭 포커스 시 먹로그(saved) 핀도 refresh한다(생성/삭제·방 나가기 후 복귀 반영)', () => {
    useMuklogPinsMock.mockReturnValue({
      state: { status: 'ready', pins: [] },
      refresh: muklogRefreshSpy,
    });
    renderWithTheme(<MapTabScreen />);
    // useFocusEffect 콜백을 수동 발화 → 먹로그 핀 refresh도 호출(위시 핀과 대칭).
    expect(mockFocus.cb).not.toBeNull();
    mockFocus.cb?.();
    expect(muklogRefreshSpy).toHaveBeenCalled();
  });

  it('T7: "위시에 담기" 성공 콜백(onAdded)이 위시 핀 refresh에 배선된다', () => {
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    renderWithTheme(<MapTabScreen />);
    // MapTabScreen이 useAddNearbyWish({ onAdded: wishPins.refresh })로 배선 → onAdded 발화 시 위시 refresh.
    expect(mockNearbyWish.onAdded).not.toBeNull();
    mockNearbyWish.onAdded?.();
    expect(wishRefreshSpy).toHaveBeenCalled();
  });

  // ── map-category-filter 배선 (plan §5 T3·T4) ────────────────────
  const lastSetMarkers = () =>
    injectedScripts.filter((s) => s.includes('"type":"SET_MARKERS"')).slice(-1)[0] ?? '';

  // 3종 핀 소스: saved(pasta) + wish(cafe) + nearby(cafe). 좌표는 서로 떨어뜨려 dedup 방지.
  const setupThreeKinds = () => {
    useMuklogPinsMock.mockReturnValue({
      state: {
        status: 'ready',
        pins: [pin({ muklogId: 'm-pasta', category: 'pasta', lat: 37.5, lng: 127.0 })],
      },
      refresh: muklogRefreshSpy,
    });
    setWishPins({ pins: [wishPin({ id: 'w-cafe', category: 'cafe', lat: 37.6, lng: 127.1 })] });
    setNearby({
      status: 'ready',
      items: [
        nearbyItem({
          kakaoPlaceId: 'k-cafe',
          categoryName: '음식점 > 카페 > 스페셜티커피',
          lat: 37.7,
          lng: 127.2,
        }),
      ],
    });
  };

  it('T3: 카테고리 칩 선택 시 3종 핀이 해당 카테고리로 좁혀 SET_MARKERS 재주입한다', () => {
    setupThreeKinds();
    renderWithTheme(<MapTabScreen />);
    emitMessage({ raw: JSON.stringify({ type: 'READY' }) });
    // 초기(전체): 세 핀 모두 INIT/SET_MARKERS에 존재.
    const initJoined = injectedScripts.join('\n');
    expect(initJoined).toContain('"id":"m-pasta"');
    expect(initJoined).toContain('"id":"w-cafe"');
    expect(initJoined).toContain('"id":"k-cafe"');

    // 카페 필터 → pasta(saved) 탈락, cafe(wish·nearby)만.
    fireEvent.press(screen.getByTestId('filter-chip-cafe'));
    const filtered = lastSetMarkers();
    expect(filtered).toContain('"id":"w-cafe"');
    expect(filtered).toContain('"id":"k-cafe"');
    expect(filtered).not.toContain('"id":"m-pasta"');
  });

  it('T3: "전체" 리셋 시 전 핀이 복귀한다', () => {
    setupThreeKinds();
    renderWithTheme(<MapTabScreen />);
    emitMessage({ raw: JSON.stringify({ type: 'READY' }) });
    fireEvent.press(screen.getByTestId('filter-chip-cafe'));
    expect(lastSetMarkers()).not.toContain('"id":"m-pasta"');

    fireEvent.press(screen.getByTestId('filter-chip-all'));
    const reset = lastSetMarkers();
    expect(reset).toContain('"id":"m-pasta"');
    expect(reset).toContain('"id":"w-cafe"');
    expect(reset).toContain('"id":"k-cafe"');
  });

  it('T3: 필터 변경은 재조회를 유발하지 않는다(순수 클라 파생, 비용 0)', () => {
    setupThreeKinds();
    renderWithTheme(<MapTabScreen />);
    emitMessage({ raw: JSON.stringify({ type: 'READY' }) });
    setBoundsSpy.mockClear();
    muklogRefreshSpy.mockClear();
    wishRefreshSpy.mockClear();

    fireEvent.press(screen.getByTestId('filter-chip-cafe'));
    fireEvent.press(screen.getByTestId('filter-chip-all'));

    // 필터는 표시 파생만 — nearby bounds 재조회·먹로그/위시 refresh 모두 미발생.
    expect(setBoundsSpy).not.toHaveBeenCalled();
    expect(muklogRefreshSpy).not.toHaveBeenCalled();
    expect(wishRefreshSpy).not.toHaveBeenCalled();
  });

  it('T4: 선택된 핀이 필터에서 빠지면 카드가 닫힌다(SET_SELECTED null)', () => {
    setupThreeKinds();
    renderWithTheme(<MapTabScreen />);
    emitMessage({ raw: JSON.stringify({ type: 'READY' }) });
    // saved(pasta) 핀 탭 → SelectedSpotCard 표시.
    emitMessage({ raw: JSON.stringify({ type: 'MARKER_TAP', id: 'm-pasta', kind: 'saved' }) });
    expect(screen.getByTestId('selected-spot-card')).toBeTruthy();

    // 카페 필터 → pasta 핀 소실 → 활성 정리로 카드 닫힘 + SET_SELECTED(null).
    fireEvent.press(screen.getByTestId('filter-chip-cafe'));
    expect(screen.queryByTestId('selected-spot-card')).toBeNull();
    const sel = setSelectedScripts();
    expect(sel[sel.length - 1]).toContain('"selectedId":null');
  });

  it('T4: 선택된 핀이 필터에 남아있으면 카드가 유지된다', () => {
    setupThreeKinds();
    renderWithTheme(<MapTabScreen />);
    emitMessage({ raw: JSON.stringify({ type: 'READY' }) });
    // wish(cafe) 핀 탭 → WishSpotCard 표시.
    emitMessage({ raw: JSON.stringify({ type: 'MARKER_TAP', id: 'w-cafe', kind: 'wish' }) });
    expect(screen.getByText('연남 파스타')).toBeTruthy(); // wishPin 기본 placeName

    // 카페 필터 → wish(cafe)는 남으므로 카드 유지.
    fireEvent.press(screen.getByTestId('filter-chip-cafe'));
    expect(screen.getByText('연남 파스타')).toBeTruthy();
  });
});
