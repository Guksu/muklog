// src/features/room/errors.spec.ts
// RPC 에러 토큰 → 한국어 메시지 매핑 + error 타입 추출 명세 테스트 (plan §5-1 (2), C2).
import { DEFAULT_ROOM_ERROR_MESSAGE, mapRoomError, ROOM_ERROR_MESSAGES } from './errors';

describe('mapRoomError — 토큰 정확 일치 (5종)', () => {
  // 소비자 실제 경로: rpcError(new Error(TOKEN))를 throw → mapRoomError가 처리.
  it('INVALID_CODE', () => {
    expect(mapRoomError({ error: new Error('INVALID_CODE') })).toBe('초대코드를 다시 확인해 주세요.');
  });

  it('ROOM_FULL', () => {
    expect(mapRoomError({ error: new Error('ROOM_FULL') })).toBe('이미 2명이 모두 입장한 방이에요.');
  });

  it('ALREADY_IN_ROOM', () => {
    expect(mapRoomError({ error: new Error('ALREADY_IN_ROOM') })).toBe('이미 참여 중인 방이 있어요.');
  });

  it('CODE_GENERATION_FAILED', () => {
    expect(mapRoomError({ error: new Error('CODE_GENERATION_FAILED') })).toBe(
      '코드 생성에 실패했어요. 잠시 후 다시 시도해 주세요.',
    );
  });

  it('NOT_AUTHENTICATED', () => {
    expect(mapRoomError({ error: new Error('NOT_AUTHENTICATED') })).toBe(
      '세션이 만료됐어요. 앱을 다시 시작해 주세요.',
    );
  });

  it('ROOM_ERROR_MESSAGES는 정확히 5개의 토큰 키를 가진다 (C2 단일 출처)', () => {
    expect(Object.keys(ROOM_ERROR_MESSAGES).sort()).toEqual(
      ['ALREADY_IN_ROOM', 'CODE_GENERATION_FAILED', 'INVALID_CODE', 'NOT_AUTHENTICATED', 'ROOM_FULL'].sort(),
    );
  });
});

describe('mapRoomError — 포함 매칭 / 기본', () => {
  it('Postgres가 토큰을 텍스트로 감싸도 포함 매칭한다', () => {
    expect(mapRoomError({ error: new Error('ERROR: ROOM_FULL (SQLSTATE P0001)') })).toBe(
      '이미 2명이 모두 입장한 방이에요.',
    );
  });

  it('미일치 토큰은 기본(네트워크) 메시지', () => {
    expect(mapRoomError({ error: new Error('some network failure') })).toBe(DEFAULT_ROOM_ERROR_MESSAGE);
  });

  it('빈 메시지는 기본 메시지', () => {
    expect(mapRoomError({ error: new Error('') })).toBe(DEFAULT_ROOM_ERROR_MESSAGE);
  });
});

describe('mapRoomError — error 타입 추출 (extractMessage 분기)', () => {
  it('문자열 입력', () => {
    expect(mapRoomError({ error: 'INVALID_CODE' })).toBe('초대코드를 다시 확인해 주세요.');
  });

  it('{ message } 객체 입력', () => {
    expect(mapRoomError({ error: { message: 'ROOM_FULL' } })).toBe('이미 2명이 모두 입장한 방이에요.');
  });

  it('null은 throw 없이 기본 메시지', () => {
    expect(mapRoomError({ error: null })).toBe(DEFAULT_ROOM_ERROR_MESSAGE);
  });

  it('숫자 등 기타 타입은 throw 없이 기본 메시지', () => {
    expect(mapRoomError({ error: 42 })).toBe(DEFAULT_ROOM_ERROR_MESSAGE);
  });
});
