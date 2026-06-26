// src/features/profile/useRecoverPendingPick.ts
// 유실된 picker 결과 복구 훅 (picker-recovery §설계2·3) — Android MainActivity 파괴로 launchImageLibraryAsync
//   promise 가 유실됐을 때, 재마운트/AppState 'active' 복귀 시 getPendingResultAsync 로 결과를 회수해 업로드 재개.
//
// 진입점: 앱 마운트 1회 + AppState 'active' 복귀(ProfileProvider 트리 — 인증 userId·refresh 보유).
// 흐름: getPendingResultAsync() → 유효 결과(!canceled && assets[0]) 1건 + 저장된 avatar 컨텍스트 →
//        uploadAvatarFromUri → ProfileProvider refresh(전 화면 반영) → 토스트. 항상 컨텍스트 clear(중복 방지).
// 분기: 결과 없음/에러결과/canceled/컨텍스트 없음 → no-op(잘못된 업로드 0). 처리 중 가드(중복 호출 방지).
//
// ⚠️ 단위 테스트는 getPendingResultAsync 를 모킹한다. 실제 파괴→복구는 디바이스 스모크로만 검증 가능.
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { useToastController } from '@/components';

import { clearPendingPick, loadPendingPick, PendingPickKind } from './pendingPick';
import { uploadAvatarFromUri } from './uploadAvatarFromUri';

/** 복구 성공 시 사용자 피드백 카피. */
export const PICK_RECOVERED_TOAST = '프로필 사진을 변경했어요';

// getPendingResultAsync 응답(배열)에서 업로드할 첫 유효 성공 결과의 uri 를 고른다.
//   에러결과(code/message)·canceled 항목은 무시. 없으면 null.
const pickRecoveredUri = ({
  results,
}: {
  results: Awaited<ReturnType<typeof ImagePicker.getPendingResultAsync>>;
}): string | null => {
  for (const item of results) {
    if (item !== null && 'canceled' in item && item.canceled === false) {
      const uri = item.assets?.[0]?.uri;
      if (uri) return uri;
    }
  }
  return null;
};

/**
 * 유실된 아바타 picker 결과를 복구·재개하는 훅(부수효과만, 반환 없음).
 * @param refresh ProfileProvider 의 공유 refresh — 업로드 성공 후 전 화면 반영
 */
export const useRecoverPendingPick = ({
  refresh,
}: {
  refresh: () => Promise<void>;
}): void => {
  const recoveringRef = useRef(false);
  const { showToast } = useToastController();

  useEffect(function recoverOnMountAndForeground() {
    let cancelled = false;

    // 중복 호출 가드(마운트·AppState active 동시 진입) + 처리 중 재진입 차단.
    const runRecovery = async () => {
      if (recoveringRef.current) return;
      recoveringRef.current = true;
      try {
        const results = await ImagePicker.getPendingResultAsync();
        const uri = pickRecoveredUri({ results });
        const context = await loadPendingPick();

        // 유효 결과 + avatar 컨텍스트일 때만 업로드. 컨텍스트는 항상 제거(중복 방지).
        if (uri && context !== null && context.kind === PendingPickKind.Avatar) {
          await clearPendingPick();
          await uploadAvatarFromUri({ uri, userId: context.userId });
          if (!cancelled) {
            await refresh();
            showToast({ message: PICK_RECOVERED_TOAST, tone: 'positive' });
          }
        } else if (context !== null) {
          // 결과 없음/canceled/에러결과인데 컨텍스트만 남음 → 정리(다음 진입 오작동 방지).
          await clearPendingPick();
        }
      } catch {
        // 복구는 best-effort: 실패해도 앱 동작에 영향 없음(다음 진입에서 재시도 가능).
      } finally {
        recoveringRef.current = false;
      }
    };

    runRecovery();

    const onAppStateChange = (next: AppStateStatus) => {
      if (next === 'active') runRecovery();
    };
    const subscription = AppState.addEventListener('change', onAppStateChange);

    return function cleanupRecovery() {
      cancelled = true;
      subscription.remove();
    };
  }, []);
};
