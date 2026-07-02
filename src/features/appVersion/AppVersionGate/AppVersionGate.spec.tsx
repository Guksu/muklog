// src/features/appVersion/AppVersionGate/AppVersionGate.spec.tsx
// 버전 게이트 래퍼 단위 테스트 (app-version-gate plan §5 T7·T11·§5-1).
//   checking/none→자식 렌더 / force→ForceUpdateScreen(자식 대체)+Linking / suggest→자식+모달+dismiss / storeUrl null→열기 0.
//   useAppVersionGate 훅 모킹(상태 주입) + expo-linking·BackHandler 모킹.
import React from 'react';
import { Text } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

jest.mock('../useAppVersionGate', () => ({ useAppVersionGate: jest.fn() }));
jest.mock('expo-linking', () => ({ openURL: jest.fn() }));

import * as Linking from 'expo-linking';
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
