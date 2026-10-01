// supabase/functions/send-join-push/index.ts
// 합류 알림 Edge Function 진입점 — 서버 시작만 한다 (join-push plan §4 D1). 처리 로직은 handler.ts.
//   테스트는 handler.ts 만 import 한다(Deno.serve 를 부르는 이 파일을 import 하면 네트워크 권한 없이는 테스트 모듈이 실패).
//   이 파일은 deno check 와 기기 스모크로 본다.
//
// 환경 변수: SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY(Edge 기본 주입 — 키 이름만, 값은 다루지 않는다).
// 인증: config.toml verify_jwt = true + 핸들러 안 JWT callerId 재확인(이중 방어) + claim_join_push 1회 보장.
// 배포: `supabase functions deploy send-join-push` — 마이그레이션(20261001120000_join_push.sql)이 먼저여야 claim 이 동작한다
//   (늦으면 claim 오류 → 보내지 않음, 잘못된 알림 0).
import { createAdminClient } from '../_shared/adminClient.ts';
import { createPushDeps } from '../_shared/pushDeps.ts';
import { handleSendJoinPush } from './handler.ts';

Deno.serve((req) =>
  handleSendJoinPush({
    req,
    deps: createPushDeps({ client: createAdminClient(), fetchImpl: fetch }),
  })
);
