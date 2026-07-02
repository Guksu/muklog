// src/features/room/errors.spec.ts
// RPC 에러 토큰 → 한국어 메시지 매핑 + error 타입 추출 명세 테스트 (plan §5-1 (2), C2).
import { DEFAULT_ROOM_ERROR_MESSAGE, mapRoomError, ROOM_ERROR_MESSAGES } from './errors';

describe('mapRoomError — 토큰 정확 일치 (5종)', () => {
  // 소비자 실제 경로: rpcError(new Error(TOKEN))를 throw → mapRoomError가 처리.
  it('INVALID_CODE', () => {
    expect(mapRoomError({ error: new Error('INVALID_CODE') })).toBe('초대코드를 다시 확인해 주세요.');
  });

  it('ROOM_FULL — 정원 일반화 카피(정원 5, "2명" 하드코딩 제거)', () => {
    expect(mapRoomError({ error: new Error('ROOM_FULL') })).toBe('로그 정원(5명)이 가득 찼어요.');
  });

  it('ROOM_FULL 카피에 "2명" 하드코딩이 없다 (정원 2→5, S5a)', () => {
    expect(ROOM_ERROR_MESSAGES.ROOM_FULL).not.toContain('2명');
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
});

describe('mapRoomError — room-modes 신규 토큰 (2종, C2)', () => {
  it('INVALID_MODE', () => {
    expect(mapRoomError({ error: new Error('INVALID_MODE') })).toBe('방 모드 선택이 올바르지 않아요.');
  });

  it('SOLO_ROOM_NOT_JOINABLE', () => {
    expect(mapRoomError({ error: new Error('SOLO_ROOM_NOT_JOINABLE') })).toBe(
      '혼자 쓰는 방에는 입장할 수 없어요.',
    );
  });
});

describe('mapRoomError — log-invite 신규 토큰 (2종, get_room, C2)', () => {
  it('NOT_A_MEMBER', () => {
    expect(mapRoomError({ error: new Error('NOT_A_MEMBER') })).toBe('이 로그에 접근할 권한이 없어요.');
  });

  it('ROOM_NOT_FOUND', () => {
    expect(mapRoomError({ error: new Error('ROOM_NOT_FOUND') })).toBe('로그를 찾을 수 없어요.');
  });

  it('Postgres가 NOT_A_MEMBER 토큰을 텍스트로 감싸도 포함 매칭한다', () => {
    expect(mapRoomError({ error: new Error('ERROR: NOT_A_MEMBER (SQLSTATE P0001)') })).toBe(
      '이 로그에 접근할 권한이 없어요.',
    );
  });

  it('ROOM_ERROR_MESSAGES는 정확히 12개의 토큰 키를 가진다 (기존 10 + room-lifecycle 2, C2 단일 출처)', () => {
    expect(Object.keys(ROOM_ERROR_MESSAGES).sort()).toEqual(
      [
        'ALREADY_IN_ROOM',
        'CODE_GENERATION_FAILED',
        'INVALID_CODE',
        'INVALID_MODE',
        'NAME_TOO_LONG',
        'NOT_AUTHENTICATED',
        'NOT_A_MEMBER',
        'NOT_DELETION_REQUESTER',
        'NOT_SCHEDULED',
        'ROOM_FULL',
        'ROOM_NOT_FOUND',
        'SOLO_ROOM_NOT_JOINABLE',
      ].sort(),
    );
  });
});

describe('mapRoomError — room-lifecycle 신규 토큰 (2종, cancel_room_deletion, C2)', () => {
  it('NOT_SCHEDULED', () => {
    expect(mapRoomError({ error: new Error('NOT_SCHEDULED') })).toBe(
      '이미 삭제 예약이 해제됐거나 없는 로그예요.',
    );
  });

  it('NOT_DELETION_REQUESTER', () => {
    expect(mapRoomError({ error: new Error('NOT_DELETION_REQUESTER') })).toBe(
      '나가기를 요청한 사람만 취소할 수 있어요.',
    );
  });

  it('Postgres가 NOT_DELETION_REQUESTER 토큰을 텍스트로 감싸도 포함 매칭한다', () => {
    expect(mapRoomError({ error: new Error('ERROR: NOT_DELETION_REQUESTER (SQLSTATE P0001)') })).toBe(
      '나가기를 요청한 사람만 취소할 수 있어요.',
    );
  });
});

describe('mapRoomError — log-name 신규 토큰 (1종, rename_room, C2)', () => {
  it('NAME_TOO_LONG', () => {
    expect(mapRoomError({ error: new Error('NAME_TOO_LONG') })).toBe('이름은 20자까지 쓸 수 있어요.');
  });

  it('Postgres가 NAME_TOO_LONG 토큰을 텍스트로 감싸도 포함 매칭한다', () => {
    expect(mapRoomError({ error: new Error('ERROR: NAME_TOO_LONG (SQLSTATE P0001)') })).toBe(
      '이름은 20자까지 쓸 수 있어요.',
    );
  });
});

describe('mapRoomError — 포함 매칭 / 기본', () => {
  it('Postgres가 토큰을 텍스트로 감싸도 포함 매칭한다', () => {
    expect(mapRoomError({ error: new Error('ERROR: ROOM_FULL (SQLSTATE P0001)') })).toBe(
      '로그 정원(5명)이 가득 찼어요.',
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
    expect(mapRoomError({ error: { message: 'ROOM_FULL' } })).toBe('로그 정원(5명)이 가득 찼어요.');
  });

  it('null은 throw 없이 기본 메시지', () => {
    expect(mapRoomError({ error: null })).toBe(DEFAULT_ROOM_ERROR_MESSAGE);
  });

  it('숫자 등 기타 타입은 throw 없이 기본 메시지', () => {
    expect(mapRoomError({ error: 42 })).toBe(DEFAULT_ROOM_ERROR_MESSAGE);
  });
});
