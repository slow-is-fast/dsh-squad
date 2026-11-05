# DSH Squad 角色配置集成方案

## 📊 参考分析：pstack-dsh

### 配置文件位置
```
C:\Users\windows\.dsh\pstack-dsh.json
```

### 配置格式
```json
{
  "version": 1,
  "roles": {
    "feature": {
      "inherit": false,
      "routes": [
        {
          "provider": "bailian",
          "model": "glm-5"
        }
      ]
    }
  }
}
```

### 关键字段说明
- **version**: 配置版本（当前为1）
- **roles**: 角色配置（类似dsh-squad的agents）
- **inherit**: 是否继承父会话配置
- **routes**: 模型路由数组
  - **provider**: 模型提供商（bailian, bailian-tpp等）
  - **model**: 模型名称

---

## 🎯 dsh-squad配置方案

### 方案1: 创建dsh-squad.json（推荐）

在 `~/.dsh/` 目录下创建配置文件：

**位置**: `C:\Users\windows\.dsh\dsh-squad.json`

**格式**:
```json
{
  "version": 1,
  "roles": {
    "architect": {
      "inherit": true,
      "routes": [
        {
          "provider": "bailian-tpp",
          "model": "deepseek-v4.1-flash"
        }
      ],
      "thinking": "enabled"
    },
    "backend": {
      "inherit": true,
      "routes": [
        {
          "provider": "bailian-tpp",
          "model": "glm-5.3"
        }
      ]
    },
    "frontend": {
      "inherit": true,
      "routes": [
        {
          "provider": "bailian-tpp",
          "model": "glm-5.3"
        }
      ]
    }
  }
}
```

---

## 🔧 实现步骤

### 第一步：创建配置文件

```bash
# 创建配置文件
vim C:\Users\windows\.dsh\dsh-squad.json
```

### 第二步：更新loadConfig()

修改 `lib/core.mjs`:

```javascript
export function loadConfig() {
  // 1. 优先从 ~/.dsh/dsh-squad.json 加载
  const homeConfigPath = join(process.env.USERPROFILE || process.env.HOME, '.dsh', 'dsh-squad.json');
  
  try {
    if (existsSync(homeConfigPath)) {
      const content = readFileSync(homeConfigPath, 'utf-8');
      const dshConfig = JSON.parse(content);
      
      // 转换为内部格式
      const config = {
        agents: {},
        defaultModel: 'glm-5.3',
        settings: {}
      };
      
      for (const [roleName, roleConfig] of Object.entries(dshConfig.roles)) {
        if (roleConfig.routes && roleConfig.routes.length > 0) {
          config.agents[roleName] = {
            model: roleConfig.routes[0].model,
            thinking: roleConfig.thinking || null
          };
        }
      }
      
      return config;
    }
  } catch (error) {
    console.error(`Warning: Failed to load config from ${homeConfigPath}: ${error.message}`);
  }
  
  // 2. 回退到项目配置
  const projectConfigPath = join(__dirname, '..', 'config', 'squad.config.json');
  // ... 原有逻辑
}
```

### 第三步：添加DSH配置UI支持

创建 `dshx.yml` 文件：

```yaml
name: dsh-squad
version: 1.1.0
description: Multi-agent collaboration for complex tasks
roles:
  - architect
  - backend
  - frontend
  - fullstack
  - qa
  - reviewer
  - security
  - debugger
  - devops
  - docs
  - researcher
  - planner
```

---

## 📋 使用方式

### 在DSH设置页面

1. 打开DSH Web UI: http://127.0.0.1:54928
2. 进入 Settings -> pstack角色
3. 找到对应的agent（如architect）
4. 设置模型路由

### 使用CLI命令

```bash
# 查看配置
node bin/dsh-squad.mjs config show

# 设置模型
node bin/dsh-squad.mjs config set architect model deepseek-v4.1-flash
```

---

## 🎯 推荐实现顺序

### 1. 立即可做（我来实现）
- ✅ 创建 `C:\Users\windows\.dsh\dsh-squad.json`
- ✅ 更新 `loadConfig()` 支持DSH配置
- ✅ 添加配置转换逻辑

### 2. 需要测试
- 在DSH设置页面验证配置生效
- 测试配置加载优先级

### 3. 需要了解
- DSH设置页面如何识别角色
- 是否需要特殊注册

---

## 🚀 现在开始实现

我可以立即：
1. 创建DSH配置文件
2. 更新加载逻辑
3. 测试配置系统

**您想现在开始吗？** 🤔