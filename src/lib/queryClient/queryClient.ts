// src/lib/queryClient/queryClient.ts
// 조회 캐시 클라이언트 팩토리 (query-cache plan §3.3).
//
// 왜 캐시가 필요한가: 화면마다 자기 상태를 들고 있어(useOneShotQuery) 언마운트되면 다음 진입이 loading부터
//   다시 시작한다 → 이미 본 화면이 로딩으로 되돌아간다(UX 백로그 U58 / ux-principles 원칙 3).
//   화면 간 공유 캐시를 두어 "캐시를 즉시 그리고 뒤에서 조용히 갱신"(stale-while-revalidate)으로 바꾼다.
//
// ⚠️ 기본값이 곧 비용 가드레일(architecture §6 · harness-rules 규칙 8)이다. 아래 값은 queryClient.spec.ts가
//   6종 단언으로 고정한다 — 폴링·자동 재시도·리스너 기반 재조회를 추가하려면 그 계약부터 다시 합의할 것.
import { QueryClient } from '@tanstack/react-query';

/** 캐시 수거까지 유지 시간(ms). 기본 5분이면 30분 뒤 재진입이 loading부터 시작해 U58이 재발한다. */
const QUERY_GC_TIME_MS = 1000 * 60 * 30;

/**
 * 앱 조회 캐시용 QueryClient를 만든다(기본값 = plan §3.3 계약).
 * @returns 기본 옵션이 적용된 새 QueryClient 인스턴스
 */
export const createQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // 캐시는 즉시 그리고 항상 재검증한다. 올리면 파트너가 남긴 기록이 늦게 반영되는 창이 벌어진다(E5).
        staleTime: 0,
        gcTime: QUERY_GC_TIME_MS,
        // 현행 동작 보존 — 실패는 즉시 노출한다. true면 실패 1회가 요청 3회가 된다.
        retry: false,
        // RN에는 document.visibilitychange가 없어 어차피 발화하지 않지만 의존하지 않고 명시한다.
        //   포커스 재조회는 useRefreshOnFocus(네비게이션 포커스)가 단독 소유한다.
        refetchOnWindowFocus: false,
        // NetInfo(네이티브 모듈) 미도입 — 온라인 감지가 없는 상태에서 켜 두면 의미 없는 옵션이 남는다.
        refetchOnReconnect: false,
        // refetchInterval: 설정하지 않는다(폴링 금지 — 비용 가드레일).
      },
    },
  });
