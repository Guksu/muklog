import React from 'react';
import { StatusBar } from 'react-native';
import { act, render } from '@testing-library/react-native';

// React/RNTL 및 RN StatusBar가 사용하는 immediate는 fake clock과 섞이지 않아야 한다.
// StatusBar는 실행이 끝난 핸들도 보관하므로 real clock 복귀 후 native 취소에 다시 전달한다.
describe('테스트 타이머 경계', () => {
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('가짜 시간을 진행하지 않아도 immediate 작업은 완료된다', async () => {
    jest.useFakeTimers();
    const deferred = jest.fn();
    setTimeout(deferred, 1000);

    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(deferred).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    expect(deferred).toHaveBeenCalledTimes(1);
  });

  it('가짜 시간으로 렌더한 상태 표시줄을 실제 시간에서 해제해도 작업 큐가 계속 진행된다', async () => {
    jest.useFakeTimers();
    const view = render(React.createElement(StatusBar, { barStyle: 'light-content' }));
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();

    view.unmount();

    await new Promise<void>((resolve) => setImmediate(resolve));
  });

  it('가짜 시간에서도 실제 immediate 작업을 취소할 수 있다', async () => {
    jest.useFakeTimers();
    const cancelled = jest.fn();
    const handle = setImmediate(cancelled);
    clearImmediate(handle);

    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(cancelled).not.toHaveBeenCalled();
  });
});
