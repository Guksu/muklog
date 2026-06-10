# Dev Notes — 프로필 편집 (profile)

> 구현: developer. 입력: `plan.md`. 산출: 아래 코드 + 본 노트. QA 교차검증용 "생산자↔소비자" 매핑 포함.
> 완료 기준 달성: **`npm test` 16 suites / 112 tests 전부 green**, **`npx tsc --noEmit` exit 0**. (실행일 2026-06-10)

---

## 1. TDD 진행 요약 (Red→Green→Refactor)

작업 순서는 plan §5: 순수 유틸(T2~T4) → 훅(T5~T7) → 컴포넌트/화면(T8~T9) → Storage SQL(T10) → 네비(T11) → 배럴(T12).
각 모듈은 실패 테스트 작성(Red) → 최소 구현(Green) → 컨벤션 정리(Refactor) 사이클로 진행했고, 모듈 완성 시점마다 qa-inspector에 incremental 교차검증을 요청했다(2회 발신).

신규 테스트(프로필 한정): nickname 6 · errors 11 · image 3 · avatarPath 9 · useProfile 5 · useUpdateProfile 9 · Avatar 4 · ProfileScreen 9 · ProfileHeaderButton 2 = **58 cases** (전체 누적 112).

---

## 2. 변경/신규 파일 목록

### 신규 — feature `src/features/profile/`
| 파일 | 역할 | 테스트 |
|------|------|--------|
| `nickname.ts` | `validateNickname` + `NICKNAME_MIN/MAX_LENGTH` (T2) | `nickname.spec.ts` |
| `errors.ts` | `mapProfileError` · `ProfileErrorToken` · `PROFILE_ERROR_MESSAGES` · `DEFAULT_PROFILE_ERROR_MESSAGE` (T3) | `errors.spec.ts` |
| `image.ts` | `processAvatarImage` · `AVATAR_SIZE=512` · `AVATAR_COMPRESS=0.7` (T4) | `image.spec.ts` |
| `avatarPath.ts` | `AVATARS_BUCKET` · `buildAvatarPath` · `parseAvatarPath` · `createAvatarFileId` (경로 단일출처) | `avatarPath.spec.ts` |
| `useProfile.ts` | 조회 훅 `useProfile({userId})` → `{state, refresh}` (T5) | `useProfile.spec.ts` |
| `useUpdateProfile.ts` | 수정 훅 `useUpdateProfile({userId})` → `{saveNickname, changeAvatar, savingNickname, uploadingAvatar, error}` (T6·T7) | `useUpdateProfile.spec.ts` |
| `index.ts` | feature 공개 배럴 (T12) | — |

### 신규 — 컴포넌트/화면/네비
| 파일 | 역할 |
|------|------|
| `src/components/Avatar.tsx` | 원형 아바타(url→Image / null→이니셜·플레이스홀더) (T8) + `Avatar.spec.tsx` |
| `src/navigation/screens/ProfileScreen.tsx` | 프로필 편집 화면 (T9) + `ProfileScreen.spec.tsx` |
| `src/navigation/ProfileHeaderButton.tsx` | RoomTabs 헤더 우측 진입 버튼 (T11) + `ProfileHeaderButton.spec.tsx` |
| `supabase/migrations/20260610120000_profile_avatars.sql` | avatars 버킷 + storage 정책 (T10) |

### 수정 — 기존 파일
| 파일 | 변경 |
|------|------|
| `src/components/index.ts` | `Avatar` export 추가 |
| `src/navigation/routes.ts` | `Routes.Profile` + `AppStackParamList[Profile]` 추가 |
| `src/navigation/AppNavigator.tsx` | `Profile` 스택 화면 등록(headerShown:true, title "프로필", 토큰 헤더 스타일) |
| `src/navigation/RoomTabs.tsx` | `screenOptions.headerRight = () => <ProfileHeaderButton/>` |
| `package.json` | `expo-image-picker@~16.0.6`, `expo-image-manipulator@~13.0.6` (`npx expo install`) |
| `app.json` | `expo-image-picker` 플러그인 + `photosPermission`(iOS NSPhotoLibraryUsageDescription 한국어) |

> **profiles 테이블/컬럼/RLS는 변경 없음** — invite-room(20260609120000)에서 이미 생성. 이번엔 `nickname`/`avatar_url` 값 편집만.

---

## 3. 계약 shape (생산자 ↔ 소비자 매핑)

> QA(integration-qa) 교차검증용. 각 경계는 plan §7의 P1~P10에 대응.

| # | 생산자(쓰기/응답) | 소비자(읽기/호출) | 계약 |
|---|---|---|---|
| **P1** | `from('profiles').select('nickname, avatar_url').eq('id',userId).maybeSingle()` (snake) | `useProfile` → `state.profile {nickname, avatarUrl}` (camel) | `avatar_url`→`avatarUrl` 매핑, 0행→`{null,null}`, error→`{status:'error'}`(자체 한국어 메시지, 토큰 없음) |
| **P2** | `from('profiles').update({nickname}).eq('id',userId)` (own-only RLS) | `useUpdateProfile.saveNickname` | trim된 값 저장, `userId=auth.uid()` |
| **P3** | `storage.from('avatars').upload('{userId}/{uuid}.jpg', body, {contentType:'image/jpeg', upsert:false})` | SQL `avatar_insert_own`(첫 세그먼트=uid) | 경로 첫 세그먼트=uid 일치 → 정책 통과. `buildAvatarPath`가 단일 출처 |
| **P4** | `storage.getPublicUrl(path).data.publicUrl` | `update({avatar_url})` 저장 + `Avatar` 렌더 | 저장값=공개 URL 문자열, `Avatar`가 그 URL로 Image. uuid 파일명 → 교체 시 URL 변경=CDN 캐시 무효화 |
| **P5** | `validateNickname({raw})` → ok{value} \| false{reason} | `ProfileScreen`(저장 disabled+인라인) + `saveNickname`(2차 검증) | 검증 실패 시 update 미호출, 메시지=토큰 매핑 |
| **P6** | 토큰: `NICKNAME_EMPTY`/`NICKNAME_TOO_LONG`/`PERMISSION_DENIED`/`AVATAR_UPLOAD_FAILED` | `mapProfileError` ↔ 화면 | 토큰 1:1, 미일치=`DEFAULT_PROFILE_ERROR_MESSAGE` |
| **P7** | `processAvatarImage`(512·JPEG·0.7) → `fetch(uri).arrayBuffer()` | `upload`의 fileBody | **처리본만 업로드**(원본 직업로드 0) — 비용 가드레일 |
| **P8** | `Routes.Profile` + `AppStackParamList[Profile]` + AppNavigator 등록 | `ProfileHeaderButton` `navigation.navigate(Routes.Profile)` | 라우트 상수·타입·등록 일치, tsc 통과 |
| **P9** | `userId`(AuthProvider authenticated → `useAuth().state.userId`) | `useProfile`/`useUpdateProfile` 입력 + Storage 경로 첫 세그먼트 | 동일 uid |
| **P10** | 직전 `avatar_url` → `parseAvatarPath` → oldPath | 교체 성공 후 `storage.remove([oldPath])` (best-effort) | 이전 파일 정리(누적 방지), 실패 무시 |

### 훅 시그니처(최종)
```ts
useProfile({ userId }): { state: ProfileState; refresh: () => Promise<void> }
//   ProfileState = {status:'loading'} | {status:'ready', profile:{nickname:string|null, avatarUrl:string|null}} | {status:'error', message:string}

useUpdateProfile({ userId }): {
  saveNickname: ({ nickname }: { nickname: string }) => Promise<void>;  // 검증→update. 실패 시 error 세팅 후 throw
  changeAvatar: () => Promise<void>;                                    // 권한→피커→처리→업로드→update→이전파일 정리. 실패 시 error 세팅 후 throw, 취소는 no-op(resolve)
  savingNickname: boolean;
  uploadingAvatar: boolean;
  error: string | null;   // 한국어 메시지(mapProfileError) 또는 null
}
```

### `changeAvatar()` 실제 호출 순서
1. `ImagePicker.requestMediaLibraryPermissionsAsync()` — `!granted` → `PERMISSION_DENIED` 세팅 + throw(업로드 0회).
2. `ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 })` — `canceled` → **no-op return**(에러 없음).
3. `uploadingAvatar=true` → `from('profiles').select('avatar_url')...maybeSingle()`로 **oldPath 파싱**(정리용, 교체 시 1 read).
4. `processAvatarImage({ uri })` → `fetch(processed.uri).arrayBuffer()`.
5. `storage.upload('{userId}/{uuid}.jpg', body, {contentType:'image/jpeg', upsert:false})` — 실패 → `AVATAR_UPLOAD_FAILED` + 새 파일 best-effort remove.
6. `getPublicUrl(path)` → `update({avatar_url})` — 실패 → `AVATAR_UPLOAD_FAILED` + 새 파일 정리.
7. 성공 → oldPath 있으면 `remove([oldPath])` best-effort.

---

## 4. 설계 결정/메모 (계획 대비 차이·근거)

1. **에러 토큰 4종 + 기본 메시지** — plan §3.6은 "토큰 5종"이라 적었으나 5번째 "(네트워크/그 외)"는 토큰이 아니라 fallback이므로 `DEFAULT_PROFILE_ERROR_MESSAGE`로 구현. `PROFILE_ERROR_MESSAGES` 키는 4개(`NICKNAME_EMPTY`/`NICKNAME_TOO_LONG`/`PERMISSION_DENIED`/`AVATAR_UPLOAD_FAILED`). → QA에 사전 공유 완료.
2. **useProfile error 메시지** — 조회 실패는 토큰이 없으므로 `mapProfileError`를 거치지 않고 자체 한국어 메시지("프로필 조회에 실패했어요. 다시 시도해 주세요.")를 사용(useMembership과 동일 패턴).
3. **oldPath 파싱용 select 1회 추가** — `changeAvatar()`는 contract 시그니처가 `() => Promise<void>`(인자 없음)라 이전 avatar_url을 자체 조회해야 P10(이전 파일 정리)을 수행. 교체 시 1 read 추가 — 폴링이 아니라 교체 액션당 1회이므로 비용 가드레일(§8) 위배 아님.
4. **RN 업로드 방식** — `fetch(localUri).then(r => r.arrayBuffer())`로 처리본을 읽어 업로드(Supabase RN 공식 권장). expo-file-system 의존 추가 없음.
5. **저장 버튼 활성 조건** — `검증 통과 && 변경됨 && !저장중`. 기존값과 동일하면 비활성(불필요 쓰기 방지, plan §6의 dev 결정 항목).
6. **uuid 생성** — `createAvatarFileId()` = `${Date.now()}-${random}` (충돌 무시 가능 수준). expo-crypto 의존 회피.
7. **mediaTypes** — SDK 52 신 API의 배열형 `['images']` 사용(`MediaTypeOptions` deprecated 회피).
8. **헤더 진입(새 탭 금지)** — `RoomTabs.screenOptions.headerRight`에 `ProfileHeaderButton`. 버튼은 부모 스택의 `Routes.Profile`로 `navigate`. AppNavigator Profile 화면은 `headerShown:true`로 뒤로가기 제공.

---

## 5. 마이그레이션 적용 안내 (사용자 환경 — git/원격 적용은 사용자 몫)

`supabase/migrations/20260610120000_profile_avatars.sql`는 **재실행 가능(idempotent)**. 적용:

```bash
# 방법 A) supabase CLI
supabase db push

# 방법 B) Supabase 대시보드 → SQL Editor에 파일 내용 붙여넣기 실행
```

내용: `avatars` 버킷(public=true) 생성 + `storage.objects`에 insert/update/delete 정책 3종(`bucket_id='avatars' AND (storage.foldername(name))[1]=auth.uid()::text`). 읽기는 public 버킷이라 별도 select 정책 없음.

### 네이티브 의존성
`expo-image-picker`/`expo-image-manipulator`는 네이티브 모듈 → **Dev Client 재빌드 필요**:
```bash
npx expo prebuild        # app.json 플러그인(권한) 반영
npx expo run:ios         # 또는 run:android
```
`app.json`에 `expo-image-picker` 플러그인 + iOS `photosPermission` 문구를 추가해 두었다(Android는 런타임 권한).

---

## 6. 디바이스 스모크 절차 (단위 대상 아님 — SQL/Storage/네이티브)

마이그레이션 적용 + Dev Client 재빌드 후:
1. 앱 진입 → RoomTabs 헤더 우측 "프로필" → ProfileScreen 진입(뒤로가기 동작).
2. 닉네임 입력(1~20자) → 저장 → 재진입 시 유지(`profiles.nickname` 갱신 확인).
3. "사진 변경" → 갤러리 선택 → 업로드 → 아바타 즉시 반영. Storage `avatars/{uid}/...jpg` 생성 + `avatar_url`=공개 URL 확인.
4. 재진입/앱 재실행 후에도 아바타 유지(공개 URL 렌더).
5. 아바타 재교체 → 이전 파일이 사라지는지(best-effort remove) 확인.
6. 권한 거부 → "사진 접근 권한이 필요해요..." 메시지. 피커 취소 → 변화 없음.
7. (가드레일) 업로드 파일이 512×512 JPEG 수준인지(원본 대용량이 그대로 올라가지 않는지) 확인.

---

## 7. 미완/후속 (Out-of-scope 유지)
- 파트너(상대) 프로필 표시 — `profiles` RLS own-only 유지(추후 SECURITY DEFINER helper).
- 아바타 제거(avatar_url→NULL), 크롭/줌 에디터, 카메라 촬영 입력 — 다음 스프린트.
- 닉네임 그래핌/이모지 길이 정규화 — JS `.length` 기준 유지(MVP).
