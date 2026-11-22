## What and why

<!-- One or two sentences. Link the plan or ADR if there is one. -->

## Parity

This app has a twin that shows the same system elsewhere. A change to what people see or call is made here first, then ported there.

- [ ] Paired PR: <!-- link, or "none: nothing the twin shows moved" -->
- [ ] Source commit: <!-- sha, if this PR ports a change from the twin -->
- What moved: [ ] feature [ ] behaviour [ ] UX (flows, copy, validation, focus, errors) [ ] contract [ ] none
- [ ] Standalone app (`apps/web`) updated
- [ ] Contract moved? `just gen-client` run and `packages/api-client` committed (`just check-client` passes)

## Checks

- [ ] `just check` (or `pnpm check`) passes
