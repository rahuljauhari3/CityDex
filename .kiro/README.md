# CityDex Kiro workspace

This root-level directory contains CityDex's Kiro configuration, specifications,
and recorded development sessions. It is tracked in Git and must remain included
in the submission. Do not add this directory or its subdirectories to ignore rules.

## Workspace guide

- `steering/`: product, technical architecture, structure, privacy, UI, and workflow guidance.
- `specs/citydex-core/requirements.md`: product requirements and acceptance criteria.
- `specs/citydex-core/design.md`: implementation design.
- `specs/citydex-core/tasks.md`: implementation checklist, including superseded work.
- `agents/`: bootstrap, builder, reviewer, tester, and UI agent configurations.
- `prompts/milestone.md`: reusable milestone execution prompt.
- `logs/`: recorded setup, specification, milestone, review, and refocusing work.

The cardsmith agent and vision-card skills are marked as retired artifacts; they
are not evidence of a current runtime integration. The current package manifest
contains no model SDK dependency. Development tooling and application runtime
are separate concerns.

## Evidence and scope

Read the original session logs alongside the specifications and Git history when
reviewing development activity. These files document Kiro configuration and
recorded usage; their presence alone does not establish exclusive authorship of
every change. Historical logs may describe superseded implementations.

This index and the submission checklist were added during a Codex-assisted
submission review on 2026-10-24. They are navigation and verification documents,
not newly executed Kiro sessions or retroactive development logs.

See `SUBMISSION_CHECKLIST.md` for repository inclusion checks.
