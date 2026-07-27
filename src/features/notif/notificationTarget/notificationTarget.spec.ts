// src/features/notif/notificationTarget/notificationTarget.spec.ts
// 딥링크 목적지 결정 순수 유틸 단위 테스트 (push-receive-ux plan §3.2 · T1 · AC1~AC4).
//   발송 payload data:{roomId, muklogId}를 소비 → MuklogDetail(muklogId 우선) / LogScreen(roomId) / null.
//   muklogId=''(발송 폴백 빈값)은 "없음" 취급 → LogScreen 폴백. 비객체는 안전 흡수(null).
import { resolveNotificationTarget } from './notificationTarget';

describe('resolveNotificationTarget (T1)', () => {
  it('AC1: muklogId·roomId 모두 있으면 MuklogDetail(muklogId만, roomId 미전달)', () => {
    expect(resolveNotificationTarget({ data: { muklogId: 'm1', roomId: 'r1' } })).toEqual({
      screen: 'MuklogDetail',
      params: { muklogId: 'm1' },
    });
  });

  it('AC2: muklogId 빈 문자열이면 "없음" 취급 → roomId로 LogScreen', () => {
    expect(resolveNotificationTarget({ data: { roomId: 'r1', muklogId: '' } })).toEqual({
      screen: 'LogScreen',
      params: { roomId: 'r1' },
    });
  });

  it('AC3: muklogId 키 부재 + roomId 있으면 LogScreen', () => {
    expect(resolveNotificationTarget({ data: { roomId: 'r1' } })).toEqual({
      screen: 'LogScreen',
      params: { roomId: 'r1' },
    });
  });

  it('muklogId만 있고 roomId 없으면 MuklogDetail(자체 roomId 조회)', () => {
    expect(resolveNotificationTarget({ data: { muklogId: 'm1' } })).toEqual({
      screen: 'MuklogDetail',
      params: { muklogId: 'm1' },
    });
  });

  it('AC4: 빈 객체 → null', () => {
    expect(resolveNotificationTarget({ data: {} })).toBeNull();
  });

  it('AC4: roomId도 빈 문자열이면 → null(라우팅 안 함)', () => {
    expect(resolveNotificationTarget({ data: { roomId: '', muklogId: '' } })).toBeNull();
  });

  it('AC4: 비객체(null/문자열/숫자/undefined) → null', () => {
    expect(resolveNotificationTarget({ data: null })).toBeNull();
    expect(resolveNotificationTarget({ data: 'x' })).toBeNull();
    expect(resolveNotificationTarget({ data: 42 })).toBeNull();
    expect(resolveNotificationTarget({ data: undefined })).toBeNull();
  });

  it('id가 문자열이 아니면(숫자 등) 그 필드는 무시 → 폴백/누락', () => {
    // muklogId가 숫자면 무시 → roomId로 LogScreen.
    expect(resolveNotificationTarget({ data: { muklogId: 123, roomId: 'r1' } })).toEqual({
      screen: 'LogScreen',
      params: { roomId: 'r1' },
    });
    // 둘 다 비문자열 → null.
    expect(resolveNotificationTarget({ data: { muklogId: 123, roomId: 456 } })).toBeNull();
  });
});
