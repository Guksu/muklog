// src/lib/queryClient — 조회 캐시 클라이언트 배럴.
//   queryClient(모듈 스코프 싱글턴)를 노출한다. 리렌더마다 새 클라이언트가 생겨 캐시가 통째로 날아가는
//   사고를 구조적으로 막기 위해 App.tsx는 이 싱글턴을 그대로 <QueryClientProvider client={...}>에 넘긴다.
//   ⚠️ 테스트 하네스(createTestQueryClient·QueryWrapper)는 여기서 export하지 않는다(프로덕션 번들 분리).
import { createQueryClient } from './queryClient';

export { createQueryClient } from './queryClient';

/** 앱 전역 단일 조회 캐시. 로그아웃 시 useClearCachesOnSignOut이 clear()한다(plan §3.8). */
export const queryClient = createQueryClient();
