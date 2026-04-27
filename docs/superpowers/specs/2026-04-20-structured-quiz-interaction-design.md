# Structured Quiz Interaction - 结构化问答交互设计

## 背景

当前 Skill Bounty 平台的任务都是以长文本问题呈现，用户在一个文本框中输入完整回答。这种方式对于开放式问题很好，但对于客观题（选择、填空）来说体验不够友好。本设计引入**结构化问答交互**，支持单选、多选、填空三种题型，可混合使用，支持随机化题目顺序，提供即时反馈，提升学习体验。

## 设计目标

1. **支持多种题型**：单选、多选、填空，同一任务可混合使用
2. **灵活随机化**：可配置随机打乱题目顺序、选项顺序，支持从题库抽题
3. **即时视觉反馈**：用户作答后立即显示对错
4. **自动评分**：前端自动计算总分，后端映射到标准四维度评分
5. **进度保存**：复用现有 `interactionRound` 基础设施，支持断点续做

## 架构设计

### 后端

复用现有的 `interaction` API 框架（`/api/interaction/*`）：
- `GET /history/:taskId` - 恢复进度
- `POST /start/:taskId` - 开始新会话
- `POST /step/:taskId` - 保存当前答题状态（gameState）
- `POST /finish/:taskId` - 完成并提交评分
- `POST /reset/:taskId` - 重置重做

无需新增后端路由，只需前端新增组件处理结构化数据。

### 前端

新增组件：
- `frontend/src/components/StructuredQuiz.tsx` - 主组件，协调整个测验
- 内部按题型拆分渲染逻辑（不单独拆文件，保持简洁）

新增 interactionType: `"structured"`

## Configuration Schema

`Task.interactionConfig` JSON 格式：

```typescript
interface StructuredConfig {
  title: string;
  description: string;
  questions: StructuredQuestion[];
  // Randomization options
  randomizeQuestions?: boolean;    // Randomize question order
  randomizeOptions?: boolean;       // Randomize option order within each question
  selectN?: number;                 // Randomly select N questions from question bank
  // Passing requirements
  passThreshold?: number;          // Percentage required to pass (default: 60)
}

type StructuredQuestion = SingleChoiceQuestion | MultipleChoiceQuestion | FillBlankQuestion;

interface SingleChoiceQuestion {
  id: string;
  type: 'single';
  question: string;
  options: Array<{
    id: string;
    text: string;
    correct: boolean;
  }>;
  points: number; // default: 10
}

interface MultipleChoiceQuestion {
  id: string;
  type: 'multiple';
  question: string;
  options: Array<{
    id: string;
    text: string;
    correct: boolean;
  }>;
  points: number;
  minSelected?: number; // Hint text: "Select at least X"
  maxSelected?: number; // Hint text: "Select at most X"
}

interface FillBlankQuestion {
  id: string;
  type: 'fill';
  // Question text with placeholders: "The __1__ brown fox jumps over the __2__ dog"
  // Placeholder format: __<number>__
  question: string;
  blanks: Array<{
    id: string;
    answer: string;      // Multiple accepted answers separated by |, /regex/ for pattern matching
    placeholder?: string; // Input placeholder
    caseInsensitive?: boolean; // default: true
  }>;
  points: number; // Total points for this question, split across blanks
}
```

## 评分算法

### 单选题
```
选中正确选项 → 得满分
否则 → 0 分
```

### 多选题
评分公式：
```
score = (correctSelected - incorrectSelected) / totalCorrect * points
```
- `correctSelected` = 正确选项被选中的数量
- `incorrectSelected` = 错误选项被选中的数量
- `totalCorrect` = 总共有多少个正确选项
- 结果 clamp 到 [0, points]

### 填空题
```
每个空白匹配正确 → 分得该空白应得分值 (points / numBlanks)
否则 → 0
```
匹配规则：
- 如果 `answer` 包含 `|` → 任意一个匹配即正确
- 如果 `answer` 以 `/` 开头并以 `/` 结尾 → 正则匹配
- 默认不区分大小写（可配置 `caseInsensitive: false` 关闭）

## 工作流程

1. **初始化**
   - Arena 检测 `interactionType === "structured"`
   - 渲染 `StructuredQuiz` 组件
   - 调用 `interactionApi.start()` 获取 sessionId
   - 如果有历史进度，恢复用户答案

2. **随机化处理**（如果配置开启）
   - 如果 `randomizeQuestions` → 打乱题目数组顺序
   - 如果 `selectN` → 从题库中随机选 N 题
   - 如果 `randomizeOptions` → 每题选项都打乱顺序（保持正确答案依旧正确）

3. **用户交互**
   - 单选：点击选项选中，取消之前选中
   - 多选：点击切换选中状态，允许多选
   - 填空：每个占位符对应一个输入框，用户输入

4. **提交评分**
   - 用户点击"交卷"按钮
   - 前端按上述算法计算每题得分和总分
   - 显示得分详情（每题对错标记，总分百分比）
   - 保存最终状态到后端 `interactionApi.finish()`
   - 后端将总分百分比映射到四维度评分，创建 submission

5. **重置**
   - 用户可以点击"重置"清空所有答案，重新开始

## 样式设计

- 复用现有 CSS 变量和深色主题
- 未作答：中性边框
- 作答后：正确 → 绿色边框背景，错误 → 红色边框背景
- 总分显示进度条，及格变绿色，不及格红色
- 移动端自适应

## 示例配置

```json
{
  "title": "JavaScript 基础测验",
  "description": "测试你对 JavaScript 基础概念的理解",
  "randomizeQuestions": true,
  "randomizeOptions": true,
  "passThreshold": 60,
  "questions": [
    {
      "id": "q1",
      "type": "single",
      "question": "JavaScript 中，下列哪个不是原始数据类型？",
      "points": 10,
      "options": [
        { "id": "a", "text": "String", "correct": false },
        { "id": "b", "text": "Number", "correct": false },
        { "id": "c", "text": "Array", "correct": true },
        { "id": "d", "text": "Boolean", "correct": false }
      ]
    },
    {
      "id": "q2",
      "type": "multiple",
      "question": "下列哪些方法可以在 JavaScript 中声明变量？",
      "points": 10,
      "minSelected": 2,
      "options": [
        { "id": "a", "text": "var", "correct": true },
        { "id": "b", "text": "let", "correct": true },
        { "id": "c", "text": "const", "correct": true },
        { "id": "d", "text": "def", "correct": false }
      ]
    },
    {
      "id": "q3",
      "type": "fill",
      "question": "在 JavaScript 中，使用____1____声明块级作用域变量，使用____2____声明常量。",
      "points": 10,
      "blanks": [
        {
          "id": "b1",
          "answer": "let|Let",
          "placeholder": "输入关键词"
        },
        {
          "id": "b2",
          "answer": "const|Const",
          "placeholder": "输入关键词"
        }
      ]
    }
  ]
}
```

## 兼容性

- 不影响现有任务和交互类型
- 数据库无需迁移，`interactionConfig` 是自由 JSON 字段
- 进度保存兼容现有 `gameState` 格式，存储用户当前答案

## 作者 Notes

创建日期：2026-04-20
需求来源：用户提出「对应每一个task，直接回答一个长长的问题的方式，不是一个好的互动方式，有什么建议可以优化一下，填空，选择？」
