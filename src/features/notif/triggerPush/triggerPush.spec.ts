// src/features/notif/triggerPush/triggerPush.spec.ts
// 푸시 발송 Edge Function 트리거 (join-push plan AC15 · R1). 대역은 외부 SDK 경계(supabase.functions.invoke)에만 둔다.
//   이벤트 → 함수 이름·본문 매핑, 정확히 1회 호출, 절대 reject 하지 않음(실패는 console.warn 만).
jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));

import { supabase } from '@/lib/supabase';

import { PushEvent, triggerPush } from './triggerPush';

const invokeMock = supabase.functions.invoke as jest.Mock;
let warnSpy: jest.SpyInstance;

beforeEach(() => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({ data: { sent: 1 }, error: null });
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe('triggerPush', () => {
  it('MemberJoined → send-join-push 를 { roomId } 본문으로 정확히 1회 부른다(사용자 id 미전송)', async () => {
    await triggerPush({ event: { type: PushEvent.MemberJoined, roomId: 'r1' } });
    expect(invokeMock.mock.calls).toEqual([['send-join-push', { body: { roomId: 'r1' } }]]);
  });

  it('MuklogCreated → send-muklog-push 를 { roomId, muklogId } 본문으로 정확히 1회 부른다(1.3.0 과 같은 계약)', async () => {
    await triggerPush({ event: { type: PushEvent.MuklogCreated, roomId: 'r1', muklogId: 'm1' } });
    expect(invokeMock.mock.calls).toEqual([
      ['send-muklog-push', { body: { roomId: 'r1', muklogId: 'm1' } }],
    ]);
  });

  it('invoke 가 reject 해도 resolve 하고 경고만 남긴다', async () => {
    invokeMock.mockRejectedValueOnce(new Error('Network request failed'));
    await expect(
      triggerPush({ event: { type: PushEvent.MemberJoined, roomId: 'r1' } }),
    ).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    // 실패해도 다른 함수로 다시 부르지 않는다(구 send-muklog-push 로 가면 "새 맛집" 오발송).
    expect(invokeMock.mock.calls).toEqual([['send-join-push', { body: { roomId: 'r1' } }]]);
  });

  it('합류 요청이 { error }(send-join-push 미배포 404 등)여도 send-join-push 1회뿐 — 다른 함수로 재시도 0', async () => {
    invokeMock.mockResolvedValueOnce({ data: null, error: new Error('FunctionsHttpError') });
    await expect(
      triggerPush({ event: { type: PushEvent.MemberJoined, roomId: 'r1' } }),
    ).resolves.toBeUndefined();
    expect(invokeMock.mock.calls).toEqual([['send-join-push', { body: { roomId: 'r1' } }]]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('invoke 가 { error } 를 돌려주면(함수 404·500 등) resolve 하고 경고만 남긴다', async () => {
    invokeMock.mockResolvedValueOnce({ data: null, error: new Error('FunctionsHttpError') });
    await expect(
      triggerPush({ event: { type: PushEvent.MuklogCreated, roomId: 'r1', muklogId: 'm1' } }),
    ).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]).toContain('send-muklog-push');
  });

  it('성공({ error: null })이면 경고 0', async () => {
    await triggerPush({ event: { type: PushEvent.MemberJoined, roomId: 'r1' } });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('이벤트 type 값은 서버 함수와 무관한 앱 내부 식별자다(enum-style 상수)', () => {
    expect(PushEvent).toEqual({ MuklogCreated: 'muklog_created', MemberJoined: 'member_joined' });
  });
});
