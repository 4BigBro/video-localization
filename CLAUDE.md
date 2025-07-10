下面是一个完善版的 `CLAUDE.md`，不仅包含了严格的测试要求与 Claude Code 工作流规则，还补充了你的 **项目目标、模块规划、执行原则与约束条件**，适用于 `video-localization` 这样的自动化本地视频翻译工作流项目：

---

## 📄 CLAUDE.md

```markdown
# Claude Code 项目配置文档

本文件定义了 Claude 助手在本项目中的行为规范、开发原则、测试策略与项目上下文信息。所有由 Claude 自动生成的修改（包括代码、PR、修复、评论）必须遵循本规范执行。

---

## 🎯 项目背景与目标

本仓库 [`video-localization`] 是一个自动化**本地视频翻译与重制工具链**，目标是将任意本地视频：

1. 提取原始音轨；
2. 进行高质量语音识别（转写）；
3. 翻译字幕；
4. 使用中文 TTS 合成语音；
5. 重新生成含中文配音的视频。

该流程将支持本地运行、跨平台兼容，适用于媒体、教育、内容创作者等场景。

---

## 🧱 项目模块规划

项目模块结构参考如下：

```

/src
├── extract/        # 音频提取模块（如 ffmpeg 包装器）
├── transcribe/     # 转录模块（Whisper、OpenAI API 或本地模型）
├── translate/      # 字幕翻译（支持 Claude/OpenAI/DeepL 等）
├── synthesize/     # 中文语音合成（如 IndexTTS、EdgeTTS 等）
├── merge/          # 合成视频（将新语音与原视频同步）
└── cli/            # 命令行入口

/tests                # 所有单元测试（保持与 src 同结构）
/scripts              # 本地辅助脚本（如 format、setup、dev 等）
/configs              # 配置管理（模型参数、TTS 选项）

````

---

## 🧪 严格测试要求

Claude 助手执行任何修改、PR 或修复任务时，必须执行下列验证命令，**所有步骤通过后才可提交变更**：

```bash
pnpm lint        # 静态检查
pnpm typecheck   # 类型检查
pnpm test        # 单元测试（Vitest 或 Jest）
pnpm run build   # 可选：构建/编译验证
````

### ✅ 特别说明：

* 所有新增功能必须配备测试；
* 所有 bug 修复必须新增或补充测试；
* 测试覆盖率应维持不降（建议 80%+）；
* 不允许提交 `.skip`, `.only`, `console.log` 等调试代码。

---

## 🤖 Claude 助手行为规范

Claude 在收到命令时，应：

1. 阅读并理解任务描述（PR 评论、Issue、commit message）；
2. 分析对应模块及依赖；
3. 修改代码并确保逻辑正确；
4. 创建/更新测试文件；
5. 本地运行所有验证命令；
6. 所有步骤通过后创建 PR；
7. PR 中应包含：

   * 变更说明
   * 测试说明
   * 关联 Issue（如 `Closes #42`）

若任一验证失败，Claude 不应提交或合并该变更。

---

## 🧭 Claude 可使用的工具（针对 Base Action）

```yaml
allowed_tools:
  - Bash(pnpm lint)
  - Bash(pnpm typecheck)
  - Bash(pnpm test)
  - Bash(pnpm run build)
  - Write
  - View
  - GlobTool
  - GrepTool
```

---

## 📋 PR 创建规范

Claude 创建的 Pull Request 必须满足以下条件：

* **标题规范**：

  * `feat: 添加 xxx 模块`
  * `fix: 修复 xxx 错误`
  * `test: 补充 xxx 测试`
* **内容规范**：

  * 描述变更目的、方式、影响；
  * 所涉及模块与测试情况；
  * 必须自动关联相关 Issue；
* **CI 状态**：所有 GitHub Actions 验证必须通过。

---

## 🚫 禁止行为列表

Claude 助手在运行过程中不得执行以下操作：

* 修改 `.github/workflows/` 配置（除非明确任务）
* 删除测试代码
* 忽略测试失败继续提交
* 跳过验证步骤或覆盖 CLI 检查输出
* 使用未经审核的外部依赖

---

## 📌 任务示例

以下命令可作为触发 Claude 自动处理的模板：

```text
@claude implement audio extraction using ffmpeg
@claude fix out-of-sync issue in TTS merge
@claude add tests for transcribe/whisper.ts
@claude refactor translate/index.ts for better modularity
```

---

## 🛠️ CI 集成说明

本项目自动执行如下 GitHub Actions 工作流：

```yaml
on: [push, pull_request]

jobs:
  validate:
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
      - run: pnpm run build
```

CI 结果将自动反馈至 PR 状态，Claude 助手不可绕过该检查流程。

---

## 🧠 高阶建议

* 使用 Claude 实现复杂模块时，推荐将任务拆解为子步骤（通过多个 PR 分批完成）；
* Claude 可以在 PR 中添加 Markdown 说明以辅助人类评审；
* 若出现模糊或冲突，Claude 应请求人类确认再继续执行。

---

# 🔚 结束语

本 `CLAUDE.md` 是 Claude Code 工作流行为的唯一约束文件，所有 Claude 任务行为必须严格遵循此文档。请勿随意修改，所有更新应经过代码审查与团队共识。

```

---

