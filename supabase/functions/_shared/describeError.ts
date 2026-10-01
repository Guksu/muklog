// supabase/functions/_shared/describeError.ts
// Edge Function 오류 로그 재료 — 잡은 오류에서 code·message 두 필드만 꺼낸다 (join-push 리더 지시 R3 · 보안 QA O-1).
//   왜: supabase-js 오류는 일반 객체라 String(err) 은 "[object Object]"만 남아, 배포 순서 문제(PGRST202 = 함수 없음 —
//   마이그레이션 미적용 / 42501 = 권한 없음)를 로그로 가릴 수 없었다. 그렇다고 객체를 통째로 찍으면 details·hint·요청 정보에
//   무엇이 실릴지 모른다 → code·message 만 남긴다. 두 필드도 ① 토큰·키처럼 생긴 문자열을 가리고 ② 한 줄 평문으로 정리하고
//   (호출자가 고른 값이 오류 문구에 섞일 수 있다 — 예: 22P02 의 잘못된 id) ③ 길이 상한으로 자른다. 가린 뒤에 자르므로 경계에
//   걸친 토큰 조각이 남지 않는다.
//   S2-1(보안 QA 2차): 가림 정규식이 도는 길이를 묶는다 — 가리기 전에 먼저 한 줄·2000자로 줄인다. 옛 JWT 패턴은 "eyJ" 를
//   반복한 긴 문구에서 시작 위치마다 끝까지 훑고 실패해 입력 길이의 제곱으로 느려졌다(80KB → 수 초~십수 초). 지금 패턴은
//   한 번 시작하면 실패하지 않는(되돌아가기 없는) 모양이고, Expo·비밀 키를 JWT 보다 먼저 가린다(JWT 패턴이 바로 뒤에 붙은
//   토큰 이름을 삼켜 괄호 안 값이 남는 틈 — S2-4 — 을 막는다). 입력 단계에서도 형식 틀린 id 를 막는다(http.ts pickUuid).
//   ⚠️ 로그에는 이 결과만 싣는다(토큰·JWT·키 미포함). 응답에는 싣지 않는다.
import { toPlainText } from './toPlainText.ts';

/** 가리기 전 정리 상한(코드 포인트) — 가림 정규식이 도는 길이를 묶는다(S2-1). 필드 상한보다 넉넉해야 경계 토큰을 온전히 가린다. */
const LOG_SCAN_MAX_LENGTH = 2000;
/** 로그 필드 하나의 최대 길이(코드 포인트) — 오류 문구에 섞인 값이 길어도 로그가 한없이 길어지지 않게. */
const LOG_FIELD_MAX_LENGTH = 200;

/** 오류 문구에 섞일 수 있는 비밀값 모양과 바꿀 표시 — 이 순서대로 가린다(Expo → 비밀 키 → JWT). */
const SECRET_PATTERNS: ReadonlyArray<{ pattern: RegExp; replacement: string }> = [
  // Expo 푸시 토큰(옛 ExponentPushToken[…] · 새 ExpoPushToken[…]). 괄호 안에 괄호가 없을 때만 — 닫는 괄호가 없으면 다음
  //   여는 괄호에서 바로 멈춰, 같은 글을 되풀이해 훑지 않는다.
  { pattern: /Expo(?:nent)?PushToken\[[^[\]]*\]/g, replacement: '[push-token]' },
  // Supabase 새 비밀 키(sb_secret_…).
  { pattern: /sb_secret_[\w-]+/g, replacement: '[secret-key]' },
  // JWT(사용자 토큰·옛 service_role 키) — 머리는 늘 eyJ('{"' 의 base64)로 시작하고, 마침표로 이은 base64url 덩어리 전체를
  //   가린다. 마침표 개수를 요구하지 않아 잘린 조각도 가리고, 한 번 시작하면 실패가 없어 되돌아가기가 생기지 않는다.
  //   마침표 뒤에 글자가 있어야 이어 붙이므로 문장 끝 마침표는 남는다.
  { pattern: /eyJ[\w-]*(?:\.[\w-]+)*/g, replacement: '[jwt]' },
];

/** 로그에 남기는 오류 모양 — 이 두 필드뿐이다. */
export type LoggedError = { code: string | null; message: string | null };

/**
 * 로그 필드 하나를 정리한다 — 한 줄·2000자로 먼저 줄이고, 비밀값 모양을 가린 뒤, 필드 상한으로 자른다.
 * @param value 원본 문자열
 * @returns 정리한 값(남는 글자가 없으면 null)
 */
const cleanLogField = ({ value }: { value: string }): string | null => {
  // ① 가림 정규식이 도는 길이를 묶는다(S2-1) — 한 줄 평문으로 만들며 2000자에서 자른다.
  const bounded = toPlainText({ value, maxLength: LOG_SCAN_MAX_LENGTH });
  // ② 비밀값 모양을 가린다(Expo → 비밀 키 → JWT).
  const redacted = SECRET_PATTERNS.reduce(
    (text, { pattern, replacement }) => text.replace(pattern, replacement),
    bounded,
  );
  // ③ 필드 상한으로 자른다 — 가린 뒤에 자르므로 경계에 걸친 토큰 조각이 남지 않는다.
  const plain = toPlainText({ value: redacted, maxLength: LOG_FIELD_MAX_LENGTH });
  return plain.length > 0 ? plain : null;
};

/**
 * 잡은 오류를 로그에 남길 모양({ code, message })으로 바꾼다. 다른 필드·중첩 객체·이름·스택은 버린다.
 * @param error catch 로 잡은 값(무엇이든)
 * @returns code(문자열·숫자일 때만) · message(문자열일 때만 — 문자열을 던졌으면 그 값). 두 필드 모두 정리·가림·상한 적용
 */
export const describeError = ({ error }: { error: unknown }): LoggedError => {
  if (typeof error === 'string') return { code: null, message: cleanLogField({ value: error }) };
  if (typeof error !== 'object' || error === null) return { code: null, message: null };
  const { code, message } = error as { code?: unknown; message?: unknown };
  return {
    code:
      typeof code === 'string' || typeof code === 'number' ? cleanLogField({ value: String(code) }) : null,
    message: typeof message === 'string' ? cleanLogField({ value: message }) : null,
  };
};
