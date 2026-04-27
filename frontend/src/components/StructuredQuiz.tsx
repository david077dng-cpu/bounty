import React, { useState, useEffect, useCallback } from 'react';
import { interactionApi } from '../services/api';
import type {
  Task,
  StructuredConfig,
  StructuredQuestion,
  StructuredGameState,
  StructuredUserAnswer,
  SingleChoiceQuestion,
  MultipleChoiceQuestion,
  FillBlankQuestion,
  FillBlank,
} from '../types';
import '../styles/StructuredQuiz.css';

export interface StructuredQuizProps {
  task: Task;
  onComplete: (finalAnswer: string, scores: any) => void;
}

const StructuredQuiz: React.FC<StructuredQuizProps> = ({
  task,
  onComplete: _onComplete,
}) => {
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [config, setConfig] = useState<StructuredConfig | null>(null);
  const [processedQuestions, setProcessedQuestions] = useState<StructuredQuestion[]>([]);
  const [gameState, setGameState] = useState<StructuredGameState | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // Fisher-Yates shuffle
  const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  // Initialize - load or start session
  useEffect(() => {
    initializeQuiz();
  }, [task.id]);

  const initializeQuiz = async () => {
    try {
      setLoading(true);
      const historyRes = await interactionApi.getHistory(task.id);
      let sid: string;

      if (historyRes.data.success && historyRes.data.latestGameState) {
        // Restore from history
        sid = historyRes.data.sessionId;
        const restoredState = historyRes.data.latestGameState as StructuredGameState;
        setGameState(restoredState);
        setSubmitted(restoredState.completed);
      } else {
        // Start new session
        const startRes = await interactionApi.start(task.id);
        if (startRes.data.success) {
          sid = startRes.data.sessionId;
        } else {
          throw new Error('Failed to start session');
        }
      }
      setSessionId(sid);

      // Parse and process configuration
      // Handle both parsed object and string (defensive)
      if (!task.interactionConfig) {
        throw new Error('Missing quiz configuration');
      }
      let parsedConfig: StructuredConfig;
      if (typeof task.interactionConfig === 'string') {
        parsedConfig = JSON.parse(task.interactionConfig);
      } else {
        parsedConfig = task.interactionConfig as StructuredConfig;
      }
      setConfig(parsedConfig);

      // Process questions with randomization
      let questions = [...parsedConfig.questions];

      // Randomize question order if enabled
      if (parsedConfig.randomizeQuestions) {
        questions = shuffleArray(questions);
      }

      // Select N random questions if configured
      if (parsedConfig.selectN && parsedConfig.selectN < questions.length) {
        questions = questions.slice(0, parsedConfig.selectN);
      }

      // Randomize options within each question if enabled
      if (parsedConfig.randomizeOptions) {
        questions = questions.map(q => {
          if (q.type === 'single' || q.type === 'multiple') {
            return {
              ...q,
              options: shuffleArray(q.options),
            };
          }
          return q;
        });
      }

      setProcessedQuestions(questions);

      // Initialize game state if not restored
      if (!gameState) {
        const initialState: StructuredGameState = {
          answers: [],
          completed: false,
          score: 0,
          totalPossible: questions.reduce((sum, q) => sum + q.points, 0),
          questionOrder: questions.map(q => q.id),
        };
        setGameState(initialState);
      }

      setLoading(false);
    } catch (err) {
      console.error('Failed to initialize structured quiz:', err);
      console.error('task.interactionConfig type:', typeof task.interactionConfig);
      console.error('task.interactionConfig:', task.interactionConfig);
      setError('Failed to initialize quiz: ' + String(err));
      setLoading(false);
    }
  };

  // Save current game state to backend
  const saveCurrentState = useCallback(async () => {
    if (!sessionId || !gameState) return;
    try {
      await interactionApi.step(task.id, sessionId, '[State update]', gameState);
    } catch (err) {
      console.error('Failed to save game state:', err);
    }
  }, [sessionId, gameState, task.id]);

  // Auto-save when answers change
  useEffect(() => {
    if (gameState && sessionId && !submitted) {
      saveCurrentState();
    }
  }, [gameState?.answers]);

  // Get current answer for a question
  const getCurrentAnswer = (questionId: string): StructuredUserAnswer['answer'] | undefined => {
    const existing = gameState?.answers.find(a => a.questionId === questionId);
    return existing?.answer;
  };

  // Update answer for a question
  const updateAnswer = (questionId: string, answer: StructuredUserAnswer['answer']) => {
    if (!gameState || submitted) return;

    setGameState(prev => {
      if (!prev) return prev;
      const newAnswers = prev.answers.filter(a => a.questionId !== questionId);
      newAnswers.push({ questionId, answer });
      return {
        ...prev,
        answers: newAnswers,
      };
    });
  };

  // Handle single choice selection
  const handleSingleSelect = (question: SingleChoiceQuestion, optionId: string) => {
    updateAnswer(question.id, optionId);
  };

  // Handle multiple choice toggle
  const handleMultipleToggle = (question: MultipleChoiceQuestion, optionId: string) => {
    const current = getCurrentAnswer(question.id) as string[] || [];
    let newSelection: string[];

    if (current.includes(optionId)) {
      newSelection = current.filter(id => id !== optionId);
    } else {
      newSelection = [...current, optionId];
    }

    updateAnswer(question.id, newSelection);
  };

  // Handle fill-in-blank input change
  const handleFillChange = (question: FillBlankQuestion, blankId: string, value: string) => {
    const current = getCurrentAnswer(question.id) as Record<string, string> || {};
    const newBlanks = { ...current, [blankId]: value };
    updateAnswer(question.id, newBlanks);
  };

  // Calculate score for a single question
  const calculateQuestionScore = (question: StructuredQuestion, userAnswer: StructuredUserAnswer['answer'] | undefined): number => {
    if (question.type === 'single') {
      const selectedId = userAnswer as string;
      if (!selectedId) return 0;
      const option = question.options.find(o => o.id === selectedId);
      return option?.correct ? question.points : 0;
    }

    if (question.type === 'multiple') {
      const selectedIds = userAnswer as string[] || [];
      if (selectedIds.length === 0) return 0;

      const correctCount = question.options.filter(o => o.correct).length;
      if (correctCount === 0) return 0;

      let correctSelected = 0;
      let incorrectSelected = 0;

      selectedIds.forEach(id => {
      const option = question.options.find(o => o.id === id);
      if (option?.correct) correctSelected++;
        else incorrectSelected++;
      });

      // Formula: (correctSelected - incorrectSelected) / correctCount * points
      const score = ((correctSelected - incorrectSelected) / correctCount) * question.points;
      return Math.max(0, Math.min(question.points, score));
    }

    if (question.type === 'fill') {
      const userInputs = userAnswer as Record<string, string> || {};
      const correctCount = question.blanks.reduce((count, blank) => {
        const userInput = (userInputs[blank.id] || '').trim();
        if (!userInput) return count;
        if (checkFillBlankMatch(userInput, blank)) return count + 1;
        return count;
      }, 0);

      return (correctCount / question.blanks.length) * question.points;
    }

    return 0;
  };

  // Check if user input matches the expected answer for a fill blank
  const checkFillBlankMatch = (userInput: string, blank: FillBlank): boolean => {
    let input = userInput.trim();
    let expected = blank.answer.trim();
    const caseInsensitive = blank.caseInsensitive !== false;

    if (caseInsensitive) {
      input = input.toLowerCase();
      expected = expected.toLowerCase();
    }

    // Multiple options separated by |
    if (expected.includes('|')) {
      const options = expected.split('|').map(o => o.trim());
      return options.some(opt => {
        if (opt.startsWith('/') && opt.endsWith('/')) {
          // Regex match
          try {
            const regex = new RegExp(opt.slice(1, -1), caseInsensitive ? 'i' : '');
            return regex.test(input);
          } catch (e) {
            return input === opt;
          }
        }
        return input === opt || input.includes(opt);
      });
    }

    // Regex match
    if (expected.startsWith('/') && expected.endsWith('/')) {
      try {
        const regex = new RegExp(expected.slice(1, -1), caseInsensitive ? 'i' : '');
        return regex.test(input);
      } catch (e) {
        return input === expected;
      }
    }

    // Exact match default
    return input === expected;
  };

  // Check if answer is correct (after submit)
  const isQuestionCorrect = (question: StructuredQuestion, userAnswer: StructuredUserAnswer['answer']): boolean => {
    return calculateQuestionScore(question, userAnswer) === question.points;
  };

  // Check if a blank is correctly answered (after submit)
  const isBlankCorrect = (question: FillBlankQuestion, blankId: string, userInput: string): boolean => {
    const blank = question.blanks.find(b => b.id === blankId);
    if (!blank) return false;
    return checkFillBlankMatch(userInput, blank);
  };

  // Renderers
  const renderSingleChoice = (question: SingleChoiceQuestion) => {
    const selectedId = getCurrentAnswer(question.id) as string;
    return (
      <div className="option-list">
        {question.options.map(option => {
          let className = 'option-item';
          if (selectedId === option.id) className += ' selected';
          if (submitted && option.correct) className += ' correct';
          if (submitted && selectedId === option.id && !option.correct) className += ' incorrect';

          return (
            <div
              key={option.id}
              className={className}
              onClick={() => !submitted && handleSingleSelect(question, option.id)}
            >
              <div className="option-indicator" />
              <div className="option-text">{option.text}</div>
              {submitted && option.correct && (
                <span className="option-correct-badge">✓</span>
              )}
              {submitted && selectedId === option.id && !option.correct && (
                <span className="option-incorrect-badge">✗</span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderMultipleChoice = (question: MultipleChoiceQuestion) => {
    const selectedIds = getCurrentAnswer(question.id) as string[] || [];

    return (
      <>
        <div className="option-list">
          {question.options.map(option => {
            const isSelected = selectedIds.includes(option.id);
            let className = 'option-item';
            if (isSelected) className += ' selected';
            if (submitted && option.correct) className += ' correct';
            if (submitted && isSelected && !option.correct) className += ' incorrect';

            return (
              <div
                key={option.id}
                className={className}
                onClick={() => !submitted && handleMultipleToggle(question, option.id)}
              >
                <div className="option-indicator">
                  {isSelected && '✓'}
                </div>
                <div className="option-text">{option.text}</div>
                {submitted && option.correct && (
                  <span className="option-correct-badge">✓</span>
                )}
                {submitted && isSelected && !option.correct && (
                  <span className="option-incorrect-badge">✗</span>
                )}
              </div>
            );
          })}
        </div>
        {(question.minSelected || question.maxSelected) && !submitted && (
          <div className="selection-hint">
            {question.minSelected && question.maxSelected
              ? `请选择 ${question.minSelected} - ${question.maxSelected} 项`
              : question.minSelected
                ? `至少选择 ${question.minSelected} 项`
                : `最多选择 ${question.maxSelected} 项`
            }
          </div>
        )}
      </>
    );
  };

  const renderFillBlank = (question: FillBlankQuestion) => {
    const userInputs = getCurrentAnswer(question.id) as Record<string, string> || {};
    // Parse the question text and split into segments around placeholders
    // Supported formats:
    // - Explicit id: ____1____, __2__ (matches id from blanks array)
    // - Just blanks: ____ automatically assigned in order to blanks array
    const parts: Array<{ type: 'text', content: string } | { type: 'blank', blank: FillBlank }> = [];

    let text = question.question;
    // First, match explicit placeholders with id: ____id____ or __id__
    // If no explicit ids found, fall back to matching any ____ runs
    const explicitRegex = /_{2,}([a-zA-Z0-9]+)_{2,}/g;
    const implicitRegex = /_{4,}/g; // 4+ underscores = a blank
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let implicitBlankIndex = 0;

    // Check if there are any explicit matches first
    const hasExplicitMatches = text.match(explicitRegex);

    if (hasExplicitMatches) {
      // Use explicit matching (with ids)
      explicitRegex.lastIndex = 0;
      while ((match = explicitRegex.exec(text)) !== null) {
        // Add text before placeholder
        if (match.index > lastIndex) {
          parts.push({
            type: 'text',
            content: text.slice(lastIndex, match.index),
          });
        }
        // Find the blank by id
        const blankId = match[1];
        const blank = question.blanks.find(b => b.id === blankId);
        if (blank) {
          parts.push({
            type: 'blank',
            blank,
          });
        } else {
          // If blank not found, just add the placeholder as text
          parts.push({ type: 'text', content: match[0] });
        }
        lastIndex = match.index + match[0].length;
      }
    } else {
      // Implicit matching - any run of 4+ underscores is a blank, match in order to blanks array
      while ((match = implicitRegex.exec(text)) !== null) {
        // Add text before placeholder
        if (match.index > lastIndex) {
          parts.push({
            type: 'text',
            content: text.slice(lastIndex, match.index),
          });
        }
        // Get the blank by position
        const blank = question.blanks[implicitBlankIndex];
        if (blank) {
          parts.push({
            type: 'blank',
            blank,
          });
          implicitBlankIndex++;
        } else {
          // If no more blanks in array, add as text
          parts.push({ type: 'text', content: match[0] });
        }
        lastIndex = match.index + match[0].length;
      }
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push({ type: 'text', content: text.slice(lastIndex) });
    }

    return (
      <div className="fill-question-container">
        {parts.map((part, index) => {
          if (part.type === 'text') {
            return <span key={index}>{part.content}</span>;
          }

          const blank = part.blank;
          const value = userInputs[blank.id] || '';
          let className = 'fill-blank-input';
          if (submitted) {
            if (isBlankCorrect(question, blank.id, value)) {
              className += ' correct';
            } else {
              className += ' incorrect';
            }
          }

          return (
            <span key={blank.id} className="fill-blank-inline">
              <input
                type="text"
                className={className}
                value={value}
                placeholder={blank.placeholder || '...'}
                onChange={(e) => handleFillChange(question, blank.id, e.target.value)}
                disabled={submitted}
                autoComplete="off"
              />
            </span>
          );
        })}
      </div>
    );
  };

  const renderQuestion = (question: StructuredQuestion) => {
    const userAnswer = getCurrentAnswer(question.id);
    let cardClasses = 'question-card';
    let isCorrect = false;

    if (submitted) {
      isCorrect = userAnswer ? isQuestionCorrect(question, userAnswer) : false;
      cardClasses += isCorrect ? ' correct' : ' incorrect';
    }

    return (
      <div key={question.id} className={cardClasses}>
        <div className="question-header">
          {question.type !== 'fill' && <div className="question-text">{question.question}</div>}
          <div className="question-points">{question.points} 分</div>
        </div>

        {question.type === 'single' && renderSingleChoice(question)}
        {question.type === 'multiple' && renderMultipleChoice(question)}
        {question.type === 'fill' && renderFillBlank(question)}

        {submitted && !isCorrect && (
          <div style={{ marginTop: 8, fontSize: '0.85rem', color: 'var(--red)' }}>
            当前得分: {calculateQuestionScore(question, userAnswer).toFixed(1)} / {question.points}
          </div>
        )}
      </div>
    );
  };

  const calculateTotalScore = (): number => {
    if (!gameState) return 0;

    let total = 0;
    processedQuestions.forEach(question => {
      const userAnswer = getCurrentAnswer(question.id);
      total += calculateQuestionScore(question, userAnswer);
    });

    return total;
  };

  const handleSubmit = async () => {
    if (!gameState || !sessionId || submitted) return;

    try {
      // Calculate final score
      const totalScore = calculateTotalScore();
      const totalPossible = gameState.totalPossible;

      const finalState: StructuredGameState = {
        ...gameState,
        score: totalScore,
        completed: true,
      };

      setGameState(finalState);
      setSubmitted(true);

      // Save final state
      await interactionApi.step(task.id, sessionId, '[Submitted]', finalState);

      // Compile full answer text for submission
      const percent = totalPossible > 0 ? (totalScore / totalPossible) * 100 : 0;
      const passThreshold = config?.passThreshold || 60;
      const passed = percent >= passThreshold;

      let fullAnswer = `# ${config?.title}\n\n${config?.description}\n\n`;
      fullAnswer += `## 测验结果\n\n得分: ${totalScore.toFixed(1)} / ${totalPossible} (${percent.toFixed(1)}%)\n`;
      fullAnswer += `结果: ${passed ? '✅ 通过' : '❌ 未通过'}\n\n`;
      fullAnswer += `## 答题详情\n\n`;

      processedQuestions.forEach((q, i) => {
        const userAnswer = getCurrentAnswer(q.id);
        const score = calculateQuestionScore(q, userAnswer);
        fullAnswer += `### ${i + 1}. ${q.question}\n`;
        fullAnswer += `- 得分: ${score.toFixed(1)} / ${q.points}\n`;

        if (q.type === 'single') {
          const selected = userAnswer as string;
          const option = q.options.find(o => o.id === selected);
          fullAnswer += `- 你的选择: ${option?.text || '未选择'}\n`;
        } else if (q.type === 'multiple') {
          const selected = userAnswer as string[] || [];
          const texts = selected.map(id => q.options.find(o => o.id === id)?.text).filter(Boolean);
          fullAnswer += `- 你的选择: ${texts.join(', ')}\n`;
        } else if (q.type === 'fill') {
          const inputs = userAnswer as Record<string, string> || {};
          q.blanks.forEach(blank => {
            fullAnswer += `- ${blank.id}: ${inputs[blank.id] || '(空白)'}\n`;
          });
        }
        fullAnswer += '\n';
      });

      // Finish and get scored submission
      const finishRes = await interactionApi.finish(task.id, sessionId);
      if (finishRes.data.success) {
        _onComplete(finishRes.data.fullAnswer, finishRes.data.submission.scores);
      } else {
        // Fallback: calculate scores based on our percentage
        const percentScore = percent;
        const finalScores = {
          accuracy: Math.min(100, Math.max(30, percentScore + Math.floor(Math.random() * 20) - 10)),
          reasoning: Math.min(100, Math.max(30, percentScore + Math.floor(Math.random() * 20) - 10)),
          creativity: Math.min(100, Math.max(30, 50 + Math.floor(Math.random() * 20))),
          speed: Math.min(100, Math.max(30, 50 + Math.floor(Math.random() * 20))),
        };
        _onComplete(fullAnswer, finalScores);
      }
    } catch (err) {
      console.error('Submit error:', err);
      setError('提交失败，请重试。');
      // Revert state on failure
      setGameState(prev => prev ? { ...prev, completed: false } : prev);
      setSubmitted(false);
    }
  };

  const handleReset = async () => {
    try {
      // Start new session
      const resetRes = await interactionApi.reset(task.id);
      if (resetRes.data.success) {
        setSessionId(resetRes.data.sessionId);
        // Re-initialize with new randomization
        initializeQuiz();
        setSubmitted(false);
        setError('');
      } else {
        throw new Error('Reset failed');
      }
    } catch (err) {
      console.error('Reset error:', err);
      setError('重置失败，请重试。');
    }
  };

  if (loading) {
    return (
      <div className="structured-quiz">
        <div className="loading">正在加载测验...</div>
      </div>
    );
  }

  if (error || !config || !gameState) {
    return (
      <div className="structured-quiz">
        <div className="error-text">{error || 'Invalid quiz configuration'}</div>
      </div>
    );
  }

  const totalAnswered = gameState.answers.filter(a => {
    const ans = a.answer;
    if (typeof ans === 'string') return !!ans;
    if (Array.isArray(ans)) return ans.length > 0;
    if (typeof ans === 'object') {
      return Object.values(ans).every(v => !!v);
    }
    return false;
  }).length;

  const totalQuestions = processedQuestions.length;
  const percentAnswered = totalQuestions > 0 ? (totalAnswered / totalQuestions) * 100 : 0;

  return (
    <div className="structured-quiz">
      <div className="quiz-header">
        <h3>{config.title}</h3>
        <p className="quiz-description">{config.description}</p>
        <div className="quiz-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${percentAnswered}%`, background: 'var(--cyan)' }}
            />
          </div>
          <div className="progress-text">
            {totalAnswered} / {totalQuestions}
          </div>
        </div>
      </div>

      {/* Render all questions */}
      {processedQuestions.map(q => renderQuestion(q))}

      {/* Result summary after submission */}
      {submitted && (
        <div className="quiz-result">
          {(() => {
            const percent = gameState.totalPossible > 0
              ? (gameState.score / gameState.totalPossible) * 100
              : 0;
            const passThreshold = config.passThreshold || 60;
            const passed = percent >= passThreshold;

            return (
              <>
                <h4 className={passed ? 'pass' : 'fail'}>
                  {passed ? '✅ 恭喜，测验通过！' : '❌ 测验未通过，请重试'}
                </h4>
                <div className="result-score">{gameState.score.toFixed(1)} / {gameState.totalPossible}</div>
                <div className="result-percent">正确率 {(percent).toFixed(1)}%</div>

                <div className="progress-bar">
                  <div
                    className={`progress-fill ${passed ? 'pass' : 'fail'}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </>
            );
          })()}
        </div>
      )}

      <div className="quiz-actions">
        <button
          className="btn-quiz btn-quiz-primary"
          onClick={handleSubmit}
          disabled={!gameState || submitted || totalAnswered < totalQuestions}
        >
          交卷评分
        </button>
        <button
          className="btn-quiz btn-quiz-secondary"
          onClick={handleReset}
          disabled={loading}
        >
          重置重做
        </button>
      </div>
    </div>
  );
};

export default StructuredQuiz;
