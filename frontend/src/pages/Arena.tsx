import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tasksApi, submissionsApi, mcpApi, arkApi } from '../services/api';
import type { Task, Scores, MCPConnection, MCPTool, SlashCommand, TaskListItem } from '../types';
import { useAuth } from '../contexts/AuthContext';
import SlashCommandPopup from '../components/SlashCommandPopup';
import PrisonerDilemmaSimulation from '../components/PrisonerDilemmaSimulation';
import TurnBasedInteractive from '../components/TurnBasedInteractive';
import ProgressivePuzzle from '../components/ProgressivePuzzle';
import StructuredQuiz from '../components/StructuredQuiz';
import SocialPanel from '../components/SocialPanel';
import IllustrationPanel from '../components/IllustrationPanel';
import AgentDebatePanel from '../components/AgentDebatePanel';
import { slashCommandRegistry } from '../utils/slashCommandRegistry';
import '../styles/Arena.css';

const Arena: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const [task, setTask] = useState<Task | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<[string, string][]>([]);
  const [showResult, setShowResult] = useState(false);
  const [currentScores, setCurrentScores] = useState<Scores | null>(null);
  const [totalScore, setTotalScore] = useState(0);
  const [grade, setGrade] = useState('');
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [error, setError] = useState('');
  // All tasks for navigation
  const [allTasks, setAllTasks] = useState<TaskListItem[]>([]);
  // MCP state
  const [mcpConnections, setMcpConnections] = useState<MCPConnection[]>([]);
  const [selectedMcpId, setSelectedMcpId] = useState<number | null>(null);
  const [mcpTools, setMcpTools] = useState<MCPTool[]>([]);
  const [mcpLoading, setMcpLoading] = useState(false);
  const [mcpCallResult, setMcpCallResult] = useState<any>(null);
  const [mcpCallError, setMcpCallError] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<string>('');
  const [toolArguments, setToolArguments] = useState<string>('{}');
  // ARK LLM agent state (hidden for now)
  const [arkConfigured, setArkConfigured] = useState(false);
  const [arkStreaming, setArkStreaming] = useState(false);
  // Interactive mode state
  const [interactiveCompleted, setInteractiveCompleted] = useState(false);
  // Keep TypeScript happy
  void arkConfigured;
  void arkStreaming;
  // Slash Command state
  const [showSlashCommand, setShowSlashCommand] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashCursorStart, setSlashCursorStart] = useState(0);
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);
  const [filteredCommands, setFilteredCommands] = useState<SlashCommand[]>([]);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const answerAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Load MCP connections when user is logged in
  useEffect(() => {
    if (user) {
      loadMcpConnections();
    }
  }, [user]);

  const loadMcpConnections = async () => {
    try {
      const res = await mcpApi.list();
      if (res.data.success) {
        setMcpConnections(res.data.connections);

        // Register all MCP tools as slash commands
        slashCommandRegistry.clearMcpCommands();
        for (const conn of res.data.connections) {
          // We need to load tools for each connection to register them
          try {
            const toolsRes = await mcpApi.test(conn.id);
            if (toolsRes.data.success && toolsRes.data.tools) {
              for (const tool of toolsRes.data.tools) {
                const safeName = `${conn.name.toLowerCase().replace(/\s+/g, '-')}-${tool.name.toLowerCase().replace(/\s+/g, '-')}`;
                slashCommandRegistry.registerCommand({
                  id: `mcp-${conn.id}-${tool.name}`,
                  name: safeName,
                  description: `MCP: ${tool.description || `${conn.name} → ${tool.name}`}`,
                  category: 'mcp',
                  icon: '🔌',
                  mcpCommand: {
                    connectionId: conn.id,
                    toolName: tool.name,
                  },
                });
              }
            }
          } catch (e) {
            // Skip if we can't load tools for this connection
          }
        }

        // Update filtered commands if popup is open
        if (showSlashCommand) {
          setFilteredCommands(slashCommandRegistry.filterCommands(slashQuery));
        }
      }
    } catch (error) {
      console.error('Failed to load MCP connections:', error);
    }
  };

  const loadMcpTools = async () => {
    if (!selectedMcpId) return;
    setMcpLoading(true);
    setMcpCallError(null);
    try {
      const res = await mcpApi.test(selectedMcpId);
      if (res.data.success) {
        setMcpTools(res.data.tools);
      } else {
        setMcpCallError(res.data.error || 'Failed to load tools');
        setMcpTools([]);
      }
    } catch (error: any) {
      setMcpCallError(error.response?.data?.error || 'Failed to load tools');
      setMcpTools([]);
    } finally {
      setMcpLoading(false);
    }
  };

  const callMcpTool = async () => {
    if (!selectedMcpId || !selectedTool) return;
    setMcpLoading(true);
    setMcpCallError(null);
    try {
      let args;
      try {
        args = JSON.parse(toolArguments);
      } catch (e) {
        setMcpCallError('Invalid JSON arguments');
        return;
      }
      const res = await mcpApi.call(selectedMcpId, selectedTool, args);
      if (res.data.success) {
        setMcpCallResult(res.data.result);
      } else {
        setMcpCallError(res.data.error || 'Tool call failed');
      }
    } catch (error: any) {
      setMcpCallError(error.response?.data?.error || 'Tool call failed');
    } finally {
      setMcpLoading(false);
    }
  };

  const insertResultIntoAnswer = () => {
    if (!mcpCallResult) return;
    const resultText = `\n\n---\nMCP tool call result:\n\`\`\`json\n${JSON.stringify(mcpCallResult, null, 2)}\n\`\`\``;
    setUserAnswer(prev => prev + resultText);
  };

  // Check ARK configuration on mount
  useEffect(() => {
    if (user) {
      checkArkStatus();
    }
  }, [user]);

  const checkArkStatus = async () => {
    try {
      const res = await arkApi.status();
      if (res.data.success) {
        setArkConfigured(res.data.configured);
      }
    } catch (error) {
      console.error('Failed to check ARK status:', error);
      setArkConfigured(false);
    }
  };

  const runArkAgent = async () => {
    if (!task || running || arkStreaming) return;

    setRunning(true);
    setArkStreaming(true);
    setLog([]);
    setShowResult(false);
    setProgress(0);
    setUserAnswer('');

    // Add log entry for starting
    addLog('info', `🚀 开始使用火山引擎 ARK LLM agent 解决任务...`);
    addLog('think', `正在分析问题: ${task.name}`);

    try {
      // Build messages for ARK
      const messages = [
        {
          role: 'system',
          content: '你是一个专业的AI助手，正在帮助用户解决编程和AI技术问题。请给出清晰、准确的解答，可以使用Markdown格式。',
        },
        {
          role: 'user',
          content: `任务: ${task.name}\n\n问题描述:\n${task.question}\n\n请给出完整的解答。`,
        },
      ];

      const response = await arkApi.streamCompletion(messages);

      if (!response.ok) {
        throw new Error(`ARK API error: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get response stream');
      }

      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content || '';
              if (delta) {
                fullContent += delta;
                setUserAnswer(fullContent);

                // Update progress log every ~200 characters
                if (fullContent.length % 200 === 0) {
                  addLog('step', `正在生成解答... ${fullContent.length} 字符`);
                  setProgress(Math.min(95, Math.round((fullContent.length / 500) * 100)));
                }
              }
            } catch (e) {
              // Skip parsing errors
            }
          }
        }
      }

      addLog('ok', `✅ ARK agent 完成解答，共 ${fullContent.length} 字符`);
      setProgress(100);
      setProgressLabel('完成');
      setArkStreaming(false);
      setRunning(false);

      // Auto-evaluate after ARK completes
      setTimeout(() => {
        submitManual();
      }, 500);

    } catch (error: any) {
      addLog('err', `ARK agent 错误: ${error.message}`);
      setArkStreaming(false);
      setRunning(false);
    }
  };

  // Keep TypeScript happy
  void runArkAgent;

  const addLog = (type: string, text: string) => {
    setLog(prev => [...prev, [type, text]]);
  };

  useEffect(() => {
    if (taskId) {
      loadTask(taskId);
      loadAllTasks();
    }
  }, [taskId]);

  const loadAllTasks = async () => {
    try {
      const res = await tasksApi.list();
      if (res.data.success) {
        setAllTasks(res.data.tasks);
      }
    } catch (error) {
      console.error('Failed to load all tasks for navigation:', error);
    }
  };

  const loadTask = async (id: string) => {
    setLoading(true);
    try {
      const res = await tasksApi.get(id);
      if (res.data.success && res.data.task) {
        setTask(res.data.task);
      } else {
        setError(res.data.error || 'Task not found');
      }
    } catch (error) {
      console.error('Failed to load task:', error);
      setError('Failed to load task');
    } finally {
      setLoading(false);
    }
  };

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const runDemo = async () => {
    if (!task || running) return;

    setRunning(true);
    setLog([]);
    setShowResult(false);
    setProgress(0);

    const steps = task.steps;
    const delay = Math.min(600, 5000 / steps.length);

    for (let i = 0; i < steps.length; i++) {
      await sleep(delay + Math.random() * 200);
      setLog(prev => [...prev, steps[i]]);
      setProgress(Math.round(((i + 1) / steps.length) * 100));
      const labels = ['分析挑战中...', '思考策略...', '技能组合...', '整合方案...'];
      setProgressLabel(labels[Math.min(Math.floor((i / steps.length) * 4), 3)]);
    }

    setUserAnswer(task.answer || '');
    // Use reference scores for demo
    const demoScores = {
      accuracy: task.refAccuracy,
      reasoning: task.refReasoning,
      creativity: task.refCreativity,
      speed: task.refSpeed,
    };
    setCurrentScores(demoScores);
    calculateAndShowResult(demoScores);
    setRunning(false);
  };

  const calculateAndShowResult = (scores: Scores) => {
    const total = Math.round(
      (scores.accuracy + scores.reasoning + scores.creativity + scores.speed) / 4
    );
    setTotalScore(total);
    setTotalScore(total);
    let g;
    if (total >= 90) g = 'S';
    else if (total >= 80) g = 'A';
    else if (total >= 70) g = 'B';
    else if (total >= 60) g = 'C';
    else g = 'D';
    setGrade(g);
    setShowResult(true);
  };

  // --- Slash Command Handling ---
  const closeSlashCommand = () => {
    setShowSlashCommand(false);
    setSelectedSlashIndex(0);
  };

  const updateFilteredCommands = useCallback((query: string) => {
    const filtered = slashCommandRegistry.filterCommands(query);
    setFilteredCommands(filtered);
    setSelectedSlashIndex(0);
  }, []);

  const getCaretCoordinates = (element: HTMLTextAreaElement) => {
    // Calculate popup position based on caret position
    const text = element.value.substring(0, element.selectionStart);
    const lines = text.split('\n');
    const lineHeight = parseInt(getComputedStyle(element).lineHeight || '20', 10);
    const x = (lines[lines.length - 1].length * 8); // approximate character width
    const y = lines.length * lineHeight;

    // Convert to relative coordinates inside answer-area
    return { x, y: y + 20 }; // 20px offset below caret
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSlashCommand) {
      // Check if user just typed '/'
      if (e.key === '/') {
        const textarea = e.currentTarget;
        const cursorPos = textarea.selectionStart;

        // Only trigger if / is at the beginning or after whitespace
        const beforeCursor = textarea.value.substring(0, cursorPos);
        if (beforeCursor.length === 0 || beforeCursor.endsWith(' ') || beforeCursor.endsWith('\n')) {
          e.preventDefault();
          // Insert the '/'
          const newValue = textarea.value.substring(0, cursorPos) + '/' + textarea.value.substring(cursorPos);
          setUserAnswer(newValue);

          setSlashCursorStart(cursorPos);
          setSlashQuery('');
          updateFilteredCommands('');
          setPopupPosition(getCaretCoordinates(textarea));
          setShowSlashCommand(true);
          setSelectedSlashIndex(0);
          return;
        }
      }
      return;
    }

    // Handle keyboard navigation when popup is open
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSlashIndex(prev => (prev + 1) % filteredCommands.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSlashIndex(prev => prev === 0 ? filteredCommands.length - 1 : prev - 1);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredCommands.length > 0) {
          executeSlashCommand(filteredCommands[selectedSlashIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        closeSlashCommand();
        break;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    setUserAnswer(newValue);

    // If popup is open, update the query
    if (showSlashCommand) {
      const query = newValue.substring(slashCursorStart + 1, cursorPos);
      setSlashQuery(query);
      updateFilteredCommands(query);

      // Update position
      if (textareaRef.current) {
        setPopupPosition(getCaretCoordinates(textareaRef.current));
      }
    }
  };

  const executeSlashCommand = (command: SlashCommand) => {
    if (!textareaRef.current) {
      closeSlashCommand();
      return;
    }

    // Handle by command type
    if (command.category === 'navigation') {
      // Navigation commands
      const routes: Record<string, string> = {
        home: '/',
        courses: '/courses',
        leaderboard: '/leaderboard',
        mcp: '/mcp',
        history: '/history',
      };
      const route = routes[command.id];
      if (route) {
        navigate(route);
      }
      closeSlashCommand();
      return;
    }

    if (command.mcpCommand) {
      // MCP tool command - select in MCP panel
      setSelectedMcpId(command.mcpCommand.connectionId);
      setSelectedTool(command.mcpCommand.toolName);
      setMcpTools([]);
      // Load tools for this connection
      mcpApi.test(command.mcpCommand.connectionId).then(res => {
        if (res.data.success) {
          setMcpTools(res.data.tools);
        }
      });
      closeSlashCommand();
      textareaRef.current.focus();
      return;
    }

    if (command.category === 'action') {
      // Action commands
      switch (command.id) {
        case 'clear':
          setUserAnswer('');
          break;
        case 'submit':
          submitManual();
          break;
        case 'help':
          const helpText = `
// 可用的斜杠命令:
// 导航: /home /courses /leaderboard /mcp /history
// 模板: /thinking /system-prompt /agent /cot
// 动作: /clear /submit /help
// 寄语: /explore
// MCP 工具会自动列出您保存的所有可用工具
`;
          insertTemplateAtCursor(helpText);
          break;
      }
      closeSlashCommand();
      return;
    }

    // Template commands (including digimon)
    if (command.template) {
      insertTemplateAtCursor(command.template);
      closeSlashCommand();
      return;
    }

    closeSlashCommand();
  };

  const insertTemplateAtCursor = (template: string) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = slashCursorStart;
    const end = textarea.selectionStart;

    // Replace everything from / to current cursor with the template
    const newValue =
      userAnswer.substring(0, start) +
      template +
      userAnswer.substring(end);

    setUserAnswer(newValue);

    // Put cursor after inserted template
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + template.length, start + template.length);
    }, 0);
  };

  const handleCommandHighlight = (index: number) => {
    setSelectedSlashIndex(index);
  };

  const handleCommandSelect = (command: SlashCommand) => {
    executeSlashCommand(command);
  };

  // --- End Slash Command Handling ---

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      // Reset height to auto to get the correct scrollHeight
      textareaRef.current.style.height = 'auto';
      // Set height to scrollHeight to fit all content
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [userAnswer]);

  const submitManual = () => {
    if (!task || !userAnswer.trim()) return;

    // Add slight randomization to scores for manual submission
    const scores: Scores = {
      accuracy: Math.min(100, Math.max(50, task.refAccuracy + Math.floor(Math.random() * 20) - 10)),
      reasoning: Math.min(100, Math.max(50, task.refReasoning + Math.floor(Math.random() * 20) - 10)),
      creativity: Math.min(100, Math.max(50, task.refCreativity + Math.floor(Math.random() * 20) - 10)),
      speed: Math.min(100, Math.max(50, task.refSpeed + Math.floor(Math.random() * 20) - 10)),
    };
    setCurrentScores(scores);
    calculateAndShowResult(scores);
  };

  const submitForBounty = async () => {
    if (!task || !currentScores || !user) {
      // If not logged in, just show result and prompt to login
      if (!user) {
        alert('请先登录后才能获得EXP！');
        navigate('/login');
      }
      return;
    }

    try {
      const res = await submissionsApi.submit(task.id, userAnswer, currentScores);
      if (res.data.success) {
        alert(`提交成功！获得 ${res.data.submission.bountyEarned} EXP！`);
        navigate('/history');
      } else {
        setError(res.data.error || 'Submit failed');
      }
    } catch (error: any) {
      console.error('Submit error:', error);
      setError(error.response?.data?.error || 'Submit failed');
    }
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  if (error || !task) {
    return <div className="error-text">{error || 'Task not found'}</div>;
  }

  // Find current index for navigation
  const currentIndex = allTasks.findIndex(t => t.id === taskId);
  const prevTask = currentIndex > 0 ? allTasks[currentIndex - 1] : null;
  const nextTask = currentIndex < allTasks.length - 1 ? allTasks[currentIndex + 1] : null;

  const scoreNames = {
    accuracy: '🎯 答案准确性',
    reasoning: '🔗 推理逻辑',
    creativity: '✨ 创意深度',
    speed: '⚡ 思维效率',
  };

  const scoreColors = {
    accuracy: '#00d4aa',
    reasoning: '#4a9eff',
    creativity: '#9b72cf',
    speed: '#f5c542',
  };

  return (
    <div className="arena-page">
      <div className="exec-area">
        <div className="exec-title">
          <div
            className="dot"
            style={{
              background: running ? 'var(--cyan)' : log.length > 0 ? '#4ade80' : 'var(--muted)',
              animation: running ? 'pulse 1.2s infinite' : 'none',
            }}
          />
          <span id="exec-status">
            {running ? `训练中: ${task.name}` : showResult ? `✓ 完成: ${task.name}` : `🔍 探索信号已捕获，准备破译`}
          </span>
        </div>

        <div className="question-box" id="question-display">
          <div className="q-label">🧭 探索目标</div>
          <div className="q-text">
            {task.question.split('\n').map((line: string, i: number) => (
              <div key={i}>{line}</div>
            ))}
          </div>
          {task.hint && <div className="q-hint">✨ 灵感火花：{task.hint}</div>}
        </div>

        {!task.isInteractive && <IllustrationPanel taskId={task.id} />}
        <AgentDebatePanel taskId={task.id} />

        {/* Interactive components based on type */}
        {task.isInteractive && task.interactionType === 'dialogue' && (
          <TurnBasedInteractive
            task={task}
            onComplete={(finalAnswer, scores) => {
              setUserAnswer(finalAnswer);
              setCurrentScores(scores);
              setInteractiveCompleted(true);
              calculateAndShowResult(scores);
            }}
          />
        )}

        {task.isInteractive && task.interactionType === 'puzzle' && task.interactionConfig && (
          <ProgressivePuzzle
            task={task}
            onComplete={(finalAnswer, scores) => {
              setUserAnswer(finalAnswer);
              setCurrentScores(scores);
              setInteractiveCompleted(true);
              calculateAndShowResult(scores);
            }}
          />
        )}

        {/* Legacy: Keep the old turn_based for backward compatibility */}
        {!task.isInteractive && task.interactionType === 'turn_based' && task.interactionConfig && (
          <TurnBasedInteractive
            task={task}
            onComplete={(finalAnswer, scores) => {
              setUserAnswer(finalAnswer);
              setCurrentScores(scores);
              setInteractiveCompleted(true);
              calculateAndShowResult(scores);
            }}
          />
        )}

        {/* Legacy: Keep the old puzzle for backward compatibility */}
        {!task.isInteractive && task.interactionType === 'puzzle' && task.interactionConfig && (
          <ProgressivePuzzle
            task={task}
            onComplete={(finalAnswer) => {
              setUserAnswer(finalAnswer);
              // Use reference scores with randomization
              const scores: Scores = {
                accuracy: Math.min(100, Math.max(50, task.refAccuracy + Math.floor(Math.random() * 20) - 10)),
                reasoning: Math.min(100, Math.max(50, task.refReasoning + Math.floor(Math.random() * 20) - 10)),
                creativity: Math.min(100, Math.max(50, task.refCreativity + Math.floor(Math.random() * 20) - 10)),
                speed: Math.min(100, Math.max(50, task.refSpeed + Math.floor(Math.random() * 20) - 10)),
              };
              setCurrentScores(scores);
              setInteractiveCompleted(true);
              calculateAndShowResult(scores);
            }}
          />
        )}

        {/* Simulation type - for game theory simulations and similar interactive modules */}
        {task.isInteractive && task.interactionType === 'simulation' && (
          <PrisonerDilemmaSimulation />
        )}

        {/* Structured Quiz - single/multiple choice, fill-in-the-blank */}
        {task.isInteractive && task.interactionType === 'structured' && (
          <StructuredQuiz
            task={task}
            onComplete={(finalAnswer, scores) => {
              setUserAnswer(finalAnswer);
              setCurrentScores(scores);
              setInteractiveCompleted(true);
              calculateAndShowResult(scores);
            }}
          />
        )}

        {/* Game type - for custom interactive games (can be implemented later) */}
        {task.isInteractive && task.interactionType === 'game' && (
          <div className="interactive-notice">
            🎮 自定义游戏互动组件需要单独实现
          </div>
        )}

        {/* MCP Tool Calling Panel - only shown when user is logged in and has connections */}
        {user && mcpConnections.length > 0 && (
          <div className="mcp-panel">
            <div className="mcp-panel-header">
              <span>🔌 技能调用</span>
            </div>
            <div className="mcp-row">
              <div className="mcp-field">
                <label>选择连接</label>
                <select
                  className="mcp-select"
                  value={selectedMcpId || ''}
                  onChange={e => {
                    setSelectedMcpId(e.target.value ? parseInt(e.target.value) : null);
                    setMcpTools([]);
                    setMcpCallResult(null);
                  }}
                >
                  <option value="">-- 选择 --</option>
                  {mcpConnections.map(conn => (
                    <option key={conn.id} value={conn.id}>{conn.name}</option>
                  ))}
                </select>
              </div>
              <button
                className="btn btn-primary mcp-btn"
                onClick={loadMcpTools}
                disabled={!selectedMcpId || mcpLoading}
              >
                {mcpLoading ? '加载中...' : '获取工具'}
              </button>
            </div>

            {mcpTools.length > 0 && (
              <>
                <div className="mcp-row">
                  <div className="mcp-field">
                    <label>选择工具</label>
                    <select
                      className="mcp-select"
                      value={selectedTool}
                      onChange={e => setSelectedTool(e.target.value)}
                    >
                      <option value="">-- 选择工具 --</option>
                      {mcpTools.map(tool => (
                        <option key={tool.name} value={tool.name}>
                          {tool.name}{tool.description ? ` - ${tool.description}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mcp-row">
                  <div className="mcp-field mcp-args">
                    <label>参数 (JSON)</label>
                    <textarea
                      className="mcp-args-input"
                      value={toolArguments}
                      onChange={e => setToolArguments(e.target.value)}
                      placeholder='{"param": "value"}'
                    />
                  </div>
                </div>
                <div className="mcp-row">
                  <button
                    className="btn btn-primary mcp-btn"
                    onClick={callMcpTool}
                    disabled={!selectedMcpId || !selectedTool || mcpLoading}
                  >
                    {mcpLoading ? '调用中...' : '调用工具'}
                  </button>
                  {mcpCallResult && (
                    <button
                      className="btn btn-secondary mcp-btn"
                      onClick={insertResultIntoAnswer}
                    >
                      插入结果到回答
                    </button>
                  )}
                </div>
              </>
            )}

            {mcpCallError && (
              <div className="error-text mcp-error">{mcpCallError}</div>
            )}

            {mcpCallResult && (
              <div className="mcp-result">
                <div className="mcp-result-label">工具调用结果:</div>
                <pre className="mcp-result-code">{JSON.stringify(mcpCallResult, null, 2)}</pre>
              </div>
            )}
          </div>
        )}

        {/* MCP panel only shown when user has connections */}

        {/* Integrated Console for Answer & Actions */}
        {(!task.interactionType || interactiveCompleted || task.interactionType === 'turn_based') && (
          <div className="arena-console">
            <div className="answer-area" ref={answerAreaRef} style={{ position: 'relative' }}>
              <div className="answer-input-wrapper">
                <textarea
                  ref={textareaRef}
                  className="answer-input"
                  id="user-answer"
                  placeholder="让你的思想在此起舞，输入 / 唤醒更多交互指令..."
                  value={userAnswer}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  disabled={running}
                  rows={1}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = `${target.scrollHeight}px`;
                  }}
                />
                <div className="console-actions">
                  <button
                    className="action-circle-btn"
                    onClick={runDemo}
                    disabled={running}
                    title="演示训练 · 观看示例"
                  >
                    🚀
                  </button>
                  <button
                    className="action-circle-btn primary"
                    onClick={submitManual}
                    disabled={running || !userAnswer.trim()}
                    title="提交评估"
                  >
                    ✦
                  </button>
                </div>
              </div>
              <SlashCommandPopup
                visible={showSlashCommand}
                commands={filteredCommands}
                selectedIndex={selectedSlashIndex}
                onSelect={handleCommandSelect}
                onHighlight={handleCommandHighlight}
                onClose={closeSlashCommand}
                x={popupPosition.x}
                y={popupPosition.y}
                containerRef={answerAreaRef}
              />
            </div>
            <div className="answer-label" style={{ display: 'block', opacity: 0.5, marginTop: '8px', fontSize: '10px' }}>
              // 灵感纪实：捕捉思维火花，支持 / 呼唤技能指令
            </div>
          </div>
        )}

        {log.length > 0 && (
          <div id="log-wrap" style={{ display: 'block', marginTop: '12px' }}>
            <div className="log" id="exec-log">
              {log.map(([type, text], i) => (
                <div key={i} className={`log-line ${type}`}>{text}</div>
              ))}
            </div>
            {running && (
              <div className="progress-wrap" id="progress-wrap" style={{ display: 'block' }}>
                <div className="progress-label" id="progress-label">{progressLabel}</div>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    id="progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {showResult && currentScores && (
          <div id="score-result" style={{ display: 'block', marginTop: '14px' }}>
            <div className="score-grid" id="score-cards">
              {(Object.entries(currentScores) as Array<[keyof Scores, number]>).map(([key, value]) => (
                <div key={key} className="score-card">
                  <div className="score-label">{scoreNames[key]}</div>
                  <div className="score-bar-wrap">
                    <div className="score-bar" style={{ width: `${value}%`, background: scoreColors[key] }} />
                  </div>
                  <div className="score-val" style={{ color: scoreColors[key] }}>{value}</div>
                </div>
              ))}
            </div>

            <div id="verdict-wrap">
              <div className="verdict-box">
                <div className="verdict-label">// 参考方案</div>
                <div className="verdict-text">
                  {task.answer && task.answer.split('\n').map((line: string, i: number) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              </div>
            </div>

            <div className="total-score">
              <div className="total-label">综合评价</div>
              <div className="total-val" id="total-val">{totalScore}</div>
              <div className="total-sub" id="total-sub">
                {grade} ·  EXP +{task.bounty}
              </div>
            </div>

            {user && (
              <button className="submit-btn" onClick={submitForBounty}>
                ✓ 提交结果 · 获得EXP
              </button>
            )}

            {!user && (
              <div style={{ marginTop: 12, padding: 12, background: 'rgba(245,197,66,0.1)', borderRadius: 8, border: '1px solid rgba(245,197,66,0.3)' }}>
                <p style={{ color: 'var(--gold)', margin: 0, fontSize: 14 }}>
                  请先登录后才能获得EXP并保存记录
                </p>
              </div>
            )}
          </div>
        )}

        {/* Task Navigation */}
        <div className="task-navigation">
          <button
            className="nav-btn prev-btn"
            onClick={() => prevTask && navigate(`/arena/${prevTask.id}`)}
            disabled={!prevTask}
          >
            <span className="nav-arrow">←</span>
            <span className="nav-text">
              <span className="nav-label">上一个</span>
              <span className="nav-name">{prevTask?.name}</span>
            </span>
          </button>
          <button
            className="nav-btn list-btn"
            onClick={() => navigate('/')}
          >
            <span className="nav-text">列表</span>
          </button>
          <button
            className="nav-btn next-btn"
            onClick={() => nextTask && navigate(`/arena/${nextTask.id}`)}
            disabled={!nextTask}
          >
            <span className="nav-text">
              <span className="nav-label">下一个</span>
              <span className="nav-name">{nextTask?.name}</span>
            </span>
            <span className="nav-arrow">→</span>
          </button>
        </div>
      </div>
      <SocialPanel taskId={task.id} taskAuthorId={task.authorId} />
    </div>
  );
};

export default Arena;
