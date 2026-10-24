# Gym Log vault

A standalone Obsidian vault for tracking workouts, body weight and daily wellbeing, with a chart dashboard.

- **Data** (`Sessions/`, `Daily/`, `Exercises/`, `Inbox/`) lives on Google Drive only and is git-ignored.
- **Code** (`Scripts/`, `Templates/`, `Dashboard.md`, `Log.md`, `*.base`, Obsidian config) is versioned on GitHub.

## Plugins
- Dataview (enable *JavaScript queries*)
- Charts (by phibr0)

## Entering data
Use **Log.md**: forms for the daily check-in and workouts (pick a date to add or edit). `Daily log.base` and `Workouts.base` show everything as editable tables.

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

Daily check-ins in `Daily/YYYY-MM-DD.md` (date = the morning you woke up): `bodyweight_kg`, `bedtime` and `wake_time` ("23:30"), `sleep_hours` (auto, or typed if no times), `sleep_quality`, `mood`, `energy` (1–5), `note`.

Exercise names must be spelled the same way every time — that is how progress is matched across sessions.

## Handwritten logs
Drop photos into `Inbox/`; they get transcribed into `Sessions/` notes.
