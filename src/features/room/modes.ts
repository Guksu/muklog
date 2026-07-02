// src/features/room/modes.ts
// 방 모드 식별 상수 + 로그 정원 (plan §3.9, C6).
//
// ⚠️ ROOM_CAPACITY 는 DB enforce_room_capacity() 트리거의 정원식과 반드시 일치해야 한다(C6 교차검증).
//    members-capacity(S5a): 트리거·join_room 정원 2→5 상향(20260701120000_members_up_to_5.sql) → 이 상수도 5로 동기화.
// 도메인 식별 문자열은 enum-style 상수로 단일 출처화(코드 컨벤션).

/** 방 모드: solo=혼자 시작 / couple=둘이 이상(초대코드 공유). 정원은 모드 무관 5(ROOM_CAPACITY). */
export type RoomMode = 'solo' | 'couple';

/** enum-style 상수 — 리터럴 직접 비교 대신 이 객체를 import해 사용. */
export const ROOM_MODES = { solo: 'solo', couple: 'couple' } as const;

/**
 * 로그 정원. 서버 정원은 모드 무관 5로 통일(enforce_room_capacity 정원식 count>=5).
 * ⚠️ 트리거 정원식과 단일 출처(C6): solo·couple 모두 5. (S5a에서 2→5 상향.)
 *    멤버 배지(혼자/N명)는 이 상수가 아니라 memberCount에서 파생한다(plan 함정3).
 */
export const ROOM_CAPACITY: Record<RoomMode, number> = { solo: 5, couple: 5 };
