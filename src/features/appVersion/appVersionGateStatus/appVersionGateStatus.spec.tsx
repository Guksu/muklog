// src/features/appVersion/appVersionGateStatus/appVersionGateStatus.spec.tsx
// 스토어 게이트 상태 컨텍스트 단위 테스트 (expo-updates-ota plan §3.7, T6 · §5-1).
//   OTA 축(OtaUpdateGate)이 suggest 억제 판정에 쓰는 additive 컨텍스트.
//   Provider 밖 기본값 'none' — 기존 소비처(Provider 없이 렌더되는 화면·테스트)에 회귀 0.
import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

jest.mock('../useAppVersionGate', () => ({ useAppVersionGate: jest.fn() }));
jest.mock('expo-linking', () => ({ openURL: jest.fn() }));

import { AppVersionGate } from '../AppVersionGate';
import { useAppVersionGate, type VersionGateState } from '../useAppVersionGate';
import {
  AppVersionGateStatusProvider,
  useAppVersionGateStatus,
  type AppVersionGateStatus,
} from './appVersionGateStatus';

const StatusProbe = () => <Text testID="gate-status">{useAppVersionGateStatus()}</Text>;

describe('appVersionGateStatus (T6)', () => {
  it('Provider 밖에서는 안전 기본값 none을 반환한다(기존 소비처 회귀 0)', () => {
    render(<StatusProbe />);
    expect(screen.getByTestId('gate-status').props.children).toBe('none');
  });

  it.each<AppVersionGateStatus>(['checking', 'force', 'suggest', 'none'])(
    'Provider가 주입한 %s 상태를 그대로 전달한다',
    (status) => {
      render(
        <AppVersionGateStatusProvider status={status}>
          <StatusProbe />
        </AppVersionGateStatusProvider>,
      );
      expect(screen.getByTestId('gate-status').props.children).toBe(status);
    },
  );
});

describe('AppVersionGate → 컨텍스트 제공 (T6)', () => {
  const gateMock = useAppVersionGate as jest.Mock;

  const setGate = (state: VersionGateState) => {
    gateMock.mockReturnValue({ state, dismissSuggest: jest.fn() });
  };

  beforeEach(() => {
    gateMock.mockReset();
  });

  it.each<VersionGateState>([
    { status: 'checking' },
    { status: 'none' },
    { status: 'suggest', latestVersion: '2.0.0', storeUrl: 'https://store/app' },
  ])('게이트 상태 $status를 자식에게 전달한다', (state) => {
    setGate(state);
    renderWithTheme(
      <AppVersionGate>
        <StatusProbe />
      </AppVersionGate>,
    );
    expect(screen.getByTestId('gate-status').props.children).toBe(state.status);
  });

  it('force면 자식이 대체되어 소비자(OTA 축)가 아예 마운트되지 않는다', () => {
    setGate({ status: 'force', storeUrl: 'https://store/app' });
    renderWithTheme(
      <AppVersionGate>
        <StatusProbe />
      </AppVersionGate>,
    );
    expect(screen.queryByTestId('gate-status')).toBeNull();
  });
});
