Implement milestone {{M}} from PLAN.md §12, following every steering file
(product, tech, structure, privacy, ui, workflow) and PLAN.md as the source of
truth.

1. Read PLAN.md §12 for milestone {{M}}'s scope and its "done when" criteria,
   plus any sections it depends on.
2. Draft a short task list for {{M}} and work through it.
3. Keep demo mode working (DEMO_MODE=true, no keys) throughout. The stamp card
   is built from place data + the uploaded photo; the app uses no AI.
4. Delegate unit tests for pure logic to `citydex-tester` via the subagent tool.
5. Delegate a review against privacy.md / tech.md / PLAN.md to
   `citydex-reviewer` via the subagent tool.
6. Fix all findings from tests and review.
7. Verify: `npm run lint`, `npx tsc --noEmit`, `npm test` all pass.
8. Commit with message `M{{M}}: <summary>` and NO Co-Authored-By trailer. Do not
   push.

If the milestone needs a key or external account only the human can provide,
build behind the demo fallback, state exactly what is needed, and continue.
