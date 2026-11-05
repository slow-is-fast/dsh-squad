# DSH Squad - DSH插件完整实现指南

## 🎯 目标

将dsh-squad从普通skill升级为完整的DSH插件，支持在设置页面配置角色模型。

---

## 📁 已创建的文件

### 1. DSH插件配置
```
✅ dshx.yml           - DSH插件定义
✅ cordis.yml         - Cordis插件注册
✅ tsconfig.json      - TypeScript配置
✅ package.json       - 更新包配置（添加DSH插件依赖）
```

### 2. 插件源码
```
✅ src/index.ts             - 插件主入口
✅ src/ids.ts               - 常量定义
✅ src/settings-routes.ts   - 设置路由
```

---

## 🔧 关键实现

### 1. 插件注册
```typescript
export function apply(ctx: Context): void {
  console.log('[dsh-squad] loaded')
  
  ctx.inject(['webServer', 'connection'], webCtx => {
    registerSquadSettingsRoutes(webCtx)
  })
}
```

### 2. 设置路由
```typescript
// 注册设置section
ctx.webServer.register(SETTINGS_SECTION_ID, {
  order: 17,
  nav: {
    'zh-CN': 'Squad 角色',
    'en-US': 'Squad Roles'
  }
})

// GET/PUT /plugins/dsh-squad/settings
ctx.webServer.get('/plugins/dsh-squad/settings', ...)
ctx.webServer.put('/plugins/dsh-squad/settings', ...)
```

### 3. 配置读写
```typescript
// 从 ~/.dsh/dsh-squad.json 加载
const CONFIG_PATH = join(DSH_HOME, 'dsh-squad.json')

// GET - 读取配置
// PUT - 保存配置
```

---

## 🚀 下一步

### 1. 安装TypeScript依赖
```bash
cd D:\code\dsh-squad
npm install --save-dev typescript @types/node
```

### 2. 编译TypeScript
```bash
npm run build
```

### 3. 安装DSH依赖（可选）
```bash
npm install --save-dev @deepseek-ai/cordis @deepseek-ai/dsh-host-webserver
```

### 4. 安装到DSH
```bash
# 方法1: 使用DSH CLI（如果可用）
dsh plugin add github:slow-is-fast/dsh-squad

# 方法2: 手动安装
# 1. 在DSH中运行插件安装命令
# 2. 重启DSH
# 3. 查看设置页面
```

---

## ⚠️ 重要说明

### 当前状态
- ✅ 已创建插件文件结构
- ✅ 已编写TypeScript代码
- ⚠️ 需要编译和安装

### 需要的依赖
```json
{
  "peerDependencies": {
    "@deepseek-ai/cordis": "^4.0.4",
    "@deepseek-ai/dsh-host-webserver": ">=0.2.1",
    "@deepseek-ai/dsh-client-ui-settings": ">=0.2.1"
  }
}
```

### 编译后
编译后会生成 `lib/index.js` 和 `lib/index.d.ts`

---

## 📋 安装步骤

### 完整流程

1. **安装依赖**
   ```bash
   npm install
   ```

2. **编译TypeScript**
   ```bash
   npm run build
   ```

3. **发布到npm或GitHub**
   ```bash
   git push
   ```

4. **在DSH中安装**
   ```bash
   dsh plugin add github:slow-is-fast/dsh-squad
   ```

5. **重启DSH**
   关闭并重新启动DSH

6. **查看设置**
   打开 DSH Web UI → Settings → Squad Roles

---

## 🎯 验证

安装成功后，您应该在DSH设置页面看到：
- **"Squad Roles"** 或 **"Squad 角色"** 选项
- 可以配置每个角色的模型
- 配置保存在 `~/.dsh/dsh-squad.json`

---

## 🤔 现在的选择

**选项1: 我帮您完成编译和安装**
- 我可以运行编译命令
- 但DSH插件安装可能需要手动操作

**选项2: 您手动完成剩余步骤**
- 安装依赖：`npm install`
- 编译：`npm run build`
- 在DSH中安装插件

**选项3: 暂时使用CLI配置**
- 现有的CLI config命令已经工作
- 可以暂时不创建插件UI

---

**您想选择哪个方案？** 🤔