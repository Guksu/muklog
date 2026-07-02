// src/features/room/modes.spec.ts
// 방 모드 enum-style 상수 + 모드별 정원 명세 (plan §3.6 / §5 T6, C4).
import { ROOM_CAPACITY, ROOM_MODES, type RoomMode } from './modes';

describe('ROOM_MODES — enum-style 상수', () => {
  it('solo/couple 두 모드를 값으로 가진다', () => {
    expect(ROOM_MODES.solo).toBe('solo');
    expect(ROOM_MODES.couple).toBe('couple');
  });

  it('정확히 2개의 모드 키만 가진다 (단일 출처)', () => {
    expect(Object.keys(ROOM_MODES).sort()).toEqual(['couple', 'solo']);
  });
});

describe('ROOM_CAPACITY — 정원 5 통일 (C6: DB 트리거 정원식과 일치)', () => {
  // members-capacity(S5a): enforce_room_capacity·join_room 정원 2→5 상향 → 이 상수도 5로 동기화.
  it('solo 정원도 5 (정원 통일, 모드 무관)', () => {
    expect(ROOM_CAPACITY.solo).toBe(5);
  });

  it('couple 정원은 5', () => {
    expect(ROOM_CAPACITY.couple).toBe(5);
  });

  it('모든 RoomMode 정원이 트리거 정원식(5)과 일치한다', () => {
    const modes: RoomMode[] = [ROOM_MODES.solo, ROOM_MODES.couple];
    modes.forEach((mode) => {
      expect(ROOM_CAPACITY[mode]).toBe(5);
    });
  });
});
