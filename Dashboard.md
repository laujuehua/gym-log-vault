# 🏋️ Gym Dashboard

> Needs the **Dataview** plugin (with JavaScript queries on) and the **Charts** plugin. Change `days:` to widen or narrow a chart.

## Overview
```dataviewjs
await dv.view("Scripts/gym", { show: "summary" })
```

## Recent sessions
```dataviewjs
await dv.view("Scripts/gym", { show: "recent", n: 10 })
```

## Body weight
```dataviewjs
await dv.view("Scripts/gym", { show: "bodyweight", days: 180 })
```

## Weekly training volume
```dataviewjs
await dv.view("Scripts/gym", { show: "volume", days: 90 })
```

## Mood, energy and sleep (1–5)
```dataviewjs
await dv.view("Scripts/gym", { show: "wellbeing", days: 60 })
```

## Personal bests by exercise
Click an exercise to open its progression chart.
```dataviewjs
await dv.view("Scripts/gym", { show: "prs" })
```
