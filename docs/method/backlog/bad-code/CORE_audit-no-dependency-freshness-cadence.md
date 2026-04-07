# Dependency health is checked ad hoc instead of by policy

The current install tree is clean under `npm audit`, but the repo does not appear to have a dedicated cadence or CI guard for dependency freshness and compatibility on its critical machine-facing libraries.

That is operational debt. Dependency health should not depend on someone remembering to look manually.
