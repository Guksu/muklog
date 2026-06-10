# QA Report — 프로필 편집 (profile)

> 검증자: qa-inspector · 방식: 경계면 교차검증(생산자↔소비자 양쪽 동시 읽기) + TDD/컨벤션/가드레일 점검
> 입력: `plan.md`, `dev-notes.md`, 소스 전체 · 출력: 본 문서
> 검증일: 2026-06-10 · 방식: incremental QA 2회(T2~T4, T5~T7) + 최종 전체 QA

---

## 0. 종합 판정 — ✅ PASS (모든 인수조건 통과, 미해결 이슈 0)

| 항목 | 결과 |
|------|------|
| `npm test` | ✅ **16 suites / 112 tests green** |
| `npx tsc --noEmit` | ✅ **exit 0** |
| 코드 컨벤션(`docs/code-convention.md`) | ✅ 위반 0 (useCallback/useMemo·export function·인라인 useEffect·raw hex 0건) |
| 경계면 정합(P1~P10) | ✅ 전부 일치 |
| 비용 가드레일(§8) | ✅ 충족 |
| 발견 이슈 | ISSUE-1(Avatar tsc) — **해결됨** / 미해결 0 |

---

## 1. 인수조건별 판정 (plan §5 T1~T12)

| # | 인수조건 | 판정 | 근거(대응 테스트/파일) |
|---|----------|------|----------------------|
| T1 | expo-image-picker/manipulator 추가 + import 가능 | ✅ PASS | `package.json:37-38`(~13.0.6/~16.0.6), `app.json` plugin+photosPermission. 실 설치/네이티브 빌드는 사용자 환경(dev-notes §5 명시) |
| T2 | validateNickname trim·1~20·empty/too-long | ✅ PASS | `nickname.spec.ts` 경계 0/1/20/21·공백·trim |
| T3 | mapProfileError 토큰 4종 + fallback | ✅ PASS | `errors.spec.ts` 토큰별·포함매칭·fallback·타입추출, "4키" 단언 |
| T4 | processAvatarImage 512·JPEG·0.7 | ✅ PASS | `image.spec.ts` manipulate 호출인자 단언 |
| T5 | useProfile loading→ready(snake→camel)/0행 null/error/refresh | ✅ PASS | `useProfile.spec.ts` 5분기 |
| T6 | saveNickname 검증실패=update 0회 / 통과=trim값 update | ✅ PASS | `useUpdateProfile.spec.ts` (update payload `{nickname:'새닉'}` 단언) |
| T7 | changeAvatar 권한/취소/성공순서/업로드실패/URL실패 | ✅ PASS | `useUpdateProfile.spec.ts` 5경로 |
| T8 | Avatar url→Image / null→이니셜·플레이스홀더 | ✅ PASS | `Avatar.spec.tsx` 4분기(url·이니셜·빈상태·trim) |
| T9 | ProfileScreen prefill·검증disabled·사진변경·에러·저장후refresh | ✅ PASS | `ProfileScreen.spec.tsx` 8케이스 |
| T10 | Storage avatars 버킷(public) + insert/update/delete 정책(첫세그=uid) | ✅ PASS(계약) | `20260610120000_profile_avatars.sql` §3.1과 일치. 실 RLS 적용은 스모크 경계(§3 참조) |
| T11 | Routes.Profile·ParamList·AppNavigator 등록·헤더진입·tsc | ✅ PASS | `routes.ts`, `AppNavigator.tsx`, `RoomTabs.tsx`, `ProfileHeaderButton.spec.tsx`, tsc 0 |
| T12 | index.ts 공개표면 + npm test 통과 | ✅ PASS | `features/profile/index.ts` 전 심볼 export, 112 green |

---

## 2. 경계면 교차검증 (P1~P10) — 생산자↔소비자 양쪽 동시 읽기

| # | 생산자 | 소비자 | 판정 | 핵심 확인 |
|---|--------|--------|------|----------|
| P1 | `select('nickname, avatar_url').eq('id',userId).maybeSingle()` | `useProfile`→`{nickname, avatarUrl}` → ProfileScreen/Avatar | ✅ | `avatar_url`→`avatarUrl` 매핑, 0행→`{null,null}`, error→자체 한국어 메시지(토큰 도메인 아님 — 의도 확인) |
| P2 | `update({nickname}).eq('id',userId)` (own-only RLS) | `saveNickname` | ✅ | **trim된 value** 저장(테스트 load-bearing), userId=auth.uid() |
| P3 | `upload('{userId}/{uuid}.jpg', …)` | SQL `(storage.foldername(name))[1]=auth.uid()::text` | ✅ | 경로 첫 세그먼트=uid가 정책과 정확 일치, `buildAvatarPath` 단일 출처(`AVATARS_BUCKET='avatars'` ↔ SQL 버킷명) |
| P4 | `getPublicUrl(path).data.publicUrl` | `update({avatar_url})` + `Avatar` Image | ✅ | 공개 URL 문자열 저장, Avatar가 그 URL로 렌더, uuid 파일명→CDN 캐시 무효화 |
| P5 | `validateNickname` ok/empty/too-long | ProfileScreen(disabled+인라인) + saveNickname(2차) | ✅ | 검증 실패 시 update 미호출, 메시지=토큰 매핑 일치 |
| P6 | 토큰 4종 | `mapProfileError` ↔ 화면 | ✅ | 토큰 1:1, 미일치=`DEFAULT_PROFILE_ERROR_MESSAGE`, 화면 표시 경로 정합 |
| P7 | `processAvatarImage`(512·JPEG·0.7)→`fetch().arrayBuffer()` | `upload` fileBody | ✅ | **처리본만 업로드**(원본 직업로드 0) — 비용 가드레일 |
| P8 | `Routes.Profile`+`AppStackParamList`+AppNavigator 등록 | `ProfileHeaderButton.navigate(Routes.Profile)` | ✅ | 상수·타입·등록 일치, `NavigationProp<AppStackParamList>` 타입, tsc 0 |
| P9 | `useAuth().state.userId`(authenticated) | useProfile/useUpdateProfile 입력 + Storage 경로 | ✅ | 조회·수정·경로 첫 세그먼트 동일 uid |
| P10 | 직전 `avatar_url`→`parseAvatarPath`→oldPath | 교체 성공 후 `remove([oldPath])` | ✅ | **update 성공 후에만** 이전 파일 정리(실패 시 기존 보존=데이터 손실 0), best-effort 실패 무시 |

---

## 3. 미검증 항목 (테스트 경계상 정상 — `docs/testing-strategy.md` 준수)

> "통과"가 아니라 단위 테스트 경계 밖이라 **모킹/계약 검증 + 디바이스 스모크로 분리**된 항목. dev-notes §6에 스모크 절차 문서화됨.

| 항목 | 검증 수준 | 비고 |
|------|----------|------|
| Storage RLS 정책 실제 강제(타 uid 폴더 쓰기 거부) | 계약 점검 ✅ / 실 DB 미적용 | `db push` 또는 대시보드 적용 후 스모크(dev-notes §5·§6) |
| expo-image-picker/manipulator 네이티브 동작 | 모킹 ✅ / 디바이스 미수행 | Dev Client 재빌드 후 스모크 |
| `fetch(file://uri).arrayBuffer()` 실제 파일 읽기 | 모킹 ✅ / 디바이스 미수행 | Supabase RN 공식 권장 방식, 스모크 대상 |
| app.json 플러그인 네이티브 반영 | 설정 점검 ✅ / 빌드 미수행 | 사용자 환경 의존 |

---

## 4. 발견 이슈 및 해결 이력

| ID | 단계 | 내용 | 위치 | 상태 |
|----|------|------|------|------|
| ISSUE-1 | incremental QA #2 | `tsc` 실패 — `base:ViewStyle`을 `<Image>`에 적용(overflow 유니온 불일치) | `Avatar.tsx:46` | ✅ **해결**(developer가 `base as ImageStyle` 캐스트 + 주석으로 수정, 최종 tsc exit 0 확인) |

**developer 질의 3건 회신(모두 수용/확정):**
1. useProfile error가 mapProfileError 미경유(자체 한국어 메시지) → 의도 맞음(조회는 토큰 도메인 아님, §3.6은 검증/업로드/권한 한정).
2. `fetch().arrayBuffer()` RN 업로드 → 권장 방식, 디바이스 스모크 대상.
3. oldPath용 select +1 read → 폴링 아닌 교체 액션당 1회라 §8 위배 아님(수용).

---

## 5. 비용 가드레일 체크 (§8)

- ✅ AWS 미사용 — Supabase(Postgres + Storage `avatars` + 익명 Auth)만.
- ✅ 이미지 리사이즈/압축 — `processAvatarImage` 512×512 + JPEG q0.7, **원본 직업로드 0**(P7).
- ✅ 이전 아바타 best-effort 삭제 — Storage 누적 방지(P10).
- ✅ 조회 최소화 — 진입 1회 + 성공 후 refresh만, 폴링/Realtime 0(useProfile effect `[userId]` 의존).
- ✅ 공개 버킷 CDN + uuid 파일명 캐시 무효화.

---

## 6. TDD / 컨벤션 점검

- ✅ 인수조건마다 대응 테스트 존재(§1 표). 경계·실패 경로 충실(빈/공백/21자, 권한거부/취소/업로드실패/URL갱신실패, 0행/error).
- ✅ 테스트 load-bearing: 핵심 단언이 구체값(trim된 닉네임 `'새닉'`, 경로 `'u1/fixed.jpg'`/`'u1/old.jpg'`, snake→camel, 한국어 메시지)이라 drift 시 적색.
- ✅ 단위 경계 준수: 유틸/훅/화면=테스트, SQL/Storage/네이티브 SDK=모킹·스모크 분리.
- ✅ 컨벤션 전수(grep): useCallback/useMemo 실호출 0, export function 0, 인라인 useEffect 0(`syncNicknameDraft`/`loadProfileOnUser` 명명), enum-style `ProfileErrorToken as const`, named-object 인자, raw hex 0.

---

## 7. 결론

profile 스프린트의 **모든 인수조건(T1~T12) 통과**, **경계면 P1~P10 정합**, **미해결 이슈 0**. 단위/통합 레벨에서 스프린트 완료 기준 충족.

**잔여(사용자 환경 작업, 비차단):** 마이그레이션 적용(`db push`/대시보드) + Dev Client 재빌드 후 dev-notes §6 디바이스 스모크 수행 권장(Storage RLS·네이티브 피커·실 업로드 검증).
