// src/lib/queryKeys/queryKeys.spec.ts
// 쿼리 키 단일 출처 명세 (query-cache plan §3.2 / T5 AC5-1, U11).
//   키 모양이 곧 캐시 격리 규칙이다 — 두 번째 요소(id)가 바뀌면 다른 캐시가 된다(E1 계정 격리·E2 로그 전환).
import { queryKeys } from './queryKeys';

describe('queryKeys (AC5-1)', () => {
  it('myLogs — 사용자 단위로 격리된다(계정 전환 시 키가 달라진다)', () => {
    expect(queryKeys.myLogs({ userId: 'u1' })).toEqual(['myLogs', 'u1']);
  });

  it('muklogs — 로그(방) 단위로 격리된다', () => {
    expect(queryKeys.muklogs({ roomId: 'r1' })).toEqual(['muklogs', 'r1']);
  });

  it('muklog — 먹로그 단위로 격리된다', () => {
    expect(queryKeys.muklog({ muklogId: 'm1' })).toEqual(['muklog', 'm1']);
  });

  it('id가 다르면 키도 다르다(이전 데이터가 새 화면으로 새지 않는다 — E2)', () => {
    expect(queryKeys.muklogs({ roomId: 'A' })).not.toEqual(queryKeys.muklogs({ roomId: 'B' }));
  });

  it('같은 인자면 항상 같은 모양을 만든다(호출 순서·시점 무관)', () => {
    expect(queryKeys.muklog({ muklogId: 'm1' })).toEqual(queryKeys.muklog({ muklogId: 'm1' }));
  });
});
