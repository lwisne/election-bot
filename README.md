# election-bot

Compare live county early-vote totals with the final early vote from 2024. Michigan first.

```bash
npm install
node --experimental-strip-types src/main.ts MI
node --experimental-strip-types src/main.ts TX
node --experimental-strip-types src/backtest.ts
node --experimental-strip-types src/mi-early-party.ts
```

The design is in [docs/design.md](docs/design.md).
