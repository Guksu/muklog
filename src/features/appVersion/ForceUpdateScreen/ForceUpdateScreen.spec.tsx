// src/features/appVersion/ForceUpdateScreen/ForceUpdateScreen.spec.tsx
// 강제 업데이트 차단 화면(app-version-gate T8) — 프리젠테이션 단위 검증.
//   킷 비종속 신설이나 프리미티브(Screen·AppMark·Button·Text)·킷 톤(코럴 브랜드마크·해요체) 정합.
//   배선(Linking·하드웨어백 차단)은 developer — 여기선 표시 상태(제목/본문·버튼 vs 안내문·콜백)만 본다.
import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { ForceUpdateScreen } from './ForceUpdateScreen';

const noop = () => {};

describe('ForceUpdateScreen', () => {
  it('제목·본문(해요체)과 브랜드 마크를 항상 렌더한다', () => {
    renderWithTheme(<ForceUpdateScreen storeUrl="https://store" onUpdatePress={noop} />);
    expect(screen.getByText('업데이트가 필요해요')).toBeTruthy();
    // 본문은 해요체(사용자 주어·이득) — 존재만 확인(카피 정확 매칭은 qa-visual).
    expect(screen.getByTestId('force-update-body')).toBeTruthy();
    // 코럴 브랜드 「먹 핀」 마크(AppMark) — 킷 톤 캐리어.
    expect(screen.getByTestId('app-mark')).toBeTruthy();
  });

  it('storeUrl이 있으면 업데이트 버튼을 렌더하고 탭 시 onUpdatePress를 호출한다', () => {
    const onUpdatePress = jest.fn();
    renderWithTheme(<ForceUpdateScreen storeUrl="https://store/app" onUpdatePress={onUpdatePress} />);
    const button = screen.getByTestId('force-update-button');
    expect(button).toBeTruthy();
    fireEvent.press(button);
    expect(onUpdatePress).toHaveBeenCalledTimes(1);
    // 버튼이 있으면 안내문은 없다.
    expect(screen.queryByTestId('force-update-guidance')).toBeNull();
  });

  it('storeUrl이 null이면 버튼을 숨기고 안내문을 렌더한다(미출시 상태)', () => {
    renderWithTheme(<ForceUpdateScreen storeUrl={null} onUpdatePress={noop} />);
    expect(screen.queryByTestId('force-update-button')).toBeNull();
    expect(screen.getByTestId('force-update-guidance')).toBeTruthy();
  });
});
