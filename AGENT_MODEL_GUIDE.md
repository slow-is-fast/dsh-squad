# Agent Model 配置指南

## 📊 当前状态

所有agent的model字段都是`null`，表示使用DSH默认模型。

## 🎯 可用模型

根据pstack_catalog，当前可用的模型：

### Bailian (百炼)
- `glm-5` - 通用模型
- `qwen3.7-plus` - 通义千问增强版

### Bailian-TPP (百炼思维链)
- `glm-5.2` - GLM 5.2
- `glm-5.3` - GLM 5.3（最新）
- `deepseek-v4.1-flash` - DeepSeek快速版
- `deepseek-v4.1-flash-1017` - DeepSeek特定版本
- `auto` - 自动选择

---

## 🎯 推荐配置方案

### 方案 1: 性能优先（推荐）

根据agent的任务复杂度和推理需求分配模型：

#### 强推理模型（需要深度思考）
```json
{
  "model": "deepseek-v4.1-flash",
  "thinking": "enabled"
}
```
**适用于**:
- **architect** - 架构设计需要深度推理
- **security** - 安全审计需要专业知识
- **debugger** - 调试需要分析能力
- **reviewer** - 代码审查需要深度理解
- **planner** - 任务规划需要全局思考

#### 中等模型（代码实现）
```json
{
  "model": "glm-5.3",
  "thinking": null
}
```
**适用于**:
- **backend** - API实现
- **frontend** - UI实现
- **fullstack** - 通用开发
- **devops** - CI/CD配置

#### 通用模型（文档和测试）
```json
{
  "model": "glm-5",
  "thinking": null
}
```
**适用于**:
- **qa** - 测试编写
- **docs** - 文档编写
- **researcher** - 信息收集

---

### 方案 2: 成本优化

全部使用中等模型，性价比最高：

```json
{
  "model": "glm-5.3",
  "thinking": null
}
```

**优点**: 
- 成本低
- 速度快
- 质量够用

**缺点**: 
- 复杂推理能力较弱

---

### 方案 3: 自动选择

让系统自动选择最优模型：

```json
{
  "model": "auto",
  "thinking": null
}
```

---

## 📋 具体配置建议

### 1. architect.json
```json
{
  "name": "architect",
  "model": "deepseek-v4.1-flash",
  "thinking": "enabled",
  "reason": "架构设计需要深度推理和创新思维"
}
```

### 2. backend.json
```json
{
  "name": "backend",
  "model": "glm-5.3",
  "thinking": null,
  "reason": "API实现属于常规编码，中等模型足够"
}
```

### 3. frontend.json
```json
{
  "name": "frontend",
  "model": "glm-5.3",
  "thinking": null,
  "reason": "UI实现属于常规编码，中等模型足够"
}
```

### 4. fullstack.json
```json
{
  "name": "fullstack",
  "model": "glm-5.3",
  "thinking": null,
  "reason": "通用开发任务，中等模型平衡成本和质量"
}
```

### 5. qa.json
```json
{
  "name": "qa",
  "model": "glm-5",
  "thinking": null,
  "reason": "测试编写相对简单，基础模型足够"
}
```

### 6. reviewer.json
```json
{
  "name": "reviewer",
  "model": "deepseek-v4.1-flash",
  "thinking": "enabled",
  "reason": "代码审查需要深度理解，需要强模型",
  "tools": ["read", "grep", "glob"]
}
```

### 7. security.json
```json
{
  "name": "security",
  "model": "deepseek-v4.1-flash",
  "thinking": "enabled",
  "reason": "安全审计需要专业知识和深度推理"
}
```

### 8. debugger.json
```json
{
  "name": "debugger",
  "model": "deepseek-v4.1-flash",
  "thinking": "enabled",
  "reason": "调试需要强大的分析和推理能力"
}
```

### 9. devops.json
```json
{
  "name": "devops",
  "model": "glm-5.3",
  "thinking": null,
  "reason": "配置文件编写，中等模型足够"
}
```

### 10. docs.json
```json
{
  "name": "docs",
  "model": "glm-5",
  "thinking": null,
  "reason": "文档编写相对简单，基础模型足够"
}
```

### 11. researcher.json
```json
{
  "name": "researcher",
  "model": "deepseek-v4.1-flash",
  "thinking": "enabled",
  "reason": "研究需要强大的分析和总结能力"
}
```

### 12. planner.json
```json
{
  "name": "planner",
  "model": "deepseek-v4.1-flash",
  "thinking": "enabled",
  "reason": "任务分解和规划需要全局思考能力"
}
```

---

## 🎯 配置优先级

### 第一优先级（强模型）
- architect
- security
- debugger
- reviewer
- researcher
- planner

### 第二优先级（中等模型）
- backend
- frontend
- fullstack
- devops

### 第三优先级（基础模型）
- qa
- docs

---

## 📝 thinking字段说明

### `"thinking": "enabled"`
启用思维链，模型会：
- 展示推理过程
- 更深入地思考问题
- 提供更详细的解释

**适用场景**:
- 复杂推理任务
- 需要详细解释的场景
- 专业领域分析

### `"thinking": null`
不启用思维链，模型会：
- 直接给出答案
- 更快速响应
- 成本更低

**适用场景**:
- 常规编码任务
- 简单文档编写
- 配置文件生成

---

## 💰 成本分析

### 方案1（性能优先）
```
强模型 (6个): deepseek-v4.1-flash
中等模型 (4个): glm-5.3
基础模型 (2个): glm-5

预估成本: 中高
预估质量: 高
```

### 方案2（成本优化）
```
全部中等模型: glm-5.3

预估成本: 低
预估质量: 中等
```

### 方案3（自动选择）
```
自动分配: auto

预估成本: 变化
预估质量: 自动优化
```

---

## 🚀 推荐做法

### 建议：使用方案1（性能优先）

**理由**:
1. ✅ 根据任务复杂度分配模型
2. ✅ 复杂任务用强模型保证质量
3. ✅ 简单任务用中等模型节省成本
4. ✅ 整体质量和成本平衡

### 配置命令

我可以帮您更新所有agent配置文件，添加model字段。

---

**您想使用哪个方案？** 🤔

1. ✅ 方案1：性能优先（推荐）
2. ✅ 方案2：成本优化
3. ✅ 方案3：自动选择
4. ✅ 自定义配置

告诉我您的选择，我会更新配置文件！