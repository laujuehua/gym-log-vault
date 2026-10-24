# 🏋️ Gym Dashboard

**[[Log|✏️ Log a check-in or workout]]**

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

## Sleep
Bars under the dashed target line are orange. Change `target:` to set your goal.
```dataviewjs
await dv.view("Scripts/gym", { show: "sleep", days: 30, target: 7 })
```

## Mood, energy and sleep quality (1–5)
```dataviewjs
await dv.view("Scripts/gym", { show: "wellbeing", days: 60 })
```

## Personal bests by exercise
Click an exercise to open its progression chart.
```dataviewjs
await dv.view("Scripts/gym", { show: "prs" })
```
