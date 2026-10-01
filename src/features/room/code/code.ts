// src/features/room/code.ts
// 초대코드 charset/길이 + 클라 입력 정규화 (plan §3.4 / §3.6 / C6).
//   invite-share(U73): 붙여넣은 문장에서 코드 추출(extractInviteCode)·숨김 입력란 변경 해석(resolveInviteCodeInput).
//     규칙은 normalizeInviteCodeInput 하나로 통일한다(추가 규칙 없음 — "정확히 6자 토큰 우선"은 범위 밖, plan §12 Q7).
//
// ⚠️ INVITE_CODE_CHARSET 은 create_room RPC(SQL)의 charset과 반드시 동일해야 한다(C6 교차검증 포인트).
//    A-Z 중 O,I 제외(24자) + 0-9 중 0,1 제외(8자) = 32자.
// 코드 "생성"은 서버(RPC) 전담 — 클라는 입력 화면의 정규화/검증만 담당(클라 코드생성 유틸 없음).

export const INVITE_CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 6;

const allowedChars = new Set(INVITE_CODE_CHARSET.split(''));

/**
 * 입력값 정규화: 대문자 변환 → charset 외 문자(공백·혼동문자 0/O/1/I 포함) 제거 → 최대 6자 컷.
 * autoCapitalize="characters" + autoCorrect={false} 와 함께 사용.
 * @param raw 사용자가 입력한 원본 문자열
 * @returns 정규화된 초대코드(최대 6자)
 */
export const normalizeInviteCodeInput = ({ raw }: { raw: string }): string =>
  raw
    .toUpperCase()
    .split('')
    .filter((ch) => allowedChars.has(ch))
    .slice(0, INVITE_CODE_LENGTH)
    .join('');

/**
 * 6자리 완성 여부(입장 버튼 활성화 조건).
 * @param code 정규화된 초대코드
 * @returns 길이가 INVITE_CODE_LENGTH면 true
 */
export const isInviteCodeComplete = ({ code }: { code: string }): boolean =>
  code.length === INVITE_CODE_LENGTH;

/**
 * 붙여넣은 글에서 초대코드를 뽑는다. normalizeInviteCodeInput 규칙(대문자화 → 허용 문자만 → 앞 6자) 그대로이고,
 * 결과가 6자일 때만 코드로 인정한다. 공유 메시지(buildInviteMessage)는 코드 앞 글자가 모두 한글이라 첫 6자가 곧 코드다.
 * @param text 붙여넣은(또는 클립보드에서 읽은) 원문
 * @returns 6자 초대코드, 허용 문자가 6자 미만이면 null
 */
export const extractInviteCode = ({ text }: { text: string }): string | null => {
  const code = normalizeInviteCodeInput({ raw: text });
  return isInviteCodeComplete({ code }) ? code : null;
};

/**
 * 입력란의 이전 값과 새 원문을 비교해 한 번에 들어온 글(삽입분)을 구한다 — 앞·뒤로 겹치는 부분을 걷어 낸 가운데 글.
 * 한 번의 연속 삽입·교체를 가정한다(끝에 붙여넣기·커서 위치에 붙여넣기·전체 선택 후 붙여넣기).
 * @param prev 입력란의 이전 값
 * @param raw 입력란이 보낸 새 원문
 * @returns 삽입분(지우기만 했으면 빈 문자열)
 */
const findInsertedText = ({ prev, raw }: { prev: string; raw: string }): string => {
  const sharedLength = Math.min(prev.length, raw.length);
  let head = 0;
  while (head < sharedLength && prev[head] === raw[head]) head += 1;
  // 뒤쪽 겹침은 앞에서 이미 센 글자를 다시 세지 않도록 남은 길이 안에서만 본다.
  let tail = 0;
  while (tail < sharedLength - head && prev[prev.length - 1 - tail] === raw[raw.length - 1 - tail]) tail += 1;
  return raw.slice(head, raw.length - tail);
};

/**
 * 숨김 입력란이 보낸 새 원문을 다음 코드 값으로 바꾼다.
 * 삽입분에 코드 하나(허용 문자 6자)가 통째로 있으면 붙여넣기·키보드 클립보드 제안으로 보고 그 코드로 교체한다
 * (이미 채운 글자에 이어 붙이지 않는다). 아니면(한 글자 입력·지우기·코드 없는 글) 기존 정규화 그대로다.
 * @param prev 입력란의 현재 값(정규화된 코드 — CodeInput의 value)
 * @param raw 입력란이 보낸 새 원문(onChangeText 인자)
 * @returns 다음 코드 값(최대 6자)
 */
export const resolveInviteCodeInput = ({ prev, raw }: { prev: string; raw: string }): string =>
  extractInviteCode({ text: findInsertedText({ prev, raw }) }) ?? normalizeInviteCodeInput({ raw });
