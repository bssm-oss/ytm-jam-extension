# YTM Jam Protocol v0.1.0

## ClientToServer
```ts
type ClientToServer =
  | { t: "JOIN"; roomId: string }
  | { t: "PLAY"; trackId: string }
  | { t: "PAUSE" }
  | { t: "SEEK"; time: number }
  | { t: "QUEUE_ADD"; trackId: string }
  | { t: "SKIP" };
```

## ServerToClient
```ts
type ServerToClient = { t: "STATE"; state: PlaybackState };
```

## PlaybackState
```ts
type PlaybackState = {
  trackId: string | null;
  startedAt: number | null;
  paused: boolean;
  pausedAt: number | null;
  queue: string[];
};
```

## Versioning Rules
1. Breaking change -> major bump
2. Optional field additions -> minor bump
3. Patch change must preserve runtime compatibility
