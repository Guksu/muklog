// supabase/functions/send-muklog-push/handler.ts
// 새 기록 알림 핸들러 (push-send S2 → join-push plan §5.3 · AC7~AC10 · U75). 새 먹로그를 저장한 사람이 부르면,
//   같은 로그의 다른 멤버에게 "{닉}님이 ‘{가게명}’ 기록을 남겼어요" 알림을 보낸다. 누르면 앱이 그 기록 상세를 연다.
//
// ⚠️ 보안:
//    · 본인 식별 = Authorization JWT → getUserId 로 확인한 callerId 만. 본문의 userId 류는 읽지 않는다. 미인증 → 401.
//    · roomId·muklogId 는 UUID 표준 표기만 받는다(아니면 400) — 형식 틀린 값이 DB 오류 문구로 되돌아와 로그 처리를 무겁게 하지
//      않게(S2-1). 1.3.0·새 앱은 늘 DB 가 준 UUID 를 보내므로 하위 호환에 영향이 없다.
//    · 위조 muklogId 차단 — muklogId 가 그 roomId 의 caller 작성 기록일 때만 보낸다(getOwnMuklogPlaceName: id·room_id·created_by
//      세 조건). 없거나 조회 오류면 보내지 않는다(fail closed). 찾은 가게명이 곧 본문 재료다(조회 1번으로 검증·문구 해결).
//    · 수신자는 list_room_push_targets(roomId, callerId) — 멤버십 게이트 + 수신 설정 게이팅. 토큰은 응답에 싣지 않는다.
//    · 오류 로그는 code·message 만(describeError — R3). 검증 오류 문구에는 호출자가 고른 muklogId 가 섞일 수 있어 한 줄로 정리한다.
// 하위 호환: 출시본 1.3.0 은 { roomId, muklogId } 를 보내고 응답을 기다린다 — 같은 본문을 그대로 받고, 알림 data 도
//   { roomId, muklogId }(type 키 없음)로 둔다 → 구·신 앱 모두 상세로 간다.
// best-effort: 저장은 이미 끝났으므로 발송 실패는 사용자 오류가 아니다 — 항상 200 { sent }.
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
import { buildMuklogPushCopy } from '../_shared/pushCopy.ts';
import { type PushBaseDeps, sendRoomPush } from '../_shared/pushDelivery.ts';

const LOG_TAG = 'send-muklog-push';

/**
 * 핸들러가 의존하는 외부 작업(주입). Deno 테스트가 모킹하고, index.ts 는 실제 구현(createPushDeps)을 넣는다.
 *   getOwnMuklogPlaceName: 그 로그에 caller 가 쓴 기록이면 가게명, 아니면 null. 오류면 throw.
 *   그 밖(getUserId·listPushTargets·getActorNickname·getRoomName·sendExpoPush·deleteToken)은 _shared/pushDelivery.ts.
 */
export type SendMuklogPushDeps = PushBaseDeps & {
  getOwnMuklogPlaceName: (args: {
    muklogId: string;
    roomId: string;
    userId: string;
  }) => Promise<string | null>;
};

/**
 * 새 기록 알림 요청을 처리한다.
 *   OPTIONS → JWT(callerId) → roomId·muklogId(UUID) 확인 → 내 기록 검증(가게명) → 수신자 → 닉·로그 이름(폴백) → 문구 → 발송.
 * @param req 들어온 Request — 본문 { roomId, muklogId }
 * @param deps 외부 작업(주입)
 * @returns 200 { sent } | 400 BAD_REQUEST | 401 UNAUTHENTICATED
 */
export const handleSendMuklogPush = async ({
  req,
  deps,
}: {
  req: Request;
  deps: SendMuklogPushDeps;
}): Promise<Response> => {
  if (req.method === 'OPTIONS') return optionsResponse();

  const callerId = await resolveCallerId({ req, getUserId: deps.getUserId });
  if (!callerId) return jsonResponse({ body: { error: ErrorCode.Unauthenticated }, status: 401 });

  const body = await readJsonObject({ req });
  const roomId = pickUuid({ value: body.roomId });
  const muklogId = pickUuid({ value: body.muklogId });
  if (roomId === null || muklogId === null) {
    return jsonResponse({ body: { error: ErrorCode.BadRequest }, status: 400 });
  }

  // 위조 차단 — 수신자 조회 전에 "이 로그에 caller 가 쓴 기록"인지 확인한다. 아니면(또는 조회 오류) 보내지 않는다.
  let placeName: string | null = null;
  try {
    placeName = await deps.getOwnMuklogPlaceName({ muklogId, roomId, userId: callerId });
  } catch (err) {
    console.warn(`${LOG_TAG}: muklog check failed (fail closed)`, describeError({ error: err }));
  }
  if (placeName === null) return jsonResponse({ body: { sent: 0 }, status: 200 });

  const { sent } = await sendRoomPush({
    deps,
    roomId,
    actorId: callerId,
    data: { roomId, muklogId },
    buildCopy: ({ actorName, roomName }) => buildMuklogPushCopy({ actorName, roomName, placeName }),
    logTag: LOG_TAG,
  });
  return jsonResponse({ body: { sent }, status: 200 });
};
