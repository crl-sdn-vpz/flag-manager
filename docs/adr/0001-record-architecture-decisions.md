# 0001. Record architecture decisions

Date: 2026-11-20 / Status: accepted

Context: decisions get lost in chat logs and PR threads; future maintainers (human or AI) need the "why".

Options considered: no records (fast, but context is lost); a wiki (drifts from code); ADRs in the repo (versioned with the code they explain).

Decision: keep lightweight ADRs in docs/adr/, one per decision, written with /write-adr.

Consequences: each non-obvious choice costs a few minutes to record; agents and reviewers can cite ADRs.
