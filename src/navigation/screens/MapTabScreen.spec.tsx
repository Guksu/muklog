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

// MapWebView 모킹 — onMessage를 testID로 노출해 직접 발화(MARKER_TAP 등)할 수 있게 한다.
jest.mock('@/features/map/components', () => {
  const Rn = require('react-native');
  const actual = jest.requireActual('@/features/map/components');
  return {
    ...actual,
    MapWebView: ({ onMessage, children }: any) => (
      <Rn.View testID="map-webview-mock" onMessage={onMessage}>
        {children}
      </Rn.View>
    ),
  };
});

import { useMuklogPins } from '@/features/map/useMuklogPins';
import { useLocationPermission } from '@/features/map/useLocationPermission';
import { LocationPermissionStatus } from '@/features/map/types';

import { MapTabScreen } from './MapTabScreen';

const useMuklogPinsMock = useMuklogPins as jest.Mock;
const useLocationPermissionMock = useLocationPermission as jest.Mock;

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
  setPermission();
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

  it('MARKER_TAP(id) 수신 시 선택 스팟 카드에 해당 먹로그를 표시한다', () => {
    useMuklogPinsMock.mockReturnValue({
      state: { status: 'ready', pins: [pin({ muklogId: 'm9', placeName: '스시 오마카세' })] },
      refresh: jest.fn(),
    });
    renderWithTheme(<MapTabScreen />);
    // 탭 전엔 선택 카드 없음.
    expect(screen.queryByTestId('selected-spot-card')).toBeNull();
    emitMessage({ raw: JSON.stringify({ type: 'MARKER_TAP', id: 'm9' }) });
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
});
