# dev-notes-A — 그룹 A: 프로필 상태·닉네임 (#2·#3·#8)

스프린트: `sprint-20260624-prod-bugfix` / 담당: developer(그룹 A) / TDD·컨벤션 100% / git 미수행.

본인 spec 결과(그룹 A 파일셋만 실행, 전체 suite·tsc는 리더 통합):
- `src/features/profile` 13 suites / 91 tests — green
- 화면 spec(HomeHeader·LogList·LogScreen·NotifSettings·MuklogDetailRoute·ProfileScreen·AuthGate) + Avatar + room/logName — 전부 green
- 합계(그룹 A 관련) **22 suites / 254 tests green** (회귀 0)

---

## #2 닉네임/아바타 변경이 다른 화면에 반영 안 됨

### 근본원인
화면마다 **독립 `useProfile({ userId })` 인스턴스**를 마운트했다(HomeHeader / LogList useSelfDisplay / LogScreen / NotifSettings / MuklogDetailRoute / ProfileScreen 각자). `useProfile`은 진입 1회 조회 + 명시 `refresh()`만 재조회(폴링 없음·비용 가드레일). ProfileScreen에서 닉/아바타를 바꾸고 자기 인스턴스만 `refresh()` 하므로, 다른 화면 인스턴스는 옛 값을 그대로 들고 있어 반영이 안 됐다.

### 수정 — 공유 ProfileProvider(context) 단일 상태화 (MyLogsProvider 패턴 동일)
- 신설 `src/features/profile/ProfileProvider.tsx` — 트리 상위에서 `useProfile({ userId })` 1회 마운트, `{ state, refresh }`를 context 공유. `useProfileContext()` 제공(Provider 바깥 호출 시 throw).
- `src/navigation/AuthGate.tsx:38-52` — authenticated 분기에서 `<ProfileProvider userId>`로 `<MyLogsProvider>` 트리를 감싸 인증 사용자 전역 단일 마운트.
- 소비자 전부 `useProfile` → `useProfileContext`로 전환:
  - `src/navigation/HomeHeader.tsx:32-43`(HomeHeaderAvatar)
  - `src/navigation/screens/LogListScreen.tsx:49-61`(useSelfDisplay)
  - `src/navigation/screens/LogScreen.tsx:218`(meNickname/meAvatarUrl)
  - `src/navigation/screens/NotifSettingsScreen.tsx:38`(selfNickname/selfAvatarUrl)
  - `src/navigation/screens/MuklogDetailRoute.tsx:42`(meAvatarUrl)
  - `src/navigation/screens/ProfileScreen.tsx:89`(state/refresh — 저장·업로드 성공 후 이 **공유** refresh 호출 → 전 화면 동시 갱신)

### 생산자 ↔ 소비자 (QA 교차검증용)
- 생산자: `ProfileProvider`(단일 `useProfile` → profiles RLS select) / `ProfileScreen.handleSave·handleChangeAvatar`가 성공 후 공유 `refresh()` 호출.
- 소비자: HomeHeader 아바타 · LogList 카드/인사/CTA 닉 · LogScreen 헤더 이름 · NotifSettings 로그명 · MuklogDetail 본인 아바타 — 모두 같은 context state를 구독 → refresh 1회로 일괄 반영.
- 비용: 인스턴스 N개 → **1개**로 줄어 진입 조회 횟수도 감소(폴링 없음 유지).

---

## #3 닉네임 미설정 시 "나" → 동물명+숫자 (결정적 표시 폴백)

### 수정 — 신규 유틸 `defaultNickname({ userId })`
- 신설 `src/features/profile/defaultNickname.ts` — 한국어 동물명 20개(`ANIMAL_NAMES`: 수달·너구리·다람쥐…) + userId 결정적 해시(31진 다항·`|0`·`Math.abs`, avatarDefault와 동일 계열) → `동물명 + 4자리 숫자`(예 `수달2847`). **결정적**(같은 userId면 항상 동일) → 화면 간 신원 일관. throw 없음(빈/null/undefined도 안전). **표시 폴백일 뿐 persist 아님**(DB 저장/복원 없음).
- 단위테스트 `defaultNickname.spec.ts`(5 tests): 형식(동물명+4자리), 결정성, 분산, 빈/null 안전, 팔레트 한국어·다양성.

### 적용처 — `'나'`/`'닉네임 미설정'`/null 폴백 전부 교체
- `LogListScreen.useSelfDisplay`(`'나'` → `defaultNickname({ userId })`)
- `HomeHeader.HomeHeaderAvatar`(Avatar nickname prop null → defaultNickname)
- `LogScreen.meNickname`(`'나'` → defaultNickname)
- `ProfileScreen` 이름 표시(`'닉네임 미설정'` → defaultNickname)
- `NotifSettingsScreen.selfNickname`(null → defaultNickname → `displayLogName "{닉}의 기록"` 일관)
- `displayLogName`(`src/features/room/logName.ts`)는 **그대로 유지**: 호출부가 이미 비어있지 않은 닉을 주입하므로 내부 "내 로그/우리 로그" 안전망은 도달하지 않음(추가 변경 불요·회귀 0). userId 인자가 없는 순수 함수라 폴백 해석은 호출부(닉 보유 측) 책임.

> 참고: MuklogDetail **작성자 라벨**은 "내가 기록"/"짝꿍이 기록"/"탈퇴한 사용자"(닉 미표시)라 #3 무관 — 라벨 카피 그대로 유지(author.ts 불변).

---

## #8 프로필 이미지 변경 안 됨

### 조사 결과
- `changeAvatar`(`useUpdateProfile.ts`) 흐름 = 권한 → 피커(`mediaTypes:['images']`) → `processAvatarImage`(512·JPEG·0.7) → `fetch(uri).arrayBuffer()` → `storage.avatars.upload({uid}/{uuid}.jpg, upsert:false)` → `getPublicUrl` → `profiles.update({ avatar_url })` → 이전 파일 best-effort remove. 로직·매핑·에러 처리는 `useUpdateProfile.spec.ts`로 완전 검증(green).
- **업로드 메커니즘 자체는 정상**: 동일한 `fetch(localUri).arrayBuffer() + supabase.storage.upload` 패턴을 먹로그 사진 업로드(`uploadMuklogPhotos.ts`)가 그대로 쓰고 실기기에서 동작 → 피커·압축·업로드 경로는 결함 없음(반례).
- Storage 정책(`supabase/migrations/20260610120000_profile_avatars.sql`)도 정상: `avatars` public 버킷 + insert/update/delete own-only(첫 세그먼트=uid). 경로 규약은 `avatarPath.ts`와 단일 출처로 일치.

### 결론 — 사용자 체감 "안 바뀜"의 주원인 = #2 전파 문제
업로드는 성공하지만, 변경 후 홈으로 돌아오면 **HomeHeader가 자기 stale `useProfile`** 때문에 옛 아바타/이니셜을 계속 보여줘 "변경 안 됨"으로 보였다. **#2의 ProfileProvider 공유 상태로 해소** — ProfileScreen `changeAvatar` 성공 → 공유 `refresh()` → HomeHeader·LogList·MuklogDetail 본인 아바타까지 새 `avatar_url`로 일괄 갱신. ProfileScreen 자체는 기존에도 자기 refresh로 갱신됐고, 공유화 후에도 동일하게 즉시 반영(Image는 uuid URL 변경으로 자동 리로드).

### ⚠️ 라이브 정책 의존(사용자 전담 — 코드로 못 고침)
위 정책 마이그레이션이 **라이브 Supabase 프로젝트에 적용되어 있어야** 업로드가 RLS를 통과한다. 만약 실기기에서 여전히 아바타 업로드가 실패(인라인 "이미지 업로드에 실패했어요")한다면, 코드가 아니라 **버킷/정책 미적용**이 원인이다.
- 확인 사항(사용자): ① `avatars` 버킷 존재·public, ② `avatar_insert_own`/`avatar_update_own`/`avatar_delete_own` 정책 존재, ③ 경로 첫 세그먼트=`auth.uid()` 규약. 미적용이면 `20260610120000_profile_avatars.sql`을 `supabase db push` 또는 SQL 에디터로 실행(idempotent).
- 본 스프린트는 카테고리/스키마 변경이 없어 추가 배포 불요. **#8이 라이브 정책 미적용 케이스면 이 SQL 적용만 사용자 전담 작업.**

---

## 변경 파일 목록(그룹 A 파일셋)
신설: `src/features/profile/ProfileProvider.tsx`(+spec), `src/features/profile/defaultNickname.ts`(+spec)
수정: `src/features/profile/index.ts`(배럴 export), `src/navigation/AuthGate.tsx`(+spec), `src/navigation/HomeHeader.tsx`(+spec), `src/navigation/screens/LogListScreen.tsx`(+spec), `src/navigation/screens/LogScreen.tsx`(+spec), `src/navigation/screens/NotifSettingsScreen.tsx`(+spec), `src/navigation/screens/MuklogDetailRoute.tsx`(+spec), `src/navigation/screens/ProfileScreen.tsx`(+spec)
불변: `displayLogName`(logName.ts), `author.ts`, `Avatar.tsx`, `avatarDefault.ts`(다른 그룹/타 기능 파일 미접촉).

## 미완/위임
- #8 라이브 Storage 정책 적용 여부 검증 → **사용자 전담**(위 ⚠️).
- 디바이스 스모크(실제 피커·업로드·화면 간 전파 시각 확인) 권장 — context 전파/Image 리로드는 디바이스에서 최종 확인.
