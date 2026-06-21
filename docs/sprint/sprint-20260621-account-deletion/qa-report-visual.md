# qa-report-visual — account-deletion (비주얼 충실도 검증)

스프린트: `sprint-20260621-account-deletion` · 검증 범위: 회원 탈퇴 행(AC5)·확인 시트(AC5)·진행/실패 상태·NULL 작성자 표시(AC6)
검증자: qa-visual · 디자인 출처: **킷 비종속(앱 정책 UI)** → 기존 파괴 패턴(`LeaveLogSheets`·`MuklogDetail` 삭제 시트) 일관성 기준
방식: 레퍼런스 파괴 시트 ↔ 신규 시트를 같이 열어 3축(레이아웃·토큰·카피) 교차검증. 토큰 경유는 raw-hex 전수 스윕.

## 종합 판정: **통과 (PASS)** — 불일치 0, 근사 허용 0(추가), 미검증 0

기존 파괴 시트 패턴과 시각·토큰·카피가 일관하며, 카피 자구는 plan §4와 완전 일치. raw hex 0. NULL 작성자 경로는 크래시 없이 익명 폴백. 비주얼 수정 요청 없음.

---

## 1) 회원 탈퇴 행 (AC5) — 통과

| 검증 항목 | 결과 | 근거 |
|---|---|---|
| 위치: 프로필 최하단, 로그아웃 행 아래 | ✅ | `ProfileScreen.tsx:334-343` — 로그아웃 행(`:307-324`)·error 텍스트(`:326-330`) 다음, scrollContent 끝 |
| 로그아웃보다 **약하게** | ✅ | 탈퇴=카드 없는 텍스트 행 `variant="caption"`+`color="fgMuted"`+언더라인(`:340`, style `deleteLabel:408`). 로그아웃=surface 카드+`shadow.card`+`color="error"`+`fontSize 15`(`:321,404-405`). 강조 대비 명확 |
| 카드 톤(약톤) | ✅ | caption(12px)/fgMuted(`palette.neutral[70]`)는 일반 액션보다 낮은 시각 위계 |
| 즉시 삭제 아님(시트 경유) | ✅ | `onPress={() => setDeleteSheetOpen(true)}`(`:337`) — 삭제 호출 없음, 시트만 open |
| 접근성 | ✅ | `accessibilityRole="button"`·`accessibilityLabel="회원 탈퇴"`(`:335-336`), pressed opacity 0.5 |
| 카피 자구 "회원 탈퇴" | ✅ | `:341` |

## 2) 확인 시트 `DeleteAccountSheet` (AC5) — 통과

레퍼런스 `LeaveLogSheets.tsx:88-141`(danger 확인 시트)와 동일 구조로 번역됨. 같은 `Sheet` 프리미티브(`title` 슬롯 + 핸들바 + children) 사용.

| 검증 항목 | 결과 | 킷/레퍼런스 ↔ RN |
|---|---|---|
| 구조: Sheet(title) + 본문 + danger Pressable + ghost 취소 | ✅ | `DeleteAccountSheet.tsx:48-102` ↔ `LeaveLogSheets.tsx:88-141` 1:1 대응 |
| danger 버튼 = negative 토큰 | ✅ | `backgroundColor: theme.color.negative`(`:78`, =`#E5484D` 킷 status-negative, tokens.ts:108-109), 글자 `color="negativeFg"`(`:88`) |
| radius = control | ✅ | `borderRadius: theme.radius.control`(`:79`, =14, tokens.ts:158) — raw 숫자 아님 |
| 패딩 = spacing[14] | ✅ | `paddingVertical: theme.spacing[14]`(`:80`) — 4px 그리드 경유 |
| 취소 = ghost Button(full) | ✅ | `variant="ghost" full`(`:93-100`) ↔ LeaveLogSheets:132-139 동일 |
| 버튼 간격 spacing[10] | ✅ | `View gap: theme.spacing[10]`(`:66`) ↔ LeaveLogSheets:105 동일 |
| 본문 약톤·중앙정렬 | ✅ | `variant="bodySm" color="fgMuted"` + `styles.body textAlign:center`(`:49-55,107`) ↔ LeaveLogSheets:89-95 동일 |

### 카피 자구 (plan §4 ↔ RN) — 전부 일치
- 제목: `정말 탈퇴할까요?` — `TITLE`(`:14`) ✅
- 본문: `계정과 내 정보가 삭제돼요. 되돌릴 수 없어요.\n함께 만든 기록은 상대방에게 남아요.` — `BODY`(`:15`) ✅ (되돌릴 수 없음 강조 + 상대 보존 안내 2줄)
- danger 버튼: `탈퇴하기` — `CONFIRM_LABEL`(`:16`) ✅
- 취소: `취소` — `CANCEL_LABEL`(`:17`) ✅

## 3) 진행/실패 상태 — 통과

| 검증 항목 | 결과 | 근거 |
|---|---|---|
| 로딩 중 danger 버튼 비활성 | ✅ | `disabled={deleting}` + `opacity: deleting ? 0.45`(`:74,81`) + `handleConfirm` 이중 방어(`:42-45`). 취소도 `disabled={deleting}`(`:98`) |
| 로딩 인디케이터 톤 일치 | ✅ | `ActivityIndicator color={theme.color.negativeFg}`(`:86`) ↔ LeaveLogSheets:125 동일 |
| 실패 인라인 에러(error색) | ✅ | `error ? Text color="error"` testID `delete-account-error`(`:56-65`), danger 버튼 **위** 배치(plan §3) — error=`palette.red[50]` tokens.ts:95 |
| 접근성 상태 | ✅ | `accessibilityState={{ disabled, busy: deleting }}`(`:72`) |
| 배선: 실패 시 세션 유지·재시도 | ✅(비주얼 관점) | `ProfileScreen.tsx:184-194` — 실패 시 인라인 error(시트) + neutral 토스트 2중 신호, 시트 유지 |

**근사 인지(이미 ui-spec 기록, 보강 불요)**: 실패 토스트는 `ToastTone`이 `neutral|positive` 2종뿐이라 `neutral`로 보내고 파괴 톤은 시트 인라인 `error` 텍스트가 담당(ui-spec L72-73). RN 한계의 정당한 근사 — 통과 처리.

## 4) NULL 작성자 표시 (AC6) — 통과

createdBy NULL muklog가 "탈퇴한 사용자" + 익명 아바타로 graceful. 깨짐·빈칸 0 확인.

| 소비처 | 라벨 | 아바타 | 결과 |
|---|---|---|---|
| `MuklogCard.tsx:48-55,164-173` | NULL→`deriveAuthorKind`=Deleted→`DELETED_AUTHOR_LABEL`="탈퇴한 사용자"(`color="fgMuted"`/`meta`) | `authorAvatarUserId({createdBy:null})`=null → Avatar tier 4 익명 🙂(`Avatar.tsx:103-111`) | ✅ 크래시 0 |
| `MuklogDetailScreen.tsx:243-251,424-432` | 동일 라벨(`color="fgWeak"`/`meta`) | `authorIsMe=false`→`url=null`, `userId=null` → 익명 🙂 | ✅ |
| more(관리) 버튼 노출 | — | `canManage`(작성자만, `:80,314`)로 게이팅 → NULL 작성자는 `authorIsMe=false` → 미노출 | ✅ NULL==NULL 오판 차단(`author.ts:35` Deleted 최우선 분기) |

- 익명 폴백 검증: `Avatar`는 url·userId 모두 null이면 tier 4(`avatar-anonymous`, surfaceAlt + 🙂)로 안전 폴백. 빈칸/깨짐 없음.
- 비주얼 보정 불요: 기존 `meta`/`fgMuted|fgWeak` 약톤 스타일이 "탈퇴한 사용자"에도 자연스럽게 적용(추가 약화 불필요).

## 5) 토큰 경유 / 파괴 강조 구분 — 통과

- **raw hex 0**: `grep -nE "#[0-9a-fA-F]{3,6}"` on `DeleteAccountSheet.tsx`·`ProfileScreen.tsx`·`author.ts` → **0건**.
- 사용 토큰 전부 tokens.ts에서 resolve: `negative`/`negativeFg`(108-109)·`error`(95)·`fgMuted`(85)·`radius.control`(158)·`spacing[10/12/14/18]`(153). raw 숫자 radius/색 없음.
- **파괴 강조 구분 위계**(3단): 회원 탈퇴 행(caption/fgMuted/언더라인, 최약) < 로그아웃(surface 카드/error, 중) < 시트 danger 버튼(solid negative bg/negativeFg, 최강). 일반 액션(설정 행=fg/fgWeak)과 명확히 구분됨.
- `negative`(파괴 CTA)와 `error`(검증/실패 텍스트) 의미 분리 정합(시트: danger 버튼=negative, 인라인 실패=error).

---

## 분류 요약
- **통과**: 1·2·3·4·5 전 항목 (회원 탈퇴 행 / 확인 시트 구조·토큰·카피 4종 / 진행·실패 상태 / NULL 작성자 / 토큰 경유)
- **불일치**: 없음 (ui-publisher 라우팅 불요)
- **근사 허용**: 실패 토스트 tone `neutral`(파괴 톤은 시트 인라인 error가 담당) — ui-spec 기록 확인, 정당
- **미검증**: 없음

**비주얼 완료.** 모든 검증 항목이 기존 파괴 패턴과 일관하며 카피·토큰 정합. 수정 요청 없음.
