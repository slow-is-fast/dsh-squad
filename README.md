# DSH Squad

Multi-agent collaboration extension for DeepSeek Harness (DSH). Decomposes complex tasks into subtasks, assigns specialist agents, manages dependencies, and runs them in parallel.

## Features

- **Task Dependency DAG** - Automatically resolves task dependencies and schedules parallel execution
- **11 Specialist Agents** - Architect, Backend, Frontend, QA, DevOps, etc.
- **QA Rework Loop** - Automatic rework when QA finds bugs
- **Health Monitoring** - Detects stuck agents and escalates
- **DSH Native Integration** - Uses spawn_teammate, team_task, and send_message

## Installation

```bash
# Clone or copy to DSH skills directory
cp -r dsh-squad ~/.agents/skills/
```

## Quick Start

Ask DSH to do something complex:

```
> Build a REST API with authentication, tests, and documentation
```

DSH will automatically use the squad skill for multi-step tasks.

## Available Agents

| Agent | Role | Tags |
|---|---|---|
| `architect` | Software Architect | architecture, design, patterns |
| `backend` | Backend Engineer | api, server, database, auth |
| `frontend` | Frontend Engineer | react, ui, css, tailwind, accessibility |
| `fullstack` | Fullstack Developer | general, coding, implementation |
| `qa` | QA Engineer | testing, verification, e2e |
| `reviewer` | Code Reviewer (read-only) | review, code-quality, over-engineering |
| `security` | Security Engineer | audit, vulnerability, threat-modeling |
| `debugger` | Debugger & Root Cause Analyst | debugging, investigation, bugs |
| `devops` | DevOps Engineer | ci-cd, docker, deployment |
| `docs` | Technical Writer | documentation, readme, api-docs |
| `researcher` | Research Analyst | research, analysis, exploration |

## Architecture

```
dsh-squad/
├── SKILL.md              # Main instructions and workflows
├── bin/
│   └── dsh-squad.mjs     # CLI helper (DAG analysis, scheduling)
└── agents/               # Agent definitions
    ├── architect.json
    ├── backend.json
    └── ...
```

## How It Works

1. **Task Decomposition** - The skill analyzes the request and creates a task breakdown
2. **Agent Assignment** - Tasks are matched to specialist agents based on tags
3. **Dependency Resolution** - The CLI tool resolves the task DAG
4. **Parallel Execution** - Ready tasks spawn teammates in parallel
5. **Health Monitoring** - Stuck or looping agents are detected and escalated
6. **QA Integration** - QA agents automatically create rework tasks when bugs are found

## CLI Commands

```bash
# Analyze task dependencies
node bin/dsh-squad.mjs plan --goal "Build API with auth and tests"

# Show available agents
node bin/dsh-squad.mjs agents

# Validate a task breakdown
node bin/dsh-squad.mjs validate tasks.json
```

## License

MIT