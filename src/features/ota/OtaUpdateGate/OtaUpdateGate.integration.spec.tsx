// src/features/ota/OtaUpdateGate/OtaUpdateGate.integration.spec.tsx
// 두 업데이트 축 통합 검증 (expo-updates-ota plan §4.2, T8 ⑥ · §7 QA 경계면).
//   실 useOtaUpdate + 실 AppVersionGate를 함께 렌더한다(모킹은 최하단 경계 2개 — updatesModule·useAppVersionGate).
//   목적: "force면 OTA 게이트가 애초에 마운트되지 않아 네트워크 호출이 0"이라는 계약을 껍데기가 아닌 실제 호출로 확인.
import React from 'react';
import { Text } from 'react-native';
import { screen, waitFor } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';
import { setDevMode } from '@/test/setDevMode';

jest.mock('../updatesModule', () => ({ loadUpdatesModule: jest.fn() }));
jest.mock('@/features/appVersion/useAppVersionGate', () => ({ useAppVersionGate: jest.fn() }));
jest.mock('expo-linking', () => ({ openURL: jest.fn() }));

import { AppVersionGate } from '@/features/appVersion/AppVersionGate';
import { useAppVersionGate, type VersionGateState } from '@/features/appVersion/useAppVersionGate';
import { loadUpdatesModule, type UpdatesModule } from '../updatesModule';
import { OtaUpdateGate } from './OtaUpdateGate';

const gateMock = useAppVersionGate as jest.Mock;
const loadMock = loadUpdatesModule as jest.Mock;

const updates = {
  isEnabled: true,
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(),
};

const renderTree = ({ gateState }: { gateState: VersionGateState }) => {
  gateMock.mockReturnValue({ state: gateState, dismissSuggest: jest.fn() });
  return renderWithTheme(
    <AppVersionGate>
      <OtaUpdateGate>
        <Text testID="app-body">본체</Text>
      </OtaUpdateGate>
    </AppVersionGate>,
  );
};

beforeEach(() => {
  setDevMode({ isDev: false });
  gateMock.mockReset();
  loadMock.mockReset();
  loadMock.mockReturnValue(updates as unknown as UpdatesModule);
  updates.checkForUpdateAsync.mockReset().mockResolvedValue({ isAvailable: true });
  updates.fetchUpdateAsync.mockReset().mockResolvedValue({ isNew: true });
  updates.reloadAsync.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  setDevMode({ isDev: true });
});

describe('AppVersionGate × OtaUpdateGate 통합 (T8 ⑥)', () => {
  it('force면 OTA 게이트가 마운트되지 않아 체크 호출 0(대역폭 0)', async () => {
    renderTree({ gateState: { status: 'force', storeUrl: 'https://store/app' } });
    await waitFor(() => expect(screen.getByTestId('force-update-body')).toBeTruthy());

    expect(screen.queryByTestId('app-body')).toBeNull();
    expect(loadMock).not.toHaveBeenCalled();
    expect(updates.checkForUpdateAsync).not.toHaveBeenCalled();
    expect(screen.queryByTestId('ota-ready-card')).toBeNull();
  });

  it('none이면 체크·다운로드 후 안내를 띄운다(정상 경로)', async () => {
    renderTree({ gateState: { status: 'none' } });
    await waitFor(() => expect(screen.getByTestId('ota-ready-card')).toBeTruthy());
    expect(updates.checkForUpdateAsync).toHaveBeenCalledTimes(1);
    expect(updates.fetchUpdateAsync).toHaveBeenCalledTimes(1);
  });

  it('suggest면 다운로드는 하되 안내만 억제한다(다음 콜드스타트에 자동 적용)', async () => {
    renderTree({
      gateState: { status: 'suggest', latestVersion: '2.0.0', storeUrl: 'https://store/app' },
    });
    await waitFor(() => expect(updates.fetchUpdateAsync).toHaveBeenCalledTimes(1));

    expect(screen.getByTestId('update-suggest-card')).toBeTruthy(); // 스토어 축 모달만 노출.
    expect(screen.queryByTestId('ota-ready-card')).toBeNull();
  });
});
