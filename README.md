# GivenTake Studio

The codebase behind [giventakedevs.com](https://giventakedevs.com): the GivenTake Devs studio website plus its production CRM.

## What is this

GivenTake Devs is an AI development studio building websites, web apps, MVPs, internal tools, automations, and AI agents for small businesses. This repo holds:

- **Studio website** — marketing site, service pages, and contact flows.
- **CRM** (`/crm`) — authenticated team dashboard with prospecting, campaign, newsletter, and referral engines, plus a human-approval queue on all outbound actions.
- **Voice agent integration** — Maya, a live voice-AI phone agent handling real business calls, with automated message delivery to email and SMS.
- **MCP bridge** — a Model Context Protocol integration exposing CRM pipeline, leads, deals, tasks, and activity to AI assistants.

## Stack

TypeScript, React, TanStack Start, Tailwind CSS, Supabase (PostgreSQL, Auth, row-level security), Vercel, ElevenLabs.

## Development

```sh
git clone https://github.com/callmesalem/giventake-studio.git
cd giventake-studio
npm i
npm run dev
```

Environment variables go in `.env` (see `.env.example`). Never commit real keys.

## Approach

Designed and shipped via AI-assisted development: the founder reads and directs the code; AI writes, reviews, and audits it.
