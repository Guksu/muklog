// src/features/appVersion/updateSuggestDismissal/updateSuggestDismissal.ts
// 업데이트 권유 노출 정책 저장 (app-version-gate plan §3.5, AsyncStorage — notifPrefs·pendingPick 선례).
//   정책 = 버전당 1회: 사용자가 "나중에" 누른 latest_version을 기록 → 저장값===현재 latest면 미노출,
//   더 새 latest면 재노출. 강제(force)는 dismissal 무시(항상 차단, 호출부 useAppVersionGate 책임).
import AsyncStorage from '@react-native-async-storage/async-storage';

/** dismiss 기록 키(단일 출처). 값 = 마지막으로 "나중에" 누른 latest_version 문자열. */
export const UPDATE_SUGGEST_DISMISSED_KEY = 'muklog:update-suggest-dismissed';

/**
 * 마지막으로 "나중에"로 미룬 latest_version을 읽는다.
 * @returns 저장된 버전 문자열, 없거나 실패면 null(=미dismiss → 권유 노출 허용)
 */
export const loadDismissedVersion = async (): Promise<string | null> => {
  try {
    const raw = await AsyncStorage.getItem(UPDATE_SUGGEST_DISMISSED_KEY);
    return raw && raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
};

/**
 * 권유 모달 "나중에" 시 현재 latest_version을 기록한다(그 버전은 재노출 안 함). best-effort.
 * @param version 미룰 latest_version 문자열
 */
export const saveDismissedVersion = async ({ version }: { version: string }): Promise<void> => {
  try {
    await AsyncStorage.setItem(UPDATE_SUGGEST_DISMISSED_KEY, version);
  } catch {
    // best-effort 로컬 쓰기 — 실패 시 다음 콜드스타트에서 권유가 한 번 더 뜰 뿐(무해).
  }
};
