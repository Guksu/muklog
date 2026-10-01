// supabase/functions/_shared/adminClient.ts
// service_role Supabase 클라이언트 생성 (join-push plan §5.4). 발송 함수 진입점(index.ts)만 쓴다.
//   환경 변수는 Edge 기본 주입 키 이름 SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY 로만 읽는다 — 값은 응답·로그에 싣지 않는다.
//   ⚠️ 원격 supabase-js(esm.sh)를 import 하는 _shared 파일은 이것 하나다. 테스트는 이 파일을 import 하지 않는다(deno check 로만 확인).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import type { PushAdminClient } from './pushDeps.ts';

/**
 * service_role 클라이언트를 만든다(RLS 우회 — 서버 전용). 세션 저장·토큰 갱신은 끈다.
 * @returns 발송 deps 가 쓰는 최소 구조 타입으로 본 클라이언트
 */
export const createAdminClient = (): PushAdminClient => {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  // 경계 단언 1회: supabase-js 의 제네릭 클라이언트를 최소 구조 타입에 그대로 대입하면 필터 빌더(eq 가 자기 자신을 돌려줌)의
  //   제네릭 비교가 TS2589(타입 인스턴스화가 너무 깊음)로 멈춘다(2026-10-01 deno check 실측). 쓰는 메서드
  //   auth.getUser · rpc · from().select().eq().maybeSingle() · from().delete().eq() 는 실제 API 와 같은 이름·인자이고
  //   (옛 send-muklog-push 가 같은 호출로 운영됨), 호출 계약은 pushDeps.test.ts 가 가짜 클라이언트로 잠근다.
  return admin as unknown as PushAdminClient;
};
