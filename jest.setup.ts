// jest.setup.ts — 전역 테스트 셋업.
// 원칙(plan §3.3): 공통으로 반복되는 모킹만 여기에 둔다. 개별 모듈 모킹은 각 spec에서 jest.mock.
//
// 여기서 하는 일은 env 더미 주입 하나뿐:
//   src/lib/env.ts 는 EXPO_PUBLIC_SUPABASE_* 누락 시 throw 한다.
//   훅 spec은 @/lib/supabase 를 모킹하므로 env가 로드되지 않지만,
//   실수로 실 모듈이 로드돼도 테스트가 env throw로 죽지 않도록 더미 값을 보장한다.
process.env.EXPO_PUBLIC_SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'test-anon-key';
