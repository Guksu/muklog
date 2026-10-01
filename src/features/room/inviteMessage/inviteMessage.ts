// src/features/room/inviteMessage/inviteMessage.ts
// 초대 공유 메시지와 설치 링크 (invite-share U72, plan §4.2 · AC1~AC3).
//   생산자: buildInviteMessage → useInviteShare가 Share.share({ message })로 보낸다.
//   소비자(받는 쪽): 받은 말풍선을 통째로 붙여넣으면 extractInviteCode가 코드를 되읽는다(왕복 계약 — 코드 앞 글자는 모두 한글).
//   링크는 버전 게이트가 콜드스타트에 받은 store_url_ios 재사용(추가 조회 0). 없거나 https가 아니면 공개 폴백 상수.
//   Android 링크는 미출시라 싣지 않는다(store_url_android가 생기면 줄을 늘린다 — 범위 밖).

/** iOS App Store 링크(공개 값) — README.md:10 · 마이그레이션 20260722120000(store_url_ios)과 같다(spec이 동기화를 잠근다). */
export const INVITE_STORE_URL_FALLBACK =
  'https://apps.apple.com/kr/app/%EB%A8%B9%EB%A1%9C%EA%B7%B8-muklog/id6782955594';

const HTTPS_PREFIX = 'https://';

// 메시지 세 줄(해요체, 이모지 없음 — 킷 HANDOFF 2026-06-30). 링크는 본문 안에 둔다:
//   iOS에서 url을 따로 넘기면 일부 앱이 본문을 버린다.
const INVITE_MESSAGE_COPY = {
  intro: '먹로그에서 우리 맛집 같이 기록해요',
  codeLabel: '초대코드: ',
  linkLabel: '앱 받기: ',
} as const;

/**
 * 초대 메시지에 넣을 설치 링크를 고른다.
 * @param storeUrlIos 버전 게이트가 조회한 app_config.store_url_ios(조회 전·실패·Provider 밖이면 null)
 * @returns 앞뒤 공백을 걷은 값이 https 링크면 그 값, 아니면(null·빈 값·공백·http·스킴 없음) 폴백 상수
 */
export const resolveInviteStoreUrl = ({ storeUrlIos }: { storeUrlIos: string | null }): string => {
  const trimmed = storeUrlIos?.trim() ?? '';
  const isHttpsLink = trimmed.startsWith(HTTPS_PREFIX) && trimmed.length > HTTPS_PREFIX.length;
  return isHttpsLink ? trimmed : INVITE_STORE_URL_FALLBACK;
};

/**
 * 공유 시트로 보낼 초대 메시지를 만든다. 세 줄을 줄바꿈으로 잇고 끝 줄바꿈은 없다.
 * @param code 6자리 초대코드
 * @param storeUrl 설치 링크(resolveInviteStoreUrl 결과)
 * @returns "먹로그에서 우리 맛집 같이 기록해요\n초대코드: {code}\n앱 받기: {storeUrl}"
 */
export const buildInviteMessage = ({ code, storeUrl }: { code: string; storeUrl: string }): string =>
  [
    INVITE_MESSAGE_COPY.intro,
    `${INVITE_MESSAGE_COPY.codeLabel}${code}`,
    `${INVITE_MESSAGE_COPY.linkLabel}${storeUrl}`,
  ].join('\n');
