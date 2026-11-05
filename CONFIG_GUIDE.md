# DSH Squad Configuration Guide

## 📝 配置文件位置

配置文件位于：`config/squad.config.json`

---

## 🎯 配置结构

```json
{
  "agents": {
    "agent-name": {
      "model": "model-name",
      "thinking": "enabled" | null,
      "tools": ["tool1", "tool2"]
    }
  },
  "defaultModel": "default-model-name",
  "settings": {
    "maxParallelTasks": 5,
    "taskTimeout": 600000,
    "retryAttempts": 2,
    "enableQA": true,
    "enableHealthCheck": true
  }
}
```

---

## 🤖 Agent Model 配置

### 为单个agent设置模型

```json
{
  "agents": {
    "architect": {
      "model": "deepseek-v4.1-flash",
      "thinking": "enabled"
    }
  }
}
```

### 可用的模型

根据您的DSH pstack配置：

**推荐模型**：
- `deepseek-v4.1-flash` - 强推理能力，适合复杂任务
- `glm-5.3` - 最新GLM模型，平衡性能和成本
- `glm-5` - 基础模型，适合简单任务
- `auto` - 自动选择

**其他可用模型**：
- `qwen3.7-plus`
- `glm-5.2`
- `deepseek-v4.1-flash-1017`

### Thinking模式

```json
{
  "thinking": "enabled"  // 启用思维链
}
```

启用thinking后，agent会：
- 展示推理过程
- 更深入地思考问题
- 提供详细解释

---

## 📋 推荐配置

### 性能优先配置

```json
{
  "agents": {
    "architect": {
      "model": "deepseek-v4.1-flash",
      "thinking": "enabled"
    },
    "security": {
      "model": "deepseek-v4.1-flash",
      "thinking": "enabled"
    },
    "debugger": {
      "model": "deepseek-v4.1-flash",
      "thinking": "enabled"
    },
    "reviewer": {
      "model": "deepseek-v4.1-flash",
      "thinking": "enabled"
    },
    "researcher": {
      "model": "deepseek-v4.1-flash",
      "thinking": "enabled"
    },
    "planner": {
      "model": "deepseek-v4.1-flash",
      "thinking": "enabled"
    },
    "backend": {
      "model": "glm-5.3"
    },
    "frontend": {
      "model": "glm-5.3"
    },
    "fullstack": {
      "model": "glm-5.3"
    },
    "devops": {
      "model": "glm-5.3"
    },
    "qa": {
      "model": "glm-5"
    },
    "docs": {
      "model": "glm-5"
    }
  }
}
```

### 成本优化配置

```json
{
  "defaultModel": "glm-5.3",
  "agents": {}
}
```

所有agent使用默认的`glm-5.3`模型。

---

## ⚙️ 全局设置

```json
{
  "settings": {
    "maxParallelTasks": 5,        // 最大并行任务数
    "taskTimeout": 600000,        // 任务超时（毫秒）
    "retryAttempts": 2,           // 重试次数
    "enableQA": true,             // 启用QA代理
    "enableHealthCheck": true     // 启用健康检查
  }
}
```

---

## 🔧 使用方法

### 方法1：直接编辑配置文件

编辑 `config/squad.config.json`：

```bash
# 找到配置文件
cd ~/.agents/skills/dsh-squad
vim config/squad.config.json
```

### 方法2：创建本地配置

在项目根目录创建 `.squadrc.json`：

```json
{
  "agents": {
    "architect": {
      "model": "deepseek-v4.1-flash"
    }
  }
}
```

### 方法3：使用环境变量

```bash
export SQUAD_DEFAULT_MODEL=glm-5.3
export SQUAD_ARCHITECT_MODEL=deepseek-v4.1-flash
```

---

## 🎯 配置优先级

配置加载优先级（从高到低）：

1. **环境变量** - `SQUAD_*_MODEL`
2. **本地配置** - `.squadrc.json`
3. **全局配置** - `config/squad.config.json`
4. **Agent定义** - `agents/*.json` 中的 `model` 字段
5. **默认值** - `defaultModel`

---

## 📊 示例配置

### 开发环境配置

```json
{
  "defaultModel": "glm-5.3",
  "settings": {
    "maxParallelTasks": 3,
    "taskTimeout": 300000,
    "enableQA": true
  }
}
```

### 生产环境配置

```json
{
  "agents": {
    "architect": {
      "model": "deepseek-v4.1-flash",
      "thinking": "enabled"
    },
    "backend": {
      "model": "deepseek-v4.1-flash"
    },
    "security": {
      "model": "deepseek-v4.1-flash",
      "thinking": "enabled"
    }
  },
  "settings": {
    "maxParallelTasks": 10,
    "taskTimeout": 900000,
    "enableQA": true,
    "enableHealthCheck": true
  }
}
```

---

## 🔍 验证配置

使用CLI验证配置：

```bash
# 查看当前配置
node bin/dsh-squad.mjs config

# 验证配置文件
node bin/dsh-squad.mjs validate config/squad.config.json
```

---

## 💡 最佳实践

1. **根据任务复杂度选择模型**
   - 复杂推理：`deepseek-v4.1-flash` + thinking
   - 常规开发：`glm-5.3`
   - 简单任务：`glm-5`

2. **使用默认配置简化管理**
   - 设置 `defaultModel` 为常用模型
   - 只为特殊agent覆盖配置

3. **测试配置**
   - 先在小任务上测试配置
   - 确认质量和成本平衡
   - 再应用到生产环境

---

## 🚀 快速开始

1. 复制默认配置：
```bash
cp config/squad.config.json config/squad.config.local.json
```

2. 编辑配置：
```bash
vim config/squad.config.local.json
```

3. 重启DSH会话使配置生效

---

**配置文档**: config/squad.config.json  
**更新日期**: 2026-11-05