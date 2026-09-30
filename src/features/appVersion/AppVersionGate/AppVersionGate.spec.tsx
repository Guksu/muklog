// src/features/appVersion/AppVersionGate/AppVersionGate.spec.tsx
// 버전 게이트 래퍼 단위 테스트 (app-version-gate plan §5 T7·T11·§5-1).
//   checking/none→자식 렌더 / force→ForceUpdateScreen(자식 대체)+Linking / suggest→자식+모달+dismiss / storeUrl null→열기 0.
//   useAppVersionGate 훅 모킹(상태 주입) + expo-linking·BackHandler 모킹.
//   invite-share(U72, plan R6 — AC4): 통과 분기(checking·none·suggest)의 자식이 useAppStoreLinks()로 훅의 storeUrlIos를 읽는다.
//     게이트 상태가 바뀌어도 자식(앱 본체)을 다시 마운트하지 않는다(QA 2차 S4 — 콜드스타트 1회 원칙).
import React from 'react';
import { Text } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

jest.mock('../useAppVersionGate', () => ({ useAppVersionGate: jest.fn() }));
jest.mock('expo-linking', () => ({ openURL: jest.fn() }));

import * as Linking from 'expo-linking';
import { useAppStoreLinks } from '../appStoreLinks';
import { useAppVersionGate, type VersionGateState } from '../useAppVersionGate';
import { AppVersionGate } from './AppVersionGate';

const gateMock = useAppVersionGate as jest.Mock;
const openURL = Linking.openURL as jest.Mock;
const dismissSuggest = jest.fn();

const setGate = (state: VersionGateState) => {
  gateMock.mockReturnValue({ state, dismissSuggest });
};

const child = <Text testID="app-child">본체</Text>;

beforeEach(() => {
  gateMock.mockReset();
  openURL.mockReset();
  dismissSuggest.mockReset();
});

describe('AppVersionGate (T7·T11)', () => {
  it('checking이면 자식(본체)을 렌더한다(콜드스타트 비차단)', () => {
    setGate({ status: 'checking' });
    renderWithTheme(<AppVersionGate>{child}</AppVersionGate>);
    expect(screen.getByTestId('app-child')).toBeTruthy();
    expect(screen.queryByTestId('force-update-body')).toBeNull();
  });

  it('none이면 자식만 렌더한다(fail-open)', () => {
    setGate({ status: 'none' });
    renderWithTheme(<AppVersionGate>{child}</AppVersionGate>);
    expect(screen.getByTestId('app-child')).toBeTruthy();
    expect(screen.queryByTestId('update-suggest-card')).toBeNull();
  });

  it('force면 ForceUpdateScreen으로 자식을 대체한다', () => {
    setGate({ status: 'force', storeUrl: 'https://store/app' });
    renderWithTheme(<AppVersionGate>{child}</AppVersionGate>);
    expect(screen.queryByTestId('app-child')).toBeNull(); // 자식 차단
    expect(screen.getByTestId('force-update-body')).toBeTruthy();
  });

  it('force에서 업데이트 버튼 탭 → Linking.openURL(storeUrl)', () => {
    setGate({ status: 'force', storeUrl: 'https://store/app' });
    renderWithTheme(<AppVersionGate>{child}</AppVersionGate>);
    fireEvent.press(screen.getByTestId('force-update-button'));
    expect(openURL).toHaveBeenCalledWith('https://store/app');
  });

  it('force + storeUrl null이면 버튼 부재 → 열기 시도 0(안내문만)', () => {
    setGate({ status: 'force', storeUrl: null });
    renderWithTheme(<AppVersionGate>{child}</AppVersionGate>);
    expect(screen.queryByTestId('force-update-button')).toBeNull();
    expect(screen.getByTestId('force-update-guidance')).toBeTruthy();
    expect(openURL).not.toHaveBeenCalled();
  });

  it('suggest면 자식 + 권유 모달을 함께 렌더한다', () => {
    setGate({ status: 'suggest', latestVersion: '2.0.0', storeUrl: 'https://store/app' });
    renderWithTheme(<AppVersionGate>{child}</AppVersionGate>);
    expect(screen.getByTestId('app-child')).toBeTruthy();
    expect(screen.getByTestId('update-suggest-card')).toBeTruthy();
  });

  it('suggest 모달 "업데이트" 탭 → Linking, "나중에" 탭 → dismissSuggest', () => {
    setGate({ status: 'suggest', latestVersion: '2.0.0', storeUrl: 'https://store/app' });
    renderWithTheme(<AppVersionGate>{child}</AppVersionGate>);
    fireEvent.press(screen.getByTestId('update-suggest-update'));
    expect(openURL).toHaveBeenCalledWith('https://store/app');
    fireEvent.press(screen.getByTestId('update-suggest-dismiss'));
    expect(dismissSuggest).toHaveBeenCalledTimes(1);
  });
});

describe('AppVersionGate → 스토어 링크 제공 (invite-share AC4)', () => {
  const STORE_URL_IOS = 'https://apps.apple.com/app/id1';
  // JSON 문자열로 그려 null과 undefined를 구분한다.
  const LinksProbe = () => <Text testID="links-probe">{JSON.stringify(useAppStoreLinks().storeUrlIos)}</Text>;

  const setGateWithLinks = ({ state, storeUrlIos }: { state: VersionGateState; storeUrlIos?: string | null }) => {
    gateMock.mockReturnValue({ state, dismissSuggest, storeUrlIos });
  };

  it('none이면 자식이 훅의 storeUrlIos를 읽는다', () => {
    setGateWithLinks({ state: { status: 'none' }, storeUrlIos: STORE_URL_IOS });
    renderWithTheme(
      <AppVersionGate>
        <LinksProbe />
      </AppVersionGate>,
    );
    expect(screen.getByTestId('links-probe').props.children).toBe(JSON.stringify(STORE_URL_IOS));
  });

  it('suggest면 권유 모달과 함께 자식이 같은 링크를 읽는다', () => {
    setGateWithLinks({
      state: { status: 'suggest', latestVersion: '2.0.0', storeUrl: 'https://store/app' },
      storeUrlIos: STORE_URL_IOS,
    });
    renderWithTheme(
      <AppVersionGate>
        <LinksProbe />
      </AppVersionGate>,
    );
    expect(screen.getByTestId('update-suggest-card')).toBeTruthy();
    expect(screen.getByTestId('links-probe').props.children).toBe(JSON.stringify(STORE_URL_IOS));
  });

  it('checking(조회 전)이면 자식은 null을 읽는다', () => {
    setGateWithLinks({ state: { status: 'checking' }, storeUrlIos: null });
    renderWithTheme(
      <AppVersionGate>
        <LinksProbe />
      </AppVersionGate>,
    );
    expect(screen.getByTestId('links-probe').props.children).toBe('null');
  });

  it('훅 대역이 storeUrlIos를 주지 않아도(undefined) 자식은 null을 읽는다 — 기존 대역과 호환', () => {
    setGateWithLinks({ state: { status: 'none' } });
    renderWithTheme(
      <AppVersionGate>
        <LinksProbe />
      </AppVersionGate>,
    );
    expect(screen.getByTestId('links-probe').props.children).toBe('null');
  });

  // 콜드스타트 조회가 끝나는 순간(checking → none) 게이트 상태가 바뀐다. 분기마다 자식을 감싸는 모양이 다르면 React가 앱 본체
  //   (App.tsx의 OtaUpdateGate·AuthGate 이하 전체)를 지웠다 다시 만들어 OTA 확인·첫 화면 조회가 두 번 돌고(콜드스타트 1회 원칙 —
  //   harness-rules 규칙 8) 사용자가 연 화면·입력이 초기화된다. 자식의 마운트 횟수(래퍼의 공개 계약)로 잠근다(QA 2차 S4).
  it('게이트가 checking → none(링크 도착) → suggest로 바뀌어도 자식(앱 본체)을 다시 마운트하지 않는다', () => {
    const mounts = { count: 0 };
    const AppBody = () => {
      React.useEffect(function countMount() {
        mounts.count += 1;
      }, []);
      return <Text>본체</Text>;
    };

    setGateWithLinks({ state: { status: 'checking' }, storeUrlIos: null });
    const { rerender } = renderWithTheme(
      <AppVersionGate>
        <AppBody />
      </AppVersionGate>,
    );
    setGateWithLinks({ state: { status: 'none' }, storeUrlIos: STORE_URL_IOS });
    rerender(
      <AppVersionGate>
        <AppBody />
      </AppVersionGate>,
    );
    setGateWithLinks({
      state: { status: 'suggest', latestVersion: '2.0.0', storeUrl: 'https://store/app' },
      storeUrlIos: STORE_URL_IOS,
    });
    rerender(
      <AppVersionGate>
        <AppBody />
      </AppVersionGate>,
    );

    expect(mounts.count).toBe(1);
  });
});
