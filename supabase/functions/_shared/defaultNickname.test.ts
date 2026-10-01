// supabase/functions/_shared/defaultNickname.test.ts
// 서버 이식본 defaultNickname 이 앱 원본과 같은 값을 내는지 잠근다 (join-push plan AC11 · DT1).
//   앱 원본(src/features/profile/defaultNickname/defaultNickname.ts)은 import 0 인 순수 함수라 Deno 가 상대 경로로 직접 읽는다.
//   ⚠️ Deno 런타임 전용 — jest 대상 아님. 실행: 저장소 루트에서 `deno test --allow-env --no-lock supabase/functions/_shared`.
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  ANIMAL_NAMES as APP_ANIMAL_NAMES,
  defaultNickname as appDefaultNickname,
} from '../../../src/features/profile/defaultNickname/defaultNickname.ts';
import { ANIMAL_NAMES, defaultNickname } from './defaultNickname.ts';

const FIXED_SAMPLES = [
  'caller-uid',
  'joiner-uid',
  'u1',
  '',
  '00000000-0000-0000-0000-000000000000',
  'a3f1c2d4-5b6e-4f70-8a9b-0c1d2e3f4a5b',
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
];

Deno.test('이식 일치: 고정 표본 7개에서 앱 원본과 같은 값', () => {
  for (const userId of FIXED_SAMPLES) {
    assertEquals(defaultNickname({ userId }), appDefaultNickname({ userId }), userId);
  }
});

Deno.test('이식 일치: 무작위 UUID 1,000개에서 앱 원본과 같은 값', () => {
  for (let index = 0; index < 1000; index += 1) {
    const userId = crypto.randomUUID();
    assertEquals(defaultNickname({ userId }), appDefaultNickname({ userId }), userId);
  }
});

Deno.test('고정 기대값: caller-uid·joiner-uid·u1', () => {
  assertEquals(defaultNickname({ userId: 'caller-uid' }), '오소리4294');
  assertEquals(defaultNickname({ userId: 'joiner-uid' }), '펭귄6650');
  assertEquals(defaultNickname({ userId: 'u1' }), '코알라3788');
});

Deno.test('빈 문자열·null·undefined 는 모두 수달1000(빈 키 폴백)', () => {
  assertEquals(defaultNickname({ userId: '' }), '수달1000');
  assertEquals(defaultNickname({ userId: null }), '수달1000');
  assertEquals(defaultNickname({ userId: undefined }), '수달1000');
});

Deno.test('동물명 팔레트가 앱 원본과 같다(순서 포함)', () => {
  assertEquals([...ANIMAL_NAMES], [...APP_ANIMAL_NAMES]);
});
