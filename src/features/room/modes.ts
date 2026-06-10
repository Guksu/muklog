// src/features/room/modes.ts
// 방 모드 식별 상수 + 로그 정원 (plan §3.9, C6).
//
// ⚠️ ROOM_CAPACITY 는 DB enforce_room_capacity() 트리거의 정원식과 반드시 일치해야 한다(C6 교차검증).
//    多로그 전환(multi-log-home): 트리거가 모드 무관 정원2로 통일 → solo도 2로 동기화(stale solo=1 폐기).
// 도메인 식별 문자열은 enum-style 상수로 단일 출처화(코드 컨벤션).

/** 방 모드: solo=혼자(정원1, 영구) / couple=둘이(정원2, 초대코드 공유). */
export type RoomMode = 'solo' | 'couple';

/** enum-style 상수 — 리터럴 직접 비교 대신 이 객체를 import해 사용. */
export const ROOM_MODES = { solo: 'solo', couple: 'couple' } as const;

/**
 * 로그 정원. 多로그 전환 후 서버 정원은 모드 무관 2로 통일(enforce_room_capacity 정원2).
 * ⚠️ 트리거 정원식과 단일 출처(C6): solo·couple 모두 2. (구 solo=1은 폐기 — 정원 통일.)
 *    멤버 배지(혼자/둘이)는 이 상수가 아니라 memberCount에서 파생한다(plan 함정3).
 */
export const ROOM_CAPACITY: Record<RoomMode, number> = { solo: 2, couple: 2 };
