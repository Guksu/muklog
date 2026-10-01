// supabase/functions/_shared/pushCopy.ts
// 푸시 알림 문구(순수) — send-join-push(합류)·send-muklog-push(새 기록)가 함께 쓴다 (join-push plan §7.2 · AC5·AC9).
//   보이스: 해요체 · 문구 안 이모지 0 · '연인' 0(킷 HANDOFF-2026-06-30 §4 — '연인' → '함께').
//   작성자 이름 폴백 = 앱과 같은 defaultNickname(userId) — 앱 화면 표기(동물명+4자리 숫자, 예: "오소리4294")와 신원을 맞춘다.
//   새 기록 본문은 조사 없는 틀("‘{가게명}’ 기록을 남겼어요") — 가게명이 영문·숫자로 끝나도 을/를 판정이 필요 없다.
//   표기는 킷 관례를 따른다: 가게명은 둥근 작은따옴표 ‘ ’(킷 mk-log.jsx:301 · 앱 MuklogDetailScreen 과 같음 — 가게명 안의
//   곧은 아포스트로피와 경계가 섞이지 않는다), 끝 마침표는 두 문장 문구(합류 본문)만(킷 mk-home.jsx:277 "함께 기록할 수 있어요.").
//   R1(보안 QA 권고 · 리더 결정 2026-10-01): 닉네임·로그 이름·가게명은 사용자가 고른 원문이다(앱을 거치지 않고 DB 에 직접 넣을 수
//   있다). 줄바꿈으로 가짜 안내 줄을 끼우거나 방향 제어 문자로 글자 순서를 뒤집지 못하게 toPlainText 로 한 줄 평문으로 정리하고,
//   앱 입력 상한으로 자른다. 앱에서 저장한 값은 잘리지 않는다 — 앱은 닉네임·가게명을 UTF-16 길이로 세고(코드 포인트 수가 같거나
//   적다), 로그 이름은 코드 포인트로 센다.
import { defaultNickname } from './defaultNickname.ts';
import { toPlainText } from './toPlainText.ts';

/** 새 기록 알림 제목 폴백(로그 이름 없음) — 기존 값 유지. */
export const MUKLOG_PUSH_FALLBACK_TITLE = '새 먹로그';
/** 합류 알림 제목 폴백(로그 이름 없음) — 앱 2명 이상 로그의 이름 폴백(logName.ts '우리 로그')과 같은 말. */
export const JOIN_PUSH_FALLBACK_TITLE = '우리 로그';

/** 닉네임 최대 길이(코드 포인트) — 앱 입력 상한 src/features/profile/nickname/nickname.ts:9 NICKNAME_MAX_LENGTH(DB 상한 없음). */
const NICKNAME_MAX_LENGTH = 20;
/** 로그 이름 최대 길이 — 앱 src/features/room/logName/logName.ts:14 LOG_NAME_MAX_LENGTH · DB rename_room char_length 20. */
const ROOM_NAME_MAX_LENGTH = 20;
/** 가게명 최대 길이 — 앱 입력 상한 src/features/muklog/MuklogEditor/MuklogEditor.tsx:91 PLACE_NAME_MAX(DB 는 빈 값만 막는다). */
const PLACE_NAME_MAX_LENGTH = 60;

/** 문구 한 벌(OS 알림의 제목·본문). */
export type PushCopy = { title: string; body: string };

/**
 * 문구 재료를 한 줄 평문으로 정리하고 상한으로 자른다. 남는 글자가 없으면 null(폴백 판단용).
 * @param value 원본(없을 수 있음)
 * @param maxLength 최대 길이(코드 포인트)
 * @returns 정리한 값 또는 null
 */
const cleanToNull = ({
  value,
  maxLength,
}: {
  value: string | null | undefined;
  maxLength: number;
}): string | null => {
  const text = toPlainText({ value: value ?? '', maxLength });
  return text.length > 0 ? text : null;
};

/**
 * 알림에 쓸 작성자(행동한 사람) 이름을 정한다.
 * @param nickname 프로필 닉네임(없거나 공백일 수 있음 — 줄바꿈·방향 제어 문자는 정리하고 20자로 자른다)
 * @param userId JWT 로 확인한 사용자 id — 닉네임이 없을 때 앱과 같은 기본 닉네임을 만든다
 * @returns 정리한 닉네임, 정리 뒤 비면 defaultNickname(userId)
 */
export const resolveActorName = ({
  nickname,
  userId,
}: {
  nickname: string | null;
  userId: string;
}): string =>
  cleanToNull({ value: nickname, maxLength: NICKNAME_MAX_LENGTH }) ?? defaultNickname({ userId });

/**
 * 합류 알림 문구를 만든다. 제목 = 로그 이름(없으면 '우리 로그'), 본문 = "{닉}님이 들어왔어요. 이제 함께 기록할 수 있어요.".
 * @param actorName 들어온 사람 이름(resolveActorName 결과 — 이미 정리됨)
 * @param roomName 로그 이름(없을 수 있음 — 정리하고 20자로 자른다, 정리 뒤 비면 폴백)
 * @returns 제목·본문
 */
export const buildJoinPushCopy = ({
  actorName,
  roomName,
}: {
  actorName: string;
  roomName: string | null;
}): PushCopy => ({
  title: cleanToNull({ value: roomName, maxLength: ROOM_NAME_MAX_LENGTH }) ?? JOIN_PUSH_FALLBACK_TITLE,
  body: `${actorName}님이 들어왔어요. 이제 함께 기록할 수 있어요.`,
});

/**
 * 새 기록 알림 문구를 만든다. 제목 = 로그 이름(없으면 '새 먹로그'),
 * 본문 = "{닉}님이 ‘{가게명}’ 기록을 남겼어요"(가게명이 정리 뒤 비면 "{닉}님이 새 맛집을 기록했어요" — DB 가 빈 가게명을 막지만
 * 방향 제어 문자만으로 된 가게명은 통과하므로 방어가 필요하다).
 * @param actorName 작성자 이름(resolveActorName 결과 — 이미 정리됨)
 * @param roomName 로그 이름(없을 수 있음 — 정리하고 20자로 자른다)
 * @param placeName 가게 이름(정리하고 60자로 자른다)
 * @returns 제목·본문
 */
export const buildMuklogPushCopy = ({
  actorName,
  roomName,
  placeName,
}: {
  actorName: string;
  roomName: string | null;
  placeName: string | null;
}): PushCopy => {
  const place = cleanToNull({ value: placeName, maxLength: PLACE_NAME_MAX_LENGTH });
  return {
    title: cleanToNull({ value: roomName, maxLength: ROOM_NAME_MAX_LENGTH }) ?? MUKLOG_PUSH_FALLBACK_TITLE,
    body:
      place === null
        ? `${actorName}님이 새 맛집을 기록했어요`
        : `${actorName}님이 ‘${place}’ 기록을 남겼어요`,
  };
};
