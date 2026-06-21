# dev-notes — sprint-20260621-profile-fidelity

프로필 화면을 킷 `mk-log.jsx` ProfileScreen(527-622)에 정합(6건). **사진 소스 시트(S5b)는 미터치.**

## 변경 파일

| 파일 | 변경 |
|------|------|
| `src/features/profile/profileStats.ts` | `spotCount` = `Σ logs.spotCount`(킷 totalSpots). `SPOT_COUNT_UNAVAILABLE`(null) 제거, 타입 `spotCount: number`(non-null). |
| `src/features/profile/profileStats.spec.ts` | 합계(3+2→5)·빈배열(0)·Σ 검증으로 갱신(기존 null 기대 제거). |
| `src/features/profile/index.ts` | `SPOT_COUNT_UNAVAILABLE` export 제거. |
| `src/features/profile/useUpdateProfile.ts` | `changeAvatar`가 `Promise<{ changed: boolean }>` 반환 — 취소=`{changed:false}`, 업로드 성공=`{changed:true}`, 실패=throw(불변). |
| `src/features/profile/useUpdateProfile.spec.ts` | 취소·성공 케이스에 반환값(`{changed}`) 단언 추가. |
| `src/navigation/screens/ProfileScreen.tsx` | 설정행 2행화·pencil·이용안내 토스트·닉/사진 토스트·즉시 로그아웃. (아래 상세) |
| `src/navigation/screens/ProfileScreen.spec.tsx` | 2행·pencil·이용안내 토스트·닉/사진 토스트 3분기·통계 실값·즉시 로그아웃(Alert 없음)으로 갱신. |

## 작업 6건 상세

1. **설정행 2행화**: `SETTINGS_ROWS`를 discriminated union(`SettingsRow`)으로 리팩터 — `{kind:'navigate', route}` | `{kind:'toast', toastMessage}`. "설정"(IconName.Setting) 행 삭제 → 2행(알림 설정·이용 안내). `RowKind` enum-style `as const`.
2. **닉네임 편집 아이콘**: `IconName.Setting` → `IconName.Pencil`(색 `fgWeak` 유지, 킷 569).
3. **이용 안내 토스트**: toast 행 탭 → `showToast({ message:'조금만 기다려 주세요', tone:'neutral' })`. navigate 행(알림설정→NotifSettings) 불변.
4. **통계 실값**: `computeProfileStats.spotCount` = `logs.reduce((s,l)=>s+l.spotCount,0)`. ProfileScreen 통계 "기록한 맛집"이 실숫자(미준비 시 빈 배열→0). "-" 폴백 제거.
5. **닉네임 변경 토스트**: `handleSave` 성공(saveNickname+refresh 완료) 시 `showToast({message:'닉네임을 변경했어요', tone:'positive'})`. catch면 미노출.
6. **사진 변경 토스트**: `changeAvatar` 반환 `{changed}` 3분기 — `changed:false`(취소)면 early return(refresh·토스트 없음), `changed:true`면 refresh 후 `showToast({message:'프로필 사진을 변경했어요', tone:'positive'})`, throw(실패)면 catch(토스트 없음).
7. **즉시 로그아웃**: `handleSignOut` → `void signOut()` 직접. `Alert` import 제거(미사용).

## 계약(생산자 ↔ 소비자)

- **computeProfileStats**(생산자: profileStats.ts) → **ProfileScreen stats[1].value**(소비자). shape: `{ logCount:number, coupleCount:number, spotCount:number }`. spotCount는 `MyLog.spotCount`(useMyLogs, S2 집계) 합산 — 라이브 마이그레이션 미적용 시 spotCount=0 → 합계 0(안전, 거짓 아님).
- **changeAvatar**(생산자: useUpdateProfile) → **handleChangeAvatar**(소비자: ProfileScreen). 반환 `{ changed: boolean }`. 유일 소비처가 ProfileScreen이라 동시 수정으로 회귀 0.
- **showToast**(생산자: ToastProvider `useToastController`) ← 소비: handleSave/handleChangeAvatar/이용안내 행. tone: 닉/사진=`positive`, 이용안내=`neutral`(킷 539·545·586).

## 회귀 0 근거

- `changeAvatar` 반환 확장: 유일 소비처 ProfileScreen 동시 수정(타 호출처 없음 — grep 확인). 기존 취소/성공/실패 흐름 동작 불변(반환값만 추가).
- `SPOT_COUNT_UNAVAILABLE` 제거: src 내 유일 참조가 ProfileScreen 주석(재작성)뿐 — 코드 참조 0.
- 알림설정 navigate 동작 불변(타입만 `keyof AppStackParamList`→리터럴 `typeof Routes.NotifSettings`로 narrow, navigate가 리터럴 라우트명 요구하므로 — 런타임 동일).
- 토스트는 실제 ToastProvider(renderWithTheme 기본 포함)로 통합 검증 — 메시지 텍스트 노출/미노출로 단언.

## 테스트/tsc 결과

- `npm test`: **140 suites / 1277 tests green**.
- `npx tsc --noEmit`: **0 에러**.
- 관련 신규/갱신 단언: profileStats(합계·빈배열·Σ), useUpdateProfile(changed 반환), ProfileScreen(2행·"설정"부재·pencil·이용안내 토스트·통계 5·닉토스트±·사진토스트 3분기·즉시 로그아웃 Alert 미호출).

## 미완/주의

- ProfileScreen 토스트 테스트에서 Toast 애니메이션 타이머의 act() 경고가 콘솔에 뜨나(기존 Toast 패턴 공통) 테스트는 green — 동작 영향 없음.
- 사진 소스 선택 시트·카메라·기본이미지 복원은 S5b(미터치).
- 통계 실값은 라이브에서 S2 spot_count 마이그레이션 적용 전제(미적용 시 0 합계, 안전 폴백) — 마이그레이션은 사용자 전담.
