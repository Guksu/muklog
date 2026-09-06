// src/features/muklog/PlaceSearchView.spec.tsx
// 장소검색 풀스크린 뷰 — 킷 mk-log.jsx:383-414 PlaceSearch 재현 (FLAG-1b).
//   헤더(뒤로 + 검색 입력바) + 결과 리스트 + 상태(loading/empty/error). 표시 전용(controlled props).
import React from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { PlaceSearchView } from './PlaceSearchView';
import { type PlaceSearchItem } from '../types';

const item = (over?: Partial<PlaceSearchItem>): PlaceSearchItem => ({
  kakaoPlaceId: 'k1',
  placeName: '트라토리아 보나',
  categoryName: '음식점 > 양식 > 이탈리안',
  categoryGroupCode: 'FD6',
  addressName: '서울 마포구 연남동 227-15',
  roadAddressName: '서울 마포구 월드컵북로 39',
  lat: 37.56,
  lng: 126.92,
  phone: '',
  ...over,
});

const baseProps = {
  query: '',
  onChangeQuery: jest.fn(),
  status: 'idle' as const,
  results: [] as PlaceSearchItem[],
  onSelectResult: jest.fn(),
  onBack: jest.fn(),
};

describe('PlaceSearchView', () => {
  it('검색 입력바와 뒤로 버튼을 렌더한다', () => {
    renderWithTheme(<PlaceSearchView {...baseProps} />);
    expect(screen.getByLabelText('장소 검색')).toBeTruthy();
    expect(screen.getByLabelText('뒤로 가기')).toBeTruthy();
  });

  it('뒤로 버튼 탭 시 onBack을 호출한다', () => {
    const onBack = jest.fn();
    renderWithTheme(<PlaceSearchView {...baseProps} onBack={onBack} />);
    fireEvent.press(screen.getByLabelText('뒤로 가기'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('입력 변경 시 onChangeQuery를 호출한다', () => {
    const onChangeQuery = jest.fn();
    renderWithTheme(<PlaceSearchView {...baseProps} onChangeQuery={onChangeQuery} />);
    fireEvent.changeText(screen.getByLabelText('장소 검색'), '보나');
    expect(onChangeQuery).toHaveBeenCalledWith('보나');
  });

  it('ready+결과가 있으면 결과 행을 렌더하고 탭 시 onSelectResult를 호출한다', () => {
    const onSelectResult = jest.fn();
    renderWithTheme(
      <PlaceSearchView
        {...baseProps}
        status="ready"
        query="보나"
        results={[item()]}
        onSelectResult={onSelectResult}
      />,
    );
    fireEvent.press(screen.getByTestId('place-result-0'));
    expect(onSelectResult).toHaveBeenCalledWith({ item: item() });
  });

  it('loading이면 스피너를 표시한다', () => {
    renderWithTheme(<PlaceSearchView {...baseProps} status="loading" query="보나" />);
    expect(screen.getByTestId('place-search-spinner')).toBeTruthy();
  });

  it('ready+0건이면 빈상태 안내를 표시한다', () => {
    renderWithTheme(<PlaceSearchView {...baseProps} status="ready" query="없는가게" results={[]} />);
    expect(screen.getByTestId('place-search-empty')).toBeTruthy();
  });

  it('0건 + onUseManualInput 주입 시 "직접 입력" 폴백 탭으로 콜백을 호출한다 (§4.2)', () => {
    const onUseManualInput = jest.fn();
    renderWithTheme(
      <PlaceSearchView
        {...baseProps}
        status="ready"
        query="없는가게"
        results={[]}
        onUseManualInput={onUseManualInput}
      />,
    );
    fireEvent.press(screen.getByLabelText('직접 입력'));
    expect(onUseManualInput).toHaveBeenCalledTimes(1);
  });

  it('error면 errorMessage를 표시한다', () => {
    renderWithTheme(
      <PlaceSearchView
        {...baseProps}
        status="error"
        query="보나"
        errorMessage="장소 검색에 실패했어요."
      />,
    );
    expect(screen.getByText('장소 검색에 실패했어요.')).toBeTruthy();
  });

  it('resolveCategory 미주입 시 mapKakaoCategory로 기본 해석한다 (#7 — 늘 cafe 폴백 방지)', () => {
    // resolveCategory 없이도 양식 브레드크럼이 파스타 라벨로 해석되어야 한다(이전엔 null→cafe 라벨 생략).
    renderWithTheme(
      <PlaceSearchView
        {...baseProps}
        status="ready"
        query="보나"
        results={[item({ categoryName: '음식점 > 양식 > 이탈리안', categoryGroupCode: 'FD6' })]}
      />,
    );
    expect(screen.getByText(/파스타·양식/)).toBeTruthy();
  });

  it('resolveCategory 미주입 + 고기 브레드크럼 → 고기 라벨 (#6·#7)', () => {
    renderWithTheme(
      <PlaceSearchView
        {...baseProps}
        status="ready"
        query="고기"
        results={[item({ categoryName: '음식점 > 한식 > 육류,고기 > 삼겹살', categoryGroupCode: 'FD6' })]}
      />,
    );
    expect(screen.getByText(/^고기 ·|^고기$|고기 ·/)).toBeTruthy();
  });

  // ── 제출 중 진행 표시·비활성(U6-b, silent-failure-feedback T2) ─────────────────────────
  //   seam = props(submitting/submittingLabel) + 화면 쿼리. 진행 행 마크업은 기존 '검색 중…' 행 승계(신규 실값 0).
  describe('submitting(U6-b)', () => {
    const readyWithResult = {
      ...baseProps,
      status: 'ready' as const,
      query: '보나',
      results: [item()],
    };

    it('submitting=true면 결과행 탭이 onSelectResult를 호출하지 않는다', () => {
      const onSelectResult = jest.fn();
      renderWithTheme(
        <PlaceSearchView {...readyWithResult} onSelectResult={onSelectResult} submitting />,
      );
      fireEvent.press(screen.getByTestId('place-result-0'));
      expect(onSelectResult).not.toHaveBeenCalled();
    });

    it('submitting=true면 "직접 입력" 행 탭이 onUseManualInput을 호출하지 않는다', () => {
      const onUseManualInput = jest.fn();
      renderWithTheme(
        <PlaceSearchView
          {...baseProps}
          status="ready"
          query="없는가게"
          results={[]}
          onUseManualInput={onUseManualInput}
          submitting
        />,
      );
      fireEvent.press(screen.getByLabelText('직접 입력'));
      expect(onUseManualInput).not.toHaveBeenCalled();
    });

    it('submitting=true면 진행 스피너 + submittingLabel 문구를 표시한다', () => {
      renderWithTheme(
        <PlaceSearchView {...readyWithResult} submitting submittingLabel="담는 중…" />,
      );
      expect(screen.getByTestId('place-search-submitting-spinner')).toBeTruthy();
      expect(screen.getByText('담는 중…')).toBeTruthy();
    });

    it('submittingLabel 미전달 시 기본 문구 "처리 중…"을 쓴다', () => {
      renderWithTheme(<PlaceSearchView {...readyWithResult} submitting />);
      expect(screen.getByText('처리 중…')).toBeTruthy();
    });

    it('submitting 미전달이면 진행 표시 없음 + 결과행·직접입력행 모두 활성이다(에디터 회귀 0)', () => {
      const onSelectResult = jest.fn();
      const onUseManualInput = jest.fn();
      renderWithTheme(
        <PlaceSearchView {...readyWithResult} onSelectResult={onSelectResult} />,
      );
      expect(screen.queryByTestId('place-search-submitting-spinner')).toBeNull();
      expect(screen.queryByText('처리 중…')).toBeNull();
      fireEvent.press(screen.getByTestId('place-result-0'));
      expect(onSelectResult).toHaveBeenCalledTimes(1);

      screen.unmount();
      renderWithTheme(
        <PlaceSearchView
          {...baseProps}
          status="ready"
          query="없는가게"
          results={[]}
          onUseManualInput={onUseManualInput}
        />,
      );
      fireEvent.press(screen.getByLabelText('직접 입력'));
      expect(onUseManualInput).toHaveBeenCalledTimes(1);
    });
  });

  it('error + onUseManualInput 주입 시에도 "직접 입력" 폴백을 노출한다 (§4.2)', () => {
    renderWithTheme(
      <PlaceSearchView
        {...baseProps}
        status="error"
        query="보나"
        errorMessage="장소 검색에 실패했어요."
        onUseManualInput={jest.fn()}
      />,
    );
    expect(screen.getByLabelText('직접 입력')).toBeTruthy();
  });
});

// ── 프레스 치환 A10(motion-press-sweep T4 / ui-spec §2-2·§3-1) ──────────────────────────
//   seam = a11yLabel(직접 입력)로 조회한 노드의 (a) flatten style의 transform/opacity 키 유무.
//   새 testID를 추가하지 않는다(plan §9-1).
describe('PlaceSearchView — "직접 입력" 폴백 행 눌림 피드백(motion-press-sweep A10)', () => {
  const mockReduceMotion = ({ enabled }: { enabled: boolean }) => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockReturnValue(Promise.resolve(enabled));
  };

  afterEach(() => jest.restoreAllMocks());

  const flatten = () =>
    StyleSheet.flatten(screen.getByLabelText('직접 입력').props.style) as Record<string, unknown>;

  const renderManualRow = () =>
    renderWithTheme(
      <PlaceSearchView
        {...baseProps}
        status="ready"
        query="없는가게"
        results={[]}
        onUseManualInput={jest.fn()}
      />,
    );

  it('A10 — 감소 모션 OFF: transform이 부착된다', async () => {
    mockReduceMotion({ enabled: false });
    renderManualRow();
    await waitFor(() => expect(flatten().transform).toBeDefined());
  });

  it('A10 — 감소 모션 ON: transform 없이 opacity만 남는다', async () => {
    mockReduceMotion({ enabled: true });
    renderManualRow();
    await waitFor(() => expect(flatten().opacity).toBeDefined());
    expect(flatten().transform).toBeUndefined();
  });

  it('렌더 시 console.warn 0건(정적 opacity 계약 위반 없음)', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    renderManualRow();
    expect(warn).not.toHaveBeenCalled();
  });
});
