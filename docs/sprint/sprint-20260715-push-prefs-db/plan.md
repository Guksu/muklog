# Sprint: 알림 설정 DB 이전 / push S3 (push-prefs-db) — **기획 결과: 이미 구현됨 (재구현 금지)**

> roadmap-sprints 루프 4/6. **정찰 결과 이 스프린트의 기능은 push-send(S2, 2026-06-22)에서 이미 전량 구현·병합되었다.** 아래는 그 근거와 권고. 새 구현 계획이 아니다.

## 결정: A안 채택 (2026-07-15, 리더 확정)

리더가 §5의 (A) 권장안을 확정했다 — 코드 재구현 없이 **문서 정합만** 수행. 반영 결과:
- `docs/design/architecture.md` §5: S2·S3 행을 "✅ 완료(push-send 흡수)"로 정정(트리거 방식=클라 `invoke` fire-and-forget 명시), notif-settings 행에 서버 이전 후속 주석, "출시 후 후속" 목록에서 S2·S3 제거(S4만 잔존).
- `docs/design/architecture.md` §7: 푸시 서술을 S2/S3 완료·S4만 잔존으로 갱신.
- `README.md` 로드맵: 푸시 항목을 "발송·게이팅 완료 / 남은 것=수신 UX(S4)+라이브 활성화"로 정정.
- 코드 변경 0, `npm test`/`typecheck` 현행 green(회귀 0). ui-publisher·developer 미투입. 루프는 5/6(push-receive-ux)로 진행.

## 0. 요약 (TL;DR)

S3(로컬 prefs → 서버 DB 이전)의 **모든 코드/스키마가 이미 존재하고 소비처에 배선되어 있다.** push S2(발송 게이팅)가 "수신자 설정이 발송을 게이팅"하려면 서버 prefs가 필수라서, push-send 스프린트가 S3를 **자기 안에 흡수**했다. 남은 구현 갭은 **없다.** 유일하게 안 한 것(기존 로컬값 1회 마이그레이션)은 push-send가 **의식적으로 폐기 결정**했고, 출시 전(프로덕션 사용자 0)이라 정당하다.

**권고: 코드 재구현 금지. 이 스프린트는 (a) 문서 정합(architecture.md §5·§7의 S3 "예정" 행이 stale) + (b) 라이브 스모크 이월 확인만 남는다. 루프는 5/6(push-receive-ux)로 진행 권장.** 최종 결정은 리더.

## 1. 정찰 근거 (무엇이 이미 있는가)

| S3 요구 항목 | 상태 | 위치(증거) |
|---|---|---|
| `notification_prefs` 테이블(user_id pk, master_enabled default true, updated_at) + RLS 본인만(select/insert/update) | ✅ 존재 | `supabase/migrations/20260622120000_push_send.sql` L30–48 |
| `notification_pref_rooms` 테이블((user_id,room_id) pk, enabled, 부재=on) + RLS 본인만 | ✅ 존재 | 동 파일 L55–75 |
| updated_at 자동 갱신 트리거(upsert update 경로) | ✅ 존재 | 동 파일 L80–98 |
| `useNotifPrefs` 내부를 **AsyncStorage → 서버 read/write로 교체**(인터페이스 `state/setMaster/setLogEnabled` 보존) | ✅ 완료 | `src/features/notif/useNotifPrefs/useNotifPrefs.ts` — 두 테이블 read + upsert, 낙관적 UI + best-effort(last-write-wins) |
| `notifPrefs.ts`에서 로컬 키/파서/직렬화 제거(형·기본값·resolveLogEnabled만 잔존) | ✅ 완료 | `src/features/notif/notifPrefs/notifPrefs.ts` L1–6 주석 명시, AsyncStorage 미사용 |
| 소비자(NotifSettingsView/Screen) **인터페이스 보존으로 무변경** | ✅ 충족 | useNotifPrefs 시그니처 동일(state loading/ready, setMaster, setLogEnabled) |
| **발송 게이팅**이 서버 prefs를 읽음(S3의 존재 이유) — `list_room_push_targets(p_room_id, p_actor)` DEFINER RPC가 master AND room override coalesce(true)로 게이팅 | ✅ 존재·배선 | 마이그레이션 L111–132 + `supabase/functions/send-muklog-push/index.ts` L234–244(service_role 호출) |

정찰 명령 결과: notif 피처에 **AsyncStorage 사용 0**(주석 1건 제외), 로컬→DB 시드 유틸 **부재**(의도적).

## 2. 유일한 "미실행" 항목과 판단 — 기존 로컬값 1회 마이그레이션

- 루프 컨텍스트가 언급한 "AsyncStorage→DB 시드"는 push-send §4가 **의식적으로 폐기**했다: *"로컬 AsyncStorage 경로 제거(또는 마이그레이션 불요 — 기존 로컬값은 폐기, 서버 기본 on에서 시작)."*
- **판단: 폐기 유지가 옳다(재구현 금지).** 근거:
  1. **출시 전 앱**(architecture §5 "출시 범위" — 프로덕션 사용자 0). 보존할 로컬 prefs가 실질적으로 없다.
  2. `notifPrefs.ts`가 이미 로컬 키/파서를 제거해, 시드하려면 **폐기된 스토리지 스키마를 되살려야** 한다(퇴행).
  3. 기본값이 **on**이라, 로컬에서 off를 켰던 극소수 케이스만 "재설정 필요"이고 이는 무해(알림이 과다가 아니라 기본 동작). 데이터 유실 위험 0(알림 설정은 파괴적 자산 아님).
- 따라서 이 항목은 **In-scope 아님**(의사결정 완료된 사항 재개 금지).

## 3. 실제로 남은 것 (구현 아님)

1. **문서 정합(doc-only)** — architecture.md가 S3를 아직 "예정 — 출시 후 후속 패치"로 표기(§5 push-notifications S3 행, §7 미해결 항목). **stale.** push-send가 흡수했으므로 "✅ 완료(push-send에 흡수, 라이브 db push 이월)"로 정정 필요. → planner가 리더 승인 후 반영 가능(또는 별도 doc PR).
2. **라이브 스모크 이월 확인** — `20260622120000_push_send.sql`의 `supabase db push`는 다른 마이그레이션들과 함께 **출시 전 배치**로 이월된 상태(architecture §5 "출시 전 필요 ②"). S3 관점 스모크 = "한 기기에서 master/로그 토글 off → 상대 기기에 발송 안 됨"(AC6). **코드/모킹 테스트는 push-send에서 통과**, 라이브만 이월. 신규 작업 아님.

## 4. 재구현 금지 목록 (하지 말 것)

- ❌ `notification_prefs`/`notification_pref_rooms` 테이블·RLS 재생성(이미 존재, additive 중복은 충돌·혼란).
- ❌ `useNotifPrefs` 재작성(이미 서버 read/write, 인터페이스 보존).
- ❌ `list_room_push_targets` 재작성(이미 게이팅 동작).
- ❌ AsyncStorage→DB 시드 유틸 신설(의식적 폐기, 출시 전이라 불요).
- ❌ 새 마이그레이션 파일(스키마 변경 요구 0).

## 5. 리더 확인 필요 (planner 단독 결정 금지)

이 스프린트는 "1기능=1스프린트"의 대상 기능이 **이미 완료**라 정상 개발 파이프라인(ui-publisher→developer→qa)을 태울 대상이 없다. 아래 중 택일을 리더가 결정:

- **(A) 권장** — 이 스프린트를 **doc-reconciliation로 축소**: architecture.md §5·§7 S3 행을 "완료(push-send 흡수)"로 정정하고, 루프 큐 4/6를 완료 처리 → 5/6(push-receive-ux)로 진행. 코드 변경 0, `npm test`/`typecheck`는 현행 그대로 green(회귀 0).
- **(B)** 라이브 스모크를 이 스프린트의 실체로 삼아, 출시 전 배치에서 db push + 토글 게이팅 디바이스 스모크를 수행(사용자 전담 — 에이전트는 db push/deploy 금지). 단, 이는 push-send의 이월 항목과 동일.
- **(C, 비권장)** 굳이 로컬→DB 시드를 구현 — §2 근거로 반대.

## 6. 비용/절대규칙 체크

- 신규 마이그레이션·RPC·Edge Function·Kakao 호출·Realtime **0**. 코드 변경 0(권장안 A 기준, 문서만).
- git·db push·deploy는 사용자 전담(에이전트 금지) — 라이브 이월 관례 그대로.

---

### developer/orchestrator 메모
- **이 스프린트에 코드 구현 작업 없음.** ui-publisher·developer 투입 불필요(권장안 A). QA는 "회귀 0(기존 push-send 스위트 green)"만 확인하면 충분.
- 근거 파일: `supabase/migrations/20260622120000_push_send.sql`, `src/features/notif/useNotifPrefs/useNotifPrefs.ts`, `src/features/notif/notifPrefs/notifPrefs.ts`, `supabase/functions/send-muklog-push/index.ts`, `docs/sprint/sprint-20260622-push-send/plan.md §4·AC5·AC6`.
