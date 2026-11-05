# 🎉 DSH Squad 完整配置指南

## ✅ 配置系统已完全就绪

---

## 📁 配置文件位置

### 1. **DSH全局配置**（推荐）
```
C:\Users\windows\.dsh\dsh-squad.json
```

### 2. **项目配置**（可选）
```
D:\code\dsh-squad\config\squad.config.json
```

---

## 🎯 配置优先级

```
1. DSH全局配置: ~/.dsh/dsh-squad.json        (最高优先级) ✅
2. 项目配置: config/squad.config.json         (中等优先级)
3. 默认值: 代码中的硬编码默认值                (最低优先级)
```

---

## 📊 配置格式

### DSH全局配置格式
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
    }
  }
}
```

### 项目配置格式
```json
{
  "agents": {
    "architect": {
      "model": "deepseek-v4.1-flash",
      "thinking": "enabled"
    }
  },
  "defaultModel": "glm-5.3"
}
```

---

## 🚀 使用方法

### 方法1: 在DSH设置页面配置

1. 打开DSH Web UI
2. 进入 Settings -> pstack角色
3. 找到对应的agent（如architect）
4. 设置provider和model

**注意**: DSH会自动保存到 `~/.dsh/dsh-squad.json`

### 方法2: 使用CLI命令

```bash
# 查看当前配置
node bin/dsh-squad.mjs config show

# 设置agent模型
node bin/dsh-squad.mjs config set architect model deepseek-v4.1-flash

# 验证配置
node bin/dsh-squad.mjs config validate
```

### 方法3: 直接编辑配置文件

```bash
# 编辑DSH全局配置
vim C:\Users\windows\.dsh\dsh-squad.json

# 或编辑项目配置
vim D:\code\dsh-squad\config\squad.config.json
```

---

## 📋 当前配置状态

### ✅ 已配置的agents
```
architect:    deepseek-v4.1-flash (thinking: enabled)
backend:      glm-5.3
frontend:     glm-5.3
fullstack:    glm-5.3
qa:           glm-5
reviewer:     deepseek-v4.1-flash (thinking: enabled)
security:     deepseek-v4.1-flash (thinking: enabled)
debugger:     deepseek-v4.1-flash (thinking: enabled)
devops:       glm-5.3
docs:         glm-5
researcher:   deepseek-v4.1-flash (thinking: enabled)
planner:      deepseek-v4.1-flash (thinking: enabled)
```

---

## 🎯 推荐配置

### 性能优先（已配置）
- 强模型：architect, security, debugger, reviewer, researcher, planner
- 中等模型：backend, frontend, fullstack, devops
- 基础模型：qa, docs

### 成本优化
```json
{
  "roles": {}
}
```
所有agents使用默认的 `glm-5.3`

---

## 🔧 配置验证

```bash
# 验证配置正确性
node bin/dsh-squad.mjs config validate
# 输出: ✓ Configuration is valid

# 测试单个agent配置
node bin/dsh-squad.mjs config get architect
# 输出: architect Configuration:
#   model: deepseek-v4.1-flash
#   thinking: enabled
```

---

## 📝 配置更新流程

### 自动更新（推荐）
1. 在DSH设置页面修改
2. 自动保存到 `~/.dsh/dsh-squad.json`
3. 下次运行自动加载

### 手动更新
1. 编辑配置文件
2. 或使用CLI命令
3. 立即生效（无需重启）

---

## 🎉 总结

### ✅ 已实现
- ✅ DSH全局配置文件
- ✅ 配置加载优先级
- ✅ DSH格式转换
- ✅ CLI配置命令
- ✅ 配置验证

### ✅ 配置方式
1. DSH设置页面（UI）
2. CLI命令
3. 直接编辑文件

### ✅ 配置位置
- **推荐**: `C:\Users\windows\.dsh\dsh-squad.json`
- **可选**: `config/squad.config.json`

---

## 🚀 立即可用！

配置系统已完全就绪，您现在可以：

1. ✅ 在DSH设置页面配置agent模型
2. ✅ 使用CLI命令管理配置
3. ✅ 直接编辑配置文件

**配置已生效并测试通过！** 🎉