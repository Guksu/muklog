// supabase/functions/send-muklog-push/index.ts
// 새 기록 알림 Edge Function 진입점 — 서버 시작만 한다 (join-push plan §4 D1). 처리 로직은 handler.ts.
//   핸들러와 진입점을 나눈 이유: 테스트가 Deno.serve 를 부르는 모듈을 import 하면 네트워크 권한 없이는 테스트 모듈 전체가
//   실패한다(2026-10-01 실측). 테스트는 handler.ts 만 import 하고, 이 파일은 deno check 와 기기 스모크로 본다.
//
// 환경 변수: SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY(Edge 기본 주입 — 키 이름만, 값은 다루지 않는다).
// 인증: config.toml verify_jwt = true + 핸들러 안 JWT callerId 재확인(이중 방어).
// 배포: `supabase functions deploy send-muklog-push` — CLI 가 import 된 _shared 파일을 함께 묶는다(_shared 를 고치면 두 함수 모두 재배포).
import { createAdminClient } from '../_shared/adminClient.ts';
import { createPushDeps } from '../_shared/pushDeps.ts';
import { handleSendMuklogPush } from './handler.ts';

Deno.serve((req) =>
  handleSendMuklogPush({
    req,
    deps: createPushDeps({ client: createAdminClient(), fetchImpl: fetch }),
  })
);
