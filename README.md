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

Or, from a clone, mirror it with the sync script (see
[Updating an Installed Skill](#updating-an-installed-skill)):

```bash
npm run sync:skill
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
`DSH_HOME` (location of the DSH state directory), `SQUAD_CONFIG_PATH` (path to
the skill config file), and `SQUAD_MODELS_PATH` (path to the model catalog),
mainly useful in tests.

### Model catalog

`config/models.json` lists the models this environment is known to expose. It is
a static list — the CLI runs outside DSH and cannot query the live LLM catalog —
so regenerate it from DSH when providers change, or edit it by hand. It is used
to reject typos; `--force` writes a model that is not listed.

```bash
node bin/dsh-squad.mjs config models   # show the catalog and its source
```

### Commands

```bash
# Show the effective configuration and which file is in use
node bin/dsh-squad.mjs config show

# Compact table of every agent's resolved model
node bin/dsh-squad.mjs config list

# Change one setting — writes to whichever file is active
node bin/dsh-squad.mjs config set architect model deepseek-v4.1-flash
node bin/dsh-squad.mjs config set architect thinking enabled   # or disabled
node bin/dsh-squad.mjs config set architect tools "read,write" # comma list or JSON array
node bin/dsh-squad.mjs config set architect model some-new-model --force

# Remove one property, or the whole agent entry
node bin/dsh-squad.mjs config unset architect thinking
node bin/dsh-squad.mjs config unset architect

node bin/dsh-squad.mjs config get architect
node bin/dsh-squad.mjs config validate   # exit 1 on unknown agent, bad value, or unknown model
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

Every read command (`plan`, `agents`, `validate`, `deps`, `config show|get|list|models|validate`)
and the two write commands (`config set|unset`) emit a single parseable JSON object
with `--json`. That contract is enforced by `tests/json-contract.test.mjs`, so a
command that silently prints nothing fails CI.

Errors exit non-zero with a stable code: `VALIDATION_ERROR`, `FILE_ERROR`,
`PARSE_ERROR`, `COMMAND_ERROR`.

## Testing

```bash
npm test    # node --test tests/*.test.mjs
```

177 tests across seven suites — also run in CI on Node 18, 20, and 22
(`.github/workflows/test.yml`):

| Suite | Covers |
|---|---|
| `tests/dsh-squad.test.mjs` | graph algorithms, task loading, agent loading, validation |
| `tests/suggest-tasks.test.mjs` | template matching, auto-dependencies, default fallback |
| `tests/config.test.mjs` | config precedence, write target, value validation, unset, tools, model catalog |
| `tests/cli-commands.test.mjs` | end-to-end CLI output, flags, exit codes, typed errors |
| `tests/error-classes.test.mjs` | typed error hierarchy, real throw sites, `formatError` |
| `tests/json-contract.test.mjs` | every `--json` command emits parseable JSON |
| `tests/sync-skill.test.mjs` | skill mirroring, stale cleanup, destructive-target guards |

## Updating an Installed Skill

The skill directory under `~/.agents/skills/` is a copy, not a git checkout, so
repo edits do not reach DSH until it is refreshed:

```bash
npm run sync:skill              # mirror into ~/.agents/skills/dsh-squad
npm run sync:skill -- --dry-run # show what would change
npm run sync:skill -- <target>  # custom destination
```

The script refuses to overwrite the repo itself, a subdirectory of it, or a
non-empty directory without `SKILL.md` (unless `--force`). It removes stale
entries and preserves `.git`. Restart DSH afterwards to reload `SKILL.md`.

## Architecture

```
dsh-squad/
├── SKILL.md                  # Agent-facing instructions and workflows
├── bin/
│   └── dsh-squad.mjs         # CLI: plan, agents, validate, deps, config
├── lib/
│   ├── core.mjs              # Config resolution, task/agent loading, DAG analysis
│   ├── templates.mjs         # Goal → task suggestion
│   └── errors.mjs            # Typed error hierarchy + formatError
├── agents/                   # 12 agent definitions
├── config/
│   ├── squad.config.json     # Model configuration (skill-local)
│   ├── squad-templates.json  # Task suggestion templates
│   └── models.json           # Known model catalog (typo guard)
├── examples/                 # Example task breakdowns
├── scripts/
│   └── sync-skill.mjs        # Mirror the repo into an installed skill
├── tests/                    # 177 tests (tests/helpers/ = shared CLI runner)
└── .github/workflows/        # CI: npm test on Node 18/20/22
```

## How It Works

1. **Task Decomposition** — the skill creates a task breakdown for the request
2. **Agent Assignment** — tasks are matched to specialists by tags
3. **Dependency Resolution** — the CLI resolves the DAG and execution levels
4. **Parallel Execution** — ready tasks spawn teammates in parallel
5. **Health Monitoring** — stuck or looping agents are detected and escalated
6. **QA Integration** — QA creates rework tasks when bugs surface

## License

MIT — see [LICENSE](LICENSE).