---
name: debate-agent
description: 构建一个三角色 AI 辩论系统，包含正方、反方和法官三个 Agent，按照固定辩论流程（立论→质询→自由辩论→总结）针对任意辩题展开辩论。当用户说"辩论"、"正反方辩论"、"AI辩论"、"帮我辩论一个话题"、"对这个话题进行辩论"、"搞一场辩论"，或者提供一个网站/话题并希望用辩论形式分析时，必须使用此 skill。即使用户只是说"这个话题我们来辩一辩"也应触发。
---

# 辩论 Agent 系统

本 skill 指导 Claude 以三个 Agent 身份（正方、反方、法官）对一个辩题进行结构化辩论。每个 Agent 有独立的角色设定、发言规则和 System Prompt，通过 Anthropic API 串行调用，输出完整辩论过程。

## 系统架构

```
用户输入辩题
     ↓
法官宣布开场 (Judge Agent)
     ↓
正方立论 (Pro Agent)
     ↓
反方立论 (Con Agent)
     ↓
法官过渡 (Judge Agent)
     ↓
反方质询正方 (Con Agent → 提问)
正方应答 (Pro Agent → 回答)
正方质询反方 (Pro Agent → 提问)
反方应答 (Con Agent → 回答)
     ↓
法官过渡 (Judge Agent)
     ↓
自由辩论 (Pro/Con 交替, 3~4轮)
     ↓
法官过渡 (Judge Agent)
     ↓
反方总结 (Con Agent)
正方总结 (Pro Agent)
     ↓
法官评判与宣判 (Judge Agent)
```

## 辩论流程（固定四段式）

| 阶段 | 说明 | 发言方 | 字数限制 |
|------|------|--------|---------|
| 立论 | 阐明己方核心立场和论点 | 正方 → 反方 | 各 300~400 字 |
| 质询 | 向对方提问，挑战其论点漏洞 | 双方各问一轮 | 问题 80 字内，回答 150 字内 |
| 自由辩论 | 快节奏交锋，直接回应对方 | 交替 3~4 轮 | 每轮 100~150 字 |
| 总结陈词 | 总结己方最强论点，升华立场 | 反方先 → 正方后 | 各 200~250 字 |

---

## 实现方式：使用 Anthropic API 创建 React Artifact

在 Claude.ai 中，通过创建一个 **React Artifact** 来实现此辩论系统。Artifact 内调用 Anthropic API，依次驱动三个 Agent。

### Step 1：确定辩题

- 若用户直接提供辩题 → 使用该辩题
- 若用户提供网站 URL → 先调用 web_search 获取该网站的热门话题或核心议题，再从中提炼辩题
- 辩题格式：陈述句，可明确正反两方立场（例："人工智能的发展利大于弊"）

### Step 2：构建 React Artifact

读取 `/mnt/skills/public/frontend-design/SKILL.md` 以获取 UI 设计规范。

构建一个视觉精良的辩论界面，包含：

**UI 组成：**
- 顶部：辩题展示 + 辩论阶段进度条
- 中央滚动区：辩论发言记录（气泡/卡片式，正方/反方/法官各有颜色）
- 底部：当前状态指示（"正方立论中…"）+ 开始按钮

**颜色规范：**
- 正方（Pro）：蓝色系（`#2563EB`）
- 反方（Con）：红色系（`#DC2626`）
- 法官（Judge）：金色/中性（`#B45309`）
- 背景：深色沉浸感（`#0F172A`）

### Step 3：Agent System Prompts

在 Artifact 代码中为三个 Agent 定义各自的 system prompt：

#### 法官 Agent（Judge）
```
你是一场正式辩论赛的法官。你的职责是：
1. 宣布辩题和辩论规则
2. 在各阶段之间做简短的过渡宣告（1~2句话）
3. 在辩论结束后，从以下维度做出公正评判：
   - 论点的逻辑严密性（30分）
   - 论据的事实支撑（30分）
   - 对对方论点的回应质量（25分）
   - 语言表达与感染力（15分）
4. 给出总分并宣布获胜方，并说明理由（200字以内）
语气：权威、中立、简洁。不发表个人立场。
```

#### 正方 Agent（Pro）
```
你是辩论赛正方辩手。辩题为：{{TOPIC}}
你的立场：支持该辩题。
规则：
- 立论阶段：提出3个有力论点，每个论点有具体论据支撑
- 质询阶段：针对反方论点的逻辑漏洞或事实错误提问
- 自由辩论：快速直接反驳对方，不重复自己已说过的内容
- 总结陈词：提炼最核心的1~2个论点，升华立场，有感染力
语气：自信、有逻辑、富有激情。不能承认己方立场有误。
当前对话历史：{{HISTORY}}
你现在的任务：{{TASK}}
```

#### 反方 Agent（Con）
```
你是辩论赛反方辩手。辩题为：{{TOPIC}}
你的立场：反对该辩题。
规则：
- 立论阶段：提出3个有力论点，每个论点有具体论据支撑
- 质询阶段：针对正方论点的逻辑漏洞或事实错误提问
- 自由辩论：快速直接反驳对方，不重复自己已说过的内容
- 总结陈词：提炼最核心的1~2个论点，升华立场，有感染力
语气：冷静、犀利、有说服力。不能承认己方立场有误。
当前对话历史：{{HISTORY}}
你现在的任务：{{TASK}}
```

### Step 4：API 调用逻辑

在 React Artifact 中，按辩论流程顺序串行调用 API：

```javascript
// 辩论步骤序列
const DEBATE_STEPS = [
  { agent: 'judge', task: '宣布辩题和辩论规则开场白（100字以内）', label: '开场' },
  { agent: 'pro',   task: '请进行立论发言（300~400字）', label: '正方立论' },
  { agent: 'con',   task: '请进行立论发言（300~400字）', label: '反方立论' },
  { agent: 'judge', task: '宣布进入质询阶段（1句话）', label: '进入质询' },
  { agent: 'con',   task: '请向正方提出1个质询问题（80字以内，针对其论点漏洞）', label: '反方质询' },
  { agent: 'pro',   task: '请回应反方的质询（150字以内）', label: '正方应答' },
  { agent: 'pro',   task: '请向反方提出1个质询问题（80字以内，针对其论点漏洞）', label: '正方质询' },
  { agent: 'con',   task: '请回应正方的质询（150字以内）', label: '反方应答' },
  { agent: 'judge', task: '宣布进入自由辩论阶段（1句话）', label: '进入自由辩论' },
  { agent: 'pro',   task: '自由辩论第1轮：直接反驳反方最弱的论点（100~150字）', label: '正方辩论1' },
  { agent: 'con',   task: '自由辩论第1轮：直接反驳正方刚才的发言（100~150字）', label: '反方辩论1' },
  { agent: 'pro',   task: '自由辩论第2轮：继续强化己方立场（100~150字）', label: '正方辩论2' },
  { agent: 'con',   task: '自由辩论第2轮：继续强化己方立场（100~150字）', label: '反方辩论2' },
  { agent: 'judge', task: '宣布进入总结陈词阶段（1句话）', label: '进入总结' },
  { agent: 'con',   task: '请进行总结陈词（200~250字）', label: '反方总结' },
  { agent: 'pro',   task: '请进行总结陈词（200~250字）', label: '正方总结' },
  { agent: 'judge', task: '请对本场辩论做出评判，给出双方得分和获胜方（200字以内）', label: '法官评判' },
];

// 构建每次 API 调用的 messages
function buildMessages(agent, task, topic, history) {
  const systemPrompt = getSystemPrompt(agent, topic, history, task);
  return [{ role: 'user', content: task }];
  // system 通过 system 字段传递
}

// 每步调用
async function runStep(step, topic, history) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: getSystemPrompt(step.agent, topic, history, step.task),
      messages: [{ role: 'user', content: step.task }],
    }),
  });
  const data = await response.json();
  return data.content[0].text;
}
```

**历史记录格式：** 将已完成步骤拼接为字符串传入 `{{HISTORY}}`：
```
[开场] 法官：...
[正方立论] 正方：...
[反方立论] 反方：...
```

### Step 5：UI 交互行为

- 点击「开始辩论」→ 依次执行所有步骤，每步完成后立即追加到界面，自动滚动到最新发言
- 每条发言加载时显示打字动画（streaming 效果可选）
- 进度条随步骤推进更新
- 辩论结束后显示「法官评判」卡片，高亮获胜方

---

## 注意事项

1. **保持角色一致性**：每次 API 调用都传入完整历史，确保 Agent 不自相矛盾
2. **中文辩论**：所有发言默认使用中文，除非用户指定其他语言
3. **控制长度**：严格在 system prompt 中限制字数，避免发言过长
4. **错误处理**：若 API 调用失败，显示错误提示并允许用户重试该步骤
5. **辩题平衡性**：若辩题明显偏向一方（如事实性问题），提示用户换一个更具争议性的话题

---

## 参考文件

- `references/debate-rules.md` — 中国大学辩论赛规则详细说明（可选读取，用于更严格的规则校验）
- `references/topic-examples.md` — 50 个适合 AI 辩论的话题示例（当用户需要推荐话题时读取）
