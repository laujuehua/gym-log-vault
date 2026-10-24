# ✏️ Log

Pick a date. If there's already an entry for that day, it loads so you can edit it. Press **Save** and the dashboard updates.

## Daily check-in
```dataviewjs
await dv.view("Scripts/log", { form: "daily" })
```

## Workout
```dataviewjs
await dv.view("Scripts/log", { form: "workout" })
```

---
Browse or quick-fix many days at once: [[Daily log.base|Daily log table]] · [[Workouts.base|Workouts table]] · [[Dashboard]]
