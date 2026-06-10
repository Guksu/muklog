// src/features/room/modes.ts
// 방 모드 식별 상수 + 모드별 정원 (plan §3.6, C4).
//
// ⚠️ ROOM_CAPACITY 는 DB enforce_room_capacity() 트리거의 정원식(solo=1/couple=2)과
//    반드시 일치해야 한다(C4 교차검증 포인트). 한쪽만 바뀌면 정원 경계 버그.
// 도메인 식별 문자열은 enum-style 상수로 단일 출처화(코드 컨벤션).

/** 방 모드: solo=혼자(정원1, 영구) / couple=둘이(정원2, 초대코드 공유). */
export type RoomMode = 'solo' | 'couple';

/** enum-style 상수 — 리터럴 직접 비교 대신 이 객체를 import해 사용. */
export const ROOM_MODES = { solo: 'solo', couple: 'couple' } as const;

/** 모드별 정원. DB 트리거 정원식과 단일 출처(C4). */
export const ROOM_CAPACITY: Record<RoomMode, number> = { solo: 1, couple: 2 };
