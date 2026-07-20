// src/components/LoadingView.spec.tsx
import { screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { LoadingView } from './LoadingView';

describe('LoadingView', () => {
  it('전달한 testID로 스피너를 렌더한다', () => {
    renderWithTheme(<LoadingView testID="x-loading" />);
    expect(screen.getByTestId('x-loading')).toBeTruthy();
  });
});
