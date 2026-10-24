# Kiro Journal

## 2026-10-24

- Reverted mutating shell commands (`git rm`, `git mv`, `rm *.tmp`, `npm uninstall`)
  from `.kiro/agents/citydex-reviewer.json`. The reviewer must stay **read-only**;
  it should only inspect and report findings, never modify the repo. Removed them
  from both `toolsSettings.shell.allowedCommands` and the `permissions` allow rule.
  Reviewer now allows only `git diff`, `git log`, `git status`, `ls`, `cat`.
  These mutating commands remain on `citydex-builder` and `citydex-tester`.
