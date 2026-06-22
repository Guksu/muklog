# Dev Notes — sprint-20260622-push-send (푸시 발송 + 서버 prefs 게이팅)

발송 실동작(S2). 새 먹로그 생성 시 같은 로그의 상대에게 푸시 + 알림 설정을 로컬→서버로 옮겨 수신자 설정이 실제 발송을 게이팅.

## ⚠️ 라이브 적용/배포는 사용자 전담
- **DB 마이그레이션 적용 안 함**: `supabase/migrations/20260622120000_push_send.sql` 파일만 작성. `supabase db push` 또는 SQL 에디터 실행은 **사용자**.
- **Edge Function 배포 안 함**: `supabase/functions/send-muklog-push/` 파일만 작성. `supabase functions deploy send-muklog-push` 는 **사용자**. verify_jwt=기본(true) — 별도 config.toml 없음(프로젝트에 부재, place-search/delete-account 와 동일).
- **APNs 키**: 프로덕션 iOS 실배달은 EAS 빌드에 APNs 키 등록 필요 — **사용자 전담**(빌드 단계).
- **시크릿**: `SUPABASE_SERVICE_ROLE_KEY` 는 Edge env 자동 주입만 사용. 코드/로그/응답/이 문서에 키 값 0(키 이름만). **Expo 푸시 토큰은 응답에 절대 미반환**(service_role 경계 안에서만).
- git 작업 0.

## 1) 마이그레이션 — `supabase/migrations/20260622120000_push_send.sql` (additive·idempotent)
실제 스키마 확인 후 작성(추측 0): `profiles(id, nickname, avatar_url)`, `rooms(id, name)`, `room_members(room_id, user_id)`, `device_tokens(user_id, expo_push_token UNIQUE, platform)`.

- **`notification_prefs`**(user_id pk→profiles cascade, `master_enabled bool default true`, updated_at) — RLS 본인만(select/insert/update, 모두 `user_id=auth.uid()`). 행 부재 = 마스터 on.
- **`notification_pref_rooms`**(user_id→profiles cascade, room_id→rooms cascade, `enabled bool`, pk(user_id,room_id), updated_at) — RLS 본인만. **명시적 override만 저장**(부재=on).
- updated_at 자동 갱신 트리거(`touch_notification_prefs_updated_at`) 두 테이블에 부착.
- **`list_room_push_targets(p_room_id uuid, p_actor uuid)` SECURITY DEFINER**(language sql, `set search_path=public`):
  - 반환 `table(expo_push_token text, platform text)`.
  - **게이팅 로직(AC1·AC6)**:
    - 안티스팸: `exists(room_members where room_id=p_room_id and user_id=p_actor)` — p_actor 비멤버면 EXISTS=false → **빈 결과**.
    - 대상: `room_members rm join device_tokens dt` where `rm.room_id=p_room_id and rm.user_id <> p_actor`(**다른 멤버만**).
    - 수신자 prefs: `left join notification_prefs np` + `left join notification_pref_rooms npr(on room_id=p_room_id)`, 필터 `coalesce(np.master_enabled,true)=true AND coalesce(npr.enabled,true)=true`(**행 부재=on**, off면 제외).
  - **GRANT execute 안 함** — service_role(Edge)만 호출(토큰 클라 미노출). service_role 은 GRANT 무관 실행.
  - prefs 테이블만 `grant select,insert,update to authenticated`(RLS 하 클라 upsert).

## 2) Edge Function — `supabase/functions/send-muklog-push/index.ts` (delete-account 패턴: deps 주입)
- **보안(AC2)**: body 의 userId/p_actor 류 **미사용**. Authorization Bearer → `getUserId({token})` 검증 callerId 만. 미인증/무효 → 401. roomId 누락 → 400.
- **게이트**: `listPushTargets({roomId, actorId:callerId})` → `list_room_push_targets(roomId, callerId)` RPC. 멤버십·수신자 prefs 게이팅은 RPC가 전담(타인 룸 스팸 차단은 RPC EXISTS 게이트). 0건 → **200 no-op**(발송 미호출).
- **발송(AC3)**: Expo Push API `POST https://exp.host/--/api/v2/push/send`(메시지 배열). 메시지 shape `{ to, title, body, sound:'default', data:{roomId, muklogId} }`.
  - 카피(해요체): `title` = 로그 이름(`getRoomName`, 없으면 폴백 `'새 먹로그'`), `body` = `"{닉}님이 새 맛집을 기록했어요 🍽️"`(`getActorNickname` 없으면 `"연인이 새 맛집을 기록했어요 🍽️"`).
- **best-effort**: 토큰 조회/닉·로그명 조회/Expo 발송 실패는 로그만 + 200(저장은 이미 끝남). `ticket.details.error === 'DeviceNotRegistered'` → 해당 토큰 `deleteToken` best-effort 삭제(격리, 실패 무시). ticket↔message 1:1(인덱스, 방어적 min).
- **응답에 토큰/시크릿 0** — `{ sent: <n> }` 또는 `{ error }` 만(클라는 fire-and-forget 이라 미사용).
- serve 진입점(`buildRealDeps`)이 service_role 클라이언트로 deps 구현(RPC·profiles.nickname·rooms.name·device_tokens 삭제·fetch).
- **Deno 테스트** `index.test.ts`(13 케이스, deps 모킹) — 로컬 deno 미설치라 jest 미실행(`/supabase/` ignore). 실행: `deno test --allow-env`. 정적 검증 완료(delete-account 와 동일 운영).

## 3) 클라 트리거 — `src/features/muklog/useCreateMuklog.ts`
- `createMuklog` 성공(insert + 사진 업로드 완료) **직후** `triggerMuklogPush({roomId, muklogId})` — `supabase.functions.invoke('send-muklog-push', { body:{ roomId, muklogId } })`.
- **fire-and-forget**(AC4): try/catch 로 흡수(`console.warn` 만). 발송 실패가 createMuklog 결과(`{id}`)/error 에 영향 0.
- **create 경로 전용**: insert 실패·사진 롤백 시 트리거 미호출(성공 지점에만 배치). 편집(useUpdateMuklog/MuklogEditor onSubmit)은 발송 안 함.
- 인증은 invoke 가 Authorization(JWT) 자동 첨부 → 함수가 callerId 검증(클라 userId 미전송).

## 4) 서버 prefs 이전 — `src/features/notif/`
- **`useNotifPrefs.ts`**: AsyncStorage → Supabase read/write. 인터페이스(`state(loading/ready)/setMaster/setLogEnabled`) **보존** → `NotifSettingsScreen` 변경 0.
  - read: 마운트 1회, `notification_prefs`(maybeSingle) + `notification_pref_rooms`(select) **병렬**. 행 부재/읽기 실패 → DEFAULT(master on, perLog 빈, best-effort). 폴링·Realtime 0.
  - setMaster: `notification_prefs.upsert({user_id, master_enabled}, {onConflict:'user_id'})` 낙관적+await. setLogEnabled: `notification_pref_rooms.upsert({user_id, room_id, enabled}, {onConflict:'user_id,room_id'})`. 쓰기 실패(throw 또는 `{error}`) → warn + 낙관적 UI 유지.
- **`notifPrefs.ts`**: 로컬 영속 함수(`notifPrefsKey/parseNotifPrefs/serializeNotifPrefs/NOTIF_PREFS_KEY_PREFIX`) **제거**. 남김: `NotifPrefs`, `DEFAULT_NOTIF_PREFS`, `resolveLogEnabled`(부재=on, 서버 coalesce 와 동일 의미). `index.ts` 재노출 정리.
- 기존 로컬값은 폐기(마이그레이션 불요) — 서버 기본 on 에서 시작.

## 경계면 (생산자 ↔ 소비자)
| 경계 | 생산자 | 소비자 | 계약 |
|---|---|---|---|
| RPC ↔ 함수 | `list_room_push_targets(p_room_id, p_actor)` → `(expo_push_token, platform)` | `buildRealDeps.listPushTargets` → `PushTarget{expoPushToken, platform}` | snake→camel 매핑(serve). 게이팅은 RPC. |
| 함수 ↔ 클라 | `send-muklog-push` body `{roomId, muklogId}`, 응답 `{sent}`(토큰 0) | `useCreateMuklog.triggerMuklogPush` invoke | callerId=JWT(클라 미전송). fire-and-forget(응답 미사용). |
| prefs ↔ 게이팅 | `useNotifPrefs` upsert(notification_prefs/_rooms) | `list_room_push_targets` coalesce(np.master, true) AND coalesce(npr.enabled, true) | 수신자 서버 설정이 발송 게이팅(off=제외). 부재=on. |
| prefs ↔ 화면 | `useNotifPrefs.state{master,perLog}` | `NotifSettingsScreen` → `resolveLogEnabled` → `NotifSettingsView` | 인터페이스 불변(회귀 0). |

## 변경 파일
- 신규: `supabase/migrations/20260622120000_push_send.sql`, `supabase/functions/send-muklog-push/{index.ts, index.test.ts, deno.json}`
- 수정: `src/features/muklog/useCreateMuklog.ts`(+트리거), `src/features/muklog/useCreateMuklog.spec.ts`(+invoke mock/트리거 케이스), `src/features/notif/useNotifPrefs.ts`(서버 read/write), `src/features/notif/useNotifPrefs.spec.ts`(서버 모킹), `src/features/notif/notifPrefs.ts`(로컬 영속 제거), `src/features/notif/notifPrefs.spec.ts`(prune), `src/features/notif/index.ts`(재노출 정리)

## 테스트 결과
- `npm test`(jest): **144 suites / 1323 tests green**(회귀 0).
- `tsc --noEmit`: **0 에러**.
- Deno 함수 테스트: 로컬 deno 미설치 → 정적 검증(`/supabase/` jest ignore). 실행은 사용자: `cd supabase/functions/send-muklog-push && deno test --allow-env`.

## 미완/후속
- Expo Push **receipt 폴링**(영수증으로 전체 무효토큰 정리)은 후속 — 이번은 push ticket 의 DeviceNotRegistered 만 best-effort 삭제.
- 파트너 신원(닉/아바타) RLS self-only 라 NotifSettingsView 파트너 아바타는 익명 폴백 유지(기존 동작 불변, 이 스프린트 범위 외).
