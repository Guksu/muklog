// plugins/withFmtConstevalFix.js
// 신규 Xcode clang에서 React Native 번들 fmt(11.0.2)가 consteval(FMT_STRING)로 컴파일 실패하는 문제 우회.
//
// 왜 -D(FMT_USE_CONSTEVAL=0)로는 안 되나:
//   fmt 11.0.2의 base.h는 FMT_USE_CONSTEVAL을 #ifndef 가드 없이 컴파일러 감지로 무조건 재정의한다
//   → 외부 -D 정의가 헤더에서 덮어써져 무효. 그래서 헤더 자체를 패치해 강제로 0으로 만든다.
//
// 동작: Podfile post_install(=pod 다운로드 후)에서 Pods/fmt/include/fmt/base.h에
//   `#undef FMT_USE_CONSTEVAL` + `#define FMT_USE_CONSTEVAL 0`을 삽입한다(멱등).
//   Expo는 ios/를 prebuild로 재생성(.gitignore)하므로 plugin으로 박아둬야 매번 적용된다.
// 제거 시점: Expo SDK/RN 업그레이드로 fmt가 새 clang과 호환되면 이 plugin을 삭제한다.
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PATCH_MARKER = 'MUKLOG_FMT_CONSTEVAL_PATCH';

// post_install 블록 안에서 실행될 Ruby. installer.sandbox.root = .../ios/Pods.
const SNIPPET = [
  '  # fmt consteval 빌드 실패 우회 — base.h를 직접 패치(외부 -D는 fmt가 헤더에서 재정의해 무효).',
  "  fmt_base_h = File.join(installer.sandbox.root, 'fmt', 'include', 'fmt', 'base.h')",
  '  if File.exist?(fmt_base_h)',
  '    fmt_src = File.read(fmt_base_h)',
  `    unless fmt_src.include?('${PATCH_MARKER}')`,
  '      fmt_src = fmt_src.sub(',
  '        "#endif\\n#if FMT_USE_CONSTEVAL\\n#  define FMT_CONSTEVAL consteval",',
  `        "#endif\\n// ${PATCH_MARKER}\\n#undef FMT_USE_CONSTEVAL\\n#define FMT_USE_CONSTEVAL 0\\n#if FMT_USE_CONSTEVAL\\n#  define FMT_CONSTEVAL consteval"`,
  '      )',
  '      File.write(fmt_base_h, fmt_src)',
  '    end',
  '  end',
].join('\n');

module.exports = function withFmtConstevalFix(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');

      if (!contents.includes(PATCH_MARKER)) {
        // 기존 post_install 블록 바로 안쪽에 패치 루틴 주입(Expo 기본 Podfile은 항상 이 블록을 가진다).
        contents = contents.replace(
          /post_install do \|installer\|\n/,
          (match) => `${match}${SNIPPET}\n`,
        );
        fs.writeFileSync(podfilePath, contents);
      }
      return cfg;
    },
  ]);
};
