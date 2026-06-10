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

describe('ROOM_CAPACITY — 모드별 정원 (C4: DB 트리거 정원식과 일치)', () => {
  it('solo 정원은 1', () => {
    expect(ROOM_CAPACITY.solo).toBe(1);
  });

  it('couple 정원은 2', () => {
    expect(ROOM_CAPACITY.couple).toBe(2);
  });

  it('모든 RoomMode에 정원이 정의돼 있다', () => {
    const modes: RoomMode[] = [ROOM_MODES.solo, ROOM_MODES.couple];
    modes.forEach((mode) => {
      expect(typeof ROOM_CAPACITY[mode]).toBe('number');
      expect(ROOM_CAPACITY[mode]).toBeGreaterThanOrEqual(1);
    });
  });
});
