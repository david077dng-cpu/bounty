import type { SlashCommand } from '../types';

class SlashCommandRegistry {
  private commands: SlashCommand[] = [];

  constructor() {
    this.registerBuiltInCommands();
  }

  private registerBuiltInCommands() {
    // Navigation commands
    this.registerCommand({
      id: 'home',
      name: 'home',
      description: '返回任务列表',
      category: 'navigation',
      icon: '🏠',
    });

    this.registerCommand({
      id: 'courses',
      name: 'courses',
      description: '前往进化路线（课程）',
      category: 'navigation',
      icon: '🧬',
    });

    this.registerCommand({
      id: 'leaderboard',
      name: 'leaderboard',
      description: '前往排行榜',
      category: 'navigation',
      icon: '🏆',
    });

    this.registerCommand({
      id: 'mcp',
      name: 'mcp',
      description: '前往技能连接管理',
      category: 'navigation',
      icon: '🔌',
    });

    this.registerCommand({
      id: 'history',
      name: 'history',
      description: '前往我的训练记录',
      category: 'navigation',
      icon: '📜',
    });

    // Template commands
    this.registerCommand({
      id: 'thinking',
      name: 'thinking',
      description: '插入结构化思考模板',
      category: 'template',
      icon: '🧠',
      template: `## 思考过程

1. **问题分析**:
2. **信息收集**:
3. **方案设计**:
4. **最终解答**:
`,
    });

    this.registerCommand({
      id: 'system-prompt',
      name: 'system-prompt',
      description: '插入数码宝贝系统提示模板',
      category: 'template',
      icon: '⚙️',
      template: `你是一只正在成长的数码宝贝。你需要不断训练和学习来提升自己的能力。请按照以下步骤思考：

1. 理解训练目标
2. 调用需要的技能
3. 总结学习收获
`,
    });

    this.registerCommand({
      id: 'agent',
      name: 'agent',
      description: '插入 Agent 架构模板',
      category: 'template',
      icon: '🤖',
      template: `## Agent 架构

- **角色**:
- **目标**:
- **工具**:
- **工作流程**:
`,
    });

    this.registerCommand({
      id: 'cot',
      name: 'cot',
      description: '插入 Chain-of-Thought 模板',
      category: 'template',
      icon: '🔗',
      template: `让我一步步思考：

1. 问题理解：
2. 分析过程：
3. 验证答案：
4. 总结：
`,
    });

    // Action commands
    this.registerCommand({
      id: 'clear',
      name: 'clear',
      description: '清空输入内容',
      category: 'action',
      icon: '🗑️',
    });

    this.registerCommand({
      id: 'submit',
      name: 'submit',
      description: '提交评估',
      category: 'action',
      icon: '✓',
    });

    this.registerCommand({
      id: 'help',
      name: 'help',
      description: '显示斜杠命令帮助',
      category: 'action',
      icon: '❓',
    });

    // Digimon themed commands
    this.registerCommand({
      id: 'evolve',
      name: 'evolve',
      description: '插入进化寄语',
      category: 'digimon',
      icon: '⭐',
      template: `---
✨ 数码宝贝进化寄语：

> "只要不断训练和挑战，总有一天你会进化成最强的形态！每一次失败都是成长的养分。"
`,
    });

    // System skill - Skill Creator (MCP Skill Creator from Claude)
    this.registerCommand({
      id: 'create-skill',
      name: 'create-skill',
      description: '创建新 MCP 技能（基于 Claude Model Context Protocol）',
      category: 'template',
      icon: '🛠️',
      template: `# MCP Skill Creator - 创建自定义技能

## 1. 技能信息

**技能名称**: [你的技能名称]
**描述**: [你的技能做什么]
**作者**: [你的名字]

## 2. 工具定义 (JSON Schema)

\`\`\`json
{
  "name": "tool_name",
  "description": "What this tool does",
  "inputSchema": {
    "type": "object",
    "properties": {
      "param1": {
        "type": "string",
        "description": "Description of parameter 1"
      }
    },
    "required": ["param1"]
  }
}
\`\`\`

## 3. Python MCP 服务器模板

\`\`\`python
# my_skill/server.py
from mcp.server import Server
from mcp.types import Tool, CallToolResult
import asyncio
import httpx

app = Server("my_skill")

@app.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="your_tool_name",
            description="Your tool description",
            inputSchema={
                "type": "object",
                "properties": {
                    "param1": {
                        "type": "string",
                        "description": "Parameter description"
                    }
                },
                "required": ["param1"]
            }
        )
    ]

@app.call_tool()
async def call_tool(name: str, arguments: dict) -> CallToolResult:
    if name == "your_tool_name":
        # Implement your tool logic here
        result = await do_something(arguments["param1"])
        return CallToolResult(result=result)
    raise ValueError(f"Unknown tool: {name}")

async def main():
    async with app.run_stdio():
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())
\`\`\`

## 4. 依赖 requirements.txt

\`\`\`text
mcp>=1.0.0
httpx>=0.27.0
\`\`\`

## 5. 部署步骤

1. 创建技能目录
2. 安装依赖: \`pip install -r requirements.txt\`
3. 测试服务器: \`python server.py\`
4. 在 Skill Bounty 添加连接: 选择 "STDIO" 类型，填写命令路径
5. 测试工具调用

## 参考资料

- Model Context Protocol: https://modelcontextprotocol.io
- Claude MCP Docs: https://docs.anthropic.com/claude/docs/model-context-protocol
- Example MCP Servers: https://github.com/modelcontextprotocol/servers
`,
    });

    // System skill - Claude Code skill template
    this.registerCommand({
      id: 'skill-creator',
      name: 'skill-creator',
      description: 'Claude Code 风格技能创建模板',
      category: 'template',
      icon: '🎨',
      template: `# Claude Code 技能创建

## 技能元数据

\`\`\`json
{
  "skill_id": "com.yourname.skillname",
  "name": "Skill Display Name",
  "description": "What this skill does",
  "version": "1.0.0",
  "author": "Your Name",
  "categories": ["utility", "productivity"],
  "parameters": {
    "required": [],
    "optional": []
  }
}
\`\`\`

## 安装说明

\`\`\`bash
# Installation steps
git clone [repository]
cd [directory]
npm install
# or pip install -r requirements.txt
\`\`\`

## 使用说明

- Type \`/command\` to use this skill
- Describe what the user should do
`,
    });
  }

  registerCommand(command: SlashCommand) {
    // Remove if already exists
    this.commands = this.commands.filter(c => c.id !== command.id);
    this.commands.push(command);
  }

  unregisterCommand(id: string) {
    this.commands = this.commands.filter(c => c.id !== id);
  }

  getCommands(): SlashCommand[] {
    return this.commands;
  }

  filterCommands(query: string): SlashCommand[] {
    if (!query.trim()) {
      return this.commands;
    }

    const lowerQuery = query.toLowerCase();
    return this.commands.filter(cmd =>
      cmd.name.toLowerCase().includes(lowerQuery) ||
      cmd.description.toLowerCase().includes(lowerQuery)
    );
  }

  clearMcpCommands() {
    this.commands = this.commands.filter(c => c.category !== 'mcp');
  }
}

// Singleton instance
export const slashCommandRegistry = new SlashCommandRegistry();
