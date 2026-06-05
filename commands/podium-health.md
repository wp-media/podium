---
name: podium-health
description: >
  Report whether the Podium dashboard server is running and reachable.
  Returns a single-line machine-readable status for callers (e.g. Maestro).
  Use when asked to check if Podium is running or available.
---

```bash
curl -s --max-time 1 http://localhost:4820/health
```

- HTTP 200 → print `podium: running`
- No response / error → print `podium: not running`
