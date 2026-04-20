import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { interactionApi } from '../services/api';
import type { Task } from '../types';
import '../styles/TurnBasedInteractive.css';

interface TurnBasedInteractiveProps {
  task: Task;
  onComplete: (finalAnswer: string, scores: any) => void;
}

interface Turn {
  roundNumber: number;
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const TurnBasedInteractive: React.FC<TurnBasedInteractiveProps> = ({
  task,
  onComplete,
}) => {
  const { user } = useAuth();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [currentRound, setCurrentRound] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const maxRounds = task.rounds || 10;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [turns]);

  // Load existing history or start new session
  useEffect(() => {
    initializeInteraction();
  }, [task.id]);

  const initializeInteraction = async () => {
    try {
      setLoading(true);
      // Check for existing history
      const historyRes = await interactionApi.getHistory(task.id);
      if (historyRes.data.success && historyRes.data.hasHistory) {
        // Resume existing session
        setSessionId(historyRes.data.sessionId);
        setCurrentRound(historyRes.data.currentRound);
        // Convert history to turns
        const loadedTurns: Turn[] = historyRes.data.history.map(r => {
          const turnsForRound: Turn[] = [];
          if (r.systemResponse) {
            turnsForRound.push({
              roundNumber: r.roundNumber,
              role: 'system',
              content: r.systemResponse,
            });
          }
          if (r.userInput) {
            turnsForRound.push({
              roundNumber: r.roundNumber,
              role: 'user',
              content: r.userInput,
            });
          }
          return turnsForRound;
        }).flat();
        setTurns(loadedTurns);
      } else {
        // Start new session
        await startNewSession();
      }
      setLoading(false);
    } catch (err: any) {
      console.error('Failed to initialize interaction:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const startNewSession = async () => {
    const res = await interactionApi.start(task.id);
    if (res.data.success) {
      setSessionId(res.data.sessionId);
      setCurrentRound(res.data.roundNumber);
      setTurns([
        {
          roundNumber: res.data.roundNumber,
          role: 'system',
          content: res.data.systemResponse,
        },
      ]);
    } else {
      throw new Error('Failed to start interaction');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!currentInput.trim() || thinking || completed || !sessionId || !user) return;

    const userContent = currentInput.trim();
    setCurrentInput('');
    setThinking(true);

    try {
      // Add user turn immediately for UI feedback
      setTurns(prev => [
        ...prev,
        {
          roundNumber: currentRound + 1,
          role: 'user',
          content: userContent,
        },
      ]);

      // Send step to backend
      const res = await interactionApi.step(task.id, sessionId, userContent);

      if (!res.data.success) {
        throw new Error('Failed to process step');
      }

      // Add AI/system response
      setTurns(prev => [
        ...prev,
        {
          roundNumber: res.data.roundNumber,
          role: 'assistant',
          content: res.data.systemResponse,
        },
      ]);

      setCurrentRound(res.data.roundNumber);
      setThinking(false);

      // Check if we've reached max rounds - auto finish
      if (res.data.roundNumber >= maxRounds) {
        handleFinish();
      }
    } catch (err: any) {
      console.error('Interaction step error:', err);
      setError(err.message);
      setThinking(false);
    }
  };

  const handleFinish = async () => {
    if (!sessionId || !confirm(`确定要结束互动并提交评分吗？已经完成 ${currentRound} 个回合。`)) {
      return;
    }

    setThinking(true);
    try {
      const res = await interactionApi.finish(task.id, sessionId);
      if (res.data.success) {
        setCompleted(true);
        onComplete(res.data.fullAnswer, res.data.submission.scores);
      } else {
        throw new Error('Failed to finish interaction');
      }
    } catch (err: any) {
      console.error('Finish error:', err);
      setError(err.message);
      setThinking(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('确定要重置互动吗？所有当前会话的历史记录将被保留，但会开始一个全新的会话。')) {
      return;
    }

    setLoading(true);
    try {
      const res = await interactionApi.reset(task.id);
      if (res.data.success) {
        setSessionId(res.data.sessionId);
        setCurrentRound(res.data.roundNumber);
        setTurns([
          {
            roundNumber: res.data.roundNumber,
            role: 'system',
            content: res.data.systemResponse,
          },
        ]);
        setCompleted(false);
        setError(null);
      }
      setLoading(false);
    } catch (err: any) {
      console.error('Reset error:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (loading) {
    return (
      <div className="turn-based-container">
        <div className="loading">正在加载互动会话...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="turn-based-container">
        <div className="interactive-error">
          ⚠️ 错误: {error}
          <button className="btn-reset" onClick={initializeInteraction}>重试</button>
        </div>
      </div>
    );
  }

  const remainingRounds = Math.max(0, maxRounds - currentRound);

  return (
    <div className="turn-based-container">
      <div className="turn-based-header">
        <div className="turn-info">
          💬 回合制AI互动 · 剩余回合: <span className="turn-count">{remainingRounds}</span> / {maxRounds}
        </div>
        <div className="turn-actions">
          {!completed && currentRound > 0 && (
            <button
              className="btn-complete-early"
              onClick={handleFinish}
              disabled={thinking}
            >
              ✓ 提交评分
            </button>
          )}
          <button
            className="btn-reset"
            onClick={handleReset}
            disabled={thinking}
          >
            🔄 重置
          </button>
        </div>
      </div>

      <div className="messages-container">
        {turns.map((turn, idx) => (
          <div
            key={idx}
            className={`message message-${turn.role}`}
          >
            <div className="message-header">
              {turn.role === 'system' && '📋 系统'}
              {turn.role === 'user' && '👤 你'}
              {turn.role === 'assistant' && '🤖 AI'}
            </div>
            <div className="message-content">
              {turn.content.split('\n').map((line, i) => (
                <div key={i}>{line || <br />}</div>
              ))}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="message message-assistant thinking">
            <div className="message-header">🤖 AI 正在思考...</div>
            <div className="message-content">
              <span className="dot-pulse">●</span>
              <span className="dot-pulse delay-1">●</span>
              <span className="dot-pulse delay-2">●</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {!completed && (
        <div className="input-container">
          <textarea
            className="user-input"
            placeholder="在这里输入你的回答或提问... (Enter 发送，Shift+Enter 换行)"
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={thinking}
            rows={3}
          />
          <button
            className="btn-send"
            onClick={handleSendMessage}
            disabled={thinking || !currentInput.trim()}
          >
            {thinking ? '发送中...' : '发送'}
          </button>
        </div>
      )}

      {completed && (
        <div className="completion-banner">
          ✅ 互动已完成，正在显示评分结果
        </div>
      )}
    </div>
  );
};

export default TurnBasedInteractive;
