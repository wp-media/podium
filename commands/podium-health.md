---
name: podium-health
description: "[internal] Machine-readable Podium health check — prints `podium: running` or `podium: not running`. Called by Maestro; not a user-facing command."
---

```bash
curl -s --max-time 1 http://localhost:4820/health
```

- HTTP 200 → print `podium: running`
- No response / error → print `podium: not running`
