// src/features/profile/useDeleteAccount.ts
// 회원 탈퇴 훅 — delete-account Edge Function 호출 (plan §3, AC4). Apple 5.1.1(v) 인앱 계정 삭제.
//
// 생산자: delete-account Edge Function(service_role) — Authorization JWT 로 본인 검증 후
//   본인 계정·프로필·아바타·기기토큰 삭제 + 솔로 룸 cascade / 커플 룸 작성자 익명화. 성공 200 { deleted: true }.
// 소비자: ProfileScreen 확인 시트 → deleteAccount() → 성공 시 **호출부가 signOut()**(AuthGate → 로그인 화면).
//   ⚠️ 훅은 signOut 하지 않는다(관심사 분리·테스트 단순화). 폴링 0(1회 호출).
//   ⚠️ 보안: userId 를 클라가 보내지 않는다. invoke 가 Authorization 헤더(현 세션 JWT)를 자동 첨부 →
//      함수가 getUser()로 검증된 본인 id만 삭제(본문 신뢰 금지, 권한상승 차단).
import { useState } from 'react';

import { supabase } from '@/lib/supabase';

import { mapProfileError } from './errors';

const DELETE_ACCOUNT_FUNCTION = 'delete-account';

/**
 * 회원 탈퇴 액션과 로딩/에러 상태를 제공하는 훅.
 * deleteAccount() 호출 시 delete-account Edge Function 을 1회 호출하고, 성공(deleted:true) 시 true 를 반환한다.
 * 성공 후 세션 정리(signOut)는 호출부 책임(plan §3). 실패 시 error 에 한국어 메시지를 세팅하고 원본 에러를 throw.
 * @returns deleteAccount(액션), loading, error
 */
export const useDeleteAccount = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteAccount = async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      // body 미전송(빈 본문). 본인 식별은 Authorization JWT → 함수 getUser()로만(본문 userId 신뢰 금지).
      const { data, error: invokeError } = await supabase.functions.invoke(DELETE_ACCOUNT_FUNCTION);
      if (invokeError) throw invokeError;

      const ok = (data as { deleted?: unknown } | null)?.deleted === true;
      // deleted:true 가 아니면 미완료 삭제를 성공으로 처리하지 않는다(세션 유지 → 재시도).
      if (!ok) throw new Error('DELETE_ACCOUNT_INCOMPLETE');

      return true;
    } catch (err) {
      setError(mapProfileError({ error: err }));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { deleteAccount, loading, error };
};
