// src/features/room/inviteMessage/inviteMessage.spec.ts
// 초대 공유 메시지·스토어 링크 해석 (invite-share U72, plan R2 — AC1·AC2·AC3).
//   보내는 메시지(buildInviteMessage)를 받는 규칙(extractInviteCode)으로 되읽어 원래 코드가 나오는지(왕복)까지 잠근다.
import { readFileSync } from 'fs';
import { join } from 'path';

import { extractInviteCode, INVITE_CODE_CHARSET } from '../code';
import { buildInviteMessage, INVITE_STORE_URL_FALLBACK, resolveInviteStoreUrl } from './inviteMessage';

// README.md:10 · supabase/migrations/20260722120000_app_config_store_url_ios.sql 과 같은 값(공개 링크).
const FALLBACK_URL = 'https://apps.apple.com/kr/app/%EB%A8%B9%EB%A1%9C%EA%B7%B8-muklog/id6782955594';
const OTHER_URL = 'https://apps.apple.com/app/id1';
// babel 변환을 피하려고 생성자로 만든다(유니코드 속성 이스케이프).
const PICTOGRAPHIC = new RegExp('\\p{Extended_Pictographic}', 'u');

/**
 * 결정적 의사 난수로 허용 문자 코드를 만든다(테스트 재현성 — 실행마다 같은 표본).
 *   32비트 선형 합동 생성기다. 곱셈을 Math.imul(32비트 정수 곱)로 하고 >>> 0으로 부호 없는 32비트에 가둔다 —
 *   일반 곱셈은 2^53을 넘어 부동소수점 정밀도가 깨져 표본이 코드 18개·글자 4종으로 쪼그라들었다(QA S3).
 *   하위 비트는 주기가 짧아서 상위 비트(>>> 16)로 글자를 고른다.
 * @param count 만들 코드 수
 * @returns 6자 코드 배열
 */
const sampleCodes = ({ count }: { count: number }): string[] => {
  let seed = 20260930;
  const nextIndex = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return (seed >>> 16) % INVITE_CODE_CHARSET.length;
  };
  return Array.from({ length: count }, () =>
    Array.from({ length: 6 }, () => INVITE_CODE_CHARSET[nextIndex()]).join(''),
  );
};

describe('buildInviteMessage (AC1)', () => {
  it('세 줄 메시지를 정확히 만든다 — 앱 이름 문장 · 초대코드 · 앱 받기 링크', () => {
    expect(buildInviteMessage({ code: 'K7P3AB', storeUrl: INVITE_STORE_URL_FALLBACK })).toBe(
      `먹로그에서 우리 맛집 같이 기록해요\n초대코드: K7P3AB\n앱 받기: ${FALLBACK_URL}`,
    );
  });

  it('넘겨받은 링크를 그대로 마지막 줄에 싣는다', () => {
    expect(buildInviteMessage({ code: 'Q9W8E7', storeUrl: OTHER_URL })).toBe(
      `먹로그에서 우리 맛집 같이 기록해요\n초대코드: Q9W8E7\n앱 받기: ${OTHER_URL}`,
    );
  });

  it('문구에 이모지가 없다(킷 HANDOFF 2026-06-30 문구 이모지 금지)', () => {
    expect(PICTOGRAPHIC.test(buildInviteMessage({ code: 'K7P3AB', storeUrl: FALLBACK_URL }))).toBe(false);
  });
});

describe('보내기 ↔ 받기 왕복 (AC2)', () => {
  const fixedCodes = ['K7P3AB', 'AAAAAA', 'ZZZZZZ', '222222', '999999', 'A2B3C4', 'HJKMNP'];
  const cases = fixedCodes.flatMap((code) => [FALLBACK_URL, OTHER_URL].map((storeUrl) => [code, storeUrl]));

  it.each(cases)('코드 %s · 링크 %s → 메시지를 되읽으면 원래 코드', (code, storeUrl) => {
    expect(extractInviteCode({ text: buildInviteMessage({ code, storeUrl }) })).toBe(code);
  });

  it('허용 문자 코드 표본 500개(서로 다른 코드 500개 · 허용 글자 32종 전부)가 모두 왕복한다(폴백 링크)', () => {
    const codes = sampleCodes({ count: 500 });
    // 표본이 실제로 넓은지부터 잠근다 — 생성기가 망가져 같은 코드만 나오면 아래 왕복 검사가 공허하게 통과한다.
    expect(new Set(codes).size).toBe(500);
    expect(new Set(codes.join('')).size).toBe(INVITE_CODE_CHARSET.length);
    const mismatches = codes.filter(
      (code) => extractInviteCode({ text: buildInviteMessage({ code, storeUrl: FALLBACK_URL }) }) !== code,
    );
    expect(mismatches).toStrictEqual([]);
  });
});

describe('resolveInviteStoreUrl (AC3)', () => {
  it('https 링크는 그대로 쓴다', () => {
    expect(resolveInviteStoreUrl({ storeUrlIos: OTHER_URL })).toBe(OTHER_URL);
  });

  it('앞뒤 공백은 걷어 내고 쓴다', () => {
    expect(resolveInviteStoreUrl({ storeUrlIos: '  https://x  ' })).toBe('https://x');
  });

  it.each([
    ['null', null],
    ['빈 값', ''],
    ['공백', '   '],
    ['http', 'http://x'],
    ['스킴 없음', 'apps.apple.com/x'],
    ['스킴만', 'https://'],
  ])('%s이면 폴백 상수', (_label, storeUrlIos) => {
    expect(resolveInviteStoreUrl({ storeUrlIos })).toBe(INVITE_STORE_URL_FALLBACK);
  });
});

describe('INVITE_STORE_URL_FALLBACK (AC3 — 공개 링크와 동기화)', () => {
  it('iOS App Store 링크 값이다', () => {
    expect(INVITE_STORE_URL_FALLBACK).toBe(FALLBACK_URL);
  });

  // 링크가 바뀌면 세 곳이 함께 바뀌어야 한다 — 한 곳만 고치면 여기서 빨개진다.
  it.each([
    ['README.md', '../../../../README.md'],
    ['store_url_ios 마이그레이션', '../../../../supabase/migrations/20260722120000_app_config_store_url_ios.sql'],
  ])('%s에 같은 링크가 적혀 있다', (_label, relativePath) => {
    expect(readFileSync(join(__dirname, relativePath), 'utf8')).toContain(INVITE_STORE_URL_FALLBACK);
  });
});
