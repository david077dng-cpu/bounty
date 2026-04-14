import React, { useState, useCallback, useEffect, Component } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useAuth } from '../contexts/AuthContext';
import { chessApi } from '../services/api';
import '../styles/Chess.css';

class ErrorBoundary extends Component<{ children: React.ReactNode }, { error: string | null }> {
  state = { error: null };
  static getDerivedStateFromError(e: any) { return { error: e?.message || String(e) }; }
  render() {
    if (this.state.error) return <pre style={{ color: 'red', padding: 24 }}>CRASH: {this.state.error}</pre>;
    return this.props.children;
  }
}

type GameStatus =
  | 'playing'
  | 'check'
  | 'checkmate-white'
  | 'checkmate-black'
  | 'stalemate'
  | 'draw';

function updateStatus(g: Chess): GameStatus {
  if (g.isCheckmate()) return g.turn() === 'w' ? 'checkmate-black' : 'checkmate-white';
  if (g.isStalemate()) return 'stalemate';
  if (g.isDraw()) return 'draw';
  if (g.inCheck()) return 'check';
  return 'playing';
}

function statusText(status: GameStatus, turn: string): string {
  switch (status) {
    case 'check':
      return turn === 'w' ? 'White is in CHECK' : 'Black is in CHECK';
    case 'checkmate-white':
      return 'CHECKMATE — White wins!';
    case 'checkmate-black':
      return 'CHECKMATE — Black wins!';
    case 'stalemate':
      return 'STALEMATE — Draw';
    case 'draw':
      return 'DRAW';
    default:
      return turn === 'w' ? 'Your turn (White)' : 'ARK is thinking...';
  }
}

function isGameOver(status: GameStatus): boolean {
  return status !== 'playing' && status !== 'check';
}

function chunkHistory(moves: string[]): [number, string, string?][] {
  const pairs: [number, string, string?][] = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push([Math.floor(i / 2) + 1, moves[i], moves[i + 1]]);
  }
  return pairs;
}

const Chess_Page: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [game, setGame] = useState<Chess>(() => new Chess());
  const [gameStatus, setGameStatus] = useState<GameStatus>('playing');
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalSquares, setLegalSquares] = useState<string[]>([]);
  const [customSquareStyles, setCustomSquareStyles] = useState<
    Record<string, React.CSSProperties>
  >({});
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [llmThinking, setLlmThinking] = useState(false);
  const [llmThought, setLlmThought] = useState('');
  const [error, setError] = useState('');

  // Redirect if not authenticated (must be in useEffect, not during render)
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [authLoading, user, navigate]);

  const buildHighlights = useCallback(
    (
      selected: string,
      legal: string[],
      last: { from: string; to: string } | null
    ) => {
      const styles: Record<string, React.CSSProperties> = {};

      // Last move — subtle purple tint
      if (last) {
        styles[last.from] = { backgroundColor: 'rgba(155,114,207,0.22)' };
        styles[last.to] = { backgroundColor: 'rgba(155,114,207,0.22)' };
      }

      // Legal destination dots
      legal.forEach((sq) => {
        styles[sq] = {
          background:
            'radial-gradient(circle, rgba(245,197,66,0.65) 26%, transparent 26%)',
        };
      });

      // Selected square
      styles[selected] = { backgroundColor: 'rgba(0,212,170,0.35)' };

      setCustomSquareStyles(styles);
    },
    []
  );

  const clearSelection = useCallback(
    (last: { from: string; to: string } | null) => {
      setSelectedSquare(null);
      setLegalSquares([]);

      if (last) {
        setCustomSquareStyles({
          [last.from]: { backgroundColor: 'rgba(155,114,207,0.22)' },
          [last.to]: { backgroundColor: 'rgba(155,114,207,0.22)' },
        });
      } else {
        setCustomSquareStyles({});
      }
    },
    []
  );

  const triggerLLMMove = useCallback(
    async (fen: string, history: string[], last: { from: string; to: string } | null) => {
      setLlmThinking(true);
      setLlmThought('');
      setError('');

      try {
        const res = await chessApi.getMove(fen, history);
        if (res.data.success && res.data.data) {
          const { move, thinking } = res.data.data;
          setLlmThought(thinking);

          const next = new Chess(fen);
          const result = next.move(move);
          if (result) {
            const newLast = { from: result.from, to: result.to };
            setGame(next);
            setLastMove(newLast);
            setGameStatus(updateStatus(next));
            setCustomSquareStyles({
              [result.from]: { backgroundColor: 'rgba(155,114,207,0.22)' },
              [result.to]: { backgroundColor: 'rgba(155,114,207,0.22)' },
            });
          }
        } else {
          setError(res.data.error || 'LLM failed to return a move');
          // Restore last-move highlight
          clearSelection(last);
        }
      } catch (err: any) {
        setError(err?.response?.data?.error || 'Network error — could not reach ARK');
        clearSelection(last);
      } finally {
        setLlmThinking(false);
      }
    },
    [clearSelection]
  );

  const onSquareClick = useCallback(
    (square: string) => {
      if (game.turn() !== 'w' || llmThinking || isGameOver(gameStatus)) return;

      if (selectedSquare === null) {
        const piece = game.get(square as any);
        if (!piece || piece.color !== 'w') return;

        const moves = game.moves({ square: square as any, verbose: true });
        if (moves.length === 0) return;

        const targets = moves.map((m) => m.to);
        setSelectedSquare(square);
        setLegalSquares(targets);
        buildHighlights(square, targets, lastMove);
      } else if (selectedSquare === square) {
        clearSelection(lastMove);
      } else if (legalSquares.includes(square)) {
        // Make the move
        const next = new Chess(game.fen());
        const result = next.move({ from: selectedSquare, to: square, promotion: 'q' });
        if (!result) {
          clearSelection(lastMove);
          return;
        }

        const newLast = { from: result.from, to: result.to };
        const newStatus = updateStatus(next);

        setGame(next);
        setLastMove(newLast);
        setGameStatus(newStatus);
        setSelectedSquare(null);
        setLegalSquares([]);
        setCustomSquareStyles({
          [result.from]: { backgroundColor: 'rgba(155,114,207,0.22)' },
          [result.to]: { backgroundColor: 'rgba(155,114,207,0.22)' },
        });

        if (!isGameOver(newStatus)) {
          triggerLLMMove(next.fen(), next.history(), newLast);
        }
      } else {
        // Re-select a different White piece
        const piece = game.get(square as any);
        if (piece && piece.color === 'w') {
          const moves = game.moves({ square: square as any, verbose: true });
          if (moves.length > 0) {
            const targets = moves.map((m) => m.to);
            setSelectedSquare(square);
            setLegalSquares(targets);
            buildHighlights(square, targets, lastMove);
            return;
          }
        }
        clearSelection(lastMove);
      }
    },
    [
      game,
      gameStatus,
      llmThinking,
      selectedSquare,
      legalSquares,
      lastMove,
      buildHighlights,
      clearSelection,
      triggerLLMMove,
    ]
  );

  const startNewGame = useCallback(() => {
    setGame(new Chess());
    setGameStatus('playing');
    setSelectedSquare(null);
    setLegalSquares([]);
    setCustomSquareStyles({});
    setLastMove(null);
    setLlmThinking(false);
    setLlmThought('');
    setError('');
  }, []);

  const resign = useCallback(() => {
    setGameStatus('checkmate-black');
    setLlmThought('');
  }, []);

  if (authLoading) {
    return <div style={{ padding: 40, fontFamily: 'var(--mono)', color: 'var(--muted)' }}>Loading...</div>;
  }

  if (!user) return null;

  const history = game.history();
  const pairs = chunkHistory(history);
  const over = isGameOver(gameStatus);
  const statusClass =
    gameStatus === 'check'
      ? 'status-value--check'
      : over
      ? 'status-value--gameover'
      : '';

  return (
  <ErrorBoundary>
    <div className="chess-page">
      <div className="chess-header">
        <h1 className="chess-title">// CHESS · ARK CHALLENGE</h1>
        <p className="chess-subtitle">You play White · ARK (Doubao) plays Black</p>
      </div>

      <div className="chess-layout">
        {/* Left: board + player rows + controls */}
        <div className="chess-board-area">
          {/* ARK (Black) — top */}
          <div className="chess-player">
            <span
              className={`player-dot${llmThinking ? ' player-dot--active' : ''}`}
              style={llmThinking ? { animation: 'pulse 1.4s infinite' } : {}}
            />
            <span className="player-name">ARK (Black)</span>
            {llmThinking && <span className="thinking-badge">thinking...</span>}
          </div>

          <Chessboard
            position={game.fen()}
            onSquareClick={onSquareClick}
            customSquareStyles={customSquareStyles}
            boardWidth={480}
            customDarkSquareStyle={{ backgroundColor: '#2a2f3e' }}
            customLightSquareStyle={{ backgroundColor: '#3d4455' }}
            arePiecesDraggable={false}
          />

          {/* User (White) — bottom */}
          <div className="chess-player">
            <span className="player-dot" style={{ background: 'var(--cyan)' }} />
            <span className="player-name">You (White)</span>
          </div>

          <div className="chess-controls">
            <button className="chess-btn chess-btn--primary" onClick={startNewGame}>
              New Game
            </button>
            <button
              className="chess-btn chess-btn--secondary"
              onClick={resign}
              disabled={over || llmThinking}
            >
              Resign
            </button>
          </div>
        </div>

        {/* Right: info panel */}
        <div className="chess-info-panel">
          {over && (
            <div className="chess-gameover-banner">
              <p className="gameover-title">{statusText(gameStatus, game.turn())}</p>
              <p className="gameover-sub">Click "New Game" to play again</p>
            </div>
          )}

          <div className="chess-status-box">
            <div className="panel-label">// STATUS</div>
            <div className={`status-value ${statusClass}`}>
              {statusText(gameStatus, game.turn())}
            </div>
          </div>

          {llmThought && (
            <div className="chess-thought-box">
              <div className="panel-label">// ARK ANALYSIS</div>
              <p className="thought-text">{llmThought}</p>
            </div>
          )}

          {error && <div className="chess-error">{error}</div>}

          <div className="chess-history-box">
            <div className="panel-label">// MOVE HISTORY</div>
            <div className="history-list">
              {pairs.length === 0 ? (
                <span className="history-empty">No moves yet</span>
              ) : (
                pairs.map(([num, white, black]) => (
                  <div key={num} className="history-row">
                    <span className="move-num">{num}.</span>
                    <span className="move-white">{white}</span>
                    <span className="move-black">{black ?? ''}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  </ErrorBoundary>
  );
};

export default Chess_Page;
