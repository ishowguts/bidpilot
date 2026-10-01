# BidPilot

Job-ad budget optimizer. Thompson sampling allocator with pacing across job sites, deterministic traffic simulator, idempotent event API with SQL rollups, Next.js dashboard. Node.js + Express (TypeScript), PostgreSQL.

**Status:** in development. Design in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), progress in
[harness/STATE.md](harness/STATE.md). Results and a live link will appear here once measured and deployed.

## Run locally

Requirements: Node.js 20, pnpm, Docker.

```sh
sh scripts/setup.sh
pnpm install
docker compose up -d
```

Full command list: [AGENTS.md](AGENTS.md#commands).

## Author

Bittu Mandal · [@ishowguts](https://github.com/ishowguts)
