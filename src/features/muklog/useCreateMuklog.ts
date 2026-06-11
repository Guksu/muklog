// src/features/muklog/useCreateMuklog.ts
// 먹로그 생성 훅 (plan §5.3 / §5 T6, AC2·AC3·AC8).
//
// 생산자: 클라 직접 insert(RLS 하). created_by = auth.getUser()의 uid를 채워
//   from('muklogs').insert(row).select('id').single(). RLS `with check (created_by=auth.uid())`가
//   누락/위조를 거부(AC8). 트리거(enforce_muklog_fields)가 값 범위 최종 방어.
// 소비자: MuklogEntrySheet(저장 버튼) → 성공 시 onSaved → MuklogList.refresh()(AC2·AC12).
//
// 검증: normalizeMuklogInput으로 앱단 1차 차단(장소명 빈→insert 미호출, rating/미래일 차단).
//   에러는 mapMuklogError로 한국어 메시지(error 상태) + 원본 throw(시트가 입력 보존).
//   중복 저장은 loading 중 시트 버튼 비활성으로 방지(엣지 §9).
import { useState } from 'react';

import { supabase } from '@/lib/supabase';

import { mapMuklogError } from './errors';
import { type CreateMuklogInput } from './types';
import { normalizeMuklogInput, toMuklogRow } from './validate';

export type CreateMuklogResult = { id: string };

/**
 * 먹로그 생성 액션과 로딩/에러 상태를 제공하는 훅.
 * createMuklog({ input })가 입력을 검증·정규화하고 insert를 수행해 { id }를 반환한다.
 * 실패 시 error에 한국어 메시지를 세팅하고 원본 에러를 throw한다(시트가 입력을 보존).
 */
export const useCreateMuklog = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createMuklog = async ({
    input,
  }: {
    input: CreateMuklogInput;
  }): Promise<CreateMuklogResult> => {
    setLoading(true);
    setError(null);
    try {
      // 앱단 1차 검증/정규화(장소명 필수·rating 1~5·미래일 차단) — 위반 시 토큰 throw.
      const normalized = normalizeMuklogInput({ input });

      // created_by는 RLS with check가 auth.uid()와 일치하길 강제 → 실제 인증 uid를 채운다.
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const userId = userData.user?.id;
      if (!userId) throw new Error('NOT_AUTHENTICATED');

      const { data, error: insertError } = await supabase
        .from('muklogs')
        .insert(toMuklogRow({ input: normalized, userId }))
        .select('id')
        .single();
      if (insertError) throw insertError;

      const obj = (data ?? {}) as { id?: string };
      if (!obj.id) throw new Error('CREATE_MUKLOG_BAD_RESPONSE');
      return { id: obj.id };
    } catch (err) {
      setError(mapMuklogError({ error: err }));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { createMuklog, loading, error };
};
