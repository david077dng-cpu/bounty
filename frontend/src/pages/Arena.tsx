import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tasksApi, submissionsApi, mcpApi } from '../services/api';
import type { Task, Scores, MCPConnection, MCPTool } from '../types';
import { useAuth } from '../contexts/AuthContext';
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
  // MCP state
  const [mcpConnections, setMcpConnections] = useState<MCPConnection[]>([]);
  const [selectedMcpId, setSelectedMcpId] = useState<number | null>(null);
  const [mcpTools, setMcpTools] = useState<MCPTool[]>([]);
  const [mcpLoading, setMcpLoading] = useState(false);
  const [mcpCallResult, setMcpCallResult] = useState<any>(null);
  const [mcpCallError, setMcpCallError] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<string>('');
  const [toolArguments, setToolArguments] = useState<string>('{}');
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

  useEffect(() => {
    if (taskId) {
      loadTask(taskId);
    }
  }, [taskId]);

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
      const labels = ['分析题目中...', '建立推理框架...', '交叉验证...', '整合结论...'];
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
        alert('请先登录后才能领取赏金！');
        navigate('/login');
      }
      return;
    }

    try {
      const res = await submissionsApi.submit(task.id, userAnswer, currentScores);
      if (res.data.success) {
        alert(`提交成功！获得 ${res.data.submission.bountyEarned} 赏金点！`);
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
            {running ? `推理中: ${task.name}` : showResult ? `✓ 完成: ${task.name}` : `题目已加载，准备作答`}
          </span>
        </div>

        <div className="question-box" id="question-display">
          <div className="q-label">📋 任务题目</div>
          <div className="q-text">
            {task.question.split('\n').map((line: string, i: number) => (
              <div key={i}>{line}</div>
            ))}
          </div>
          {task.hint && <div className="q-hint">💡 {task.hint}</div>}
        </div>

        {/* MCP Tool Calling Panel - only shown when user is logged in and has connections */}
        {user && mcpConnections.length > 0 && (
          <div className="mcp-panel">
            <div className="mcp-panel-header">
              <span>🔌 MCP 工具调用</span>
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

        <div className="answer-area">
          <div className="answer-label">// 你的回答（可以直接填写，或点击「自动执行」观看推理过程）</div>
          <textarea
            className="answer-input"
            id="user-answer"
            placeholder="在此输入答案或推理过程..."
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            disabled={running}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="run-btn"
            id="run-btn"
            onClick={runDemo}
            disabled={running}
            style={{ flex: 1 }}
          >
            ▶ 自动执行 · 观看推理
          </button>
          <button
            className="run-btn"
            onClick={submitManual}
            disabled={running || !userAnswer.trim()}
            style={{ flex: 1, borderColor: 'rgba(155,114,207,0.5)', color: 'var(--purple)' }}
          >
            ✎ 提交答案 · 评分
          </button>
        </div>

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
                <div className="verdict-label">// 参考答案</div>
                <div className="verdict-text">
                  {task.answer && task.answer.split('\n').map((line: string, i: number) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              </div>
            </div>

            <div className="total-score">
              <div className="total-label">综合得分</div>
              <div className="total-val" id="total-val">{totalScore}</div>
              <div className="total-sub" id="total-sub">
                {grade} ·  赏金 +{task.bounty}pts
              </div>
            </div>

            {user && (
              <button className="submit-btn" onClick={submitForBounty}>
                ✓ 提交结果 · 领取赏金
              </button>
            )}

            {!user && (
              <div style={{ marginTop: 12, padding: 12, background: 'rgba(245,197,66,0.1)', borderRadius: 8, border: '1px solid rgba(245,197,66,0.3)' }}>
                <p style={{ color: 'var(--gold)', margin: 0, fontSize: 14 }}>
                  请先登录后才能领取赏金并保存记录
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Arena;
