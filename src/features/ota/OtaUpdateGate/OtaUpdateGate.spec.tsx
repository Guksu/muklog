// src/features/ota/OtaUpdateGate/OtaUpdateGate.spec.tsx
// OTA 게이트 렌더 매트릭스 단위 테스트 (expo-updates-ota plan §4.2·§4.4, T8 · §5-1).
//   useOtaUpdate 모킹(상태 주입) — 5상태 × 스토어 게이트 상태 조합에서 다이얼로그 노출/미노출을 전수 단언.
//   앱 진행을 절대 막지 않는다(children은 항상 렌더).
import React from 'react';
import { Text } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';
import {
  AppVersionGateStatusProvider,
  type AppVersionGateStatus,
} from '@/features/appVersion/appVersionGateStatus';

jest.mock('../useOtaUpdate', () => ({
  ...jest.requireActual('../useOtaUpdate'),
  useOtaUpdate: jest.fn(),
}));

import { OtaStatus, useOtaUpdate } from '../useOtaUpdate';
import { OtaUpdateGate } from './OtaUpdateGate';

const otaMock = useOtaUpdate as jest.Mock;
const applyUpdate = jest.fn();
const dismiss = jest.fn();

const setOta = (status: OtaStatus) => {
  otaMock.mockReturnValue({ state: { status }, applyUpdate, dismiss });
};

const child = <Text testID="ota-child">본체</Text>;

const renderGate = ({ storeStatus = 'none' }: { storeStatus?: AppVersionGateStatus } = {}) =>
  renderWithTheme(
    <AppVersionGateStatusProvider status={storeStatus}>
      <OtaUpdateGate>{child}</OtaUpdateGate>
    </AppVersionGateStatusProvider>,
  );

beforeEach(() => {
  otaMock.mockReset();
  applyUpdate.mockReset();
  dismiss.mockReset();
});

describe('OtaUpdateGate (T8)', () => {
  it.each<OtaStatus>([
    OtaStatus.Idle,
    OtaStatus.Checking,
    OtaStatus.Downloading,
    OtaStatus.Ready,
    OtaStatus.Reloading,
  ])('%s 상태에서도 children을 항상 렌더한다(앱 진행 차단 0)', (status) => {
    setOta(status);
    renderGate();
    expect(screen.getByTestId('ota-child')).toBeTruthy();
  });

  it('ready + 스토어 게이트 none → 안내 다이얼로그를 오버레이한다', () => {
    setOta(OtaStatus.Ready);
    renderGate({ storeStatus: 'none' });
    expect(screen.getByTestId('ota-ready-card')).toBeTruthy();
  });

  it('ready + 스토어 게이트 checking → 안내를 띄운다(fail-open)', () => {
    setOta(OtaStatus.Ready);
    renderGate({ storeStatus: 'checking' });
    expect(screen.getByTestId('ota-ready-card')).toBeTruthy();
  });

  it('ready + 스토어 게이트 suggest → 안내를 억제한다(모달 2개 겹침 방지)', () => {
    setOta(OtaStatus.Ready);
    renderGate({ storeStatus: 'suggest' });
    expect(screen.getByTestId('ota-child')).toBeTruthy();
    expect(screen.queryByTestId('ota-ready-card')).toBeNull();
  });

  it.each<OtaStatus>([
    OtaStatus.Idle,
    OtaStatus.Checking,
    OtaStatus.Downloading,
    OtaStatus.Reloading,
  ])('%s 상태에서는 안내를 띄우지 않는다(사용자 접점은 ready 하나뿐)', (status) => {
    setOta(status);
    renderGate();
    expect(screen.queryByTestId('ota-ready-card')).toBeNull();
  });

  it('"지금 적용" 탭 → applyUpdate 1회, "나중에" 탭 → dismiss 1회', () => {
    setOta(OtaStatus.Ready);
    renderGate();
    fireEvent.press(screen.getByTestId('ota-apply'));
    expect(applyUpdate).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByTestId('ota-dismiss'));
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  // 스토어 권유 모달을 사용자가 "나중에"로 닫으면 게이트가 none이 되어 OTA 안내가 곧바로 이어서 뜬다.
  //   **의도된 동작**(리더 확정): 두 안내는 성격이 다르고(스토어 다운로드 vs 재시작 적용) 화면에서 겹치지 않으며,
  //   여기서 한 번 더 억제하면 사용자는 다음 콜드스타트까지 개선을 받지 못한다. architecture §7 두 축 우선순위 참조.
  it('suggest → none 전이(사용자가 스토어 모달을 닫음) 시 안내가 이어서 노출된다', () => {
    setOta(OtaStatus.Ready);
    const { rerender } = renderGate({ storeStatus: 'suggest' });
    expect(screen.queryByTestId('ota-ready-card')).toBeNull(); // 억제 중.

    rerender(
      <AppVersionGateStatusProvider status="none">
        <OtaUpdateGate>{child}</OtaUpdateGate>
      </AppVersionGateStatusProvider>,
    );
    expect(screen.getByTestId('ota-ready-card')).toBeTruthy(); // 억제 해제 → 이어서 노출.
  });

  it('Provider 밖(스토어 게이트 미사용 컨텍스트)에서도 ready면 안내를 띄운다(기본값 none)', () => {
    setOta(OtaStatus.Ready);
    renderWithTheme(<OtaUpdateGate>{child}</OtaUpdateGate>);
    expect(screen.getByTestId('ota-ready-card')).toBeTruthy();
  });
});
