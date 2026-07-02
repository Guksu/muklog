// src/components/Card.spec.tsx
// 공용 Card — 소프트 웜 섀도우 surface(muklog LogCard), card radius(22), 누름 스모크. (plan §5-6, T9 / ui-redesign 보정)
import React from 'react';
import { Text as RNText } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { Card } from './Card';

describe('Card', () => {
  it('children 을 렌더한다', () => {
    renderWithTheme(
      <Card>
        <RNText>내용</RNText>
      </Card>,
    );
    expect(screen.getByText('내용')).toBeTruthy();
  });

  it('소프트 웜 섀도우 + card radius(22)로 렌더한다(헤어라인 보더 대신 그림자)', () => {
    renderWithTheme(
      <Card testID="card">
        <RNText>x</RNText>
      </Card>,
    );
    const style = screen.getByTestId('card').props.style;
    const flat = Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style;
    expect(flat.borderRadius).toBe(22);
    // muklog LogCard = 웜 섀도우(rgba 120,90,70 = #785A46), 보더 없음.
    expect(flat.shadowColor).toBe('#785A46');
    expect(flat.elevation).toBe(2);
    expect(flat.borderWidth).toBeUndefined();
  });

  it('onPress 가 있으면 누를 수 있고 핸들러를 호출한다', () => {
    const onPress = jest.fn();
    renderWithTheme(
      <Card testID="card" onPress={onPress}>
        <RNText>x</RNText>
      </Card>,
    );
    fireEvent.press(screen.getByTestId('card'));
    expect(onPress).toHaveBeenCalled();
  });
});
