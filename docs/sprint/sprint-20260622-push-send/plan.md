# Sprint: 푸시 알림 실동작 — 발송 + 서버 설정 게이팅 (sprint-20260622-push-send)

## 단일 기능
**새 먹로그가 등록되면 같은 로그의 상대(연인)에게 푸시 알림을 보낸다.** + 알림 설정 토글을 로컬→서버로 옮겨 **수신자 설정이 실제 발송을 게이팅**하게 한다. (push S2 — architecture §3·§7. S1=토큰 등록만 완료, 발송·prefs gating은 미구현.)

## 사용자 결정
- 푸시를 **제대로 구현**(옵션 a). 토큰 등록만(현행)이 아니라 실제 발송 + 토글이 진짜 동작.

## 현황(정찰)
- ✅ S1: `useRegisterPushToken`(AuthProvider) → 권한요청+`device_tokens`(expo_push_token UNIQUE, RLS 본인만, idx user_id).
- ✅ 설정 UI: `NotifSettingsView` + `useNotifPrefs`(로컬 AsyncStorage, `{master, perLog:{roomId:bool}}`, perLog 부재=on). 주석: "발송 스프린트에서 로컬→DB 교체 용이".
- ❌ 발송: 트리거/Edge Function/Expo Push 호출 **전무**. `list_room_push_targets` RPC **미생성**.
- 트리거 지점: `useCreateMuklog.createMuklog({input})` 성공(insert+사진) 후 → 상대에게 발송.

## 설계

### 1) 마이그레이션(신규 파일) — 서버 prefs + 수신자 조회 RPC
- **`notification_prefs`** (user_id pk → profiles ON DELETE CASCADE, `master_enabled bool not null default true`, updated_at). RLS 본인만(select/insert/update). 행 부재=마스터 on(기본).
- **`notification_pref_rooms`** (user_id → profiles cascade, room_id → rooms cascade, `enabled bool not null`, pk(user_id,room_id)). **명시적 override만 저장**(부재=on, 기존 perLog 의미 그대로). RLS 본인만.
- **`list_room_push_targets(p_room_id uuid, p_actor uuid)` SECURITY DEFINER RPC**:
  - p_actor가 p_room_id 멤버가 아니면 빈 결과(안티스팸 게이트).
  - p_room_id의 **다른 멤버**(user_id ≠ p_actor)의 `device_tokens.expo_push_token`을 반환하되, 수신자별 게이팅: `notification_prefs.master_enabled`(행 부재=true) **AND** `notification_pref_rooms`(부재=true, 있으면 그 값)가 모두 true인 경우만.
  - 반환: expo_push_token 목록(+ 필요 시 platform). **service_role(Edge Function)에서 호출** — 토큰은 클라이언트에 절대 노출 안 함.
  - GRANT execute to authenticated 불필요(함수가 service_role로 호출). DEFINER 소유자 권한으로 타 멤버 토큰·prefs 조회.

### 2) Edge Function `send-muklog-push` (service_role, 기존 함수 패턴)
- verify_jwt = true(기본) → 인증 사용자만. JWT→callerId(본문 신뢰 금지).
- body: `{ roomId, muklogId }`. (muklogId는 로깅·향후 딥링크용. 권한은 roomId 멤버십으로 게이트.)
- service_role 클라이언트로 `list_room_push_targets(roomId, callerId)` 호출 → 수신 토큰 목록. 빈 목록이면 200(no-op).
- 작성자 닉네임 조회(profiles, 선택) → 본문 카피.
- **Expo Push API** `POST https://exp.host/--/api/v2/push/send`(JSON 메시지 배열): `{ to, title, body, data:{ roomId, muklogId }, sound:'default' }`.
  - 카피(해요체): title=로그 이름(`rooms.name` 또는 폴백), body=`"{작성자닉}님이 새 맛집을 기록했어요 🍽️"`(닉 없으면 "연인이 새 맛집을 기록했어요 🍽️").
- **best-effort**: 네트워크/Expo 에러는 로그만(먹로그 저장은 이미 끝남). 응답 ticket이 `DeviceNotRegistered`면 해당 토큰 best-effort 삭제(무효 토큰 정리, 격리).
- service_role 키는 env 자동 주입(`SUPABASE_SERVICE_ROLE_KEY`)만 사용 — 응답/로그/클라이언트에 미노출(시크릿 규칙). 토큰도 응답에 미반환.

### 3) 클라이언트 발송 트리거
- `useCreateMuklog.createMuklog` 성공(먹로그+사진 완료) 직후 **best-effort** `supabase.functions.invoke('send-muklog-push', { body:{ roomId, muklogId:id } })`. **fire-and-forget**(await하되 catch로 흡수 — 발송 실패가 저장 결과를 망치지 않음). **생성(create) 경로만**(편집은 발송 안 함).

### 4) 설정 prefs 로컬→서버 이전
- `useNotifPrefs`를 **서버 read/write**로 교체(인터페이스 `state(loading/ready)/setMaster/setLogEnabled` 보존 → `NotifSettingsView` 변경 최소).
  - read: `notification_prefs`(master) + `notification_pref_rooms`(perLog override) 조회 → `{master, perLog}` 복원. 행 부재→기본(master on, perLog 빈).
  - setMaster: `notification_prefs` upsert(user_id, master_enabled). 낙관적 갱신 후 await, 실패 시 console.warn+롤백 또는 UI 유지(best-effort).
  - setLogEnabled: `notification_pref_rooms` upsert(user_id, room_id, enabled). (on=기본이라 enabled=true도 명시 저장해도 무방 — 단순화.)
- 로컬 AsyncStorage 경로 제거(또는 마이그레이션 불요 — 기존 로컬값은 폐기, 서버 기본 on에서 시작). `notifPrefs.ts` 순수 파서는 더 이상 영속에 안 쓰이면 정리(서버 shape 매핑 유틸로 대체 가능).
- 폴링 0(마운트 1회 read), Realtime 미사용(비용 가드레일).

## 인수조건 (= 테스트, TDD)
- **AC1(RPC)** `list_room_push_targets`: 비멤버 actor→빈 결과 / 커플 룸에서 상대 토큰만(본인 제외) / 수신자 master off→제외 / 해당 room muted(enabled=false)→제외 / 기본(prefs 행 없음)→포함. SQL 정적 검증 + (가능 시) 매핑.
- **AC2(Edge Function 보안)** body userId류 미사용, JWT callerId만. 비멤버 roomId→no-op(타인 룸에 스팸 불가). service_role 키 응답/로그 미노출. 토큰 클라 미반환. Deno 테스트(모킹).
- **AC3(발송 내용)** 메시지 shape(to/title/body/data), 카피 분기(닉 유무). Expo API 호출 형태.
- **AC4(클라 트리거)** createMuklog 성공 후 invoke 1회(create만, 편집 미발송), 발송 실패가 createMuklog 결과/에러에 영향 0(best-effort).
- **AC5(서버 prefs)** useNotifPrefs 서버 read/write — master/perLog 복원·토글 upsert, 부재=기본 on. NotifSettingsView 토글 동작 회귀 0. loading/error 상태.
- **AC6(게이팅 통합)** 수신자가 master off 또는 해당 로그 off면 `list_room_push_targets`에서 제외 → 발송 0(토글이 실제로 동작).
- **AC7** `npm test` green + `tsc --noEmit` 0. Deno 함수 테스트 통과(또는 정적). 회귀 0.

## 리스크/보안/배포
- **service_role 비노출**·**본인 JWT만**·**멤버십 게이트**(타인 룸 스팸 차단) — qa-logic 필수 점검.
- **수신자 prefs는 서버에서만 게이팅 가능**(발신자가 수신자 로컬 설정을 못 읽음) → 그래서 prefs를 서버로 옮김(이 스프린트 핵심).
- **APNs 키 필요**: 프로덕션 iOS 실배달은 EAS 빌드에 APNs 키 등록 필요(EAS가 빌드 시 관리 제안). **사용자 전담**(빌드 단계).
- 라이브 적용(마이그레이션 + `send-muklog-push` 배포)은 **사용자 전담**(developer는 파일·로컬검증·Deno 테스트까지). git·db push·deploy 금지.
- 무효 토큰(DeviceNotRegistered) best-effort 정리만(전체 receipt 폴링은 후속).
- 비용: 발송=먹로그 생성당 1회, prefs read=설정 진입 1회. 폴링·Realtime 0.

## 작업
1. (dev) 마이그레이션(notification_prefs·notification_pref_rooms·list_room_push_targets) + Edge Function `send-muklog-push` + useNotifPrefs 서버 이전 + createMuklog 트리거 + 테스트.
2. (qa-logic) 보안(JWT 본인·service_role 비노출·멤버십 게이트)·RPC 게이팅 정확·prefs 경계·best-effort·TDD / (qa-visual) NotifSettingsView 토글·로딩/에러 비주얼 회귀.
