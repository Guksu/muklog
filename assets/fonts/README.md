# Pretendard 폰트 배치

이 디렉터리에 Pretendard 정적 TTF 4개 weight를 배치한다. 파일명은 코드의 `useFonts`
등록 키 및 `theme/tokens.ts`의 `typography.*.fontFamily` 값과 **정확히 일치**해야 한다.

| 파일명 (필수) | weight | fontFamily 키 |
|---------------|--------|----------------|
| `Pretendard-Regular.ttf`  | 400 | `Pretendard-Regular`  |
| `Pretendard-Medium.ttf`   | 500 | `Pretendard-Medium`   |
| `Pretendard-SemiBold.ttf` | 600 | `Pretendard-SemiBold` |
| `Pretendard-Bold.ttf`     | 700 | `Pretendard-Bold`     |

## 받는 법
- npm: `npm i pretendard` 후 `node_modules/pretendard/dist/public/static/*.ttf`에서 위 4개 복사.
- 또는 공식 릴리스: https://github.com/orioncactus/pretendard/releases (Pretendard-1.3.x.zip → `public/static/`)

## 주의 (RN 흔한 버그)
RN은 `fontWeight`만으로 커스텀 폰트 두께가 안 잡히는 경우가 많아, weight별 `fontFamily`를
직접 지정한다(`tokens.ts`의 typography가 이미 그렇게 구성됨). 파일이 없으면 폰트 로드가
실패하므로 `App.tsx`의 부트스트랩은 타임아웃/실패 시 시스템 폰트로 fallback 진입한다.

> 이 ttf들은 라이선스(SIL OFL) 폰트 바이너리다. 저장소 정책에 따라 커밋 여부를 결정한다.
> 현재 `.gitkeep` 없이 이 README가 디렉터리를 유지한다.
