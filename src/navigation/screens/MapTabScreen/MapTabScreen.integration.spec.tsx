// src/navigation/screens/MapTabScreen/MapTabScreen.integration.spec.tsx
// 재검색 pill 통합 검증(map-nearby-feedback, qa-logic L1) — 실제 useNearbyPlaces + 실제 MapTabScreen을 함께 렌더한다.
//   MapTabScreen.spec은 훅을 고정 값으로 모킹해 상태 전환을 만들 수 없고, 훅 spec은 화면 요소를 모른다.
//   그 사이(훅의 응답 처리 렌더 순서 → 화면의 pill 마운트 여부)를 여기서 본다.
//   핵심 계약: 사용자가 누른 pill은 검색 중 → 실패/이 지역에서 검색으로 바뀌는 동안 **같은 요소**로 남는다.
//     중간 렌더에서 pill이 한 번이라도 사라지면 새 요소가 만들어지고, 방금 누른 버튼에서 스크린리더 포커스가 떠난다.
//   모킹은 실제 훅의 바깥 경계만 — searchNearby(네트워크) · supabase auth(세션 없음 → 캐시 미접촉) · AsyncStorage ·
//   WebView · 화면의 다른 훅(핀·권한·위시).
import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { act, fireEvent, screen, within } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

jest.mock('expo-linking', () => ({ ...jest.requireActual('expo-linking'), openSettings: jest.fn() }));
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return { ...actual, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock(
  'react-native-webview',
  () => {
    const Rn = require('react-native');
    return { WebView: (props: any) => <Rn.View {...props} /> };
  },
  { virtual: true },
);
jest.mock('@/lib/env', () => ({ env: { KAKAO_JS_KEY: 'TEST_KEY' } }));
jest.mock('@/features/map/useMuklogPins', () => ({ useMuklogPins: jest.fn() }));
jest.mock('@/features/map/useLocationPermission', () => ({ useLocationPermission: jest.fn() }));
jest.mock('@/features/map/useWishPins', () => ({ useWishPins: jest.fn() }));
// useNavigation: 우리 맛집 카드 → 먹로그 상세 배선(map-pin-card-detail)이 화면에서 호출한다. 여기선 이동을 보지 않아 no-op.
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
  useNavigation: () => ({ navigate: jest.fn() }),
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
// 실제 useNearbyPlaces의 바깥 경계.
jest.mock('@/features/map/searchNearby', () => ({ searchNearby: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn() },
}));
jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: null } })) } },
}));
// MapWebView 모킹 — onMessage를 testID로 노출해 READY·BOUNDS_CHANGED를 직접 발화한다(MapTabScreen.spec과 같은 방식).
jest.mock('@/features/map/components', () => {
  const Rn = require('react-native');
  const ReactLib = require('react');
  const actual = jest.requireActual('@/features/map/components');
  return {
    ...actual,
    MapWebView: ({ onMessage, webviewRef, children }: any) => {
      ReactLib.useImperativeHandle(webviewRef, () => ({ injectJavaScript: jest.fn() }));
      return (
        <Rn.View testID="map-webview-mock" onMessage={onMessage}>
          {children}
        </Rn.View>
      );
    },
  };
});

import { searchNearby } from '@/features/map/searchNearby';
import { LocationPermissionStatus } from '@/features/map/types';
import { useLocationPermission } from '@/features/map/useLocationPermission';
import { useMuklogPins } from '@/features/map/useMuklogPins';
import { useWishPins } from '@/features/map/useWishPins';

import { MapTabScreen } from './MapTabScreen';

const searchMock = searchNearby as jest.Mock;
const announceMock = AccessibilityInfo.announceForAccessibility as jest.Mock;

// 카피는 문자 그대로 적는다 — 상수를 import하면 상수 오타가 spec까지 따라와 잠금이 풀린다.
const COPY = {
  idle: '이 지역에서 검색',
  searching: '검색하는 중이에요',
  failedLine: '주변 음식점을 불러오지 못했어요 · 다시 시도',
  failedMessage: '주변 음식점을 불러오지 못했어요',
  nearbyEmpty: '음식점이 없어요. 지도를 옮겨보세요',
} as const;

/** 수동으로 응답을 정하는 searchNearby 호출 1건. */
type DeferredCall = { resolve: (value: unknown) => void; reject: (reason: unknown) => void };

const item = ({ id }: { id: string }) => ({
  kakaoPlaceId: id,
  placeName: `place-${id}`,
  categoryName: '음식점 > 한식',
  categoryGroupCode: 'FD6',
  lat: 37.5,
  lng: 127.0,
  distance: 100,
});

/** 이후 searchNearby 호출마다 pending Promise를 만들고 그 resolve/reject를 호출 순서대로 모은다. */
const deferSearches = (): DeferredCall[] => {
  const calls: DeferredCall[] = [];
  searchMock.mockImplementation(
    () =>
      new Promise((resolve, reject) => {
        calls.push({ resolve, reject });
      }),
  );
  return calls;
};

/** WebView → RN 메시지 1건을 발화한다. */
const emit = ({ message }: { message: unknown }) => {
  fireEvent(screen.getByTestId('map-webview-mock'), 'message', {
    nativeEvent: { data: JSON.stringify(message) },
  });
};

/** 중심 위도만 바꾼 뷰포트(폭 0.02). 0.5 이상 옮기면 재검색 임계를 넘는다. */
const emitBounds = ({ lat }: { lat: number }) =>
  emit({
    message: {
      type: 'BOUNDS_CHANGED',
      sw: { lat: lat - 0.01, lng: 126.99 },
      ne: { lat: lat + 0.01, lng: 127.01 },
    },
  });

/** 하이드레이션(마이크로태스크) + 0틱 조회 타이머 + 응답을 모두 소화한다. */
const flush = async () => {
  await act(async () => {
    jest.advanceTimersByTime(0);
  });
  await act(async () => {
    jest.advanceTimersByTime(0);
  });
};

const pressPill = async () => {
  await act(async () => {
    fireEvent.press(screen.getByTestId('map-research-button'));
  });
};

/** READY + 첫 조회(first-bounds) 성공 + 임계 초과 이동 → "이 지역에서 검색" pill까지. invoke 1. */
const renderToIdle = async () => {
  searchMock.mockResolvedValueOnce([item({ id: '1' })]);
  renderWithTheme(<MapTabScreen />);
  await flush();
  emit({ message: { type: 'READY' } });
  emitBounds({ lat: 37.5 });
  await flush();
  emitBounds({ lat: 38.0 });
  expect(within(screen.getByTestId('map-research-button')).getByText(COPY.idle)).toBeTruthy();
  expect(searchMock).toHaveBeenCalledTimes(1);
};

beforeEach(() => {
  jest.useFakeTimers();
  searchMock.mockReset();
  announceMock.mockClear();
  (useMuklogPins as jest.Mock).mockReturnValue({
    state: { status: 'ready', pins: [] },
    refresh: jest.fn(),
  });
  // 좌표·핀 없음 → 선로딩 스킵 → 첫 BOUNDS_CHANGED가 첫 조회를 맡는다.
  (useLocationPermission as jest.Mock).mockReturnValue({
    status: LocationPermissionStatus.Granted,
    coords: null,
    coordsSource: null,
    request: jest.fn(),
    refreshCoords: jest.fn(),
  });
  (useWishPins as jest.Mock).mockReturnValue({
    state: { status: 'ready', pins: [] },
    refresh: jest.fn(),
  });
});
afterEach(() => {
  jest.useRealTimers();
});

describe('MapTabScreen × useNearbyPlaces — 재검색 pill은 전환 내내 같은 요소(map-nearby-feedback)', () => {
  it('N1 누른 조회가 실패하면 검색 중 pill이 그 자리에서 실패 pill로 바뀐다(재마운트 0) · 알림 1회 · 조회 +1', async () => {
    await renderToIdle();
    const searches = deferSearches();

    await pressPill();
    const searching = screen.getByTestId('map-research-button');
    expect(within(searching).getByText(COPY.searching)).toBeTruthy();

    await act(async () => {
      searches[0].reject(new Error('net'));
    });

    const failed = screen.getByTestId('map-research-button');
    expect(within(failed).getByText(COPY.failedLine)).toBeTruthy();
    // 요소 동일성은 === 로 본다(toBe의 실패 diff는 렌더 트리 전체를 출력한다).
    expect(failed === searching).toBe(true);
    expect(announceMock).toHaveBeenCalledTimes(1);
    expect(announceMock).toHaveBeenCalledWith(COPY.failedMessage);
    expect(searchMock).toHaveBeenCalledTimes(2);
  });

  it('N2 검색 중 지도를 멀리 옮긴 뒤 성공하면 검색 중 pill이 그 자리에서 "이 지역에서 검색"으로 돌아온다(재마운트 0)', async () => {
    await renderToIdle();
    const searches = deferSearches();

    await pressPill();
    const searching = screen.getByTestId('map-research-button');
    emitBounds({ lat: 38.5 });
    await act(async () => {
      searches[0].resolve([item({ id: 'b' })]);
    });

    const idle = screen.getByTestId('map-research-button');
    expect(within(idle).getByText(COPY.idle)).toBeTruthy();
    expect(idle === searching).toBe(true);
    expect(announceMock).not.toHaveBeenCalled();
  });

  it('N3 누르는 순간(이 지역에서 검색 → 검색 중)과 실패 뒤 다시 시도(실패 → 검색 중)도 같은 요소', async () => {
    await renderToIdle();
    const searches = deferSearches();
    const idle = screen.getByTestId('map-research-button');

    await pressPill();
    expect(screen.getByTestId('map-research-button') === idle).toBe(true);
    await act(async () => {
      searches[0].reject(new Error('net'));
    });
    await pressPill(); // 다시 시도

    const retrying = screen.getByTestId('map-research-button');
    expect(within(retrying).getByText(COPY.searching)).toBeTruthy();
    expect(retrying === idle).toBe(true);
    expect(searchMock).toHaveBeenCalledTimes(3);
  });

  it('N4 누른 조회가 0건이면 pill이 퇴장하고 neutral 토스트 1개 + 같은 문구 알림 1회', async () => {
    await renderToIdle();
    searchMock.mockResolvedValueOnce([]);

    await pressPill();
    await flush();

    const toast = screen.getByTestId('toast-pill');
    expect(within(toast).getByText(COPY.nearbyEmpty)).toBeTruthy();
    expect(within(toast).queryByText('✓')).toBeNull();
    expect(announceMock).toHaveBeenCalledTimes(1);
    expect(announceMock).toHaveBeenCalledWith(COPY.nearbyEmpty);
    expect(screen.queryByTestId('map-research-button')).toBeNull();
    expect(searchMock).toHaveBeenCalledTimes(2);
  });
});
