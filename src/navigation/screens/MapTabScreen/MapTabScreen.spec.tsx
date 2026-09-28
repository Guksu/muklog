// src/navigation/screens/MapTabScreen.spec.tsx
// 지도 탭 상태 오케스트레이션 — 훅(useMuklogPins·useLocationPermission)·지도뷰 모킹으로 상태별 렌더 검증.
//   (plan §4·§5-1 MapTabScreen) loading/denied/empty/마커탭→선택카드/error+refresh.
//   네이티브 지도 렌더는 스모크(디바이스) → WebView는 MapWebView 모킹으로 대체, onMessage만 직접 호출.
import React from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

// map-location-denied: "설정 열기" → expo-linking openSettings 배선 지점. 다른 export는 실물 유지(전이 import 보호).
jest.mock('expo-linking', () => ({
  ...jest.requireActual('expo-linking'),
  openSettings: jest.fn(),
}));

// map-headerless: safe-area top inset 가변 모킹 — 네이티브 헤더(HomeHeader)를 끈 뒤 상단 오버레이가
//   그 inset을 승계하는지 검증하는 주입 지점(LogScreen.spec:35-42 선례). SafeAreaProvider 등 나머지는 실 구현.
const mockTopInset: { current: number } = { current: 0 };
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: mockTopInset.current, bottom: 0, left: 0, right: 0 }),
  };
});

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

import * as Linking from 'expo-linking';

import { MapPermissionBanner } from '@/features/map/components';
import { useMuklogPins } from '@/features/map/useMuklogPins';
import { useLocationPermission } from '@/features/map/useLocationPermission';
import { useNearbyPlaces } from '@/features/map/useNearbyPlaces';
import { useWishPins } from '@/features/map/useWishPins';
import {
  LocationCoordsSource,
  LocationPermissionStatus,
  MapPinKind,
  NearbyResearchOutcome,
  NearbyResearchState,
  type MapMarker,
} from '@/features/map/types';

import { MAP_BOOT_TIMEOUT_MS, MapTabScreen } from './MapTabScreen';

const openSettingsMock = Linking.openSettings as jest.Mock;
// RN jest 기본 목(react-native/jest/setup.js) — 호출 인자·횟수만 본다.
const announceMock = AccessibilityInfo.announceForAccessibility as jest.Mock;

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
// map-pin-loading: 선로딩·명시 재검색 배선 지점(호출 횟수·조건 렌더 검증). 상태 기계 자체는 훅 단위 테스트가 검증한다.
const preloadSpy = jest.fn();
const researchSpy = jest.fn();
// nearby 훅 상태 주입(기본: idle·빈 마커·빈 items·버튼 미노출). 테스트에서 오버라이드.
//   map-nearby-feedback: 실제 훅 계약과 같은 모양으로 만든다(테스트 더블 충실도) —
//   ① researchState를 주지 않으면 researchAvailable로 고른다(true → Idle, 아니면 Hidden)
//   ② researchAvailable은 researchState가 Idle·Failed일 때만 true인 파생 별칭(훅 H15와 같은 식)
//   ③ research()는 항상 resolve하는 Promise(기본 Skipped — 아무 안내도 만들지 않는 결과).
const setNearby = (over?: {
  markers?: MapMarker[];
  items?: unknown[];
  status?: string;
  researchAvailable?: boolean;
  researchState?: NearbyResearchState;
  researchOutcome?: NearbyResearchOutcome;
}) => {
  const researchState =
    over?.researchState ??
    (over?.researchAvailable ? NearbyResearchState.Idle : NearbyResearchState.Hidden);
  researchSpy.mockResolvedValue(over?.researchOutcome ?? NearbyResearchOutcome.Skipped);
  useNearbyPlacesMock.mockReturnValue({
    setBounds: setBoundsSpy,
    preload: preloadSpy,
    research: researchSpy,
    researchState,
    researchAvailable:
      researchState === NearbyResearchState.Idle || researchState === NearbyResearchState.Failed,
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
  preloadSpy.mockReset();
  researchSpy.mockReset();
  requestSpy.mockReset();
  refreshCoordsSpy.mockReset();
  injectedScripts.length = 0;
  mockRequestAdd.mockReset();
  mockChooseLog.mockReset();
  mockDismiss.mockReset();
  mockNearbyWish.onAdded = null;
  mockNearbyWish.choosing = null;
  mockNearbyWish.submitting = false;
  mockTopInset.current = 0;
  openSettingsMock.mockReset();
  announceMock.mockClear();
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

  // B3(map-feedback): READY를 발화한 뒤에도 로딩 배너가 뜨는지로 본다. READY 전이면 신규 `!mapReady`가
  //   대신 조건을 충족시켜 "핀 loading" conjunct가 하중을 잃는다(단언이 죽는다).
  it('핀 loading이면 로딩 오버레이를 띄운다 (지도는 함께 렌더)', () => {
    useMuklogPinsMock.mockReturnValue({ state: { status: 'loading' }, refresh: jest.fn() });
    renderWithTheme(<MapTabScreen />);
    emitMessage({ raw: JSON.stringify({ type: 'READY' }) }); // 지도 부팅은 끝났고 핀만 로딩인 상태
    expect(screen.getByTestId('map-status-spinner')).toBeTruthy();
    expect(screen.getByTestId('map-webview-mock')).toBeTruthy();
  });

  // B1(map-feedback): 권한 안내는 로딩보다 **아래** 우선순위다 → 지도 부팅이 끝난(READY) 뒤의 상태를 본다.
  //   map-location-denied(DV8): 안내는 중앙 오버레이가 아니라 하단 배너(map-permission-banner) 안에 있다.
  it('권한 거부면 현재위치 안내를 하단 배너로 노출하되 지도는 계속 렌더한다(차단 아님)', () => {
    setPermission({ status: LocationPermissionStatus.Denied, coords: null });
    useMuklogPinsMock.mockReturnValue({
      state: { status: 'ready', pins: [pin()] },
      refresh: jest.fn(),
    });
    renderWithTheme(<MapTabScreen />);
    emitMessage({ raw: JSON.stringify({ type: 'READY' }) });
    const banner = screen.getByTestId('map-permission-banner');
    expect(
      within(banner).getByText('위치 권한을 허용하면 현재 위치를 볼 수 있어요'),
    ).toBeTruthy();
    expect(screen.queryByTestId('map-status-overlay')).toBeNull();
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
    emitMessage({ raw: JSON.stringify({ type: 'READY' }) }); // B2: 권한 안내는 지도 부팅 이후의 상태다
    // slice1 권한 안내는 그대로(nearby 에러가 덮지 않음) — map-location-denied 이후 하단 배너 안.
    expect(
      within(screen.getByTestId('map-permission-banner')).getByText(
        '위치 권한을 허용하면 현재 위치를 볼 수 있어요',
      ),
    ).toBeTruthy();
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

  // map-location-denied(U13 ③)로 "무반응 no-op"은 "안내 재노출 + 스크린리더 알림"으로 대체됐다(P7·P8).
  //   위치 호출 0(request·refreshCoords·RECENTER)은 그대로 유지되는지 여기서 잠근다.
  it('T6: 거부에서 FAB 탭 → 위치 호출(request·refreshCoords·RECENTER) 0 — 안내 알림만', async () => {
    setPermission({ status: LocationPermissionStatus.Denied, coords: null });
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    renderWithTheme(<MapTabScreen />);

    fireEvent.press(screen.getByTestId('map-locate-button'));

    // 비동기 경로가 있더라도 호출이 일어나지 않음을 확정(알림 발화까지 대기).
    await waitFor(() => expect(announceMock).toHaveBeenCalledTimes(1));
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
    expect(
      within(screen.getByTestId('map-permission-banner')).getByText(
        '위치 권한을 허용하면 현재 위치를 볼 수 있어요',
      ),
    ).toBeTruthy();
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

// ── map-headerless (plan §5-1 T3-1~T3-6) ────────────────────────────
//   네이티브 헤더를 끄면 지도가 상태바까지 차오른다. 헤더가 흡수하던 top inset을 상단 오버레이 2종이
//   승계하는지(그리고 하단 요소로 새지 않는지) inset 0/59 두 렌더의 델타로 lock한다.
describe('MapTabScreen — map-headerless 상단 오버레이 safe-area', () => {
  // 오버레이 래퍼의 flatten 스타일(top/bottom은 인라인 토큰이라 배열 → flatten 필요).
  const flatStyle = ({ testID }: { testID: string }): { top?: number; bottom?: number } =>
    StyleSheet.flatten(screen.getByTestId(testID).props.style);

  const renderWithInset = ({ top }: { top: number }) => {
    mockTopInset.current = top;
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    return renderWithTheme(<MapTabScreen />);
  };

  const INSET = 59; // 다이나믹 아일랜드 근사.

  it('T3-1·T3-2: 카테고리 필터 바 top = spacing[12](inset 0) → inset만큼 정확히 하강', () => {
    const { unmount } = renderWithInset({ top: 0 });
    const base = flatStyle({ testID: 'map-overlay-filterbar' }).top;
    expect(base).toBe(12); // 현행 보존(회귀 0).
    unmount();

    renderWithInset({ top: INSET });
    expect(flatStyle({ testID: 'map-overlay-filterbar' }).top).toBe((base ?? 0) + INSET);
  });

  it('T3-3·T3-4: 범례 top = spacing[56](inset 0) → inset만큼 정확히 하강', () => {
    const { unmount } = renderWithInset({ top: 0 });
    const base = flatStyle({ testID: 'map-overlay-legend' }).top;
    expect(base).toBe(56);
    unmount();

    renderWithInset({ top: INSET });
    expect(flatStyle({ testID: 'map-overlay-legend' }).top).toBe((base ?? 0) + INSET);
  });

  it('T3-5: inset이 있어도 필터 바↔범례 상대 간격 44는 보존된다(한쪽에만 적용되는 실수 방지)', () => {
    renderWithInset({ top: INSET });
    const filterTop = flatStyle({ testID: 'map-overlay-filterbar' }).top ?? 0;
    const legendTop = flatStyle({ testID: 'map-overlay-legend' }).top ?? 0;
    expect(legendTop - filterTop).toBe(44);
  });

  it('T3-6: top inset이 하단 요소로 새지 않는다(현재위치 FAB 래퍼 bottom = 16 불변)', () => {
    renderWithInset({ top: INSET });
    // 배치는 래퍼가 소유한다(MapLocateButton은 배치 미보유) → 래퍼에 testID를 직접 부여해 읽는다.
    //   버튼에서 .parent로 거슬러 오르면 composite(Pressable forwardRef)가 끼어 스타일을 못 읽는다.
    expect(flatStyle({ testID: 'map-overlay-locate' }).bottom).toBe(16);
    // 상단 오버레이만 inset을 흡수했는지 대조(같은 렌더에서 상단은 하강, 하단은 불변).
    expect(flatStyle({ testID: 'map-overlay-filterbar' }).top).toBe(12 + INSET);
  });
});

// ── map-pin-loading (plan §6 W4 A4-1~A4-6) ──────────────────────────
//   화면의 책임은 셋뿐이다: ① 마운트 1회 선로딩 발사 ② researchAvailable 조건 렌더 ③ 버튼 탭 → research.
//   상태 기계(허용분·보정·캐시)는 useNearbyPlaces 단위 테스트가 검증하고, 여기선 **배선**만 잠근다.
describe('MapTabScreen — nearby 선로딩·재검색 버튼 배선', () => {
  const nearbyMarker = (over?: Partial<MapMarker>): MapMarker => ({
    id: 'k1',
    lat: 37.52,
    lng: 127.02,
    emoji: '🍜',
    kind: MapPinKind.Nearby,
    ...over,
  });

  it('A4-1 coords 보유 상태로 마운트 → preload가 정확히 1회 · bbox 중심이 현재위치다', () => {
    setPermission({ coords: { lat: 37.5, lng: 127.0 } });
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    renderWithTheme(<MapTabScreen />);

    expect(preloadSpy).toHaveBeenCalledTimes(1);
    const { bbox } = preloadSpy.mock.calls[0][0];
    expect((bbox.sw.lat + bbox.ne.lat) / 2).toBeCloseTo(37.5, 6);
    expect((bbox.sw.lng + bbox.ne.lng) / 2).toBeCloseTo(127.0, 6);
  });

  it('A4-1 coords가 warm→fresh로 승격돼도 preload 재호출 0(마운트당 1회)', () => {
    setPermission({
      coords: { lat: 37.5, lng: 127.0 },
      coordsSource: LocationCoordsSource.Warm,
    });
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    const { rerender } = renderWithTheme(<MapTabScreen />);
    expect(preloadSpy).toHaveBeenCalledTimes(1);

    setPermission({
      coords: { lat: 37.501, lng: 127.001 },
      coordsSource: LocationCoordsSource.Fresh,
    });
    rerender(<MapTabScreen />);
    expect(preloadSpy).toHaveBeenCalledTimes(1);
  });

  it('A4-2 coords·핀 모두 없으면 preload 0(스킵) — 첫 BOUNDS_CHANGED가 조회를 맡는다', () => {
    setPermission({ status: LocationPermissionStatus.Denied, coords: null });
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    renderWithTheme(<MapTabScreen />);

    expect(preloadSpy).not.toHaveBeenCalled();
    emitMessage({
      raw: JSON.stringify({
        type: 'BOUNDS_CHANGED',
        sw: { lat: 37.49, lng: 126.99 },
        ne: { lat: 37.51, lng: 127.01 },
      }),
    });
    expect(setBoundsSpy).toHaveBeenCalledTimes(1);
  });

  it('A4-2 coords가 없어도 핀이 있으면 핀 bbox 중심으로 선로딩한다(폴백 신호)', () => {
    setPermission({ status: LocationPermissionStatus.Denied, coords: null });
    useMuklogPinsMock.mockReturnValue({
      state: { status: 'ready', pins: [pin({ lat: 37.4, lng: 126.9 }), pin({ muklogId: 'm2', lat: 37.6, lng: 127.1 })] },
      refresh: jest.fn(),
    });
    renderWithTheme(<MapTabScreen />);

    expect(preloadSpy).toHaveBeenCalledTimes(1);
    const { bbox } = preloadSpy.mock.calls[0][0];
    expect((bbox.sw.lat + bbox.ne.lat) / 2).toBeCloseTo(37.5, 6);
  });

  // map-nearby-feedback(DV8): 지도 가운데 안내(부팅 로딩 포함)가 떠 있으면 pill을 숨기는 규칙이 생겨
  //   pill 케이스는 READY를 먼저 발화한다(단언은 그대로 — 노출 조건만 "중앙 안내 없음"이 전제로 붙었다).
  it('A4-3 researchAvailable=true일 때만 map-research-button이 렌더된다', () => {
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    setNearby({ researchAvailable: false });
    const { unmount } = renderWithTheme(<MapTabScreen />);
    emitMessage({ raw: JSON.stringify({ type: 'READY' }) });
    expect(screen.queryByTestId('map-research-button')).toBeNull();
    unmount();

    setNearby({ researchAvailable: true });
    renderWithTheme(<MapTabScreen />);
    emitMessage({ raw: JSON.stringify({ type: 'READY' }) });
    expect(screen.getByTestId('map-research-button')).toBeTruthy();
    expect(screen.getByText('이 지역에서 검색')).toBeTruthy();
  });

  it('A4-4 버튼 탭 → nearby.research가 1회 호출된다', async () => {
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    setNearby({ researchAvailable: true });
    renderWithTheme(<MapTabScreen />);
    emitMessage({ raw: JSON.stringify({ type: 'READY' }) });

    await act(async () => {
      fireEvent.press(screen.getByTestId('map-research-button'));
    });
    expect(researchSpy).toHaveBeenCalledTimes(1);
  });

  it('A4-5 READY 시점에 nearby가 있으면 INIT 페이로드에 kind:nearby가 함께 실린다(팝인 0)', () => {
    useMuklogPinsMock.mockReturnValue({
      state: { status: 'ready', pins: [pin({ lat: 37.5, lng: 127.0 })] },
      refresh: jest.fn(),
    });
    // 지도 마커는 nearby.items에서 파생된다(훅의 markers가 아니라) — 좌표가 saved 핀과 겹치면
    //   mergeMapMarkers의 근접 dedup에 흡수되므로 떨어진 좌표를 쓴다.
    setNearby({
      markers: [nearbyMarker()],
      items: [nearbyItem({ lat: 37.52, lng: 127.02 })],
      status: 'ready',
    });
    renderWithTheme(<MapTabScreen />);
    emitMessage({ raw: JSON.stringify({ type: 'READY' }) });

    const initScript = injectedScripts.find((s) => s.includes('INIT'));
    expect(initScript).toBeTruthy();
    expect(initScript).toContain('"kind":"nearby"');
    expect(initScript).toContain('"kind":"saved"');
  });

  it('A4-6 버튼 오버레이 top = insets.top + 96(범례 아래 한 단) · 하단은 불변', () => {
    const flatStyle = ({ testID }: { testID: string }): { top?: number; bottom?: number } =>
      StyleSheet.flatten(screen.getByTestId(testID).props.style);
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    setNearby({ researchAvailable: true });

    mockTopInset.current = 0;
    const { unmount } = renderWithTheme(<MapTabScreen />);
    emitMessage({ raw: JSON.stringify({ type: 'READY' }) });
    expect(flatStyle({ testID: 'map-overlay-research' }).top).toBe(96);
    // 범례(56)보다 아래 한 단이며 겹치지 않는다.
    expect(flatStyle({ testID: 'map-overlay-legend' }).top).toBe(56);
    unmount();

    mockTopInset.current = 59;
    renderWithTheme(<MapTabScreen />);
    emitMessage({ raw: JSON.stringify({ type: 'READY' }) });
    expect(flatStyle({ testID: 'map-overlay-research' }).top).toBe(96 + 59);
    // inset이 하단으로 새지 않는다(map-headerless 규율).
    expect(flatStyle({ testID: 'map-overlay-locate' }).bottom).toBe(16);
  });

  // ── map-feedback U5: 지도 부팅 구간 통지 (plan §3.3 ②) ────────────────────────
  //   핀은 캐시로 즉시 ready라 핀 상태만 보면 부팅 ≈1.2s가 통째로 무통지 흰 화면이 된다(원칙 3).
  it('U5-2 READY 전에는 핀이 ready여도 로딩 배너를 띄운다(지도 부팅도 로딩이다)', () => {
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    setNearby({ status: 'ready' });
    renderWithTheme(<MapTabScreen />);

    expect(screen.getByTestId('map-status-spinner')).toBeTruthy();
    expect(screen.getByText('지도를 불러오는 중이에요')).toBeTruthy(); // 신규 카피 0 — 기존 MAP_COPY.loading 재사용
  });

  it('U5-3 READY가 오면 로딩 배너가 사라진다(영구 잔류 0)', () => {
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    setNearby({ status: 'ready' });
    renderWithTheme(<MapTabScreen />);
    expect(screen.getByTestId('map-status-overlay')).toBeTruthy();

    emitMessage({ raw: JSON.stringify({ type: 'READY' }) });

    // 권한 granted 전제라 다음 순위(권한 안내)도 걸리지 않는다 → 오버레이 자체가 사라진다.
    expect(screen.queryByTestId('map-status-overlay')).toBeNull();
  });

  it('U5-3b READY 후 권한 거부면 권한 안내가 뜬다(로딩이 영구히 가로채지 않는다)', () => {
    setPermission({ status: LocationPermissionStatus.Denied, coords: null });
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    renderWithTheme(<MapTabScreen />);
    // 부팅 중엔 로딩이 위다 — 지도가 아직 없는데 권한 안내를 먼저 띄우는 건 순서가 뒤집힌 것이다.
    expect(screen.getByTestId('map-status-spinner')).toBeTruthy();
    expect(screen.queryByTestId('map-permission-banner')).toBeNull();

    emitMessage({ raw: JSON.stringify({ type: 'READY' }) });

    expect(screen.queryByTestId('map-status-spinner')).toBeNull();
    // map-location-denied: 로딩이 걷히면 중앙 오버레이 자체가 사라지고 안내는 하단 배너로 뜬다.
    expect(screen.queryByTestId('map-status-overlay')).toBeNull();
    expect(
      within(screen.getByTestId('map-permission-banner')).getByText(
        '위치 권한을 허용하면 현재 위치를 볼 수 있어요',
      ),
    ).toBeTruthy();
  });

  // ── qa-logic F1: SDK 로드 실패 후 "다시 시도"가 영구 로딩 dead-end로 끝나지 않는다 ────────────
  //   SDK가 죽은 페이지에는 __muklogInit이 없어 READY도 ERROR도 다시 오지 않는다. 그 상태에서
  //   mapErrored를 미리 내리면 로딩 분기(!mapReady)가 배너를 대체해 스피너가 영구 잔류하고
  //   재시도 버튼이 사라진다(바텀탭은 언마운트되지 않아 세션 내내 갇힌다).
  //   READY·ERROR가 처음부터 하나도 오지 않는 경우(E6)는 map-nearby-feedback의 10초 1회 제한 시간이 맡는다(S11~S19).
  //   재시도는 그 제한 시간을 끄지도 다시 켜지도 않는다 — 여기 F1 동작은 그대로다.
  it('F1-1 READY 전 SDK 에러에서 "다시 시도"를 눌러도 에러 배너·재시도 버튼이 유지된다', () => {
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    setNearby({ status: 'ready' });
    renderWithTheme(<MapTabScreen />);
    emitMessage({ raw: JSON.stringify({ type: 'ERROR', reason: 'SDK_LOAD_FAILED' }) });
    expect(screen.getByText('지도를 불러오지 못했어요')).toBeTruthy();

    fireEvent.press(screen.getByText('다시 시도'));

    expect(screen.getByText('지도를 불러오지 못했어요')).toBeTruthy();
    expect(screen.getByTestId('map-status-action')).toBeTruthy();
    // 로딩 스피너가 배너를 대체하면 재시도 수단이 사라진 dead-end다.
    expect(screen.queryByTestId('map-status-spinner')).toBeNull();
  });

  it('F1-2 "다시 시도"는 배너 유지와 무관하게 INIT을 재주입한다(SDK가 살아있으면 즉시 복구)', () => {
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    setNearby({ status: 'ready' });
    renderWithTheme(<MapTabScreen />);
    emitMessage({ raw: JSON.stringify({ type: 'ERROR', reason: 'SDK_LOAD_FAILED' }) });
    expect(injectedScripts.filter((s) => s.includes('INIT'))).toHaveLength(0);

    fireEvent.press(screen.getByText('다시 시도'));

    expect(injectedScripts.filter((s) => s.includes('INIT'))).toHaveLength(1);
  });

  it('F1-3 재시도 후 실제로 READY가 오면 배너가 사라지고 지도만 남는다(정상 복구 경로 회귀 0)', () => {
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    setNearby({ status: 'ready' });
    renderWithTheme(<MapTabScreen />);
    emitMessage({ raw: JSON.stringify({ type: 'ERROR', reason: 'SDK_LOAD_FAILED' }) });
    fireEvent.press(screen.getByText('다시 시도'));

    emitMessage({ raw: JSON.stringify({ type: 'READY' }) });

    expect(screen.queryByTestId('map-status-overlay')).toBeNull();
    expect(screen.getByTestId('map-webview-mock')).toBeTruthy();
  });

  it('F1-4 READY 후 늦게 온 SDK 에러는 재시도로 배너가 즉시 걷힌다(SDK 생존 경로)', () => {
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    setNearby({ status: 'ready' });
    renderWithTheme(<MapTabScreen />);
    emitMessage({ raw: JSON.stringify({ type: 'READY' }) });
    emitMessage({ raw: JSON.stringify({ type: 'ERROR', reason: 'SDK_LOAD_FAILED' }) });
    expect(screen.getByText('지도를 불러오지 못했어요')).toBeTruthy();

    fireEvent.press(screen.getByText('다시 시도'));

    // 이미 READY를 받은 페이지는 __muklogInit이 살아 있다 → 배너를 내려도 갇히지 않는다.
    expect(screen.queryByTestId('map-status-overlay')).toBeNull();
  });

  it('B10 래퍼가 지도 제스처를 삼키지 않는다(pointerEvents=box-none)', () => {
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: jest.fn() });
    setNearby({ researchAvailable: true });
    renderWithTheme(<MapTabScreen />);
    emitMessage({ raw: JSON.stringify({ type: 'READY' }) });
    expect(screen.getByTestId('map-overlay-research').props.pointerEvents).toBe('box-none');
  });
});

// ── map-location-denied (plan §5-1 A P1~P12, UX 백로그 U7 전체 + U13 ③) ─────────────────
//   seam: 화면 렌더 결과(텍스트·역할/이름·testID·래퍼 스타일) + 모킹된 권한 훅 반환 + expo-linking openSettings
//   + AccessibilityInfo(RN 기본 목) + ToastProvider(renderWithTheme 포함). 배너 비주얼은 MapPermissionBanner spec 몫.
//   모든 배너 케이스는 READY를 먼저 발화한다(부팅 로딩이 중앙 오버레이로 우선하므로).
describe('MapTabScreen — 위치 권한 거부 배너(map-location-denied)', () => {
  const COPY = {
    permissionDenied: '위치 권한을 허용하면 현재 위치를 볼 수 있어요',
    openSettings: '설정 열기',
    openSettingsHint: '기기 설정에서 위치 권한을 허용할 수 있어요',
    dismissPermission: '위치 안내 닫기',
    openSettingsFailed: '설정을 열지 못했어요. 설정 앱에서 허용해 주세요',
  } as const;

  const readyPins = () =>
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: muklogRefreshSpy });

  // 거부 + 핀 ready + 지도 READY — 중앙 오버레이가 없는 기본 배너 상태.
  const renderDeniedReady = () => {
    setPermission({ status: LocationPermissionStatus.Denied, coords: null });
    readyPins();
    const view = renderWithTheme(<MapTabScreen />);
    emitMessage({ raw: JSON.stringify({ type: 'READY' }) });
    return view;
  };

  const flatStyle = ({ testID }: { testID: string }) =>
    StyleSheet.flatten(screen.getByTestId(testID).props.style) as Record<string, unknown>;

  it('P1: 거부 + 중앙 오버레이 없음 → 하단 배너(문구 + 설정 열기 + 닫기)를 노출한다', () => {
    renderDeniedReady();
    const banner = screen.getByTestId('map-permission-banner');
    expect(within(banner).getByText(COPY.permissionDenied)).toBeTruthy();
    expect(within(banner).getByRole('button', { name: COPY.openSettings })).toBeTruthy();
    expect(within(banner).getByLabelText(COPY.dismissPermission)).toBeTruthy();
    // 배너는 전용 하단 래퍼 안에 있다(중앙 오버레이 재사용 아님).
    expect(
      within(screen.getByTestId('map-overlay-permission')).getByTestId('map-permission-banner'),
    ).toBeTruthy();
  });

  it('P2: "설정 열기" 탭 → expo-linking openSettings를 정확히 1회 호출한다', async () => {
    openSettingsMock.mockResolvedValueOnce(undefined);
    renderDeniedReady();

    fireEvent.press(screen.getByRole('button', { name: COPY.openSettings }));

    await waitFor(() => expect(openSettingsMock).toHaveBeenCalledTimes(1));
    // 설정 열기는 배너를 닫지 않는다(돌아왔을 때 여전히 거부면 그대로 안내 — D5).
    expect(screen.getByTestId('map-permission-banner')).toBeTruthy();
  });

  it('P3: openSettings 실패 → 안내 토스트, 배너 유지, 예외 전파 0', async () => {
    openSettingsMock.mockRejectedValueOnce(new Error('no settings app'));
    renderDeniedReady();

    fireEvent.press(screen.getByRole('button', { name: COPY.openSettings }));

    await waitFor(() => expect(screen.getByText(COPY.openSettingsFailed)).toBeTruthy());
    expect(screen.getByTestId('map-permission-banner')).toBeTruthy();

    // 배너가 받은 onAction 자체가 reject하지 않는다(try/await/catch로 흡수 — unhandled rejection 0).
    openSettingsMock.mockRejectedValueOnce(new Error('no settings app again'));
    const onAction = screen.UNSAFE_getByType(MapPermissionBanner).props.onAction as () => unknown;
    await expect(Promise.resolve(onAction())).resolves.toBeUndefined();
  });

  it('P4: 거부만으로는 지도 정중앙 오버레이가 뜨지 않고, 배너 래퍼는 FAB 위 하단 전폭에 둔다', () => {
    renderDeniedReady();
    expect(screen.queryByTestId('map-status-overlay')).toBeNull();

    const wrapper = screen.getByTestId('map-overlay-permission');
    expect(wrapper.props.pointerEvents).toBe('box-none');
    const style = flatStyle({ testID: 'map-overlay-permission' });
    expect(style.position).toBe('absolute');
    // 16(FAB bottom) + 46(FAB 한 변 MAP_LOCATE_BUTTON_SIZE) + 10(간격) — ui-spec §4.
    expect(style.bottom).toBe(72);
    expect(style.left).toBe(16);
    expect(style.right).toBe(16);
    // 옛 중앙 오버레이(absoluteFill + center)의 흔적이 없어야 한다.
    expect(style.top).toBeUndefined();
    expect(style.alignItems).toBeUndefined();
    expect(style.justifyContent).toBeUndefined();
  });

  it('P5-①: READY 전(로딩) + 거부 → 스피너만, READY 뒤 배너(동시 노출 0)', () => {
    setPermission({ status: LocationPermissionStatus.Denied, coords: null });
    readyPins();
    renderWithTheme(<MapTabScreen />);

    expect(screen.getByTestId('map-status-spinner')).toBeTruthy();
    expect(screen.queryByTestId('map-permission-banner')).toBeNull();

    emitMessage({ raw: JSON.stringify({ type: 'READY' }) });

    expect(screen.queryByTestId('map-status-overlay')).toBeNull();
    expect(screen.getByTestId('map-permission-banner')).toBeTruthy();
  });

  it('P5-②: 거부 + 지도 SDK 오류 → 오류만(배너 숨김)', () => {
    renderDeniedReady();
    emitMessage({ raw: JSON.stringify({ type: 'ERROR', reason: 'SDK_LOAD_FAILED' }) });

    expect(screen.getByText('지도를 불러오지 못했어요')).toBeTruthy();
    expect(screen.queryByTestId('map-permission-banner')).toBeNull();
  });

  it('P5-③: 거부 + 핀 오류 → 오류만(배너 숨김), 오류가 풀리면 배너', () => {
    setPermission({ status: LocationPermissionStatus.Denied, coords: null });
    useMuklogPinsMock.mockReturnValue({
      state: { status: 'error', message: '먹로그를 불러오지 못했어요' },
      refresh: muklogRefreshSpy,
    });
    const { rerender } = renderWithTheme(<MapTabScreen />);
    emitMessage({ raw: JSON.stringify({ type: 'READY' }) });

    expect(screen.getByText('먹로그를 불러오지 못했어요')).toBeTruthy();
    expect(screen.queryByTestId('map-permission-banner')).toBeNull();

    readyPins();
    rerender(<MapTabScreen />);

    expect(screen.queryByTestId('map-status-overlay')).toBeNull();
    expect(screen.getByTestId('map-permission-banner')).toBeTruthy();
  });

  it('P6: 닫기는 마운트 동안 유지(재렌더·핀 변경·포커스 refresh에도 안 뜸), 새 마운트는 다시 뜬다', () => {
    const { rerender, unmount } = renderDeniedReady();

    fireEvent.press(screen.getByLabelText(COPY.dismissPermission));
    expect(screen.queryByTestId('map-permission-banner')).toBeNull();

    rerender(<MapTabScreen />);
    useMuklogPinsMock.mockReturnValue({
      state: { status: 'ready', pins: [pin()] },
      refresh: muklogRefreshSpy,
    });
    rerender(<MapTabScreen />);
    mockFocus.cb?.();
    rerender(<MapTabScreen />);
    expect(screen.queryByTestId('map-permission-banner')).toBeNull();

    // 영속 저장 0 — 새 마운트(앱 재실행·재로그인에 해당)는 여전히 거부면 다시 보인다.
    unmount();
    renderDeniedReady();
    expect(screen.getByTestId('map-permission-banner')).toBeTruthy();
  });

  it('P7: 닫은 뒤 현재위치 FAB 탭 → 배너 재노출, 위치 호출 0', async () => {
    renderDeniedReady();
    fireEvent.press(screen.getByLabelText(COPY.dismissPermission));
    expect(screen.queryByTestId('map-permission-banner')).toBeNull();

    fireEvent.press(screen.getByTestId('map-locate-button'));

    await waitFor(() => expect(screen.getByTestId('map-permission-banner')).toBeTruthy());
    expect(requestSpy).not.toHaveBeenCalled();
    expect(refreshCoordsSpy).not.toHaveBeenCalled();
    expect(injectedScripts.some((s) => s.includes('"type":"RECENTER"'))).toBe(false);
  });

  it('P8: 거부 상태 FAB 탭 → 스크린리더에 권한 안내 문구를 정확히 1회 알린다', async () => {
    renderDeniedReady();
    fireEvent.press(screen.getByLabelText(COPY.dismissPermission));

    fireEvent.press(screen.getByTestId('map-locate-button'));

    await waitFor(() => expect(announceMock).toHaveBeenCalledTimes(1));
    expect(announceMock).toHaveBeenCalledWith(COPY.permissionDenied);
  });

  it('P9: 배너가 보이는 채 FAB 탭 → 배너 1개(중복 0), 알림 1회, 위치 호출 0', async () => {
    renderDeniedReady();
    expect(screen.getAllByTestId('map-permission-banner')).toHaveLength(1);

    fireEvent.press(screen.getByTestId('map-locate-button'));

    await waitFor(() => expect(announceMock).toHaveBeenCalledTimes(1));
    expect(announceMock).toHaveBeenCalledWith(COPY.permissionDenied);
    expect(screen.getAllByTestId('map-permission-banner')).toHaveLength(1);
    expect(requestSpy).not.toHaveBeenCalled();
    expect(refreshCoordsSpy).not.toHaveBeenCalled();
  });

  it('P10: 거부가 아니면(허용·미결정·요청 중) READY 뒤에도 배너가 없다', () => {
    const cases = [
      { status: LocationPermissionStatus.Granted, coords: { lat: 37.5, lng: 127.0 } },
      { status: LocationPermissionStatus.Undetermined, coords: null },
      { status: LocationPermissionStatus.Requesting, coords: null },
    ];
    cases.forEach((permissionCase) => {
      setPermission(permissionCase);
      readyPins();
      const { unmount } = renderWithTheme(<MapTabScreen />);
      emitMessage({ raw: JSON.stringify({ type: 'READY' }) });
      expect(screen.queryByTestId('map-permission-banner')).toBeNull();
      expect(screen.queryByTestId('map-overlay-permission')).toBeNull();
      unmount();
    });
  });

  it.each([
    ['닫지 않은 채', false],
    ['닫은 뒤', true],
  ])(
    'P11: 거부 → 허용(설정에서 복귀, %s) → 배너가 사라지고 새 좌표로 RECENTER가 주입된다',
    (_label, dismissFirst) => {
      const { rerender } = renderDeniedReady();
      if (dismissFirst) {
        fireEvent.press(screen.getByLabelText(COPY.dismissPermission));
      } else {
        expect(screen.getByTestId('map-permission-banner')).toBeTruthy();
      }
      expect(injectedScripts.some((s) => s.includes('"type":"RECENTER"'))).toBe(false);

      // 훅의 재활성화 재조회가 Granted + fresh 좌표로 전이시킨 상태.
      setPermission({
        status: LocationPermissionStatus.Granted,
        coords: { lat: 37.61, lng: 127.02 },
        coordsSource: LocationCoordsSource.Fresh,
      });
      rerender(<MapTabScreen />);

      expect(screen.queryByTestId('map-permission-banner')).toBeNull();
      const recenter = injectedScripts.filter((s) => s.includes('"type":"RECENTER"'));
      expect(recenter.length).toBeGreaterThanOrEqual(1);
      expect(recenter[recenter.length - 1]).toContain('"lat":37.61');
      expect(recenter[recenter.length - 1]).toContain('"lng":127.02');
    },
  );

  it('P12: 버튼 접근성 — 설정 열기(role button + 힌트), 닫기(role button + 라벨)', () => {
    renderDeniedReady();
    const action = screen.getByRole('button', { name: COPY.openSettings });
    expect(action.props.accessibilityHint).toBe(COPY.openSettingsHint);
    expect(screen.getByRole('button', { name: COPY.dismissPermission })).toBeTruthy();
  });

  it('E15: 닫힘 + 중앙 오류 중 FAB 탭 → 알림은 즉시, 배너는 오류가 풀린 뒤 다시 보인다', async () => {
    const { rerender } = renderDeniedReady();
    fireEvent.press(screen.getByLabelText(COPY.dismissPermission));
    useMuklogPinsMock.mockReturnValue({
      state: { status: 'error', message: '먹로그를 불러오지 못했어요' },
      refresh: muklogRefreshSpy,
    });
    rerender(<MapTabScreen />);

    fireEvent.press(screen.getByTestId('map-locate-button'));

    await waitFor(() => expect(announceMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('map-permission-banner')).toBeNull();

    readyPins();
    rerender(<MapTabScreen />);
    expect(screen.getByTestId('map-permission-banner')).toBeTruthy();
  });
});

// ── map-nearby-feedback (plan §5-1 B S1~S20, UX 백로그 U10 ①~④) ─────────────────────────────
//   seam: 화면 렌더 결과(pill testID·문구·스피너·accessibilityState, 중앙 카드 문구, 토스트 문구) + 모킹된 훅 반환
//   (researchState · research()가 resolve하는 결과) + AccessibilityInfo(RN 기본 목) + WebView 메시지(READY/ERROR)
//   + 가짜 시간 + export 상수 MAP_BOOT_TIMEOUT_MS. 훅 상태 기계는 useNearbyPlaces spec(H1~H16), pill 비주얼은
//   MapResearchButton spec 몫이다. pill 케이스는 READY를 먼저 발화한다(부팅 로딩이 중앙 안내로 우선하므로).
describe('MapTabScreen — 주변 조회·지도 준비 피드백(map-nearby-feedback)', () => {
  // 카피는 spec에 문자 그대로 적는다 — 상수를 import하면 상수 오타가 spec까지 따라와 잠금이 풀린다.
  const COPY = {
    idle: '이 지역에서 검색',
    searching: '검색하는 중이에요',
    failedLine: '주변 음식점을 불러오지 못했어요 · 다시 시도',
    failedMessage: '주변 음식점을 불러오지 못했어요',
    nearbyEmpty: '음식점이 없어요. 지도를 옮겨보세요',
    loading: '지도를 불러오는 중이에요',
    sdkError: '지도를 불러오지 못했어요',
    pinsError: '먹로그를 불러오지 못했어요',
    retry: '다시 시도',
  } as const;

  const readyPins = () =>
    useMuklogPinsMock.mockReturnValue({ state: { status: 'ready', pins: [] }, refresh: muklogRefreshSpy });
  const errorPins = () =>
    useMuklogPinsMock.mockReturnValue({
      state: { status: 'error', message: COPY.pinsError },
      refresh: muklogRefreshSpy,
    });
  const emitReady = () => emitMessage({ raw: JSON.stringify({ type: 'READY' }) });
  const emitSdkError = () =>
    emitMessage({ raw: JSON.stringify({ type: 'ERROR', reason: 'SDK_LOAD_FAILED' }) });

  /** 핀 ready + 주어진 훅 상태로 렌더하고 READY까지 보낸다(중앙 로딩이 걷힌 상태). */
  const renderReadyWith = (over: {
    researchState: NearbyResearchState;
    researchOutcome?: NearbyResearchOutcome;
  }) => {
    readyPins();
    setNearby(over);
    const view = renderWithTheme(<MapTabScreen />);
    emitReady();
    return view;
  };

  /** pill 탭 → handleResearch의 await(research 결과)까지 흘린다. */
  const pressResearch = async () => {
    await act(async () => {
      fireEvent.press(screen.getByTestId('map-research-button'));
    });
  };

  /** 콘솔 로그 중 지도 준비 제한 시간 만료 계측(`[nearby] map:boot-timeout`) 줄 수. */
  const bootTimeoutTraces = ({ logSpy }: { logSpy: jest.SpyInstance }): number =>
    logSpy.mock.calls.filter((call) => String(call[0]).includes('map:boot-timeout')).length;

  describe('재검색 pill 상태(① 검색 중 · ② 실패)', () => {
    it('S1 Searching → pill이 제자리에서 스피너 + "검색하는 중이에요"를 보이고 busy·disabled를 알린다', () => {
      renderReadyWith({ researchState: NearbyResearchState.Searching });

      const pill = screen.getByTestId('map-research-button');
      expect(within(pill).getByText(COPY.searching)).toBeTruthy();
      expect(within(pill).getByTestId('map-research-spinner')).toBeTruthy();
      expect(within(pill).queryByText(COPY.idle)).toBeNull();
      expect(pill.props.accessibilityState).toEqual(
        expect.objectContaining({ busy: true, disabled: true }),
      );
    });

    it('S2 Searching 중 pill을 3번 눌러도 research 호출 0(중복 조회 없음)', async () => {
      renderReadyWith({ researchState: NearbyResearchState.Searching });

      await pressResearch();
      await pressResearch();
      await pressResearch();

      expect(researchSpy).not.toHaveBeenCalled();
    });

    it('S3 Failed → "주변 음식점을 불러오지 못했어요 · 다시 시도" 한 줄, 1번 누르면 research 1회', async () => {
      renderReadyWith({ researchState: NearbyResearchState.Failed });

      const pill = screen.getByTestId('map-research-button');
      expect(within(pill).getByText(COPY.failedLine)).toBeTruthy();
      expect(within(pill).getByText(COPY.retry)).toBeTruthy();
      expect(pill.props.accessibilityState?.disabled).toBeFalsy();

      await pressResearch();

      expect(researchSpy).toHaveBeenCalledTimes(1);
    });

    it('Idle → "이 지역에서 검색"(검색 아이콘) — 매핑이 Idle을 다른 모양으로 바꾸지 않는다', () => {
      renderReadyWith({ researchState: NearbyResearchState.Idle });
      const pill = screen.getByTestId('map-research-button');
      expect(within(pill).getByText(COPY.idle)).toBeTruthy();
      expect(within(pill).getByTestId('icon-search')).toBeTruthy();
    });

    it('Hidden → pill 없음(READY 뒤에도)', () => {
      renderReadyWith({ researchState: NearbyResearchState.Hidden });
      expect(screen.queryByTestId('map-overlay-research')).toBeNull();
      expect(screen.queryByTestId('map-research-button')).toBeNull();
    });

    it('래퍼 좌우 16(큰 글자에서 실패 pill이 화면 끝까지 넓어지지 않게) · top·pointerEvents 불변', () => {
      renderReadyWith({ researchState: NearbyResearchState.Failed });
      const wrapper = screen.getByTestId('map-overlay-research');
      const style = StyleSheet.flatten(wrapper.props.style) as Record<string, unknown>;
      expect(style.paddingHorizontal).toBe(16);
      expect(style.top).toBe(96);
      expect(wrapper.props.pointerEvents).toBe('box-none');
    });
  });

  describe('누른 조회의 결과 안내(② 실패 알림 · ③ 0건 토스트)', () => {
    // 토스트 진입·자동 사라짐 애니메이션이 실제 시간으로 테스트 밖까지 흘러 act 경고를 내지 않게 가짜 시간으로 돈다(qa-logic L4).
    beforeEach(() => {
      jest.useFakeTimers();
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it('S4 누른 조회가 실패하면 스크린리더에 "주변 음식점을 불러오지 못했어요"를 정확히 1회 알리고 토스트는 없다', async () => {
      renderReadyWith({
        researchState: NearbyResearchState.Idle,
        researchOutcome: NearbyResearchOutcome.Failed,
      });

      await pressResearch();

      expect(researchSpy).toHaveBeenCalledTimes(1);
      expect(announceMock).toHaveBeenCalledTimes(1);
      expect(announceMock).toHaveBeenCalledWith(COPY.failedMessage);
      expect(screen.queryByTestId('toast-pill')).toBeNull();
    });

    it('S5 누른 조회가 0건이면 토스트 "음식점이 없어요. 지도를 옮겨보세요"(상태 + 다음 행동) + 같은 문구 알림 1회', async () => {
      renderReadyWith({
        researchState: NearbyResearchState.Idle,
        researchOutcome: NearbyResearchOutcome.Empty,
      });

      await pressResearch();

      const toast = screen.getByTestId('toast-pill');
      expect(within(toast).getByText(COPY.nearbyEmpty)).toBeTruthy();
      // 톤은 neutral — 0건은 성공이 아니다. positive면 ✓와 성공 배경이 붙어 "0건"이 완료처럼 보인다(qa-logic L3).
      expect(within(toast).queryByText('✓')).toBeNull();
      expect(announceMock).toHaveBeenCalledTimes(1);
      expect(announceMock).toHaveBeenCalledWith(COPY.nearbyEmpty);

      // 토스트 자동 사라짐(타이머) → 퇴장 애니메이션(다음 렌더에서 시작)까지 테스트 안에서 끝낸다.
      await act(async () => {
        jest.advanceTimersByTime(5_000);
      });
      await act(async () => {
        jest.advanceTimersByTime(5_000);
      });
      expect(screen.queryByTestId('toast-pill')).toBeNull();
    });

    it('S6 자동 조회의 0건은 알리지 않는다(누르지 않았으면 토스트·알림 0)', () => {
      readyPins();
      setNearby({ status: 'loading', items: [] });
      const { rerender } = renderWithTheme(<MapTabScreen />);
      emitReady();
      setNearby({ status: 'ready', items: [] });
      rerender(<MapTabScreen />);
      rerender(<MapTabScreen />);

      expect(screen.queryByTestId('toast-pill')).toBeNull();
      expect(screen.queryByText(COPY.nearbyEmpty)).toBeNull();
      expect(announceMock).not.toHaveBeenCalled();
    });

    it.each([
      ['S7 Found', NearbyResearchOutcome.Found],
      ['S8 Skipped', NearbyResearchOutcome.Skipped],
    ] as const)('%s → 토스트 0 · 알림 0(핀 등장 자체가 피드백 / 조회하지 않음)', async (_label, outcome) => {
      renderReadyWith({ researchState: NearbyResearchState.Idle, researchOutcome: outcome });

      await pressResearch();
      await act(async () => {}); // 결과 처리 뒤 남은 마이크로태스크까지 흘린다

      expect(researchSpy).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('toast-pill')).toBeNull();
      expect(announceMock).not.toHaveBeenCalled();
    });
  });

  describe('안내 우선순위(한 자리 한 가지)', () => {
    it.each([
      NearbyResearchState.Idle,
      NearbyResearchState.Searching,
      NearbyResearchState.Failed,
    ])('S9 지도 가운데 안내(로딩·핀 오류·지도 오류)가 있으면 pill(%s)을 숨기고, 걷히면 다시 보인다', (researchState) => {
      readyPins();
      setNearby({ researchState });
      const { rerender } = renderWithTheme(<MapTabScreen />);

      // ① READY 전 — 부팅 로딩
      expect(screen.getByTestId('map-status-spinner')).toBeTruthy();
      expect(screen.queryByTestId('map-research-button')).toBeNull();
      emitReady();
      expect(screen.getByTestId('map-research-button')).toBeTruthy();

      // ② READY 뒤 핀 오류
      errorPins();
      rerender(<MapTabScreen />);
      expect(screen.getByText(COPY.pinsError)).toBeTruthy();
      expect(screen.queryByTestId('map-research-button')).toBeNull();
      readyPins();
      rerender(<MapTabScreen />);
      expect(screen.getByTestId('map-research-button')).toBeTruthy();

      // ③ READY 뒤 지도 SDK 오류
      emitSdkError();
      expect(screen.getByText(COPY.sdkError)).toBeTruthy();
      expect(screen.queryByTestId('map-research-button')).toBeNull();
      emitReady();
      expect(screen.queryByTestId('map-status-overlay')).toBeNull();
      expect(screen.getByTestId('map-research-button')).toBeTruthy();
    });

    it('S10 권한 거부 + Failed → 상단 pill과 하단 배너가 공존하고, 핀 오류가 오면 둘 다 숨고 가운데 카드만 남는다', () => {
      setPermission({ status: LocationPermissionStatus.Denied, coords: null });
      readyPins();
      setNearby({ researchState: NearbyResearchState.Failed });
      const { rerender } = renderWithTheme(<MapTabScreen />);
      emitReady();

      expect(screen.getByTestId('map-research-button')).toBeTruthy();
      expect(screen.getByTestId('map-permission-banner')).toBeTruthy();

      errorPins();
      rerender(<MapTabScreen />);

      expect(screen.queryByTestId('map-research-button')).toBeNull();
      expect(screen.queryByTestId('map-permission-banner')).toBeNull();
      expect(screen.getAllByTestId('map-status-overlay')).toHaveLength(1);
      expect(screen.getByText(COPY.pinsError)).toBeTruthy();
    });
  });

  describe('④ 지도 준비 제한 시간(1회성 워치독)', () => {
    let logSpy: jest.SpyInstance;

    beforeEach(() => {
      jest.useFakeTimers();
      logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });
    afterEach(() => {
      logSpy.mockRestore();
      jest.useRealTimers();
    });

    const advance = ({ ms }: { ms: number }) => {
      act(() => {
        jest.advanceTimersByTime(ms);
      });
    };

    /** READY·ERROR 없이 제한 시간을 정확히 채워 만료시킨다. */
    const renderAndExpire = () => {
      readyPins();
      const view = renderWithTheme(<MapTabScreen />);
      advance({ ms: MAP_BOOT_TIMEOUT_MS });
      return view;
    };

    it('S18 제한 시간은 10초다', () => {
      expect(MAP_BOOT_TIMEOUT_MS).toBe(10_000);
    });

    it('S11 READY·ERROR 없이 제한 시간이 지나면 로딩 카드가 "지도를 불러오지 못했어요" + 다시 시도로 바뀐다(1ms 경계)', () => {
      readyPins();
      renderWithTheme(<MapTabScreen />);

      advance({ ms: MAP_BOOT_TIMEOUT_MS - 1 });
      expect(screen.getByTestId('map-status-spinner')).toBeTruthy();
      expect(screen.getByText(COPY.loading)).toBeTruthy();
      expect(screen.queryByText(COPY.sdkError)).toBeNull();
      expect(bootTimeoutTraces({ logSpy })).toBe(0);

      advance({ ms: 1 });
      expect(screen.getByText(COPY.sdkError)).toBeTruthy();
      expect(screen.getByTestId('map-status-action')).toBeTruthy();
      expect(screen.queryByTestId('map-status-spinner')).toBeNull();
      expect(bootTimeoutTraces({ logSpy })).toBe(1);
    });

    it('S12 만료 뒤 늦게 READY가 오면 카드가 걷히고 INIT이 1번 주입된다(자동 복구)', () => {
      renderAndExpire();
      expect(screen.getByText(COPY.sdkError)).toBeTruthy();

      emitReady();

      expect(screen.queryByTestId('map-status-overlay')).toBeNull();
      expect(injectedScripts.filter((script) => script.includes('INIT'))).toHaveLength(1);
    });

    it('S13 5초에 READY가 오면 20초가 더 지나도 오류 카드·만료 계측 0', () => {
      readyPins();
      renderWithTheme(<MapTabScreen />);
      advance({ ms: 5_000 });
      emitReady();

      advance({ ms: 20_000 });

      expect(screen.queryByText(COPY.sdkError)).toBeNull();
      expect(screen.queryByTestId('map-status-overlay')).toBeNull();
      expect(bootTimeoutTraces({ logSpy })).toBe(0);
    });

    it('S14 3초에 ERROR가 오면 그 카드 1개가 유지되고 20초 뒤에도 만료 계측 0', () => {
      readyPins();
      renderWithTheme(<MapTabScreen />);
      advance({ ms: 3_000 });
      emitSdkError();
      expect(screen.getByText(COPY.sdkError)).toBeTruthy();

      advance({ ms: 20_000 });

      expect(screen.getAllByTestId('map-status-overlay')).toHaveLength(1);
      expect(screen.getByText(COPY.sdkError)).toBeTruthy();
      expect(bootTimeoutTraces({ logSpy })).toBe(0);
    });

    it('S15 1회성 — 만료 뒤 "다시 시도"는 카드를 유지하고(F1) 제한 시간을 다시 켜지 않는다', () => {
      renderAndExpire();
      expect(bootTimeoutTraces({ logSpy })).toBe(1);

      fireEvent.press(screen.getByText(COPY.retry));
      expect(screen.getByText(COPY.sdkError)).toBeTruthy();
      expect(screen.queryByTestId('map-status-spinner')).toBeNull();

      advance({ ms: 3 * MAP_BOOT_TIMEOUT_MS });

      expect(bootTimeoutTraces({ logSpy })).toBe(1);
      expect(screen.getAllByTestId('map-status-overlay')).toHaveLength(1);
    });

    it('S16 만료 전에 화면이 사라지면 타이머도 해제된다(만료 계측 0 · console.error 0)', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      readyPins();
      const { unmount } = renderWithTheme(<MapTabScreen />);
      advance({ ms: MAP_BOOT_TIMEOUT_MS - 1 });

      unmount();
      advance({ ms: 2 * MAP_BOOT_TIMEOUT_MS });

      expect(bootTimeoutTraces({ logSpy })).toBe(0);
      expect(errorSpy).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('S17 만료는 네트워크 호출을 만들지 않는다(선로딩·재검색·뷰포트·핀 재조회 수 동일)', () => {
      readyPins();
      renderWithTheme(<MapTabScreen />);
      advance({ ms: MAP_BOOT_TIMEOUT_MS - 1 });
      const before = {
        preload: preloadSpy.mock.calls.length,
        research: researchSpy.mock.calls.length,
        setBounds: setBoundsSpy.mock.calls.length,
        refresh: muklogRefreshSpy.mock.calls.length,
      };

      advance({ ms: 1 });
      expect(screen.getByText(COPY.sdkError)).toBeTruthy();

      expect({
        preload: preloadSpy.mock.calls.length,
        research: researchSpy.mock.calls.length,
        setBounds: setBoundsSpy.mock.calls.length,
        refresh: muklogRefreshSpy.mock.calls.length,
      }).toEqual(before);
    });

    it('S19 부팅 중 핀 오류 카드의 "다시 시도"가 제한 시간을 끄지 않는다 — 만료되면 지도 오류 카드가 우선한다', () => {
      errorPins();
      renderWithTheme(<MapTabScreen />);
      expect(screen.getByText(COPY.pinsError)).toBeTruthy();

      fireEvent.press(screen.getByText(COPY.retry));
      advance({ ms: MAP_BOOT_TIMEOUT_MS });

      expect(screen.getByText(COPY.sdkError)).toBeTruthy();
      expect(screen.queryByText(COPY.pinsError)).toBeNull();
      expect(bootTimeoutTraces({ logSpy })).toBe(1);
    });

    it('S20 지도 오류·핀 오류 카드의 "다시 시도"는 주변 조회를 만들지 않는다(research·preload 추가 0)', () => {
      const { rerender } = renderAndExpire();
      const preloadBefore = preloadSpy.mock.calls.length;
      fireEvent.press(screen.getByText(COPY.retry)); // 지도 오류(만료) 카드

      emitReady();
      errorPins();
      rerender(<MapTabScreen />);
      fireEvent.press(screen.getByText(COPY.retry)); // 핀 오류 카드

      expect(researchSpy).not.toHaveBeenCalled();
      expect(preloadSpy.mock.calls.length).toBe(preloadBefore);
      expect(muklogRefreshSpy).toHaveBeenCalledTimes(2); // 재시도 = 핀 재조회(기존 동작)
    });
  });
});
