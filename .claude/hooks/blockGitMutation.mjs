#!/usr/bin/env node
// PreToolUse 훅 — git 변경 명령을 차단한다 (절대 규칙: git 작업은 사용자 전담).
// 읽기 명령(status·diff·log·show·blame·grep)은 작업 파악에 필요하므로 허용한다.
// exit code 2 → 호출 차단 + stderr가 에이전트에게 피드백으로 전달.
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const { tool_input } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
const command = tool_input?.command ?? '';

const GIT_MUTATION =
  /\bgit\s+(?:-\S+\s+)*(commit|push|merge|rebase|reset|revert|cherry-pick|tag|stash|switch|checkout|am|apply|branch\s+(?:-[dDmM]|--delete))\b/;

if (GIT_MUTATION.test(command)) {
  console.error(
    '차단됨: git 변경 작업은 사용자 전담입니다(CLAUDE.md 절대 규칙). 변경 요약을 보고하고 "커밋은 직접 진행하세요"로 안내하세요.',
  );
  process.exit(2);
}
