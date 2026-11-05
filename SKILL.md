---
name: dsh-squad
description: Multi-agent collaboration for complex tasks. Decomposes work into tasks, assigns specialist agents, manages dependencies, runs in parallel with automatic QA rework loops. Use when tasks involve 2+ concerns (backend+frontend+tests+docs), have natural parallelism, or are too large for single-agent context.
license: MIT
metadata:
  version: "1.2"
  author: dsh-squad
---

# DSH Squad - Multi-Agent Collaboration

## Agent Model Configuration

Each agent's model is resolved at load time. Two config files are supported, in this order:

**1. Global (takes precedence): `~/.dsh/dsh-squad.json`**

```json
{
  "version": 1,
  "roles": {
    "architect": {
      "routes": [{ "provider": "bailian-tpp", "model": "deepseek-v4.1-flash" }],
      "thinking": "enabled"
    },
    "backend": {
      "routes": [{ "provider": "bailian-tpp", "model": "glm-5.3" }]
    }
  }
}
```

**2. Skill-local: `config/squad.config.json`**

```json
{
  "agents": {
    "architect": { "model": "deepseek-v4.1-flash", "thinking": "enabled" }
  },
  "defaultModel": "glm-5.3"
}
```

Anything not configured falls back to `defaultModel`.

`config set` always writes to the file that is actually in effect: the DSH
overlay when it exists, otherwise the skill-local config, preserving that
file's own format. `config show` prints the path it resolved. Environment
overrides: `DSH_HOME` (DSH state directory), `SQUAD_CONFIG_PATH` (skill config
file), `SQUAD_MODELS_PATH` (model catalog), mainly for tests.

### Model catalog

`config/models.json` lists the models this environment exposes. It is static —
the CLI cannot query the live LLM catalog — so regenerate it from DSH when
providers change. `config set <agent> model <name>` rejects a name that is not
listed; add `--force` to write it anyway. `config validate` reports unlisted
models as errors unless `--force` is passed.

### Managing config from the CLI

```bash
# Show the effective configuration and the file it came from
node bin/dsh-squad.mjs config show

# Compact table: every agent with its resolved model
node bin/dsh-squad.mjs config list

# Which models are known, and where that list came from
node bin/dsh-squad.mjs config models

# Set one agent's model / thinking mode / tools (writes to the active file)
node bin/dsh-squad.mjs config set architect model deepseek-v4.1-flash
node bin/dsh-squad.mjs config set architect thinking enabled   # or disabled
node bin/dsh-squad.mjs config set architect tools "read,write"

# Remove a property, or the whole agent entry
node bin/dsh-squad.mjs config unset architect thinking
node bin/dsh-squad.mjs config unset architect

# Inspect the resolved value for one agent
node bin/dsh-squad.mjs config get architect

# Check for unknown agents, invalid values, and unlisted models (exit 1)
node bin/dsh-squad.mjs config validate
```

Invalid input is rejected before anything is written: unknown agent name,
unsupported property, empty or whitespace-containing model name, unknown model,
and thinking values other than `enabled`/`disabled` all exit non-zero with
`VALIDATION_ERROR`. `unset` of something already absent is a no-op success.

Note: DSH itself does not render a Settings UI for skill-level role config; the
config files and the `config` CLI subcommand are the supported surface.

## Overview

DSH Squad enables complex, multi-step tasks by coordinating multiple specialist agents in parallel. It automatically decomposes work, manages dependencies, and orchestrates execution using DSH's native tools (spawn_teammate, team_task, send_message).

## When to Use Squad

**USE SQUAD when a task:**
- Involves 2+ concerns: backend + frontend + tests + docs + devops
- Has natural parallelism: independent modules can be built simultaneously
- Is too large for a single agent's context
- Requires specialist expertise: security audit, performance optimization, etc.
- Benefits from independent review: architecture, code quality

**DO NOT USE for:**
- Simple single-file changes
- Quick bug fixes
- Tasks a single agent can complete in minutes
- Sequential work with no parallelism

## Quick Start

When you receive a complex request, follow this workflow:

### 1. Analyze the Request

Identify:
- **What** needs to be built
- **Who** should work on each part (agent assignment)
- **Dependencies** between parts
- **Parallelization** opportunities

### 2. Plan the Tasks

Create a task breakdown following these rules:

```
Task 1: Design API Contract (architect)
  - No dependencies
  - Defines interfaces for parallel work

Task 2: Implement Backend API (backend)  
  - Depends on: Task 1
  
Task 3: Implement Frontend (frontend)
  - Depends on: Task 1
  
Task 4: Write Tests (qa)
  - Depends on: Task 2, Task 3
  
Task 5: Write Documentation (docs)
  - Depends on: Task 2
```

### 3. Execute with DSH Tools

Use the CLI helper to validate and plan:

```bash
node bin/dsh-squad.mjs plan --tasks tasks.json
```

Then spawn agents using DSH native tools:

```
team_task_create for each task
spawn_teammate for each agent
send_message to coordinate
wait_agent to monitor progress
```

## Task Breakdown Rules

### Rule 1: Contract/Design First
For tasks that share interfaces:
- **First task**: Architecture/Design (architect)
- **Parallel tasks**: Implementation tasks depend on design
- **Example**: Backend + Frontend both need API contract

### Rule 2: QA Last
For user-facing changes:
- **Final task**: QA testing (qa)
- **Depends on**: All implementation tasks
- **Automatically triggers**: Rework loop if bugs found

### Rule 3: Right-Size Tasks
Each task should be:
- **Completable** in one session (30-90 minutes)
- **Deliverable**: Produces concrete output
- **Testable**: Has verification command
- **Scoped**: Clear boundaries (what NOT to change)

### Rule 4: 3-7 Tasks
- **Minimum**: 3 tasks (design + implement + verify)
- **Maximum**: 7 tasks (maintain clarity)
- **Sweet spot**: 4-5 tasks with parallelism

### Rule 5: Parallelism When Possible
Maximize parallel execution:
- **Independent tasks**: Run in parallel
- **Shared interface**: Design first, then parallel
- **Dependencies**: Make them explicit

## Agent Selection Guide

Match agents to task requirements using tags:

| Task Type | Agent | Tags |
|-----------|-------|------|
| API design, architecture | `architect` | architecture, design, patterns |
| Backend API, database | `backend` | api, server, database, auth |
| UI components, React | `frontend` | react, ui, css, tailwind |
| Full-stack feature | `fullstack` | general, coding, implementation |
| Testing, QA | `qa` | testing, verification, e2e |
| Code review | `reviewer` | review, code-quality |
| Security audit | `security` | audit, vulnerability |
| Bug investigation | `debugger` | debugging, investigation |
| CI/CD, Docker | `devops` | ci-cd, docker, deployment |
| Documentation | `docs` | documentation, readme |
| Research, analysis | `researcher` | research, analysis |

### Agent Selection by Task

```javascript
// Example: Building a REST API with auth and tests
{
  tasks: [
    {
      id: "api-design",
      title: "Design API contract and database schema",
      agent: "architect",  // Tags: architecture, api-design
      depends: []
    },
    {
      id: "backend-auth",
      title: "Implement authentication API",
      agent: "backend",  // Tags: api, auth, database
      depends: ["api-design"]
    },
    {
      id: "backend-crud",
      title: "Implement CRUD endpoints",
      agent: "backend",  // Tags: api, rest
      depends: ["api-design"]
    },
    {
      id: "tests",
      title: "Write integration and unit tests",
      agent: "qa",  // Tags: testing, verification
      depends: ["backend-auth", "backend-crud"]
    },
    {
      id: "docs",
      title: "Write API documentation",
      agent: "docs",  // Tags: documentation, api-docs
      depends: ["backend-auth", "backend-crud"]
    }
  ]
}
```

## Dependency Management

### Dependency Types

1. **Sequential**: Task B must wait for Task A
   ```
   Task A → Task B
   ```

2. **Parallel**: Tasks can run simultaneously
   ```
   Task A ─┐
           ├→ Task C
   Task B ─┘
   ```

3. **Diamond**: Multiple paths converge
   ```
   Task A ─┬→ Task B ─┐
           │          ├→ Task D
           └→ Task C ─┘
   ```

### Using team_task Tools

```javascript
// Create task with dependencies
team_task_create({
  subject: "Implement authentication",
  description: "...",
  blocked_by: ["api-design"],  // Dependencies
  write_scopes: ["src/auth/"]  // File scope
})

// Check task status
team_task_list({ status: "pending" })

// Update task when done
team_task_update({
  task_id: "backend-auth",
  action: "complete"
})
```

## QA Integration & Rework Loop

### How QA Works

1. **QA agent runs tests** and produces verdict:
   ```
   ## Verdict: FAIL
   
   ## Issues:
   - Authentication fails for invalid tokens
   - SQL injection vulnerability in /users endpoint
   ```

2. **Automatic rework loop triggers**:
   - Create fix task for original agent
   - Create retest task for QA
   - Loop up to `maxRetries` (default: 2)

3. **Escalation after max retries**:
   - Report to main orchestrator
   - Request human intervention

### Implementing QA Checks

```javascript
// QA task depends on implementation
{
  id: "qa-tests",
  agent: "qa",
  depends: ["backend-auth", "backend-crud"],
  description: `
    Goal: Verify all API endpoints work correctly
    
    Context: 
    - Authentication API at /api/auth
    - CRUD API at /api/users
    
    Output: Test report with verdict
    
    Verify: npm test
  `
}
```

### QA Verdict Format

QA agents MUST end with this format:

```markdown
## Verdict: PASS | PASS WITH ISSUES | FAIL

## Issues: (if FAIL or PASS WITH ISSUES)
- [Specific issue 1]
- [Specific issue 2]

## Evidence:
- Test command: npm test
- Result: 3/5 tests passing
```

## Health Monitoring

### Detecting Stuck Agents

Monitor for:
- **Idle > 3 minutes**: Send nudge message
- **Stuck > 5 minutes**: Escalate to orchestrator  
- **Tool loop**: Same tool called 5 times
- **Long running > 30 minutes**: Check in with orchestrator

### Using wait_agent

```javascript
// Wait for agent status changes
const status = await wait_agent({
  timeout_ms: 180000  // 3 minutes
})

if (status.type === "noProgress") {
  // Send nudge or escalate
}
```

## Task Description Template

Structure task descriptions for clarity:

```markdown
Goal: [What this task accomplishes - outcome first]

Context:
- [Files to read]
- [APIs to use]
- [Dependencies to consider]

Output:
- [Deliverable: file, feature, test, etc.]

Boundaries:
- [What must NOT change]
- [Constraints and limitations]

Verify:
- [Command to prove it works]
```

### Example

```markdown
Goal: Implement user authentication with JWT tokens

Context:
- Read src/db/schema.sql for users table
- Use existing database connection from src/db/client.js
- API contract defined in docs/api-design.md

Output:
- src/auth/login.js - Login endpoint
- src/auth/middleware.js - JWT verification
- Tests in tests/auth.test.js

Boundaries:
- Do NOT modify database schema
- Do NOT change existing API routes
- Keep under 200 lines per file

Verify: npm test tests/auth.test.js
```

## Parallel Execution Strategy

### Step 1: Validate DAG

```bash
# Check for cycles and missing dependencies
node bin/dsh-squad.mjs validate tasks.json
```

### Step 2: Identify Ready Tasks

Tasks are ready when:
- Status is `pending`
- All dependencies are `completed`

### Step 3: Spawn Agents

```javascript
// Get ready tasks
const ready = await team_task_list({ ready: true })

// Spawn agents up to maxConcurrency
for (const task of ready.slice(0, maxConcurrency)) {
  await spawn_teammate({
    name: `squad-${task.id}`,
    description: task.subject,
    prompt: buildTaskPrompt(task),
    context: "fresh"
  })
}
```

### Step 4: Monitor and Unblock

```javascript
// Wait for completion
while (true) {
  const status = await wait_agent({ timeout_ms: 60000 })
  
  // When a task completes, unblock dependents
  if (status.type === "completed") {
    // Check if dependents are now ready
    // Spawn more agents if capacity allows
  }
}
```

## Best Practices

### 1. Start with Architecture
- Always design before implementing
- Use `architect` agent for API contracts
- Document decisions

### 2. Parallelize Aggressively
- Identify independent tasks
- Run them simultaneously
- Only block on real dependencies

### 3. Test Continuously
- Add QA tasks for all features
- Use automatic rework loops
- Verify before declaring done

### 4. Communicate Clearly
- Use descriptive task titles
- Provide complete context
- Define explicit deliverables

### 5. Monitor Health
- Watch for stuck agents
- Escalate promptly
- Use advisor for complex issues

### 6. Keep Focused
- Each task = one concern
- Avoid scope creep
- Clear boundaries

## CLI Commands

```bash
# Plan and validate tasks
node bin/dsh-squad.mjs plan --goal "Build API with auth and tests"

# Show available agents
node bin/dsh-squad.mjs agents

# Validate task breakdown
node bin/dsh-squad.mjs validate tasks.json

# Analyze dependencies
node bin/dsh-squad.mjs deps tasks.json
```

Add `--json` to any read command (`plan`, `agents`, `validate`, `deps`,
`config show|get|list|models|validate`) or to `config set`/`unset` to get a
single JSON object instead of text; the other commands are text-only.

## Example Workflow

### Request: "Build a blog API with authentication, tests, and docs"

**Step 1: Analyze**
- Backend: Posts CRUD, Auth
- Database: Schema needed
- Tests: Unit + integration
- Docs: API documentation
- Deployment: Docker + CI/CD

**Step 2: Plan Tasks**

```json
{
  "goal": "Build blog API with authentication",
  "tasks": [
    {
      "id": "design",
      "title": "Design API contract and database schema",
      "agent": "architect",
      "depends": []
    },
    {
      "id": "database",
      "title": "Create database schema and migrations",
      "agent": "backend",
      "depends": ["design"]
    },
    {
      "id": "auth",
      "title": "Implement authentication (login, register, JWT)",
      "agent": "backend",
      "depends": ["database"]
    },
    {
      "id": "posts",
      "title": "Implement posts CRUD endpoints",
      "agent": "backend",
      "depends": ["database"]
    },
    {
      "id": "tests",
      "title": "Write integration and unit tests",
      "agent": "qa",
      "depends": ["auth", "posts"]
    },
    {
      "id": "docs",
      "title": "Write API documentation",
      "agent": "docs",
      "depends": ["auth", "posts"]
    },
    {
      "id": "docker",
      "title": "Create Docker configuration",
      "agent": "devops",
      "depends": ["auth", "posts"]
    }
  ],
  "config": {
    "maxConcurrency": 2
  }
}
```

**Step 3: Execute**

1. Spawn `architect` → completes design
2. Spawn `backend` for database → completes schema
3. Spawn `backend` for auth AND posts (parallel)
4. Spawn `qa`, `docs`, `devops` (parallel)
5. Monitor and handle QA verdict
6. Report completion

**Step 4: Review**

After all tasks complete:
- Review QA verdict
- Check test results
- Verify documentation
- Test deployment

## Troubleshooting

### Common Issues

**Issue**: Task stuck in `blocked` state
**Solution**: Check dependency status, complete blocking tasks

**Issue**: Agent not responding
**Solution**: Send message with `send_message`, check health

**Issue**: QA finds bugs
**Solution**: Let automatic rework loop handle it

**Issue**: Too many tasks
**Solution**: Combine related tasks, aim for 3-7 tasks

**Issue**: Dependencies unclear
**Solution**: Use architect to define clear interfaces first

## References

- Agent definitions: `agents/*.json`
- CLI tool: `bin/dsh-squad.mjs`
- Examples: `examples/` directory
- DSH tools documentation: DSH built-in help

## License

MIT