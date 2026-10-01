// supabase/functions/send-join-push/handler.ts
// 합류 알림 핸들러 (join-push plan §5.2 · AC1~AC6 · U74). 초대코드로 로그에 들어온 사람이 부르면, 그 로그의 다른 멤버에게
//   "{닉}님이 들어왔어요. 이제 함께 기록할 수 있어요." 알림을 한 번 보낸다. 누르면 앱이 roomId 로 로그 화면을 연다.
//
// ⚠️ 보안:
//    · 본인 식별 = Authorization JWT → getUserId 로 확인한 callerId 만. 본문의 userId 류는 읽지 않는다. 미인증 → 401.
//    · roomId 는 UUID 표준 표기만 받는다(아니면 400) — 형식 틀린 값이 DB 오류 문구로 되돌아와 로그 처리를 무겁게 하지 않게(S2-1).
//    · 같은 합류로 두 번 이상 보내지 않는다 — claim_join_push(service_role)가 "내 멤버 행 · 아직 안 보냄 · 합류 10분 안 ·
//      생성자 아님"을 한 문장으로 확인하고 기록한다. true 일 때만 보낸다. 오류는 보내지 않는다(fail closed).
//    · 수신자는 list_room_push_targets(roomId, callerId) — 멤버십 게이트 + 수신 설정(master AND 로그별) 게이팅.
//    · 토큰은 service_role 경계 안에서만 — 응답에 싣지 않는다. 오류 로그는 code·message 만(describeError — R3).
// 순서: claim 먼저, 발송 나중 — 수신자 조회·Expo 발송이 실패하면 그 합류의 알림은 사라진다(최대 1회, best-effort).
// 분리 이유: 구 send-muklog-push 는 모르는 필드를 무시하므로 거기에 합류 본문을 보내면 "새 맛집" 오발송이 난다.
//   새 이름은 배포 전이면 404 라 아무것도 보내지 않는다(배포 순서가 어긋나도 잘못된 알림 0).
// ⚠️ Deno 런타임(Supabase Edge). 앱 jest/tsc 대상 아님. 서버 시작은 index.ts — 테스트는 이 파일만 import 한다.
import {
  ErrorCode,
  jsonResponse,
  optionsResponse,
  pickUuid,
  readJsonObject,
  resolveCallerId,
} from '../_shared/http.ts';
import { describeError } from '../_shared/describeError.ts';
import { buildJoinPushCopy } from '../_shared/pushCopy.ts';
import { type PushBaseDeps, PushDataType, sendRoomPush } from '../_shared/pushDelivery.ts';

const LOG_TAG = 'send-join-push';

/**
 * 핸들러가 의존하는 외부 작업(주입). Deno 테스트가 모킹하고, index.ts 는 실제 구현(createPushDeps)을 넣는다.
 *   claimJoinPush: 합류 알림 발송권을 한 번만 쓴다(처음 쓴 호출만 true). 오류면 throw.
 *   그 밖(getUserId·listPushTargets·getActorNickname·getRoomName·sendExpoPush·deleteToken)은 _shared/pushDelivery.ts.
 */
export type SendJoinPushDeps = PushBaseDeps & {
  claimJoinPush: (args: { roomId: string; userId: string }) => Promise<boolean>;
};

/**
 * 합류 알림 요청을 처리한다.
 *   OPTIONS → JWT(callerId) → roomId(UUID) 확인 → claim(1회) → 수신자 → 닉·로그 이름(폴백) → 문구 → 발송.
 *   발송 결과와 무관하게 200(입장은 이미 끝남) — 응답은 { sent } 만.
 * @param req 들어온 Request — 본문 { roomId }
 * @param deps 외부 작업(주입)
 * @returns 200 { sent } | 400 BAD_REQUEST | 401 UNAUTHENTICATED
 */
export const handleSendJoinPush = async ({
  req,
  deps,
}: {
  req: Request;
  deps: SendJoinPushDeps;
}): Promise<Response> => {
  if (req.method === 'OPTIONS') return optionsResponse();

  const callerId = await resolveCallerId({ req, getUserId: deps.getUserId });
  if (!callerId) return jsonResponse({ body: { error: ErrorCode.Unauthenticated }, status: 401 });

  const body = await readJsonObject({ req });
  const roomId = pickUuid({ value: body.roomId });
  if (roomId === null) return jsonResponse({ body: { error: ErrorCode.BadRequest }, status: 400 });

  // 1회 보장 — 처음 쓴 호출만 보낸다. 재호출·연타·악의적 반복은 여기서 멈춘다(수신자 조회 0).
  let claimed = false;
  try {
    claimed = await deps.claimJoinPush({ roomId, userId: callerId });
  } catch (err) {
    // code 로 배포 순서 문제를 가린다 — PGRST202 = claim 함수 없음(마이그레이션 미적용) / 42501 = 실행 권한 없음.
    console.warn(`${LOG_TAG}: claim failed (fail closed)`, describeError({ error: err }));
  }
  if (!claimed) return jsonResponse({ body: { sent: 0 }, status: 200 });

  const { sent } = await sendRoomPush({
    deps,
    roomId,
    actorId: callerId,
    data: { type: PushDataType.MemberJoined, roomId },
    buildCopy: buildJoinPushCopy,
    logTag: LOG_TAG,
  });
  return jsonResponse({ body: { sent }, status: 200 });
};
