# DSH Squad 配置UI集成方案

## 📊 当前状态

DSH有Web GUI界面运行在 `http://127.0.0.1:60765`

---

## 🎯 集成方案

### 方案1: 配置文件编辑器

在DSH Web GUI中添加配置文件编辑器：

**实现方式**：
1. 创建Web配置界面
2. 读取和编辑 `config/squad.config.json`
3. 提供表单界面设置每个agent的模型

**优点**：
- ✅ 用户友好的界面
- ✅ 实时预览配置
- ✅ 验证配置正确性

**缺点**：
- ❌ 需要开发Web界面
- ❌ 需要后端API支持

---

### 方案2: 命令行配置工具

扩展CLI工具提供配置命令：

```bash
# 查看当前配置
node bin/dsh-squad.mjs config show

# 设置agent模型
node bin/dsh-squad.mjs config set architect model deepseek-v4.1-flash

# 启用thinking
node bin/dsh-squad.mjs config set architect thinking enabled

# 重置配置
node bin/dsh-squad.mjs config reset
```

**优点**：
- ✅ 简单易用
- ✅ 无需Web开发
- ✅ 可脚本化

**缺点**：
- ❌ 需要命令行操作

---

### 方案3: DSH原生集成

利用DSH的配置系统：

**实现方式**：
1. 在SKILL.md中定义配置schema
2. DSH自动识别并生成配置UI
3. 用户在DSH设置中配置

**优点**：
- ✅ 原生集成
- ✅ 统一的UI体验
- ✅ 无需额外开发

**缺点**：
- ❌ 需要了解DSH配置API
- ❌ 依赖DSH功能

---

## 🎯 推荐方案

### 混合方案（推荐）

1. **CLI配置工具**（立即实现）
   - 添加config命令
   - 支持查看/设置/重置配置
   - 提供验证功能

2. **配置文件schema**（为未来集成准备）
   - 定义JSON Schema
   - 支持DSH自动识别
   - 文档化配置选项

3. **Web配置界面**（可选）
   - 如果DSH支持插件UI
   - 可以后续添加

---

## 📋 CLI配置命令设计

### 命令列表

```bash
# 查看配置
dsh-squad config show
dsh-squad config get <agent>
dsh-squad config get-all

# 设置配置
dsh-squad config set <agent> model <model-name>
dsh-squad config set <agent> thinking enabled|disabled
dsh-squad config set-default <model-name>

# 验证配置
dsh-squad config validate
dsh-squad config test <agent>

# 重置配置
dsh-squad config reset
dsh-squad config reset <agent>

# 导入导出
dsh-squad config export > my-config.json
dsh-squad config import < config.json
```

### 示例用法

```bash
# 查看所有agent配置
node bin/dsh-squad.mjs config show

# 设置architect使用强模型
node bin/dsh-squad.mjs config set architect model deepseek-v4.1-flash
node bin/dsh-squad.mjs config set architect thinking enabled

# 设置默认模型
node bin/dsh-squad.mjs config set-default glm-5.3

# 验证配置
node bin/dsh-squad.mjs config validate

# 测试配置
node bin/dsh-squad.mjs config test architect
```

---

## 🔧 实现步骤

### 第一步：添加config命令

修改 `bin/dsh-squad.mjs`：

```javascript
function configCommand(action, ...args) {
  const config = loadConfig();
  
  switch(action) {
    case 'show':
      console.log(JSON.stringify(config, null, 2));
      break;
    case 'get':
      // 获取单个agent配置
      break;
    case 'set':
      // 设置配置
      break;
    // ... 更多命令
  }
}
```

### 第二步：创建配置schema

创建 `config/squad.config.schema.json`：

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "agents": {
      "type": "object",
      "properties": {
        "architect": {
          "type": "object",
          "properties": {
            "model": {
              "type": "string",
              "enum": ["deepseek-v4.1-flash", "glm-5.3", "glm-5", "auto"]
            },
            "thinking": {
              "type": "string",
              "enum": ["enabled", null]
            }
          }
        }
      }
    }
  }
}
```

### 第三步：更新帮助信息

更新SKILL.md和README.md说明配置方法。

---

## 🎯 下一步建议

### 立即实现
1. ✅ 添加CLI config命令
2. ✅ 创建配置schema
3. ✅ 更新文档

### 未来扩展
1. 📋 DSH原生UI集成（待了解DSH API）
2. 📋 Web配置界面（可选）

---

## 💡 当前可用方法

### 用户现在可以：

1. **直接编辑配置文件**
   ```bash
   vim config/squad.config.json
   ```

2. **使用环境变量**
   ```bash
   export SQUAD_ARCHITECT_MODEL=deepseek-v4.1-flash
   ```

3. **查看配置**
   ```bash
   node bin/dsh-squad.mjs agents
   ```

---

## 🤔 您的选择

**我建议先实现CLI config命令**，因为：
- ✅ 立即可用
- ✅ 无需了解DSH内部API
- ✅ 可以脚本化和自动化
- ✅ 为未来UI集成做准备

**您想：**
1. ✅ 立即添加CLI config命令
2. ✅ 了解DSH UI集成方式
3. ✅ 保持当前配置文件方式

告诉我您的选择！