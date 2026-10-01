// src/features/appVersion/appStoreLinks/appStoreLinks.spec.tsx
// 스토어 링크 컨텍스트 (invite-share U72, plan R4 — AC4) — additive(appVersionGateStatus 선례).
//   버전 게이트가 콜드스타트에 이미 받은 store_url_ios를 자식에게 내린다(추가 조회 0). Provider 밖은 null(소비처는 폴백 상수).
import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import { AppStoreLinksProvider, useAppStoreLinks } from './appStoreLinks';

// JSON 문자열로 그려 null과 undefined를 구분한다(undefined면 글자가 비어 단언이 실패한다).
const LinksProbe = () => <Text testID="links-probe">{JSON.stringify(useAppStoreLinks())}</Text>;

describe('appStoreLinks (AC4)', () => {
  it('Provider 밖에서는 { storeUrlIos: null }을 돌려준다 — 소비처가 폴백 상수로 안전하게 동작', () => {
    render(<LinksProbe />);
    expect(screen.getByTestId('links-probe').props.children).toBe('{"storeUrlIos":null}');
  });

  it('Provider가 준 링크를 자식이 그대로 읽는다', () => {
    render(
      <AppStoreLinksProvider storeUrlIos="https://apps.apple.com/app/id1">
        <LinksProbe />
      </AppStoreLinksProvider>,
    );
    expect(screen.getByTestId('links-probe').props.children).toBe('{"storeUrlIos":"https://apps.apple.com/app/id1"}');
  });

  it('Provider가 null을 주면 자식도 null을 읽는다(조회 전·실패)', () => {
    render(
      <AppStoreLinksProvider storeUrlIos={null}>
        <LinksProbe />
      </AppStoreLinksProvider>,
    );
    expect(screen.getByTestId('links-probe').props.children).toBe('{"storeUrlIos":null}');
  });
});
