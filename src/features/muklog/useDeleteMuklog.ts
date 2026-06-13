// src/features/muklog/useDeleteMuklog.ts
// 먹로그 삭제 훅 (plan §3.6 / §7 작업⑤ d, 경계면 §8).
//
// 생산자: 클라 직접 delete(RLS muklogs_delete_own 하). 동작 순서:
//   1) Storage 파일 먼저 remove(photoPaths 일괄, best-effort) — row 먼저 지우면 크래시 시 orphan 단서를 잃는다.
//   2) muklogs.delete({ count }).eq('id') — RLS가 본인 행만. FK ON DELETE CASCADE로 muklog_photos 행 자동 삭제.
//      error 또는 count 0(권한 없음/없는 행) → throw(상위가 인라인 에러 + 재시도).
// 소비자: MuklogDetailRoute onConfirmDelete → 성공 시 navigation.goBack + 리스트 포커스 refresh(plan §4.3).
//
// orphan 정책(plan §6): Storage 먼저 지우므로 "row 삭제됨 + 파일 남음" 역전은 발생 안 함.
//   반대(파일 지움 + row 삭제 실패) → 사용자 재시도 시 row 삭제, remove는 no-op. orphan 허용(무료 티어 영향 미미).
import { useState } from 'react';

import { supabase } from '@/lib/supabase';

import { mapMuklogError } from './errors';
import { MUKLOG_PHOTOS_BUCKET } from './photoPath';

/**
 * 먹로그 삭제 액션과 로딩/에러 상태를 제공하는 훅.
 * deleteMuklog({ muklogId, roomId, photoPaths })가 Storage 파일을 먼저 정리하고 row를 삭제한다.
 * 실패 시 error에 한국어 메시지를 세팅하고 원본 에러를 throw한다(확인 시트가 인라인 표시·재시도).
 */
export const useDeleteMuklog = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteMuklog = async ({
    muklogId,
    roomId: _roomId,
    photoPaths,
  }: {
    muklogId: string;
    roomId: string;
    photoPaths: string[];
  }): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      // 1. Storage 파일 먼저 remove(best-effort) — 실패해도 row 삭제로 진행(orphan은 허용, plan §6).
      if (photoPaths.length > 0) {
        try {
          await supabase.storage.from(MUKLOG_PHOTOS_BUCKET).remove(photoPaths);
        } catch {
          // best-effort: Storage 정리 실패는 무시(row 삭제가 더 중요, 차기 정리 잡).
        }
      }

      // 2. row delete — RLS(muklogs_delete_own)가 본인 행만. FK CASCADE로 muklog_photos 자동 삭제.
      //    count 요청으로 0행(권한 없음/없는 행)을 에러로 승격해 사용자에게 알린다.
      const { error: deleteError, count } = await supabase
        .from('muklogs')
        .delete({ count: 'exact' })
        .eq('id', muklogId);
      if (deleteError) throw deleteError;
      if (count === 0) throw new Error('DELETE_MUKLOG_NOT_FOUND'); // RLS 거부/없는 행.
    } catch (err) {
      setError(mapMuklogError({ error: err }));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { deleteMuklog, loading, error };
};
