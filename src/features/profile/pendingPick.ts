// src/features/profile/pendingPick.ts
// picker 컨텍스트 영속 (picker-recovery §설계1) — Android MainActivity 파괴로 메모리가 날아가도
//   재마운트 후 getPendingResultAsync 로 복구한 결과를 어디로 라우팅할지 알기 위한 컨텍스트를 AsyncStorage에 저장.
//
// 라이프사이클: launchImageLibraryAsync 호출 직전 savePendingPick → 정상 resolve(파괴 안 됨) 시 clearPendingPick.
//   파괴되면 clear 가 실행되지 않아 컨텍스트가 남고, 복구 시점에 loadPendingPick 으로 읽어 라우팅 후 clear.
//
// kind: 이번 스프린트는 'avatar' 만 처리(먹로그 사진은 동일 패턴 후속 — 형만 열어둠).
import AsyncStorage from '@react-native-async-storage/async-storage';

/** picker 컨텍스트 영속 키(단일 출처). */
export const PENDING_PICK_KEY = 'muklog:pending-pick';

/** picker 결과 라우팅 종류(enum-style 상수 — 도메인 식별 문자열). */
export const PendingPickKind = {
  Avatar: 'avatar',
} as const;
export type PendingPickKind = (typeof PendingPickKind)[keyof typeof PendingPickKind];

/** 아바타 picker 컨텍스트 — 복구 시 어떤 사용자의 아바타로 업로드할지. */
export type PendingPickContext = {
  kind: typeof PendingPickKind.Avatar;
  userId: string;
};

/**
 * picker 호출 직전 컨텍스트를 영속한다.
 * @param context 복구 라우팅에 필요한 컨텍스트({ kind:'avatar', userId })
 */
export const savePendingPick = async ({
  context,
}: {
  context: PendingPickContext;
}): Promise<void> => {
  await AsyncStorage.setItem(PENDING_PICK_KEY, JSON.stringify(context));
};

/**
 * 영속된 picker 컨텍스트를 읽는다(없거나 파싱 실패면 null).
 * @returns 유효한 PendingPickContext 또는 null
 */
export const loadPendingPick = async (): Promise<PendingPickContext | null> => {
  const raw = await AsyncStorage.getItem(PENDING_PICK_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingPickContext> | null;
    if (
      parsed !== null &&
      parsed.kind === PendingPickKind.Avatar &&
      typeof parsed.userId === 'string' &&
      parsed.userId.length > 0
    ) {
      return { kind: PendingPickKind.Avatar, userId: parsed.userId };
    }
    return null;
  } catch {
    return null;
  }
};

/** 영속된 picker 컨텍스트를 제거한다(정상 resolve·복구 처리 후 중복 방지). */
export const clearPendingPick = async (): Promise<void> => {
  await AsyncStorage.removeItem(PENDING_PICK_KEY);
};
