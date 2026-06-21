# Sprint: 프로필 화면 정합 (sprint-20260621-profile-fidelity)

## 단일 기능
프로필 화면(`ProfileScreen.tsx`)을 킷 `mk-log.jsx` ProfileScreen(527-622)에 정합. 설정행 제거·편집 아이콘·변경/안내 토스트·통계 실값·즉시 로그아웃.

> 분리: **사진 소스 선택 시트(보관함/사진찍기/기본이미지로)는 S5b로 분리.** 카메라 권한·아바타 리셋(storage 삭제+avatar_url null) 인프라가 필요한 별도 기능(`useUpdateProfile`는 현재 라이브러리 피커만). 이번 S5는 그 외 정합.

## 사용자 결정 반영
- **로그아웃 = 즉시**(킷대로). 현재 네이티브 Alert 확인을 **제거**하고 탭 즉시 `signOut()`.

## 작업 범위 (킷 정합 6건)
1. **설정 행 제거**(킷 584 "설정 제거"): `SETTINGS_ROWS`에서 `{ Setting, '설정', null }` 행 제거 → **2행**(알림 설정 / 이용 안내). 현재 3행.
2. **닉네임 편집 아이콘**(킷 569 pencil): `ProfileScreen.tsx:199` `IconName.Setting`(톱니) → `IconName.Pencil`(이미 존재). 색 `fgWeak`(킷 --mk-ink2) 유지.
3. **이용 안내 토스트**(킷 586): "이용 안내" 탭 → `showToast({ message: '조금만 기다려 주세요', tone: 'neutral' })`. 현재 `route:null` 비활성 → 행 모델을 route(navigate) | action(toast) 지원으로 소폭 리팩터, 전역 토스트(`useToastController`) 사용.
4. **통계 "기록한 맛집" 실값**(킷 576 totalSpots): `computeProfileStats`가 `spotCount = Σ myLogs.spotCount`(S2에서 추가된 실집계) 반환 → "-" 폴백 제거(로딩 중에만 미표시/0). `ProfileScreen.tsx:124` 실숫자.
5. **닉네임 변경 토스트**(킷 545): `handleSave` 성공 시 `showToast({ message: '닉네임을 변경했어요', tone: 'positive' })`.
6. **프로필 사진 변경 토스트**(킷 539): `handleChangeAvatar` **실변경 성공** 시만 `showToast({ message: '프로필 사진을 변경했어요', tone: 'positive' })`. 취소는 토스트 없음 → `changeAvatar`가 변경 여부(`{ changed: boolean }` 또는 boolean) 반환하도록 소폭 확장(취소=false, 업로드 성공=true). 실패는 기존 에러 유지.
7. **즉시 로그아웃**(킷 595, 사용자 결정): `handleSignOut` → `void signOut()` 직접. `Alert` import 제거(미사용 시).

## 인수조건 (= 테스트, TDD)
- **AC1** 설정 리스트 = 2행(알림 설정·이용 안내), "설정" 행 부재.
- **AC2** 닉네임 편집 버튼 아이콘 = pencil(testID/glyph).
- **AC3** "이용 안내" 탭 → "조금만 기다려 주세요" 토스트(전역). "알림 설정" 탭 → NotifSettings 네비(불변).
- **AC4** 통계 "기록한 맛집" = `Σ spotCount` 실숫자(myLogs ready 시). computeProfileStats 단위테스트(합계·빈배열 0).
- **AC5** 닉네임 저장 성공 → "닉네임을 변경했어요" / 아바타 실변경 성공 → "프로필 사진을 변경했어요"(취소 시 미노출). 실패 시 미노출.
- **AC6** 로그아웃 탭 → Alert 없이 즉시 `signOut()` 호출.
- **AC7** `npm test` green + `tsc --noEmit` 0. 회귀 0.

## 경계/리스크
- `changeAvatar` 반환 변경: 기존 소비처(ProfileScreen만) 동시 수정 → 회귀 0. 취소/성공/실패 3분기 테스트.
- `computeProfileStats`: spotCount 합계는 myLogs(이미 spotCount 보유). 라이브 마이그레이션 미적용이면 spotCount=0 → 합계 0(거짓 아님, 안전). 마이그레이션 적용은 S2와 동일 사용자 전담.
- 전역 토스트(S4) 사용 — 프로필은 화면 유지(네비 없음)라 토스트 표시 단순.
- 디바이스 스모크(토스트·아이콘 렌더)는 사용자 영역.

## 작업 목록
1. (dev, TDD) computeProfileStats 실값 + ProfileScreen(설정행·pencil·이용안내 토스트·닉/사진 토스트·즉시 로그아웃) + changeAvatar 반환 확장.
2. (qa-visual) pencil·2행·통계 표기 킷 정합 / (qa-logic) 통계 합계·토스트 경계·즉시 로그아웃·changeAvatar 3분기·회귀 0.
