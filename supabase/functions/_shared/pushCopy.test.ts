// supabase/functions/_shared/pushCopy.test.ts
// 푸시 문구 순수 함수 (join-push plan AC5·AC9 · DT2). 해요체·이모지 0·'연인' 0·닉네임 폴백 = 앱 defaultNickname.
//   문자열은 assertEquals 로 전체를 비교한다(일부 포함 검사는 다른 분기가 대신 만족시켜 죽기 쉽다).
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  buildJoinPushCopy,
  buildMuklogPushCopy,
  JOIN_PUSH_FALLBACK_TITLE,
  MUKLOG_PUSH_FALLBACK_TITLE,
  resolveActorName,
} from './pushCopy.ts';

const EMOJI = /\p{Extended_Pictographic}/u;

/** 문구에 이모지·'연인'이 없는지 확인한다(킷 보이스: 문구 이모지 금지 · '연인' → '함께'). */
const assertVoice = ({ copy }: { copy: { title: string; body: string } }) => {
  for (const text of [copy.title, copy.body]) {
    assert(!EMOJI.test(text), `이모지 금지: ${text}`);
    assert(!text.includes('연인'), `'연인' 금지: ${text}`);
  }
};

Deno.test('폴백 제목 상수: 새 기록 = 새 먹로그, 합류 = 우리 로그', () => {
  assertEquals(MUKLOG_PUSH_FALLBACK_TITLE, '새 먹로그');
  assertEquals(JOIN_PUSH_FALLBACK_TITLE, '우리 로그');
});

Deno.test('합류 문구: 제목 = 로그 이름, 본문 = "{닉}님이 들어왔어요. 이제 함께 기록할 수 있어요."(두 문장 — 끝 마침표)', () => {
  const copy = buildJoinPushCopy({ actorName: '민지', roomName: '우리의 맛집' });
  assertEquals(copy, { title: '우리의 맛집', body: '민지님이 들어왔어요. 이제 함께 기록할 수 있어요.' });
  assertVoice({ copy });
});

Deno.test('합류 문구: 로그 이름이 null·빈 문자열·공백이면 제목 "우리 로그"', () => {
  for (const roomName of [null, '', '   ']) {
    assertEquals(buildJoinPushCopy({ actorName: '민지', roomName }).title, '우리 로그');
  }
});

Deno.test('합류 문구: 로그 이름 앞뒤 공백은 잘라서 제목으로 쓴다', () => {
  assertEquals(buildJoinPushCopy({ actorName: '민지', roomName: '  을지로 투어  ' }).title, '을지로 투어');
});

Deno.test('새 기록 문구: 제목 폴백 "새 먹로그" + 본문 "{닉}님이 ‘{가게명}’ 기록을 남겼어요"', () => {
  const copy = buildMuklogPushCopy({ actorName: '민지', roomName: null, placeName: '을지로 노포' });
  assertEquals(copy, { title: '새 먹로그', body: '민지님이 ‘을지로 노포’ 기록을 남겼어요' });
  assertVoice({ copy });
});

Deno.test('새 기록 문구: 로그 이름이 있으면 trim 해서 제목으로', () => {
  assertEquals(
    buildMuklogPushCopy({ actorName: '민지', roomName: ' 우리의 맛집 ', placeName: '을지로 노포' }).title,
    '우리의 맛집',
  );
});

Deno.test('새 기록 문구: 영문·숫자·특수문자로 끝나는 가게명도 같은 틀(조사 없는 구조)', () => {
  const cases: Array<[string, string]> = [
    ['Blue Bottle', '민지님이 ‘Blue Bottle’ 기록을 남겼어요'],
    ['CU 역삼점', '민지님이 ‘CU 역삼점’ 기록을 남겼어요'],
    ['스시 3', '민지님이 ‘스시 3’ 기록을 남겼어요'],
    ["Mom's Touch", "민지님이 ‘Mom's Touch’ 기록을 남겼어요"],
  ];
  for (const [placeName, body] of cases) {
    const copy = buildMuklogPushCopy({ actorName: '민지', roomName: '우리의 맛집', placeName });
    assertEquals(copy.body, body);
    assertVoice({ copy });
  }
});

Deno.test('새 기록 문구: 가게명이 공백뿐이면 "{닉}님이 새 맛집을 기록했어요"', () => {
  const copy = buildMuklogPushCopy({ actorName: '민지', roomName: null, placeName: '  ' });
  assertEquals(copy.body, '민지님이 새 맛집을 기록했어요');
  assertVoice({ copy });
});

Deno.test('새 기록 문구: 가게명 앞뒤 공백은 잘라서 넣는다', () => {
  assertEquals(
    buildMuklogPushCopy({ actorName: '민지', roomName: null, placeName: '  을지로 노포 ' }).body,
    '민지님이 ‘을지로 노포’ 기록을 남겼어요',
  );
});

Deno.test('문구 표기(킷 관례): 가게명은 둥근 작은따옴표 U+2018·U+2019 로 감싸고, 끝 마침표는 두 문장인 합류 본문만', () => {
  // 킷 mk-log.jsx:301 "‘{m.place}’ 기록과 사진이…"·앱 MuklogDetailScreen 과 같은 따옴표 — 가게명 안의 곧은 아포스트로피와 경계가 섞이지 않는다.
  const muklog = buildMuklogPushCopy({ actorName: '민지', roomName: null, placeName: "Mom's Touch" });
  assertEquals(muklog.body, `민지님이 \u2018Mom's Touch\u2019 기록을 남겼어요`);
  // 두 문장 문구는 끝에도 마침표(킷 mk-home.jsx:277 "함께 기록할 수 있어요.") · 한 문장인 새 기록 본문은 토스트 관례대로 없음.
  assert(buildJoinPushCopy({ actorName: '민지', roomName: null }).body.endsWith('있어요.'));
  assert(!muklog.body.endsWith('.'));
});

Deno.test('작성자 이름: 닉네임이 있으면 trim 한 값', () => {
  assertEquals(resolveActorName({ nickname: '  민지 ', userId: 'x' }), '민지');
});

Deno.test('작성자 이름: 닉네임이 null·빈 문자열·공백이면 앱과 같은 defaultNickname(userId)', () => {
  for (const nickname of [null, '', '  ']) {
    assertEquals(resolveActorName({ nickname, userId: 'caller-uid' }), '오소리4294');
  }
});

Deno.test('폴백 조합 문구도 이모지·연인 0', () => {
  const actorName = resolveActorName({ nickname: null, userId: 'caller-uid' });
  assertVoice({ copy: buildJoinPushCopy({ actorName, roomName: null }) });
  assertVoice({ copy: buildMuklogPushCopy({ actorName, roomName: null, placeName: '을지로 노포' }) });
  assertVoice({ copy: buildMuklogPushCopy({ actorName, roomName: null, placeName: ' ' }) });
});

// ── R1(보안 QA 권고 · 리더 결정 2026-10-01) — 문구 재료 정리 ─────────────────────────────────────
//   닉네임·로그 이름·가게명은 사용자가 고른 원문이다. 앱을 거치지 않고 DB 에 직접 넣으면 줄바꿈으로 가짜 안내를 끼우거나
//   방향 제어 문자로 글자 순서를 뒤집어 잠금 화면 알림을 꾸밀 수 있고, 길이도 앱 상한을 넘을 수 있다.
//   → 줄을 나누는 문자는 공백으로, 보이지 않는 방향 제어 문자는 지우고, 연속 공백을 하나로 줄인 뒤 앱 입력 상한으로 자른다.
//   상한(코드 포인트): 닉네임 20(앱 src/features/profile/nickname/nickname.ts:9) · 로그 이름 20(앱 logName.ts:14 · DB rename_room)
//   · 가게명 60(앱 src/features/muklog/MuklogEditor/MuklogEditor.tsx:91). 아래 테스트가 이 수를 잠근다.

/** 줄을 나누는 문자 — 제어 문자(줄바꿈·복귀·탭·세로 탭·폼 피드·NUL·단위 구분자·DEL·NEL)와 줄/문단 구분자. */
const LINE_BREAKERS = ['\n', '\r', '\t', '\v', '\f', '\u0000', '\u001f', '\u007f', '\u0085', '\u2028', '\u2029'];
/** 보이지 않는 방향 제어 문자 — ALM · LRM · RLM · LRE·RLE·PDF·LRO·RLO · LRI·RLI·FSI·PDI. */
const BIDI_CONTROLS = [
  '\u061c',
  '\u200e',
  '\u200f',
  '\u202a',
  '\u202b',
  '\u202c',
  '\u202d',
  '\u202e',
  '\u2066',
  '\u2067',
  '\u2068',
  '\u2069',
];

Deno.test('R1: 닉네임의 줄바꿈·탭·제어 문자·줄/문단 구분자는 공백 하나로 바꾼다', () => {
  for (const ch of LINE_BREAKERS) {
    assertEquals(resolveActorName({ nickname: `민${ch}지`, userId: 'caller-uid' }), '민 지', JSON.stringify(ch));
  }
});

Deno.test('R1: 닉네임의 방향 제어 문자(U+061C·U+200E·U+200F·U+202A~U+202E·U+2066~U+2069)는 지운다', () => {
  for (const ch of BIDI_CONTROLS) {
    assertEquals(resolveActorName({ nickname: `민${ch}지`, userId: 'caller-uid' }), '민지', JSON.stringify(ch));
  }
});

Deno.test('R1: 연속 공백(정리하며 생긴 공백·NBSP·전각 공백 포함)은 하나로 줄인다', () => {
  assertEquals(resolveActorName({ nickname: '민 \n\t  지', userId: 'caller-uid' }), '민 지');
  assertEquals(resolveActorName({ nickname: '민\u00a0\u00a0\u3000지', userId: 'caller-uid' }), '민 지');
});

Deno.test('R1: 합성 이모지(ZWJ 로 잇는 글자)는 그대로 둔다 — 방향 제어 문자만 지운다', () => {
  // 커플 이모지 = U+1F469 · ZWJ · U+2764 · U+FE0F · ZWJ · U+1F468 — 보이지 않는 ZWJ 가 섞여 있어 이스케이프로 적는다.
  const couple = '\u{1F469}\u200d\u2764\ufe0f\u200d\u{1F468}';
  assertEquals(resolveActorName({ nickname: `민지${couple}`, userId: 'caller-uid' }), `민지${couple}`);
});

Deno.test('R1: 정리하고 나면 빈 닉네임은 앱과 같은 defaultNickname(userId)으로 폴백한다', () => {
  assertEquals(resolveActorName({ nickname: '\n\u202e\t\u2066 ', userId: 'caller-uid' }), '오소리4294');
});

Deno.test('R1: 닉네임은 앱 입력 상한 20자(코드 포인트)로 자른다 — 20자는 그대로, 이모지를 반으로 자르지 않는다', () => {
  assertEquals(resolveActorName({ nickname: '가'.repeat(20), userId: 'x' }), '가'.repeat(20));
  assertEquals(resolveActorName({ nickname: '가'.repeat(21), userId: 'x' }), '가'.repeat(20));
  assertEquals(resolveActorName({ nickname: '😀'.repeat(21), userId: 'x' }), '😀'.repeat(20));
  // 자른 끝이 공백이면 그 공백도 버린다("…가 님이"처럼 이름 뒤에 빈칸이 남지 않게).
  assertEquals(resolveActorName({ nickname: `${'가'.repeat(19)} 나다`, userId: 'x' }), '가'.repeat(19));
});

Deno.test('R1: 로그 이름(제목)도 같은 정리 + 상한 20자, 정리 뒤 비면 각 알림의 폴백 제목', () => {
  assertEquals(buildJoinPushCopy({ actorName: '민지', roomName: '을지로\n투어\u202e' }).title, '을지로 투어');
  assertEquals(
    buildMuklogPushCopy({ actorName: '민지', roomName: '을지로\r\n투어', placeName: '노포' }).title,
    '을지로 투어',
  );
  assertEquals(buildJoinPushCopy({ actorName: '민지', roomName: '나'.repeat(21) }).title, '나'.repeat(20));
  assertEquals(
    buildMuklogPushCopy({ actorName: '민지', roomName: '나'.repeat(21), placeName: '노포' }).title,
    '나'.repeat(20),
  );
  assertEquals(buildJoinPushCopy({ actorName: '민지', roomName: '\u2066\u2069\n' }).title, '우리 로그');
  assertEquals(
    buildMuklogPushCopy({ actorName: '민지', roomName: '\u2066\u2069\n', placeName: '노포' }).title,
    '새 먹로그',
  );
});

Deno.test('R1: 가게명도 같은 정리 + 앱 입력 상한 60자, 정리 뒤 비면 "{닉}님이 새 맛집을 기록했어요"', () => {
  assertEquals(
    buildMuklogPushCopy({ actorName: '민지', roomName: null, placeName: 'Blue\nBottle\u202e' }).body,
    '민지님이 ‘Blue Bottle’ 기록을 남겼어요',
  );
  assertEquals(
    buildMuklogPushCopy({ actorName: '민지', roomName: null, placeName: '다'.repeat(60) }).body,
    `민지님이 ‘${'다'.repeat(60)}’ 기록을 남겼어요`,
  );
  assertEquals(
    buildMuklogPushCopy({ actorName: '민지', roomName: null, placeName: '다'.repeat(61) }).body,
    `민지님이 ‘${'다'.repeat(60)}’ 기록을 남겼어요`,
  );
  assertEquals(
    buildMuklogPushCopy({ actorName: '민지', roomName: null, placeName: '\u202e\n' }).body,
    '민지님이 새 맛집을 기록했어요',
  );
});

Deno.test('R1: 공격 입력(줄바꿈으로 가짜 안내 끼우기 + RLO + 수천 자) → 한 줄·상한 이내의 문구', () => {
  const nickname = `민지\n[먹로그 안내] 계정 확인이 필요해요\n\u202e${'A'.repeat(2000)}`;
  const placeName = `을지로 노포\n\n[먹로그 안내] 아래 링크에서 다시 로그인해 주세요\u202e${'B'.repeat(2000)}`;
  const copy = buildMuklogPushCopy({
    actorName: resolveActorName({ nickname, userId: 'caller-uid' }),
    roomName: `우리의\n맛집\u202e${'C'.repeat(2000)}`,
    placeName,
  });
  assertEquals(copy, {
    title: `우리의 맛집${'C'.repeat(14)}`,
    body: `민지 [먹로그 안내] 계정 확인이 필님이 ‘을지로 노포 [먹로그 안내] 아래 링크에서 다시 로그인해 주세요${'B'.repeat(25)}’ 기록을 남겼어요`,
  });
});

// ── S2-2(보안 QA 2차 · 낮음) — 제로폭·채움 문자, 보이는 글자가 없는 이름 ─────────────────────────────────
//   방향 제어 문자 말고도 보이지 않는 글자(제로폭·채움·BOM·변형 선택자·태그 문자 등)가 남으면, 그것만으로 된 이름이 폴백 없이
//   "님이 들어왔어요"처럼 실리거나 이름 사이에 숨은 글자가 섞인다. → 유니코드 서식 문자와 기본 무시 문자를 지우되 이모지
//   시퀀스에 필요한 ZWJ(U+200D)·표현 선택자(U+FE0E·U+FE0F)는 남긴다. 정리 뒤 보이는 글자가 없으면 빈 값 → 기존 폴백.

/** 지우는 보이지 않는 글자 — ZWSP·ZWNJ·WJ·보이지 않는 연산자 4·SHY·CGJ·한글 채움 4·BOM·몽골 모음 구분자·크메르 무음 모음·
 *  옛 서식 제어·주석 기준점·악보 서식·변형 선택자 1~14·17~256·언어 태그·태그 문자. */
const INVISIBLES = [
  '\u200b',
  '\u200c',
  '\u2060',
  '\u2061',
  '\u2062',
  '\u2063',
  '\u2064',
  '\u00ad',
  '\u034f',
  '\u3164',
  '\u115f',
  '\u1160',
  '\uffa0',
  '\ufeff',
  '\u180e',
  '\u17b4',
  '\u206a',
  '\ufff9',
  '\u{1D173}',
  '\ufe00',
  '\ufe0d',
  '\u{E0100}',
  '\u{E01EF}',
  '\u{E0001}',
  '\u{E0020}',
  '\u{E0041}',
  '\u{E007F}',
];

Deno.test('S2-2: 제로폭·채움 문자·BOM·변형 선택자(이모지용 둘 제외)·태그 문자는 지운다(공백으로 바꾸지 않는다)', () => {
  for (const ch of INVISIBLES) {
    assertEquals(resolveActorName({ nickname: `민${ch}지`, userId: 'caller-uid' }), '민지', JSON.stringify(ch));
  }
});

Deno.test('S2-2: 이모지 시퀀스에 필요한 ZWJ·변형 선택자 U+FE0F·U+FE0E 는 남긴다', () => {
  const heart = '\u2764\ufe0f'; // 빨간 하트(이모지 표현)
  const smile = '\u263a\ufe0e'; // 웃는 얼굴(글자 표현)
  const family = '\u{1F468}\u200d\u{1F469}\u200d\u{1F467}'; // 가족
  for (const emoji of [heart, smile, family]) {
    assertEquals(resolveActorName({ nickname: `민지${emoji}`, userId: 'caller-uid' }), `민지${emoji}`);
  }
});

Deno.test('S2-2: 태그 문자는 지역 깃발(검은 깃발 + 태그)에서도 지운다 — 알림에서는 검은 깃발만 남는다', () => {
  // 스코틀랜드 깃발 = U+1F3F4 + 태그 g·b·s·c·t + 취소 태그 U+E007F. 태그는 보이지 않는 글자를 숨겨 싣는 데도 쓰여 지운다.
  const scotland = '\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}';
  assertEquals(resolveActorName({ nickname: `민지${scotland}`, userId: 'caller-uid' }), '민지\u{1F3F4}');
});

Deno.test('S2-2: 점자 빈칸(U+2800)은 빈칸으로 그려지므로 공백으로 바꾼다', () => {
  assertEquals(resolveActorName({ nickname: '민\u2800\u2800지', userId: 'caller-uid' }), '민 지');
});

Deno.test('S2-2: 정리 뒤 보이는 글자가 없으면(ZWJ·변형 선택자·결합 부호·채움·점자 빈칸만) 닉네임은 기본 닉네임으로 폴백', () => {
  for (const nickname of ['\u200d\ufe0f', '\u3164', '\u200b\u200c\u2060', '\u0301\u0301', '\u2800\u2800', '\u200d \ufe0e \u20e3']) {
    assertEquals(resolveActorName({ nickname, userId: 'caller-uid' }), '오소리4294', JSON.stringify(nickname));
  }
});

Deno.test('S2-2: 상한으로 자른 뒤에 보이는 글자가 없으면 폴백한다(앞쪽 20자가 모두 ZWJ 인 경우)', () => {
  assertEquals(resolveActorName({ nickname: `${'\u200d'.repeat(25)}민지`, userId: 'caller-uid' }), '오소리4294');
});

Deno.test('S2-2: 보이는 글자가 없는 로그 이름·가게명도 기존 폴백(우리 로그 · 새 먹로그 · 새 맛집을 기록했어요)', () => {
  assertEquals(buildJoinPushCopy({ actorName: '민지', roomName: '\u3164\u3164' }).title, '우리 로그');
  assertEquals(buildMuklogPushCopy({ actorName: '민지', roomName: '\u200d\ufe0f', placeName: '노포' }).title, '새 먹로그');
  assertEquals(
    buildMuklogPushCopy({ actorName: '민지', roomName: null, placeName: '\uffa0\u115f' }).body,
    '민지님이 새 맛집을 기록했어요',
  );
});
