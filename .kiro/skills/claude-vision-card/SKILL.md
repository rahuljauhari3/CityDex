---
name: claude-vision-card
description: DEPRECATED AND REMOVED. CityDex no longer uses the Anthropic SDK or API. All AI runs through Kiro over the Agent Client Protocol. Use the kiro-vision-card skill instead.
---

# DEPRECATED — replaced by `kiro-vision-card`

CityDex's AI runtime is **Kiro only**. The Anthropic SDK / API are no longer
used anywhere in the app. Do not follow any Anthropic `messages.parse` /
`zodOutputFormat` pattern.

**Use the [`kiro-vision-card`](../kiro-vision-card/SKILL.md) skill** for the
stamp-card generator: spawn `kiro-cli acp --agent citydex-cardsmith`, send an
image content block before the text block over the Agent Client Protocol, with a
`kiro-cli chat --no-interactive` CLI fallback and a deterministic mock.

> This folder is a tombstone. It should be deleted from the repository
> (`rm -rf .kiro/skills/claude-vision-card`); it is retained only because the
> configuring agent lacks a delete tool.
