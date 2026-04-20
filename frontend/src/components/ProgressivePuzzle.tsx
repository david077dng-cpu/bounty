import React, { useState, useEffect } from 'react';
import { interactionApi } from '../services/api';
import type { Task } from '../types';
import '../styles/ProgressivePuzzle.css';

export interface PuzzleStep {
  question: string;
  hint: string;
  answerPattern: string; // regex pattern or expected answer (case-insensitive)
  nextUnlockHint: string;
}

interface ProgressivePuzzleProps {
  task: Task;
  onComplete: (finalAnswer: string, scores: any) => void;
}

const ProgressivePuzzle: React.FC<ProgressivePuzzleProps> = ({
  task,
  onComplete,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [error, setError] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [history, setHistory] = useState<Array<{ step: number; answer: string }>>([]);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const config = task.interactionConfig;

  const currentStep = config.steps[currentStepIndex];
  const totalSteps = config.steps.length;

  // Load existing session on mount
  useEffect(() => {
    initializePuzzle();
  }, [task.id]);

  const initializePuzzle = async () => {
    try {
      setLoading(true);
      const historyRes = await interactionApi.getHistory(task.id);
      if (historyRes.data.success && historyRes.data.hasHistory) {
        setSessionId(historyRes.data.sessionId);
        // Try to reconstruct progress from history
        if (historyRes.data.latestGameState) {
          setCurrentStepIndex(historyRes.data.latestGameState.currentStepIndex || 0);
          setHistory(historyRes.data.latestGameState.history || []);
        }
      } else {
        // Start new session
        const startRes = await interactionApi.start(task.id);
        if (startRes.data.success) {
          setSessionId(startRes.data.sessionId);
        }
      }
      setLoading(false);
    } catch (err) {
      console.error('Failed to initialize puzzle:', err);
      setLoading(false);
    }
  };

  const saveCurrentState = async () => {
    if (!sessionId) return;
    // Save the current game state to backend
    try {
      await interactionApi.step(task.id, sessionId, `[进度保存] 当前第 ${currentStepIndex + 1} 关`, {
        currentStepIndex,
        history,
      });
    } catch (err) {
      console.error('Failed to save state:', err);
    }
  };

  const checkAnswer = (userAnswer: string, pattern: string): boolean => {
    const cleanedInput = userAnswer.trim().toLowerCase();
    const cleanedPattern = pattern.trim().toLowerCase();

    // If pattern looks like regex (starts and ends with /)
    if (pattern.startsWith('/') && pattern.endsWith('/')) {
      try {
        const regex = new RegExp(pattern.slice(1, -1), 'i');
        return regex.test(cleanedInput);
      } catch (e) {
        // If regex invalid, fall back to exact match
        return cleanedInput === cleanedPattern;
      }
    }

    // Check multiple possible answers separated by |
    if (pattern.includes('|')) {
      const options = pattern.split('|').map(p => p.trim().toLowerCase());
      return options.some(opt => cleanedInput.includes(opt) || cleanedInput === opt);
    }

    // Exact match or contains match
    return cleanedInput === cleanedPattern || cleanedInput.includes(cleanedPattern);
  };

  const handleSubmit = async () => {
    setError('');

    if (!userInput.trim()) {
      setError('请输入答案');
      return;
    }

    try {
      if (checkAnswer(userInput, currentStep.answerPattern)) {
        // Correct answer
        const newHistory = [...history, { step: currentStepIndex, answer: userInput }];
        setHistory(newHistory);

        if (currentStepIndex >= totalSteps - 1) {
          // All steps completed
          setCompleted(true);
          // Compile all answers
          const fullAnswer = "# 渐进解谜\n\n" + config.description + "\n\n" + newHistory
            .map((h, i) => "## 第 " + (i + 1) + " 关\n问题: " + config.steps[i].question + "\n答案: " + h.answer + "\n")
            .join("\n") + "\n## 最终答案\n" + userInput + "\n\n---\n" + config.finalRewardText;

          // Save the final state and finish
          if (sessionId) {
            await interactionApi.step(task.id, sessionId, fullAnswer, {
              currentStepIndex,
              history: newHistory,
              completed: true,
            });
            // Let backend handle final scoring
            const finishRes = await interactionApi.finish(task.id, sessionId);
            if (finishRes.data.success) {
              onComplete(finishRes.data.fullAnswer, finishRes.data.submission.scores);
            }
          } else {
            // Fallback - use reference scores with random variation
            const finalScores = {
              accuracy: Math.min(100, Math.max(50, task.refAccuracy + Math.floor(Math.random() * 20) - 10)),
              reasoning: Math.min(100, Math.max(50, task.refReasoning + Math.floor(Math.random() * 20) - 10)),
              creativity: Math.min(100, Math.max(50, task.refCreativity + Math.floor(Math.random() * 20) - 10)),
              speed: Math.min(100, Math.max(50, task.refSpeed + Math.floor(Math.random() * 20) - 10)),
            };
            onComplete(fullAnswer, finalScores);
          }
        } else {
          // Move to next step
          setTimeout(() => {
            setCurrentStepIndex(prev => prev + 1);
            setUserInput('');
            setShowHint(false);
            saveCurrentState();
          }, 500);
        }
      } else {
        // Incorrect answer
        setError('答案不正确，请再试一次。');
      }
    } catch (err) {
      console.error('Submit error:', err);
      setError('提交失败，请重试。');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const handleReset = async () => {
    if (!confirm('确定要重置谜题吗？所有进度将被重置。')) return;
    try {
      const res = await interactionApi.reset(task.id);
      if (res.data.success) {
        setSessionId(res.data.sessionId);
        setCurrentStepIndex(0);
        setHistory([]);
        setUserInput('');
        setCompleted(false);
        setError('');
        setShowHint(false);
      } else {
        throw new Error('Reset failed');
      }
    } catch (err) {
      console.error('Reset error:', err);
      setError('重置失败，请重试。');
    }
  };

  const progress = ((currentStepIndex + 1) / totalSteps) * 100;

  if (loading) {
    return (
      <div className="puzzle-container">
        <div className="loading">正在加载谜题...</div>
      </div>
    );
  }

  return (
    <div className="puzzle-container">
      <div className="puzzle-header">
        <h3>{config.title}</h3>
        <p className="puzzle-description">{config.description}</p>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${progress}%` }}
          />
          <div className="progress-text">
            {currentStepIndex + 1} / {totalSteps}
          </div>
        </div>
        {history.length > 0 && (
          <button className="btn-reset-puzzle" onClick={handleReset}>
            🔄 重置谜题
          </button>
        )}
      </div>

      <div className="step-container">
        <div className="step-question">
          <div className="step-label">第 {currentStepIndex + 1} 问</div>
          <div className="question-text">{currentStep.question}</div>
        </div>

        {showHint && (
          <div className="hint-box">
            <div className="hint-label">💡 提示</div>
            <div className="hint-text">{currentStep.hint}</div>
          </div>
        )}

        {!showHint && (
          <button
            className="btn-show-hint"
            onClick={() => setShowHint(true)}
          >
            🤔 需要提示？点此查看
          </button>
        )}

        <div className="input-area">
          <input
            type="text"
            className="puzzle-input"
            placeholder="输入你的答案..."
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={completed}
            autoFocus
          />
          <button
            className="btn-submit-answer"
            onClick={handleSubmit}
            disabled={completed || !userInput.trim()}
          >
            ✓ 提交
          </button>
        </div>

        {error && <div className="error-text">{error}</div>}

        {currentStepIndex > 0 && (
          <div className="previous-steps">
            <div className="previous-label">已完成关卡:</div>
            {history.map((entry, i) => (
              <div key={i} className="previous-step">
                <span className="step-number">{i + 1}:</span> {entry.answer}
              </div>
            ))}
          </div>
        )}

        {completed && (
          <div className="completed-banner">
            🎉 恭喜！你已完成所有谜题！
            <div className="final-reward">{config.finalRewardText}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgressivePuzzle;
