# Sprint: 프로필 편집 (profile)

> 입력: `docs/design/architecture.md`(§1 결정 — 프로필=닉네임+아바타 편집, §3 데이터 모델 `profiles`, §4 화면 — Profile은 Room 헤더 진입, §6 비용 가드레일 — 이미지 리사이즈/압축·Supabase 무료 티어).
> 선행 스프린트: `docs/sprint/sprint-20260609-invite-room/plan.md`. 이미 존재하는 자산을 재사용한다 — `profiles` 테이블(컬럼 `nickname`/`avatar_url` 보유, 익명 세션 확보 시 본인 행 upsert 완료), `profiles` RLS(`select`/`insert`/`update` 모두 `id = auth.uid()` own-only), `AuthProvider`(authenticated 상태에서 `userId` 제공).
> 산출물: 이 plan.md → developer 구현(dev-notes.md) → qa-inspector 검증(qa-report.md).

---

## 1. 기능 한줄 정의

방에 들어온 사용자가 **Room 헤더에서 Profile 화면으로 진입**해, **닉네임을 수정**하고(1~20자) **아바타 이미지를 갤러리에서 골라 업로드**(리사이즈·압축 후 Supabase Storage 저장)하여, 자신의 `profiles.nickname` / `profiles.avatar_url`을 갱신하고 그 결과를 화면에서 즉시 확인할 수 있다.

---

## 2. 범위

### In-scope
- **Storage 버킷 `avatars`** + RLS 정책(소유자만 쓰기, 공개 읽기) — `supabase/migrations/`에 SQL 계약 추가. (`profiles` 테이블/컬럼은 **변경 없음** — invite-room에서 이미 생성됨.)
- **프로필 조회 훅** `useProfile({ userId })` — 본인 `nickname`/`avatar_url`을 1회 조회(own-only RLS).
- **프로필 수정 훅** `useUpdateProfile({ userId })` — 닉네임 저장 + 아바타 업로드(이미지 처리 → Storage 업로드 → `profiles.avatar_url` 갱신 → 이전 파일 정리).
- **닉네임 검증 유틸** `validateNickname` — trim·길이(1~20)·빈값/공백전용 차단.
- **아바타 이미지 처리 유틸** `processAvatarImage` — 정사각 리사이즈 512px + JPEG q0.7 압축(비용 가드레일).
- **에러 매핑 유틸** `mapProfileError` — 검증/업로드/권한 토큰 → 한국어 메시지.
- **`ProfileScreen`** — 현재 닉네임·아바타 표시, 닉네임 편집+저장, 아바타 탭→갤러리 선택→업로드. 로딩/빈/에러/성공 상태 반영.
- **`Avatar` 공용 컴포넌트** — URL 있으면 이미지, 없으면 닉네임 이니셜/플레이스홀더.
- **네비게이션 진입점** — `Routes.Profile` 추가, `AppNavigator`에 스택 화면 등록, `RoomTabs` 헤더 우측 버튼(아바타/프로필)에서 진입.
- 신규 의존성: `expo-image-picker`, `expo-image-manipulator` (Expo 패키지, `npx expo install`로 추가 — 적용은 dev 환경 의존, dev-notes 명시).

### Out-of-scope (다음/추후)
- **파트너(상대) 프로필 표시.** `profiles` RLS는 invite-room 결정대로 **own-only 유지** — 이번에 cross-member 가시성을 열지 않는다. 상대 닉네임/아바타 노출은 추후 SECURITY DEFINER helper로.
- **아바타 제거(기본값으로 되돌리기 = avatar_url을 NULL로).** 이번엔 설정/교체만. (제거 흐름은 추후.)
- 아바타 **크롭/줌 편집 UI**(고급 에디터). 이번엔 라이브러리 정사각 리사이즈로 충분.
- 카메라 촬영 입력(이번엔 갤러리 선택만). 닉네임 **중복 검사/유일성**(허용 — couple 2인이라 충돌 무의미).
- 먹로그/지도/Kakao/Realtime/Edge Function — 범위 밖.

---

## 3. 데이터 · API 계약

> 마이그레이션 파일: `supabase/migrations/20260610120000_profile_avatars.sql`(재실행 가능하게: `on conflict do nothing` / `drop policy if exists`). **실 Supabase 적용은 사용자 환경 의존**(`db push` 또는 대시보드) — dev-notes에 명시. `profiles` 테이블 DDL은 **추가/변경 없음**.

### 3.1 Storage 버킷 + 정책 (계약)

```sql
-- 공개 읽기 버킷(아바타는 비민감 + 추후 파트너 표시 대비). 파일명 uuid → 교체 시 URL 변경 = CDN 캐시 무효화.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- 경로 규약: avatars/{user_id}/{uuid}.jpg  (첫 세그먼트 = 소유자 uid)
-- 쓰기(insert/update/delete)는 소유자만. 읽기는 public 버킷이라 익명 CDN 허용(별도 select 정책 불필요).
drop policy if exists "avatar_insert_own" on storage.objects;
create policy "avatar_insert_own" on storage.objects for insert to authenticated
  with check ( bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text );

drop policy if exists "avatar_update_own" on storage.objects;
create policy "avatar_update_own" on storage.objects for update to authenticated
  using ( bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text );

drop policy if exists "avatar_delete_own" on storage.objects;
create policy "avatar_delete_own" on storage.objects for delete to authenticated
  using ( bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text );
```

- **저장값 결정**: `profiles.avatar_url`에는 **공개 URL 문자열**을 저장한다(`supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl`). 파일명이 uuid라 교체 시 URL이 바뀌어 **stale 캐시 자동 무효화**. (path가 아닌 URL 저장 → 렌더 시 추가 변환 불필요, 추후 파트너 표시도 필드 그대로 사용.)
- **경로**: `{userId}/{uuid}.jpg` (버킷 내부 키). uuid는 RN에서 생성(예: `expo-crypto`의 randomUUID 또는 간단한 난수 — dev가 결정, 단 충돌 무시 가능 수준).

### 3.2 `profiles` 사용 (DDL 변경 없음, 기존 RLS 재사용)

| 작업 | 쿼리 | 근거 RLS(기존) |
|------|------|----------------|
| 조회 | `select nickname, avatar_url from profiles where id = userId` (maybeSingle) | `select`: `id = auth.uid()` |
| 닉네임 갱신 | `update profiles set nickname = :nickname where id = userId` | `update`: `id = auth.uid()` |
| 아바타 갱신 | `update profiles set avatar_url = :url where id = userId` | `update`: `id = auth.uid()` |

> `userId`는 항상 `auth.uid()`와 동일(본인). `.eq('id', userId)`를 명시하되 RLS가 2차 방어.

### 3.3 프론트 훅 시그니처 (`src/features/profile/`)

```ts
// 조회 — 화면 진입 1회 + 갱신 성공 후 refresh (폴링 금지)
export type Profile = { nickname: string | null; avatarUrl: string | null };
export type ProfileState =
  | { status: 'loading' }
  | { status: 'ready'; profile: Profile }
  | { status: 'error'; message: string };

useProfile({ userId }: { userId: string }): {
  state: ProfileState;
  refresh: () => Promise<void>;
};
//   내부: supabase.from('profiles').select('nickname, avatar_url').eq('id', userId).maybeSingle()
//   snake(avatar_url) → camel(avatarUrl) 매핑. 0행이면 nickname/avatarUrl 모두 null.

// 수정 — 닉네임 저장 / 아바타 업로드(두 액션 분리)
useUpdateProfile({ userId }: { userId: string }): {
  saveNickname: ({ nickname }: { nickname: string }) => Promise<void>;  // 검증→update
  changeAvatar: () => Promise<void>;  // 권한→피커→처리→업로드→update→이전파일 정리
  savingNickname: boolean;
  uploadingAvatar: boolean;
  error: string | null;   // 한국어 메시지(mapProfileError) 또는 null
};
```

`changeAvatar()` 내부 순서(계약):
1. `expo-image-picker` 권한 요청 → 거부 시 `PERMISSION_DENIED`.
2. `launchImageLibraryAsync({ mediaTypes: images, quality: 1 })` → **취소면 조용히 종료**(에러 아님, no-op).
3. `processAvatarImage({ uri })`(§3.4) → 처리된 로컬 jpeg uri.
4. 처리 결과를 ArrayBuffer/Blob로 읽어 `supabase.storage.from('avatars').upload('{userId}/{uuid}.jpg', data, { contentType: 'image/jpeg', upsert: false })`. 실패 시 `AVATAR_UPLOAD_FAILED`.
5. `getPublicUrl(path)` → `update profiles set avatar_url`. 실패 시 `AVATAR_UPLOAD_FAILED`(업로드된 새 파일은 best-effort 삭제로 정리).
6. 성공 시 **이전 avatar 파일 best-effort 삭제**(`remove([이전path])`) — 실패해도 무시(가드레일: 스토리지 누적 방지). 이전 path는 직전 `avatar_url`에서 파싱.

### 3.4 이미지 처리 유틸 `processAvatarImage` (`src/features/profile/image.ts`)

```ts
processAvatarImage({ uri }: { uri: string }): Promise<{ uri: string; width: number; height: number }>;
//   expo-image-manipulator: 정사각 기준 resize { width: AVATAR_SIZE, height: AVATAR_SIZE }
//   + SaveFormat.JPEG, compress: AVATAR_COMPRESS.
export const AVATAR_SIZE = 512;        // 정사각 512px (아래 가드레일 주석 참조)
export const AVATAR_COMPRESS = 0.7;    // JPEG q0.7 (architecture §6 기준)
```

> **비용 가드레일 정합(architecture §6)**: 설계 문서의 일반 규칙은 "업로드 전 리사이즈/압축 — **장변 1280px, JPEG q0.7**"이다. **압축 품질은 q0.7로 동일**하게 따른다. **리사이즈 한도는 아바타 특성상 1280px보다 더 엄격한 512×512 정사각으로 적용**한다 — 아바타는 작은 원형으로만 렌더되므로 1280px는 과대(스토리지·전송량 낭비)이고, 512는 1280 한도 **이내(더 강한 절감)**라 가드레일을 어기지 않고 충족한다. (먹로그 사진 스프린트는 장변 1280px를 그대로 적용.) 비정사각 원본은 resize로 512×512 강제(왜곡 허용 — 크롭 UI는 out-of-scope). manipulate 호출 인자(resize/compress/format)가 테스트 단언 대상(P7).

### 3.5 닉네임 검증 유틸 `validateNickname` (`src/features/profile/nickname.ts`)

```ts
export const NICKNAME_MIN_LENGTH = 1;
export const NICKNAME_MAX_LENGTH = 20;

export type NicknameValidation =
  | { ok: true; value: string }          // trim된 정규값
  | { ok: false; reason: 'empty' | 'too-long' };

validateNickname({ raw }: { raw: string }): NicknameValidation;
//   trim 후: 빈문자열/공백전용 → empty. 길이 > 20 → too-long. 그 외 ok+trim값.
```

### 3.6 에러 토큰 → 한국어 메시지 (`mapProfileError`, `src/features/profile/errors.ts`)

| 토큰 | 메시지(예시) | 발생 위치 |
|------|--------------|-----------|
| `NICKNAME_EMPTY` | "닉네임을 입력해 주세요." | 닉네임 검증(empty) |
| `NICKNAME_TOO_LONG` | "닉네임은 20자까지 입력할 수 있어요." | 닉네임 검증(too-long) |
| `PERMISSION_DENIED` | "사진 접근 권한이 필요해요. 설정에서 허용해 주세요." | 갤러리 권한 거부 |
| `AVATAR_UPLOAD_FAILED` | "이미지 업로드에 실패했어요. 다시 시도해 주세요." | 업로드/URL 갱신 실패 |
| (네트워크/그 외) | "처리에 실패했어요. 다시 시도해 주세요." | fallback |

> 토큰 문자열은 유틸 ↔ 훅 ↔ 화면 **단일 출처**. invite-room의 `mapRoomError`와 별도 모듈(`profile/errors.ts`)로 둔다.

---

## 4. 화면 · UX

### 진입점 (architecture §4 — "Profile (Room 헤더 진입)")
- `RoomTabs`의 `screenOptions.headerRight`에 **프로필 버튼**(작은 `Avatar` 또는 "프로필" 텍스트) 추가 → `navigation.navigate(Routes.Profile)`.
- `Routes.Profile` 신설, `AppStackParamList`에 추가, `AppNavigator`에 `Stack.Screen`(headerShown: true, title "프로필", 뒤로가기) 등록.

### ProfileScreen 구성/상태
| 영역 | 내용 | 상태별 UX |
|------|------|-----------|
| 로딩 | `useProfile` loading | Splash/스피너(`Screen` 내 중앙) |
| 아바타 | `Avatar`(현재 `avatarUrl`) + "사진 변경" 버튼/탭 | 업로드 중=스피너/disabled, 실패=에러 텍스트, 성공=새 이미지 즉시 |
| 닉네임 | `TextInput`(현재 닉네임 prefill) + "저장" 버튼 | 검증 실패=인라인 메시지+저장 disabled, 저장 중=loading, 성공=완료 표시 |
| 에러 | `useProfile` error | 에러 텍스트 + 재시도(refresh) |

- 닉네임 입력: `maxLength={NICKNAME_MAX_LENGTH}`, "저장" 버튼은 `validateNickname` 통과 + 기존값과 다를 때만 활성(혹은 항상 활성+검증실패 시 인라인). 저장 성공 후 `refresh()`.
- 아바타 변경 성공 후 `refresh()`(또는 훅이 반환한 새 URL로 즉시 반영).
- 갤러리 취소 → 아무 변화 없음(에러 표시 X).

### 원티드 토큰 사용 지점
- 배경/패딩: `Screen`(`color.bg`, `spacing`). 텍스트: `Text` variant/`color`. 버튼: `Button` primary/secondary.
- 아바타 원형: `radius.full`, 테두리 `color.border`, 플레이스홀더 배경 `color.surface`/`color.primaryWeak`, 이니셜 텍스트 `color.fgWeak`. 입력 테두리 `radius.lg`+`color.border`. **raw hex 금지**(setup 규칙 유지).

---

## 5. 작업 목록 (각 인수조건 포함)

> TDD 순서: 순수 유틸 → 훅(supabase/외부 SDK 모킹) → 화면 → 네비게이션. 각 모듈 완성 시 qa-inspector에 생산자↔소비자 경로 명시해 incremental 교차검증 요청.

- [ ] **T1. 의존성 추가** — 인수: `expo-image-picker`, `expo-image-manipulator`가 package.json에 추가되고 import 가능. **인수 검증: dev-notes에 `npx expo install` 명령·적용은 사용자 환경 의존 명시.** — 테스트: (설치 자체는 모킹으로 대체, 단위 대상 아님)
- [ ] **T2. `validateNickname` + 상수** — 인수: trim 후 빈/공백전용 → `{ok:false,'empty'}`, 21자 → `{ok:false,'too-long'}`, 1~20자 → `{ok:true, value:trim}`. — 테스트: `nickname.spec.ts` 경계(0/1/20/21자, 공백·앞뒤공백 trim).
- [ ] **T3. `mapProfileError` + 토큰** — 인수: §3.6 토큰 5종 한국어 매핑, 미일치/네트워크는 기본 메시지. — 테스트: `errors.spec.ts` 토큰별·fallback.
- [ ] **T4. `processAvatarImage`(image.ts)** — 인수: expo-image-manipulator를 `resize 512×512` + `JPEG` + `compress 0.7`로 호출하고 처리 uri 반환. — 테스트: `image.spec.ts`(manipulator 모킹, 호출 인자 단언).
- [ ] **T5. `useProfile` 훅** — 인수: 진입 시 `select nickname, avatar_url` 1회 → loading→ready(`avatar_url`→`avatarUrl` 매핑), 0행이면 둘 다 null, 에러면 error. `refresh()` 재조회. 폴링 없음. — 테스트: `useProfile.spec.ts`(supabase 모킹, 상태 전이·snake→camel·0행).
- [ ] **T6. `useUpdateProfile` 훅 — saveNickname** — 인수: 검증 실패 시 update 미호출 + error에 매핑 메시지, 통과 시 `update profiles set nickname`. savingNickname 토글. — 테스트: `useUpdateProfile.spec.ts`(검증실패=update 0회, 성공=1회·payload `{nickname}`).
- [ ] **T7. `useUpdateProfile` 훅 — changeAvatar** — 인수: 권한 거부→`PERMISSION_DENIED`/취소→no-op/정상→처리·업로드·`avatar_url` update·이전파일 remove. 업로드 실패→`AVATAR_UPLOAD_FAILED`. uploadingAvatar 토글. — 테스트: 권한거부·취소·성공(순서: process→upload→getPublicUrl→update→remove old)·업로드실패 경로(expo-image-picker/manipulator/supabase.storage 모킹).
- [ ] **T8. `Avatar` 컴포넌트** — 인수: `avatarUrl` 있으면 `Image`(원형) 렌더, null이면 닉네임 이니셜/플레이스홀더. 토큰만 사용. — 테스트: `Avatar.spec.tsx`(url 유무 분기 렌더).
- [ ] **T9. `ProfileScreen`** — 인수: 현재 닉네임/아바타 표시, 닉네임 입력 검증(저장 disabled/인라인 에러), "사진 변경" 탭→changeAvatar, 로딩/에러/성공 상태 반영, 저장 성공 후 refresh. 토큰만(raw hex 0). — 테스트: `ProfileScreen.spec.tsx`(prefill·검증 disabled·아바타 탭 호출·에러 표시).
- [ ] **T10. Storage 마이그레이션 SQL** — 인수: `avatars` 버킷(public) + insert/update/delete 정책(첫 세그먼트=uid)이 §3.1대로. 재실행 가능. — 테스트: (SQL/RLS는 단위 대상 아님 → dev-notes 스모크 절차 명시, qa 계약 점검).
- [ ] **T11. 네비게이션 진입점** — 인수: `Routes.Profile` 추가, `AppStackParamList[Profile]`, `AppNavigator`에 Profile 스택 등록(title "프로필"), `RoomTabs` headerRight 버튼 탭 시 Profile 이동. `tsc --noEmit` 통과. — 테스트: 라우트 상수/타입 + (네비는 단위 약식, 헤더 버튼 onPress→navigate 모킹 단언 선택).
- [ ] **T12. `src/features/profile/index.ts` 공개 표면** — 인수: 훅/유틸/상수/타입 export, `ProfileScreen`은 navigation에서 import. `npm test` 전체 통과.

---

## 5-1. 테스트 케이스 (TDD)

**단위(유틸) — 필수**
- `validateNickname`: `''`→empty / `'   '`→empty / `'a'`→ok'a' / `'  닉  '`→ok'닉'(trim) / 20자→ok / 21자→too-long.
- `mapProfileError`: 각 토큰→해당 메시지 / 알 수 없는 문자열→기본 / Error·string·{message} 추출.
- `processAvatarImage`: manipulator가 `[{ resize:{width:512,height:512} }]`, `{ compress:0.7, format:JPEG }`로 호출됨, 반환 uri 전달.

**훅(supabase·expo 모킹) — 필수**
- `useProfile`: loading→ready(`{nickname:'x', avatar_url:'u'}`→`{nickname:'x', avatarUrl:'u'}`), 0행→null/null, error→error. `refresh` 재호출 시 재조회.
- `useUpdateProfile.saveNickname`: 빈값→update 0회+error 세팅 / 정상→`from('profiles').update({nickname}).eq('id',userId)` 1회 / 실패→`AVATAR_UPLOAD_FAILED` 아닌 네트워크 fallback.
- `useUpdateProfile.changeAvatar`: 권한거부→`PERMISSION_DENIED`·업로드 0회 / 취소(canceled:true)→no-op·error null / 정상→process·upload·getPublicUrl·update·remove(old) 순서/업로드 reject→`AVATAR_UPLOAD_FAILED`·새파일 정리.

**화면/컴포넌트 — 핵심 흐름**
- `Avatar`: url 있음→Image source uri / url 없음→이니셜·플레이스홀더.
- `ProfileScreen`: 현재값 prefill / 닉네임 비우면 저장 disabled+메시지 / "사진 변경" 탭→changeAvatar 호출 / 업로드 에러→메시지 표시 / 저장 성공→refresh 호출.

**모킹/스모크 경계**(testing-strategy 준수)
- SQL·Storage RLS·버킷 정책 → 단위 아님. dev-notes에 디바이스/대시보드 스모크 절차(아바타 업로드→공개 URL 렌더→재실행 후 유지) 기록, qa는 계약(경로·정책·필드)만 점검.
- expo-image-picker / expo-image-manipulator / supabase.storage → **모킹**(우리 코드의 호출·매핑·에러 처리만 검증).

---

## 6. 엣지케이스

**닉네임 입력(경계/검증)**
- 빈 문자열/공백 전용 → `NICKNAME_EMPTY`, 저장 disabled+인라인 메시지.
- 21자 이상 → `maxLength`로 1차 차단 + `validateNickname` 2차(`too-long`).
- 앞뒤 공백 → trim 후 저장(서버 저장값은 정규화된 값).
- 이모지/멀티바이트 → 길이는 JS `.length` 기준 20(MVP 단순화, 별도 그래핌 처리 안 함 — Out-of-scope 명시).
- 기존 닉네임과 동일값 저장 → 허용(무해, update 1회 또는 변경없음 시 저장 비활성 — dev 결정).

**아바타(권한/입력/실패)**
- 갤러리 권한 거부 → `PERMISSION_DENIED` 메시지(앱 설정 안내). 업로드 시도 안 함.
- 피커 취소 → no-op(에러 표시 없음).
- 업로드 중 네트워크 끊김 → `AVATAR_UPLOAD_FAILED`, `profiles.avatar_url` 미변경(orphan 참조 0). 업로드된 새 파일 best-effort 삭제.
- URL 갱신(update) 실패 → 업로드된 새 파일 best-effort 정리 + 에러.
- 이전 아바타 교체 시 이전 파일 best-effort 삭제(스토리지 누적 방지). 삭제 실패는 무시(치명 아님).
- 매우 큰 원본 이미지 → `processAvatarImage`가 512px로 축소 후 업로드(원본 그대로 업로드 금지 — 가드레일).
- 손상/비이미지 선택 → 피커가 이미지로 한정(`mediaTypes: images`); 처리 실패 시 `AVATAR_UPLOAD_FAILED` fallback.

**권한/RLS**
- 다른 사용자의 `profiles` 행 조회/수정 시도 → RLS own-only로 0행/거부. (앱은 항상 본인 `userId`만 사용.)
- Storage 다른 uid 폴더에 쓰기 시도 → 정책(첫 세그먼트=uid)으로 거부.

**동시성(커플 2명)** — 프로필은 **own-only**라 커플 간 충돌 없음:
- 같은 사용자가 **두 기기**에서 동시 편집 → last-write-wins(본인 행). 데이터 손상 없음.
- 파트너는 내 프로필을 보거나 수정 불가(RLS own-only, 파트너 표시 Out-of-scope).

**네트워크/세션**
- 조회 실패 → ProfileScreen error 뷰 + 재시도(refresh).
- 오프라인에서 저장/업로드 → 훅 error → 메시지+재시도. 성공 응답 전까지 상태 미반영.
- 세션 만료/없음 → update/storage 401 → fallback 메시지(앱 재시작 흐름은 AuthGate 담당).

**빈 상태**
- 아직 닉네임/아바타 미설정(invite-room 직후 NULL) → 닉네임 입력 비어있음, `Avatar`는 플레이스홀더/이니셜. 정상 진입.

---

## 7. QA 교차검증 경계면 (생산자 ↔ 소비자)

| # | 생산자 | 소비자 | 확인 포인트 |
|---|--------|--------|-------------|
| **P1** | `profiles.select('nickname, avatar_url')`(snake) | `useProfile` 매핑(`avatarUrl` camel) | 필드명·snake→camel·0행 시 null/null |
| **P2** | `profiles` RLS(own-only, 기존) + `update`(`id=auth.uid()`) | `useUpdateProfile`의 `update().eq('id', userId)` | 본인 행만 갱신, userId=auth.uid() 일치 |
| **P3** | Storage `avatars` 버킷 + insert/update/delete 정책(첫 세그먼트=uid) | `changeAvatar` 업로드 경로 `{userId}/{uuid}.jpg` | 경로 첫 세그먼트=uid 일치, public 읽기, 권한 거부 동작 |
| **P4** | `getPublicUrl(path)` 결과 URL | `profiles.avatar_url` 저장값 + `Avatar` 렌더 | 저장=공개URL(문자열), Avatar가 그 URL로 Image 렌더, uuid 캐시무효화 |
| **P5** | `validateNickname` 결과(empty/too-long/ok) | `ProfileScreen` 저장 버튼 활성·인라인 메시지 + `saveNickname` | 검증 실패 시 update 미호출, 메시지 토큰 일치 |
| **P6** | 에러 토큰(`PERMISSION_DENIED`/`AVATAR_UPLOAD_FAILED`/`NICKNAME_*`) | `mapProfileError` ↔ 화면 메시지 | 토큰 1:1, 누락 0, fallback 동작 |
| **P7** | `processAvatarImage`(512·JPEG·0.7) | 업로드 데이터(`contentType:image/jpeg`) | 리사이즈/압축 적용본만 업로드(원본 직업로드 0) — 가드레일 |
| **P8** | `Routes.Profile` + `AppStackParamList` + `AppNavigator` 등록 | `RoomTabs` headerRight `navigation.navigate(Profile)` | 라우트 상수·타입·등록 일치, 진입/뒤로가기, tsc 통과 |
| **P9** | `userId`(AuthProvider authenticated) | `useProfile`/`useUpdateProfile` 입력 + Storage 경로 | 동일 uid 사용(조회·수정·경로 첫 세그먼트 일치) |
| **P10** | 이전 `avatar_url`에서 파싱한 이전 path | 교체 성공 후 `storage.remove([oldPath])` | 이전 파일 정리(스토리지 누적 방지), 실패 무시 안전 |

---

## 8. 비용 가드레일 체크

- **AWS 미사용.** 백엔드는 Supabase 무료 티어만(Postgres + Storage `avatars` 버킷 + 익명 Auth). Edge Function/Kakao **이번 범위 없음**.
- **이미지 리사이즈/압축 필수**(architecture §6 — "장변 1280px, JPEG q0.7"): 업로드 전 `processAvatarImage`로 **JPEG q0.7(동일)** + **512×512 정사각(1280px 한도 이내로 더 강하게 절감)**. **원본 직업로드 금지**(P7로 검증). → Storage 용량·전송량 절감.
- **이전 아바타 정리**: 교체 시 이전 파일 best-effort 삭제 → Storage 무한 누적 방지(무료 티어 용량 보호, P10).
- **조회 최소화**: 프로필은 화면 진입 1회 + 저장/업로드 성공 후 `refresh`만. **폴링/주기 조회 금지.** Realtime 미사용.
- **공개 버킷 CDN**: 아바타는 public 버킷 → 서명 URL 재발급 왕복 없이 CDN 캐시 활용. uuid 파일명으로 캐시 무효화 자연 처리.
- 카카오 디바운스/캐싱 · viewport 조회 → **이번 기능 해당 없음**(다음 스프린트).

---

## 부록. invite-room → profile 전환 메모 (developer 참고)
- `profiles` 테이블/컬럼·RLS는 **이미 존재**(invite-room T1·T2·T7). 이번 스프린트는 **컬럼 값 편집**만 — DDL 변경 없음.
- 새 feature 모듈 `src/features/profile/`(나란히 spec 콜로케이션). 공개 표면은 `index.ts`로.
- `Avatar`는 `src/components/`에 추가하고 `components/index.ts`에 export(공용 재사용 — 추후 먹로그 작성자 표시 등).
- 네비게이션: `routes.ts`에 `Profile` 추가, `AppNavigator`에 스택 화면 1개 등록(headerShown:true), `RoomTabs` screenOptions에 headerRight. 새 탭은 만들지 않는다(헤더 진입).
- 신규 Expo 패키지(`expo-image-picker`/`expo-image-manipulator`)는 `npx expo install`로 추가하고, 네이티브 모듈이므로 **Dev Client 재빌드**가 필요할 수 있음(dev-notes에 명시). 테스트에서는 모킹.
- git 작업은 하지 않는다(사용자 전담).

## 부록 2. QA 기준선 분석 반영 (qa-inspector 발견 → 반영 위치)
| # | qa-inspector 발견 | 반영 위치 |
|---|-------------------|-----------|
| 1 | 아바타용 Storage 버킷/정책이 기존 마이그레이션에 없음 → 이번 스프린트에 버킷 생성 + 정책(경로 첫 세그먼트=user_id) 포함 | §3.1 버킷·정책 SQL 계약 + **T10**(마이그레이션 작업) + P3 |
| 2 | Profile 라우트가 routes.ts/AppStackParamList에 미등록 → 등록 + Room 헤더 진입점 연결 | §4 진입점 + **T11**(Routes.Profile·AppStackParamList·AppNavigator·RoomTabs headerRight) + P8 |
| 3 | snake_case(`nickname`,`avatar_url`) ↔ camelCase(`nickname`,`avatarUrl`) 매핑 명시(useCreateRoom 패턴 준수) | §3.2 쿼리 + §3.3 훅(`avatar_url`→`avatarUrl`) + P1 |
| 4 | `nickname`/`avatar_url` NULL 초기 상태(빈 상태 UI) 엣지케이스 | §4 ProfileScreen(닉네임 빈 입력·Avatar 플레이스홀더) + §6 "빈 상태" + §3.3(0행→null/null) |
| 5 | 비용 가드레일: 업로드 전 리사이즈/압축(장변 1280px, JPEG q0.7) 명시 | §3.4(가드레일 정합 주석 — q0.7 동일 적용, 리사이즈는 1280 한도 이내 512×512로 더 강하게) + §8 + P7 |

> 참고(항목 5): 압축 품질은 architecture §6의 **q0.7을 그대로** 따른다. 리사이즈 한도만 아바타 특성에 맞춰 **512×512**로 더 엄격화했고, 이는 1280px 한도 **이내**라 가드레일을 충족한다(과대 업로드 방지로 오히려 절감 ↑). 1280px가 반드시 필요하다는 판단이면 team-lead 회신 시 즉시 조정 가능.
