// src/lib/useCachedQuery/toOneShotState.spec.ts
// 캐시 조회 결과 → OneShotState 변환 명세 (query-cache plan §3.4 / T3, U1~U4).
//   판정 순서 data → error → loading 이 계약의 핵심이다. 이 순서가 U58/U14의 "이미 본 화면이
//   백그라운드 재조회 1회 실패로 통째로 에러가 되는" 문제를 구조적으로 막는다.
import { toOneShotState } from './toOneShotState';

const mapError = () => '실패 메시지';

describe('toOneShotState (AC3-1~3-4)', () => {
  it('U2: data도 error도 없으면 loading', () => {
    expect(toOneShotState<{ logs: string[] }>({ data: undefined, error: null, mapError })).toEqual({
      status: 'loading',
    });
  });

  it('U1: data가 있으면 ready + payload의 named 필드를 그대로 펼친다', () => {
    expect(toOneShotState({ data: { muklogs: [1, 2] }, error: null, mapError })).toEqual({
      status: 'ready',
      muklogs: [1, 2],
    });
  });

  it('U3: data 없이 error만 있으면 error + mapError에 원본 에러를 넘긴다', () => {
    const cause = new Error('boom');
    const spy = jest.fn(() => '불러오지 못했어요');

    const state = toOneShotState<{ logs: string[] }>({ data: undefined, error: cause, mapError: spy });

    expect(state).toEqual({ status: 'error', message: '불러오지 못했어요' });
    expect(spy).toHaveBeenCalledWith(cause);
  });

  it('U4(경계, AC3-4): data와 error가 동시에 있으면 ready를 유지한다(백그라운드 실패가 화면을 덮지 않는다)', () => {
    const state = toOneShotState({ data: { muklogs: [1] }, error: new Error('background'), mapError });

    expect(state).toEqual({ status: 'ready', muklogs: [1] });
  });

  it('빈 payload(예: 빈 배열)도 ready다 — 빈 상태는 에러가 아니다', () => {
    expect(toOneShotState({ data: { logs: [] }, error: null, mapError })).toEqual({
      status: 'ready',
      logs: [],
    });
  });

  it('payload 필드가 null이어도 ready다(notFound 매핑은 소비 훅의 책임 — 어댑터는 도메인을 모른다)', () => {
    expect(toOneShotState({ data: { muklog: null }, error: null, mapError })).toEqual({
      status: 'ready',
      muklog: null,
    });
  });
});
