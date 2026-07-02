# map-pins-cache 측정 결과 (T-MEASURE)

> plan §5 T-MEASURE / §0 병목 가설 확정용. `map-prewarm`의 `scripts/mapPerf.mjs` 접근을 재사용한다.
> **본 스프린트 산출물 트리에는 PERF-TEMP·mapPerf가 포함되지 않는다**(`grep -rn PERF-TEMP src scripts` → 0 확인).
> 라이브 계측(렌더 픽셀·첫 핀 가시화 시각)은 **디바이스 스모크가 필수**(메모리 `qa-layout-blind-spot`·`native-module-debug-needs-devbuild`)라 **사용자 디바이스 스모크로 이월**한다.

## 왜 이월인가 (측정 경계)

② `list_my_muklog_pins` RPC 왕복이 만드는 지연과 "첫 핀 가시화" 시각 단축은 **실제 WebView 렌더 타이밍**에 걸린 값이다. 단위 테스트(jest)는 렌더 픽셀·네이티브 WebView·실 네트워크 왕복을 재현하지 못하므로 **단위로 확정 불가**. `map-prewarm`도 동일하게 dev/iOS 시뮬레이터 + PERF-TEMP + `scripts/mapPerf.mjs` 분석기로만 수치를 얻었고, 종료 시 계측을 제거했다(감사 추적 문서만 보존). 본 스프린트도 같은 절차를 따르되, 라이브 캡처는 사용자 디바이스에서 수행한다.

## 재현 절차 (라이브 캡처 시 재삽입할 PERF-TEMP)

`map-prewarm` 선례와 동일하게, 아래 지점에 `PERF-TEMP` 주석과 함께 `console.log('[mapPerf] <event> <ts>')`를 심고, Metro 로그를 `scripts/mapPerf.mjs`(재작성) 파서로 집계한 뒤 **전량 제거**한다.

| 이벤트 | 위치 | 의미 |
|--------|------|------|
| `rpc-start` | `useMuklogPins.loadPins` — `supabase.rpc('list_my_muklog_pins')` 직전 | ② RPC 왕복 시작 |
| `rpc-response` | 동 RPC `await` 직후(error/데이터 분기 전) | ② RPC 왕복 종료(→ 왕복 ms 산출) |
| `cache-hit` | `useMuklogPins.loadPins` — `setState(ready, cached)` 직전 | 캐시-우선 "첫 핀 데이터 준비" 시각(마운트 기준 ms) |
| `map-ready` | `MapTabScreen.handleMessage` — `MapInboundType.Ready` 수신 시 | WebView/SDK READY(①) |
| `set-markers` | `MapTabScreen` `reinjectMarkersOnChange` effect 주입 시 | SET_MARKERS 주입(첫 핀 가시화 상한) |

> 마운트 t0는 `MapTabScreen` 최초 렌더 시점(`map-prewarm` 기준과 동일)으로 잡는다.

## 대조 설계 (캐시 OFF vs ON)

- **캐시 OFF(현행 baseline)**: 콜드 진입에서 `rpc-start`→`rpc-response`(② 왕복 지연)와 첫 핀 가시화 = `set-markers`(RPC 도착 후) 시각.
- **캐시 ON(본 스프린트)**: 캐시 히트 진입에서 첫 핀 가시화 = `cache-hit`(RPC 왕복 대기 없음) 시각. RPC는 백그라운드에서 1회 재검증만.
- **기대 단축폭**: 첫 핀 가시화가 `set-markers(RPC 이후)` → `cache-hit(RPC 이전)` 로 앞당겨지는 폭 ≈ 콜드 RPC 왕복 시간(② 지연). `map-prewarm` warm 기준 RPC 왕복은 136ms였으나 **콜드(프리워밍 직후·warm 커넥션 없음) 왕복은 미측정** — 라이브 캡처로 확정.

## 라이브 스모크 체크리스트 (사용자 수행 — dev build)

- [ ] 지도탭 **2회차 이상** 진입 시 로딩 오버레이 없이 직전 핀이 즉시 표시(캐시 히트).
- [ ] 앱 **완전 종료 후 재시작** → 첫 진입도 캐시 잔존으로 즉시 표시(AsyncStorage 영속).
- [ ] 백그라운드 RPC 도착 후 핀이 깜빡임 없이 fresh로 교체(추가/삭제 반영).
- [ ] 기내모드(RPC 실패) 진입 시 **캐시 핀 유지 + 에러 배너 없음**(캐시 없을 때만 배너).
- [ ] 계정 전환 후 이전 계정 핀이 보이지 않음(userId 네임스페이싱).
- [ ] `[mapPerf]` 로그로 `cache-hit` < `set-markers(baseline)` 확인, 단축폭 기록.

## 상태

- **단위 검증**: 완료 — 캐시-우선 즉시표시·재검증 교체·캐시 갱신·에러 정책·userId 격리·RPC 1회·언마운트 race 전부 green(plan §5 T1~T10).
- **라이브 계측(수치 확정)**: **이월(사용자 디바이스 스모크)** — 위 절차/체크리스트로 캡처. 확정 후 본 문서에 baseline/after 표를 채운다.
- **트리 청결**: `grep -rn PERF-TEMP src scripts` → 0(계측 코드 미포함).
