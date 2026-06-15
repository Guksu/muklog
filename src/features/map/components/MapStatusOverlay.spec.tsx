// src/features/map/components/MapStatusOverlay.spec.tsx
// 지도 상태 오버레이 — 로딩/권한거부/빈/에러 안내의 비주얼만(메시지·액션은 props).
//   차단형 아님(지도 위 배너/오버레이). 비즈니스 로직 없음(상태 판단은 developer가 MapTabScreen에서).
import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { MapStatusOverlay } from './MapStatusOverlay';

describe('MapStatusOverlay', () => {
  it('loading 톤: 로딩 인디케이터와 메시지를 표시한다', () => {
    renderWithTheme(<MapStatusOverlay tone="loading" message="지도를 불러오는 중이에요" />);
    expect(screen.getByText('지도를 불러오는 중이에요')).toBeTruthy();
    expect(screen.getByTestId('map-status-spinner')).toBeTruthy();
  });

  it('info 톤: 메시지를 표시하고 스피너는 없다', () => {
    renderWithTheme(
      <MapStatusOverlay tone="info" message="좌표가 있는 먹로그가 아직 없어요" />,
    );
    expect(screen.getByText('좌표가 있는 먹로그가 아직 없어요')).toBeTruthy();
    expect(screen.queryByTestId('map-status-spinner')).toBeNull();
  });

  it('error 톤 + actionLabel: 재시도 버튼을 렌더하고 onAction을 호출한다', () => {
    const onAction = jest.fn();
    renderWithTheme(
      <MapStatusOverlay
        tone="error"
        message="지도를 불러오지 못했어요"
        actionLabel="다시 시도"
        onAction={onAction}
      />,
    );
    expect(screen.getByText('지도를 불러오지 못했어요')).toBeTruthy();
    fireEvent.press(screen.getByText('다시 시도'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('actionLabel이 없으면 액션 버튼을 렌더하지 않는다', () => {
    renderWithTheme(<MapStatusOverlay tone="info" message="안내" />);
    expect(screen.queryByTestId('map-status-action')).toBeNull();
  });
});
