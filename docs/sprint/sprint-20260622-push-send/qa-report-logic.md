# QA Report — Logic / Security / Integration (sprint-20260622-push-send)

**검증자:** qa-logic · **일자:** 2026-06-22 · **범위:** 로직·통합 정합성·보안·비용·TDD·컨벤션 (비주얼은 qa-visual)
**판정:** ✅ **PASS (로직 완료)** — 라이브 미적용·APNs는 사용자 전담(적용 후 실발송 스모크 필요). 차단 이슈 0. 경미 관찰 2건(비차단).

---

## 1. 보안 교차검증 (최우선)

### 1.1 본인 JWT만 — 안티스팸 ✅ PASS
- Edge Function이 body의 `userId`/`p_actor`를 **권한에 사용하지 않음**. `index.ts:124-134` → `extractBearer` 추출 후 `deps.getUserId({ token })`로 검증된 `callerId`만 사용. body는 `roomId`/`muklogId`만 파싱(`index.ts:137-145`).
- RPC 호출이 항상 JWT `callerId`로: `index.ts:151` `listPushTargets({ roomId, actorId: callerId })` → `index.ts:234-238` `rpc('list_room_push_targets', { p_room_id: roomId, p_actor: actorId })`. body의 actor 주입 경로 없음.
- 미인증 → 401: 토큰 부재(`index.ts:126`)·`getUserId` null/throw(`index.ts:131-134`) 모두 401.
- **load-bearing 테스트 확인**: `index.test.ts:72-80` — body에 `userId:'victim', p_actor:'victim'` 주입해도 `calls.listedFor`가 `actorId:'caller-uid'`(JWT)임을 단언. 이 단언을 깨면(코드가 body actor를 쓰면) 빨개짐 → 유의미.

### 1.2 멤버십 게이트 ✅ PASS
- `list_room_push_targets`(migration `:111-132`)의 EXISTS 절(`:126-129`)이 `p_actor`가 `p_room_id` 멤버일 때만 결과 생성. 비멤버 → EXISTS false(모든 행) → **빈 결과**. 임의 roomId로 타인 룸 푸시 트리거 불가.
- EXISTS는 WHERE의 상관 서브쿼리(`room_members me where me.room_id=p_room_id and me.user_id=p_actor`)로 정확. 대상 행 필터 `rm.user_id <> p_actor`(`:124`)와 독립적으로 게이트 작동.
- Edge 단에서도 `targets.length === 0 → 200 no-op`(`index.ts:156`), 비멤버는 빈 배열 → 발송 0.

### 1.3 토큰 클라이언트 미노출 ✅ PASS
- RPC에 `GRANT execute to authenticated` **없음**(migration `:134` 주석만, 실제 grant 문 부재 — grep 확인). authenticated 직접 호출 불가, service_role만 RLS/grant 무관 실행.
- prefs 두 테이블만 `grant select,insert,update to authenticated`(`:140-141`) — 토큰 테이블 아님(`device_tokens`는 본인 토큰만 RLS, 타인 토큰은 DEFINER RPC 경유만).
- Edge 응답은 `{ sent: n }` / `{ error }`만(`index.ts:154,156,187,204`). 토큰 미반환.
- **load-bearing 테스트**: `index.test.ts:150-156` — 응답 본문에 `ExponentPushToken` 미포함 단언(유의미, 토큰 누출 시 빨개짐).

### 1.4 service_role 비노출 ✅ PASS
- `SUPABASE_SERVICE_ROLE_KEY`는 env에서만 참조(`index.ts:220` `env?.get(...)`). 코드/응답/로그에 평문 0.
- grep(`eyJ` JWT 리터럴 / 키 평문 대입) — supabase/·src/·sprint 디렉터리 전체 **0건**. dev-notes도 키 이름만.

---

## 2. 데이터 / 통합 교차검증

### 2.1 RPC 게이팅 정확 (AC1·AC6) ✅ PASS
- 다른 멤버만: `rm.user_id <> p_actor`(`:124`) → 솔로 룸=수신자 0, 커플=상대 1명.
- prefs 게이팅: `coalesce(np.master_enabled, true)=true AND coalesce(npr.enabled, true)=true`(`:130-131`). LEFT JOIN(`:120-122`)으로 행 부재=on, off 행 존재=제외. 의미 정확.
- `npr` 조인이 `npr.room_id = p_room_id`로 한정(`:122`) — 다른 룸 override가 섞이지 않음.
- 스키마 정합 확인: `room_members(room_id,user_id)`·`device_tokens(user_id,expo_push_token,platform)`·`rooms.name`(20260615 추가)·`profiles(id,nickname)` 모두 실재 → RPC/Edge 조회 컬럼 일치.

### 2.2 prefs ↔ 게이팅 의미 일치 (AC5·AC6) ✅ PASS
- 생산자 `useNotifPrefs`: master upsert `notification_prefs(user_id, master_enabled)`(`useNotifPrefs.ts:78-80`), room upsert `notification_pref_rooms(user_id, room_id, enabled)`(`:96-98`).
- 소비자 RPC: 동일 테이블/컬럼 읽음. 부재=기본 on이 양쪽 동일(`resolveLogEnabled` 부재=true `notifPrefs.ts:28` ↔ `coalesce(...,true)`).
- snake_case(DB) ↔ camelCase(앱) 매핑: `useNotifPrefs`는 DB snake 직접 사용(`master_enabled`/`room_id`/`enabled`), Edge `buildRealDeps.listPushTargets`는 `expo_push_token→expoPushToken` 매핑(`index.ts:240-243`)로 일관.

### 2.3 트리거 best-effort (AC4) ✅ PASS
- 발송 invoke가 `createMuklog` **성공 지점**(insert+사진 완료)에만(`useCreateMuklog.ts:112`). insert 실패는 throw 전(`:89`)이라 미도달, 사진 실패는 rollback 후 throw(`:103-104`)라 미도달.
- create 경로 전용: grep 결과 `send-muklog-push` invoke는 `useCreateMuklog.ts`에만 존재. `useUpdateMuklog.ts`에 push 참조 0건 → 편집 미발송.
- best-effort 흡수: `triggerMuklogPush`가 try/catch로 흡수(`:38-43`), `await`하지만 발송 실패가 결과/error에 영향 0.
- **load-bearing 테스트**: `useCreateMuklog.spec.ts:229-241`(1회 invoke·정확한 body), `:243-255`(invoke reject해도 `{id}` 반환·error null), `:257-265`(insert 실패 시 미invoke), `:267-278`(사진 롤백 시 미invoke). 경계 모두 커버.

### 2.4 prefs 서버 이전 (AC5) ✅ PASS
- AsyncStorage 경로 제거: `notifPrefs.ts`는 형/기본값/`resolveLogEnabled`만 남음(로컬 키/파서/직렬화 삭제 확인).
- 인터페이스 보존: `state(loading/ready)/setMaster/setLogEnabled`(`useNotifPrefs.ts:107`). 소비자 `NotifSettingsScreen.tsx:36,62-65`가 동일 시그니처로 배선 → 회귀 0.
- loading 상태 처리: `NotifSettingsScreen.tsx:41` loading 중 DEFAULT 폴백. 마운트 1회 read(`useNotifPrefs.ts:29-69`, deps `[userId]`) — 폴링·Realtime 0(비용 가드레일 충족).

---

## 3. TDD / 종료 기준 (AC7)

- `tsc --noEmit`: **0 에러** (직접 실행, exit 0).
- `npm test`(jest): **144 suites / 1323 tests green** (직접 실행). dev-notes 수치와 일치, 회귀 0.
- Deno 함수 테스트 `index.test.ts`(13 케이스): 로컬 deno **미설치** → 직접 실행 불가. supabase가 jest(`testPathIgnorePatterns:/supabase/`)·tsc(`exclude: supabase/functions`)에서 제외됨을 확인 → 정적 검증으로 분류. **사용자 환경에서 `deno test --allow-env` 실행 필요**.
- 인수조건↔테스트 대응: AC1/AC6=RPC(SQL 정적, Deno 게이팅 스모크) / AC2·AC3=`index.test.ts` / AC4=`useCreateMuklog.spec.ts` / AC5=`useNotifPrefs.spec.ts`·`notifPrefs.spec.ts`. 핵심 단언 load-bearing 표본 확인 완료(§1.1·1.3·2.3).

---

## 4. 코드 컨벤션 (touched 파일)

- `useCallback`/`useMemo`: 0건. `export function`(컴포넌트/훅): 0건(전부 화살표 const). 인라인 `useEffect(() =>`: 0건(`loadNotifPrefsOnUser` 명명 함수). named-object 인자: `setMaster({enabled})`·`setLogEnabled({roomId,enabled})`·`triggerMuklogPush({roomId,muklogId})`·`buildCopy/handleSendMuklogPush` 모두 객체 인자. 파일명=심볼명 일치. ✅

---

## 5. 경미 관찰 (비차단, 수정 선택)

1. **`useNotifPrefs` 상태에 명시적 `error` 없음** — plan AC5는 "loading/error 상태"를 언급하나, 구현은 read 실패를 `ready`+DEFAULT(기본 on)로 흡수(`useNotifPrefs.ts:33,101` 테스트). best-effort·크래시 회피 의도로 일관되며 기능상 정상. 설계 의도이면 비차단. (담당: developer — 의도 확인만)
2. **Deno 테스트 `text.includes('valid')` 단언이 약함** — `index.test.ts:155`. 응답 본문(`{"sent":1}`)에 JWT 문자열 'valid'가 들어갈 경로가 원래 없어 트리비얼 통과. 같은 케이스의 `ExponentPushToken` 미포함 단언(`:154`)이 실제 load-bearing이라 토큰 누출은 잡힘. 단언 강화는 선택(비차단). (담당: developer)

---

## 6. 미검증 (사유 명시 — 사용자 전담)

- **DB 마이그레이션 라이브 적용**(`supabase db push`) — 미적용. DEFINER 권한·RLS는 라이브에서만 실검증 가능(메모리 참조: definer-storage-and-best-effort). 적용 후 RPC 게이팅 실데이터 스모크 필요.
- **Edge Function 배포 + 실 Expo Push 발송** — 미배포. `supabase functions serve` + 디바이스 스모크 필요.
- **APNs 키(iOS 실배달)** — EAS 빌드 단계, 사용자 전담.
- **Deno 단위 테스트 실행** — 로컬 deno 미설치. `deno test --allow-env` 사용자 실행 권장.

---

## 종합 판정

**✅ PASS (로직 완료)**. 보안 4축(본인 JWT·멤버십 게이트·토큰 미노출·service_role 비노출) 모두 충족, 타인 룸 스팸·토큰 누출 경로 없음. RPC 게이팅·prefs 의미 일치·best-effort 트리거·서버 이전 모두 정합. `npm test` 1323 green + `tsc` 0. 차단 이슈 0, 경미 관찰 2건(비차단). 라이브 적용 후 실발송 스모크는 사용자 전담으로 잔존.
