// src/features/notif/notifPrefs.ts
// 알림 설정 영속 순수 유틸 (notif-settings plan §4.1). 단위 테스트 대상.
//   영속 위치 = 로컬 AsyncStorage(D1, DB 변경 0). 키는 user_id 스코프(D5)로 계정 전환 시 격리.
//   parseNotifPrefs는 손상/null 입력에도 throw 없이 DEFAULT 폴백(크래시 금지). resolveLogEnabled는
//   perLog 키 부재 시 기본 on(D4 — 신규 로그는 알림 켜짐).

/** 영속 스키마 버전 — 키에 박아 향후 마이그레이션 분기. */
export const NOTIF_PREFS_KEY_PREFIX = 'muklog:notif-prefs:v1';

/**
 * user별 AsyncStorage 키를 만든다.
 * @param userId 인증된 사용자 id (= auth.uid())
 * @returns `muklog:notif-prefs:v1:{userId}` 형태의 스코프 키
 */
export const notifPrefsKey = ({ userId }: { userId: string }): string =>
  `${NOTIF_PREFS_KEY_PREFIX}:${userId}`;

/** 영속 형태. master=마스터 스위치, perLog=roomId→enabled 맵(부재=기본 on). */
export type NotifPrefs = {
  master: boolean;
  perLog: Record<string, boolean>;
};

/** 기본값 — 마스터 on, 로그별 맵 비어있음(미존재 키는 on으로 해석). */
export const DEFAULT_NOTIF_PREFS: NotifPrefs = { master: true, perLog: {} };

/**
 * perLog 후보 값에서 boolean 값만 추려 안전한 맵으로 정규화한다(손상 값 방어).
 * @param value JSON 파싱 결과의 perLog 후보(unknown)
 * @returns roomId→boolean 맵(비-boolean 값은 제외)
 */
const sanitizePerLog = ({ value }: { value: unknown }): Record<string, boolean> => {
  if (value === null || typeof value !== 'object') return {};
  const out: Record<string, boolean> = {};
  for (const [roomId, enabled] of Object.entries(value as Record<string, unknown>)) {
    if (typeof enabled === 'boolean') out[roomId] = enabled;
  }
  return out;
};

/**
 * 원문(JSON string|null)을 안전 파싱한다. 손상/null/형식 불일치면 DEFAULT 반환(throw 금지).
 *   누락 필드는 기본값 보강: master 누락→true, perLog 누락/비객체→{}.
 * @param raw AsyncStorage에서 읽은 원문(JSON 문자열 또는 null)
 * @returns 복원된 NotifPrefs(항상 유효)
 */
export const parseNotifPrefs = ({ raw }: { raw: string | null }): NotifPrefs => {
  if (raw === null) return { ...DEFAULT_NOTIF_PREFS, perLog: {} };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== 'object') return { ...DEFAULT_NOTIF_PREFS, perLog: {} };
    const obj = parsed as { master?: unknown; perLog?: unknown };
    return {
      master: typeof obj.master === 'boolean' ? obj.master : true,
      perLog: sanitizePerLog({ value: obj.perLog }),
    };
  } catch {
    return { ...DEFAULT_NOTIF_PREFS, perLog: {} };
  }
};

/**
 * 저장용으로 직렬화한다.
 * @param prefs 직렬화할 영속 형태
 * @returns JSON 문자열
 */
export const serializeNotifPrefs = ({ prefs }: { prefs: NotifPrefs }): string =>
  JSON.stringify(prefs);

/**
 * 특정 로그의 enabled를 해석한다 — perLog에 키가 없으면 기본 true(D4).
 * @param prefs 현재 영속 형태
 * @param roomId 조회할 로그 id
 * @returns 키가 있으면 그 값, 없으면 true
 */
export const resolveLogEnabled = ({
  prefs,
  roomId,
}: {
  prefs: NotifPrefs;
  roomId: string;
}): boolean => (roomId in prefs.perLog ? prefs.perLog[roomId] : true);
