// src/test/findAccessibleAncestors/findAccessibleAncestors.spec.tsx
// 헬퍼 자체 검증 — 이 헬퍼가 빈 배열만 돌려주면 소비처의 접근성 단언이 전부 껍데기가 된다.
//   RN 실물(Pressable 기본 accessible=true / View 기본 미설정)을 렌더해 판정이 실제 props를 따르는지 고정한다.
//   단언은 toStrictEqual로 한다 — toEqual은 배열 안의 undefined 원소를 무시해 `[undefined]`를 `[]`와 같다고 본다.
import React from 'react';
import { Pressable, View } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import { findAccessibleAncestors } from './findAccessibleAncestors';

const noop = () => {};

const ancestorsOf = ({ testId }: { testId: string }) =>
  findAccessibleAncestors({ element: screen.getByTestId(testId) });

const Target = () => (
  <Pressable testID="target" accessibilityRole="button" accessibilityLabel="대상" onPress={noop} />
);

describe('findAccessibleAncestors', () => {
  it('Pressable 안의 요소는 그 Pressable을 조상 접근성 요소로 보고한다(기본 accessible=true)', () => {
    render(
      <Pressable testID="wrapper" onPress={noop}>
        <Target />
      </Pressable>,
    );
    expect(ancestorsOf({ testId: 'target' })).toStrictEqual(['wrapper']);
  });

  it('View 안의 요소는 조상 접근성 요소가 없다', () => {
    render(
      <View testID="wrapper">
        <Target />
      </View>,
    );
    expect(ancestorsOf({ testId: 'target' })).toStrictEqual([]);
  });

  it('accessible을 켠 View도 조상 접근성 요소로 보고한다', () => {
    render(
      <View testID="wrapper" accessible>
        <Target />
      </View>,
    );
    expect(ancestorsOf({ testId: 'target' })).toStrictEqual(['wrapper']);
  });

  it('accessible={false}인 Pressable은 조상 접근성 요소로 세지 않는다', () => {
    render(
      <Pressable testID="wrapper" accessible={false} onPress={noop}>
        <Target />
      </Pressable>,
    );
    expect(ancestorsOf({ testId: 'target' })).toStrictEqual([]);
  });

  it('여러 겹이면 가까운 조상부터 돌려준다', () => {
    render(
      <Pressable testID="outer" onPress={noop}>
        <View testID="middle">
          <Pressable testID="inner" onPress={noop}>
            <Target />
          </Pressable>
        </View>
      </Pressable>,
    );
    expect(ancestorsOf({ testId: 'target' })).toStrictEqual(['inner', 'outer']);
  });

  it('요소 자신이 접근성 요소인 것은 세지 않는다(조상만 본다)', () => {
    render(<Target />);
    expect(screen.getByTestId('target').props.accessible).toBe(true);
    expect(ancestorsOf({ testId: 'target' })).toStrictEqual([]);
  });

  // 결함이 재발하는 가장 흔한 형태 — 이름표(testID) 없는 래퍼로 컨트롤을 감싼다.
  //   testID만 돌려주면 이 조상은 undefined가 되어 단언을 빠져나간다 → 호스트 타입 이름으로라도 드러낸다.
  it('testID 없는 Pressable 조상은 호스트 타입 이름으로 보고한다', () => {
    render(
      <Pressable onPress={noop}>
        <Target />
      </Pressable>,
    );
    expect(ancestorsOf({ testId: 'target' })).toStrictEqual(['View']);
  });

  it('testID 없는 accessible View 조상도 호스트 타입 이름으로 보고한다', () => {
    render(
      <View accessible>
        <Target />
      </View>,
    );
    expect(ancestorsOf({ testId: 'target' })).toStrictEqual(['View']);
  });

  it('testID가 빈 문자열이어도 조상을 빠뜨리지 않는다', () => {
    render(
      <View testID="" accessible>
        <Target />
      </View>,
    );
    expect(ancestorsOf({ testId: 'target' })).toStrictEqual(['View']);
  });
});
