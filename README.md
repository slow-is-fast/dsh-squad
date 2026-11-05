# DSH Squad

Multi-agent collaboration skill for DeepSeek Harness (DSH). Decomposes complex tasks into subtasks, assigns specialist agents, manages dependencies, and runs them in parallel.

## Features

- **12 Specialist Agents** — architect, planner, backend, frontend, fullstack, qa, reviewer, security, debugger, devops, docs, researcher
- **Task Dependency DAG** — resolves dependencies and schedules parallel execution
- **QA Rework Loop** — automatic rework when QA finds bugs
- **Health Monitoring** — detects stuck agents and escalates
- **Per-Agent Model Configuration** — assign a model and thinking mode to each agent
- **DSH Native Integration** — uses `spawn_teammate`, `team_task_*`, and `send_message`

## Installation

```bash
# Copy the skill into the DSH skills directory
cp -r dsh-squad ~/.agents/skills/dsh-squad
```

Restart DSH (or start a new session) so the skill catalog is re-read.

## Quick Start

Ask DSH for something that spans several concerns:

```
> Build a REST API with authentication, tests, and documentation
```

DSH picks up the squad skill and runs the multi-step workflow.

## Agents

| Agent | Role | Tags |
|---|---|---|
| `architect` | Software Architect | architecture, design, patterns, api-design |
| `planner` | Project Planner | planning, task-breakdown, coordination, dependencies |
| `backend` | Backend Engineer | api, server, database, auth, rest, graphql |
| `frontend` | Frontend Engineer | react, ui, css, tailwind, accessibility |
| `fullstack` | Fullstack Developer | general, coding, implementation, web |
| `qa` | QA Engineer | testing, verification, e2e, integration-tests |
| `reviewer` | Code Reviewer (read-only) | review, code-quality, over-engineering |
| `security` | Security Engineer | audit, vulnerability, threat-modeling, owasp |
| `debugger` | Debugger & Root Cause Analyst | debugging, investigation, root-cause |
| `devops` | DevOps Engineer | ci-cd, docker, deployment, infrastructure |
| `docs` | Technical Writer | documentation, readme, api-docs |
| `researcher` | Research Analyst | research, analysis, exploration |

## Model Configuration

Each agent resolves its model at load time. Two files are supported:

**1. `~/.dsh/dsh-squad.json` — takes precedence**

```json
{
  "version": 1,
  "roles": {
    "architect": {
      "inherit": true,
      "routes": [{ "provider": "bailian-tpp", "model": "deepseek-v4.1-flash" }],
      "thinking": "enabled"
    },
    "backend": {
      "inherit": true,
      "routes": [{ "provider": "bailian-tpp", "model": "glm-5.3" }]
    }
  }
}
```

**2. `config/squad.config.json` — skill-local fallback**

```json
{
  "agents": {
    "architect": { "model": "deepseek-v4.1-flash", "thinking": "enabled" }
  },
  "defaultModel": "glm-5.3",
  "settings": { "maxParallelTasks": 5, "retryAttempts": 2 }
}
```

Agents without an entry fall back to `defaultModel`. Environment overrides:
`DSH_HOME` (location of the DSH state directory) and `SQUAD_CONFIG_PATH`
(path to the skill config file), both mainly useful in tests.

```bash
# Show the effective configuration and which file is in use
node bin/dsh-squad.mjs config show

# Change one setting — writes to whichever file is active
node bin/dsh-squad.mjs config set architect model deepseek-v4.1-flash
node bin/dsh-squad.mjs config set architect thinking enabled   # or disabled
node bin/dsh-squad.mjs config get architect
node bin/dsh-squad.mjs config validate   # exit 1 on unknown agent or bad value
```

DSH does not render a Settings page for skill-level configuration; the config
files and the `config` subcommand are the supported surface.

## CLI Commands

```bash
# Suggest a task breakdown from a goal
node bin/dsh-squad.mjs plan --goal "Build API with auth and tests"

# Analyze an existing breakdown
node bin/dsh-squad.mjs plan --tasks tasks.json

# List agents with their effective models
node bin/dsh-squad.mjs agents

# Validate a breakdown (cycles, unknown agents, bad dependencies)
node bin/dsh-squad.mjs validate tasks.json

# Show the dependency graph and execution levels
node bin/dsh-squad.mjs deps tasks.json
```

Global flags: `--json`, `--quiet`/`-q`, `--verbose`, `--version`/`-v`, `--help`/`-h`.

Errors exit non-zero with a stable code: `VALIDATION_ERROR`, `FILE_ERROR`,
`PARSE_ERROR`, `COMMAND_ERROR`.

## Testing

```bash
npm test    # node --test tests/*.test.mjs
```

122 tests across four suites:

| Suite | Covers |
|---|---|
| `tests/dsh-squad.test.mjs` | graph algorithms, task loading, agent loading, validation |
| `tests/suggest-tasks.test.mjs` | template matching, auto-dependencies, default fallback |
| `tests/config.test.mjs` | config precedence, write target, value validation |
| `tests/cli-commands.test.mjs` | end-to-end CLI output, flags, exit codes, typed errors |
| `tests/error-classes.test.mjs` | typed error hierarchy and the real throw sites |

## Architecture

```
dsh-squad/
├── SKILL.md                  # Agent-facing instructions and workflows
├── bin/
│   └── dsh-squad.mjs         # CLI: plan, agents, validate, deps, config
├── lib/
│   ├── core.mjs              # Config resolution, task/agent loading, DAG analysis
│   ├── templates.mjs         # Goal → task suggestion
│   └── errors.mjs            # Typed error hierarchy
├── agents/                   # 12 agent definitions
├── config/
│   ├── squad.config.json     # Model configuration (skill-local)
│   └── squad-templates.json  # Task suggestion templates
├── examples/                 # Example task breakdowns
└── tests/                    # 122 tests
```

## How It Works

1. **Task Decomposition** — the skill creates a task breakdown for the request
2. **Agent Assignment** — tasks are matched to specialists by tags
3. **Dependency Resolution** — the CLI resolves the DAG and execution levels
4. **Parallel Execution** — ready tasks spawn teammates in parallel
5. **Health Monitoring** — stuck or looping agents are detected and escalated
6. **QA Integration** — QA creates rework tasks when bugs surface

## License

MIT