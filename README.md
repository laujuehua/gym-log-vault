# Gym Log vault

A standalone Obsidian vault for tracking workouts, body weight and daily wellbeing, with a chart dashboard.

- **Data** (`Sessions/`, `Daily/`, `Exercises/`, `Inbox/`) lives on Google Drive only and is git-ignored.
- **Code** (`Scripts/`, `Templates/`, `Dashboard.md`, Obsidian config) is versioned on GitHub.

## Plugins
- Dataview (enable *JavaScript queries*)
- Charts (by phibr0)

## Logging format
One note per session in `Sessions/YYYY-MM-DD.md`:

```yaml
date: 2026-10-23
workout: Push
bodyweight_kg: 72.4
rating: 4            # 1–5 stars
exercises:
  - name: Bench Press
    sets: ["60x8", "60x8", "62.5x6"]   # kg x reps; "60x8x3" = 3 sets; "BWx12" = bodyweight
cardio:
  - type: Treadmill
    minutes: 15
```

Daily check-ins in `Daily/YYYY-MM-DD.md`: `bodyweight_kg`, `mood`, `energy`, `sleep` (1–5).

Exercise names must be spelled the same way every time — that is how progress is matched across sessions.

## Handwritten logs
Drop photos into `Inbox/`; they get transcribed into `Sessions/` notes.
