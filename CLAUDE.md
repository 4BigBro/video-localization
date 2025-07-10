当然，以下是一个结合 **Claude Code Action + GitHub Actions** 工作流、强调**严格测试与自动检查**的 `CLAUDE.md` 示例配置文件，适用于你的项目（如你正在做的 `video-localization` 工程）：

---

### 📄 CLAUDE.md（放置于仓库根目录）

```markdown
# Claude Code 项目配置

本项目严格采用 TDD（测试驱动开发）模式，所有代码变更必须符合以下约定，Claude 执行任务时需严格遵循。

---

## ✅ 项目准则

- **语言**：主要使用 TypeScript、Shell Script、Python。
- **风格指南**：
  - TypeScript 遵循 Airbnb 风格。
  - 使用 Prettier 自动格式化，ESLint 做静态检查。
  - 变量命名需语义明确，避免使用缩写。
- **模块划分清晰**，所有功能需拆分为可测试的函数。
- **Git 提交必须通过测试**（详见下文 "提交标准"）。

---

## 🧪 测试规范

Claude 生成代码或修复问题时，必须：

1. 添加相应的 **单元测试** 或更新已有测试；
2. 所有测试需通过，包括但不限于：
   - `pnpm test`
   - `pnpm lint`
   - `pnpm typecheck`（如启用 TypeScript 严格模式）
3. 禁止提交跳过测试（如 `.only`、`.skip`）的内容。

---

## 🧱 目录结构约定（示例）

```

/src            # 主代码目录
/core         # 核心模块
/cli          # 命令行接口逻辑
/utils        # 工具方法
/tests          # Jest 或 Vitest 测试
/scripts        # 本地脚本

````

---

## 🧭 Claude 执行行为准则

### 🔧 在收到任务时，Claude 应遵循以下逻辑：

1. 解析 issue 或评论内容，明确需求；
2. **优先分析现有代码结构和上下文**；
3. 编写实现代码，并放在合适模块；
4. 同时编写对应测试文件（保持覆盖率）；
5. 运行以下命令确保提交质量：
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
````

若有任何一项失败，应拒绝提交或创建 PR。

---

## 📦 PR 标准流程

Claude 自动创建 PR 时需遵守：

* PR 名需简洁明了（如：`feat: 支持字幕翻译功能`）
* PR 描述需包含：

  * 实现说明
  * 测试说明
  * 潜在影响区域
* 若与某 Issue 相关，自动关闭语句需写明（如：`Closes #23`）

---

## 🧠 示例触发语句

* `@claude implement subtitle translation feature`
* `@claude fix panic in audio extractor`
* `@claude add tests for video merge logic`

---

## 📛 禁止行为

* 提交未测试代码
* 删除现有测试覆盖
* 绕过 CI 检查
* 修改 workflow 而未说明目的

---

## 📌 附加说明

如遇复杂任务，Claude 可在 PR 说明中添加分析思路，并提示人类复审。

---

````

---

### ✅ 建议搭配的 GitHub Actions 检查项（在 `.github/workflows/ci.yml`）

```yaml
name: CI Check
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - run: pnpm install
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
````

---

