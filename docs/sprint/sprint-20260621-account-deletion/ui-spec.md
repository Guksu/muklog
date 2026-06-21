# ui-spec — account-deletion (UI 절반: 탈퇴 행·확인 시트·NULL 작성자)

스프린트: `sprint-20260621-account-deletion` · 기능: 인앱 회원 탈퇴(Apple 5.1.1(v)) UI
범위: ProfileScreen "회원 탈퇴" 행(AC5) + 파괴 확인 시트(AC5) + 훅→signOut 배선(AC5) + NULL 작성자 비주얼 점검(AC6).
**비범위(developer 소유, 미손댐)**: `useDeleteAccount.ts` · Edge Function · 마이그레이션 · `author.ts` · dev-notes.

## 결과
- `npm test`: **144 suites / 1321 tests green**(기존 1306 → +15: DeleteAccountSheet 8 · ProfileScreen 회원탈퇴 6 · MuklogDetail NULL 1). 회귀 0.
- `tsc --noEmit`: **0 에러**.

## 디자인 출처 근거
회원 탈퇴는 **킷 비종속(앱 정책 UI)** — 킷 `templates/muklog`에 탈퇴 화면/시트 없음. 따라서 임의 디자인 대신
**기존 파괴 확인 시트 패턴을 재사용**한다:
- 확인 시트 = `src/features/room/LeaveLogSheets.tsx`(킷 `mk-log:204-217` danger 확인 패턴) + `MuklogDetailScreen` 삭제 시트와 동일 구조: `Sheet`(title) + 본문 카피 + `status-negative` danger `Pressable` + ghost 취소 `Button`.
- 토큰만 사용(raw hex 0). danger=`theme.color.negative`(#E5484D, 킷 status-negative), 글자=`negativeFg`, radius=`control`, 인라인 error=`error` 색.

## 1) "회원 탈퇴" 행 (AC5)

| 항목 | 값 | 근거 |
|---|---|---|
| 위치 | ProfileScreen 최하단, **로그아웃 행 아래**(scrollContent 끝) | plan §4 "로그아웃 아래" |
| 강조 | 로그아웃보다 **약하게** — 카드 없음, `variant="caption"` + `color="fgMuted"` + 언더라인. 로그아웃은 surface 카드 + `error`색 | plan §4 "negative, 약하게" |
| 동작 | 탭 → 확인 시트 open(`setDeleteSheetOpen(true)`). **즉시 삭제 절대 안 함** | plan §4 |
| 접근성 | `accessibilityRole="button"`, `accessibilityLabel="회원 탈퇴"` | — |
| 카피 | `회원 탈퇴` | plan §4 |

스타일(`ProfileScreen.tsx`): `deleteRow { paddingVertical:16, alignItems:'center' }`, `deleteLabel { textDecorationLine:'underline' }`.

## 2) 확인 시트 `DeleteAccountSheet` (AC5)

신규 파일: `src/features/profile/DeleteAccountSheet.tsx`(+ `.spec.tsx`). presentational — open/close·실행·signOut은 부모.

| 슬롯 | 카피/토큰 | 근거 |
|---|---|---|
| 제목(Sheet title) | `정말 탈퇴할까요?` | plan §4 |
| 본문 | `계정과 내 정보가 삭제돼요. 되돌릴 수 없어요.\n함께 만든 기록은 상대방에게 남아요.` (`bodySm`/`fgMuted`/center) | plan §4(되돌릴 수 없음 + 상대 보존) |
| danger 버튼 | `탈퇴하기` — bg `negative`, 글자 `negativeFg`, radius `control`, pad `spacing[14]` | LeaveLogSheets danger 패턴 |
| 취소 | `취소` — `Button variant="ghost" full` | LeaveLogSheets ghost 패턴 |
| 진행 중 | `deleting=true` → danger 비활성(`opacity 0.45`) + `ActivityIndicator(negativeFg)` + 탭 무시(이중 방어) | plan §3 "진행 중 버튼 비활성" |
| 실패 | `error` → danger 위 인라인(`error`색, testID `delete-account-error`) | plan §3 인라인 에러 |

### props 계약 (developer 참고 — 이미 ProfileScreen이 소비)
```
DeleteAccountSheetProps = {
  visible: boolean;
  onClose: () => void;        // 딤/취소 닫기
  onConfirm: () => void;      // "탈퇴하기" → 부모가 deleteAccount 실행
  deleting?: boolean;         // useDeleteAccount.loading
  error?: string | null;     // useDeleteAccount.error
}
```

## 3) 배선 (AC5) — ProfileScreen

`useDeleteAccount()`(developer 훅, 배럴 export) 소비. dev-notes §AC4 계약: 훅은 signOut 안 함 → **호출부 책임**.

```
handleConfirmDelete = async () => {
  try {
    await deleteAccount();   // 성공 시 true(실패는 throw)
    void signOut();          // useAuth().signOut → AuthGate unauthenticated → LoginScreen
  } catch {
    showToast({ message: '탈퇴에 실패했어요. 다시 시도해 주세요.', tone: 'neutral' });
    // + 시트 인라인 error(useDeleteAccount.error)도 동시 노출. 세션 유지 → 재시도.
  }
}
```
- 성공: `signOut()` → 화면 언마운트(시트 자동 소멸). 별도 시트 close 불필요.
- 실패: 세션 유지. 시트는 열린 채 인라인 error + 전역 토스트(2중 신호). danger 버튼은 `deleting` 동안 비활성.
- 진행 중: `deletingAccount`(loading) → 시트 danger 비활성(중복 호출 차단).

### RN 번역 메모(근사)
- **Toast tone 제약**: `ToastTone = 'neutral' | 'positive'` 2종뿐(킷 mkToast). 실패는 파괴 톤이 없어 `neutral`로 보내고, **파괴 강조는 시트 인라인 `error`색 텍스트가 담당**. (별도 'negative' 토스트 톤 추가는 토큰/Toast 컴포넌트 변경 필요 → 범위 밖.)

## 4) NULL 작성자 비주얼 (AC6) — 점검·정합

데이터 폴백은 developer가 `author.ts`(`deriveAuthorKind`/`authorAvatarUserId`/`DELETED_AUTHOR_LABEL='탈퇴한 사용자'`)로 배선 완료. **퍼블리셔는 비주얼 정합·크래시 0만 확인**(코드 무수정, 회귀 테스트만 보강).

| 소비처 | createdBy NULL 표시 | 검증 |
|---|---|---|
| `MuklogCard.tsx:49-55,166` | 라벨 "탈퇴한 사용자"(`fgMuted`/`meta`) + `Avatar(userId=null)` → 익명(🙂) 폴백 | MuklogCard.spec:81 기존 green |
| `MuklogDetailScreen.tsx:244-251,424-432` | 동일 라벨 + `authorIsMe=false → url=null, userId=null` → 익명 아바타. more 버튼은 `canManage`(작성자만) 미전달 → 미노출 | **신규** MuklogDetail.spec AC6 케이스(라벨 노출 + 내/짝꿍 라벨 부재 = null===null 오판 차단) |

- 크래시 0: `Avatar`는 url·userId 모두 null이면 익명 폴백(`Avatar.tsx` 4순위). 깨짐 없음.
- 비주얼 보정 불요: 기존 라벨 스타일(`meta`/`fgWeak|fgMuted`)이 "탈퇴한 사용자"에도 자연스럽게 적용됨(약톤). 추가 약화 불필요.

## 변경 파일
- 신규: `src/features/profile/DeleteAccountSheet.tsx` · `DeleteAccountSheet.spec.tsx`
- 수정: `src/features/profile/index.ts`(배럴 export) · `src/navigation/screens/ProfileScreen.tsx`(행+시트+배선) · `ProfileScreen.spec.tsx`(AC5 6케이스 + useDeleteAccount 모킹) · `MuklogDetailScreen.spec.tsx`(AC6 NULL 1케이스)
- 무수정(developer 소유): `useDeleteAccount.ts` · `author.ts` · `MuklogCard.tsx` · `MuklogDetailScreen.tsx`(이미 author 헬퍼 배선됨) · Edge Function · 마이그레이션

## qa-visual 대조 포인트
- 확인 시트 카피 4종(제목/본문 2줄/탈퇴하기/취소)이 plan §4와 자구 일치.
- danger 버튼이 `negative`(#E5484D), 취소가 ghost — LeaveLogSheets danger 시트와 동일 시각.
- 회원 탈퇴 행이 로그아웃보다 **약함**(caption/fgMuted/언더라인 vs surface카드/error).
- NULL 작성자가 MuklogCard·MuklogDetail에서 "탈퇴한 사용자" + 익명 아바타(크래시 0).
