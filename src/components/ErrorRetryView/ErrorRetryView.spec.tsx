// src/components/ErrorRetryView.spec.tsx
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTheme } from '@/test/renderWithTheme';

import { ErrorRetryView } from './ErrorRetryView';

describe('ErrorRetryView', () => {
  it('메시지와 "다시 시도" 버튼을 렌더하고 탭 시 onRetry를 호출한다', () => {
    const onRetry = jest.fn();
    renderWithTheme(<ErrorRetryView message="불러오지 못했어요" onRetry={onRetry} />);
    expect(screen.getByText('불러오지 못했어요')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('다시 시도'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
