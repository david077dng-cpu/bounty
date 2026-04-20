import React, { useState, useEffect, useCallback } from 'react';
import { interactionApi } from '../services/api';
import type { Task, StructuredConfig, StructuredQuestion, StructuredGameState } from '../types';
import '../styles/StructuredQuiz.css';

export interface StructuredQuizProps {
  task: Task;
  onComplete: (finalAnswer: string, scores: any) => void;
}

const StructuredQuiz: React.FC<StructuredQuizProps> = ({
  task,
  onComplete,
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
      const parsedConfig: StructuredConfig = task.interactionConfig;
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
      setError('Failed to initialize quiz');
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

  // Placeholder handlers - will be implemented in next task
  const handleSubmit = () => {
    console.log('Submit to be implemented');
  };

  const handleReset = () => {
    console.log('Reset to be implemented');
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

      {/* TODO: render questions here in next task */}
      <div>Questions will be rendered here</div>

      {gameState.completed && (
        <div className="quiz-result">
          {/* TODO: result summary here */}
          Result summary will be here
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
