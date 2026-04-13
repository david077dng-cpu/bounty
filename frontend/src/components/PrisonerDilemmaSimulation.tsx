import React, { useState, useEffect, useRef } from 'react';

type Move = 'C' | 'D';

interface Strategy {
  id: string;
  name: string;
  description: string;
  color: string;
}

interface BattleHistoryEntry {
  round: number;
  moveA: Move;
  moveB: Move;
  scoreA: number;
  scoreB: number;
}

interface TournamentResult {
  strategyId: string;
  strategyName: string;
  totalScore: number;
  averageScore: number;
  rank: number;
}

interface EvolutionHistoryEntry {
  generation: number;
  proportions: Record<string, number>;
}

// Prisoner's Dilemma payoff matrix
// [myMove][opponentMove] -> score
const PAYOFF = {
  'C': {
    'C': 3,
    'D': 0,
  },
  'D': {
    'C': 5,
    'D': 1,
  },
};

// All 8 classic strategies
const STRATEGIES: Strategy[] = [
  {
    id: 'always-cooperate',
    name: '永远合作',
    description: 'Always cooperate, never defects',
    color: '#00d4aa', // cyan
  },
  {
    id: 'always-defect',
    name: '永远背叛',
    description: 'Always defects, never cooperates',
    color: '#ff4d6d', // red
  },
  {
    id: 'tit-for-tat',
    name: '以牙还牙',
    description: 'Starts cooperate, then copies opponent\'s last move',
    color: '#4a9eff', // blue
  },
  {
    id: 'tit-for-two-tats',
    name: '两次以牙还牙',
    description: 'Only defects after two consecutive defections',
    color: '#9b72cf', // purple
  },
  {
    id: 'pavlov',
    name: '帕甫洛夫',
    description: 'Win-stay, lose-shift: repeats if score > 2, otherwise switches',
    color: '#f5c542', // gold
  },
  {
    id: 'random',
    name: '随机策略',
    description: '50% cooperate, 50% defect randomly',
    color: '#888888', // gray
  },
  {
    id: 'grudger',
    name: '记仇策略',
    description: 'Cooperates until first defection, then defects forever',
    color: '#ff8844', // orange
  },
  {
    id: 'reverse-tit-for-tat',
    name: '反向以牙还牙',
    description: 'Starts defect, then does opposite of opponent\'s last move',
    color: '#44ff88', // light green
  },
];

// Strategy decision functions
const makeMove = (strategyId: string, myMoves: Move[], opponentMoves: Move[]): Move => {
  switch (strategyId) {
    case 'always-cooperate':
      return 'C';
    case 'always-defect':
      return 'D';
    case 'tit-for-tat':
      if (opponentMoves.length === 0) return 'C';
      return opponentMoves[opponentMoves.length - 1];
    case 'tit-for-two-tats':
      if (opponentMoves.length < 2) return 'C';
      if (opponentMoves[opponentMoves.length - 1] === 'D' &&
          opponentMoves[opponentMoves.length - 2] === 'D') {
        return 'D';
      }
      return 'C';
    case 'pavlov': {
      if (myMoves.length === 0) return 'C';
      const lastMyMove = myMoves[myMoves.length - 1];
      const lastOpponentMove = opponentMoves[opponentMoves.length - 1];
      const lastScore = PAYOFF[lastMyMove][lastOpponentMove];
      if (lastScore > 2) {
        return lastMyMove; // win-stay
      } else {
        return lastMyMove === 'C' ? 'D' : 'C'; // lose-shift
      }
    }
    case 'random':
      return Math.random() < 0.5 ? 'C' : 'D';
    case 'grudger':
      if (opponentMoves.includes('D')) {
        return 'D';
      }
      return 'C';
    case 'reverse-tit-for-tat':
      if (opponentMoves.length === 0) return 'D';
      return opponentMoves[opponentMoves.length - 1] === 'C' ? 'D' : 'C';
    default:
      return 'C';
  }
};

const PrisonerDilemmaSimulation: React.FC = () => {
  // Active tab
  const [activeTab, setActiveTab] = useState<'battle' | 'tournament' | 'evolution'>('battle');

  // ========== Battle State ==========
  const [battleStrategyA, setBattleStrategyA] = useState<string>('pavlov');
  const [battleStrategyB, setBattleStrategyB] = useState<string>('always-defect');
  const [battleRounds, setBattleRounds] = useState<number>(200);
  const [battleRunning, setBattleRunning] = useState<boolean>(false);
  const [battleHistory, setBattleHistory] = useState<BattleHistoryEntry[]>([]);
  const [battleTotalA, setBattleTotalA] = useState<number>(0);
  const [battleTotalB, setBattleTotalB] = useState<number>(0);

  // ========== Tournament State ==========
  const [tournamentSelected, setTournamentSelected] = useState<Set<string>>(
    new Set(STRATEGIES.map(s => s.id))
  );
  const [tournamentRounds, setTournamentRounds] = useState<number>(200);
  const [tournamentRunning, setTournamentRunning] = useState<boolean>(false);
  const [tournamentResults, setTournamentResults] = useState<TournamentResult[]>([]);
  const [tournamentProgress, setTournamentProgress] = useState<number>(0);
  const [tournamentCompleted, setTournamentCompleted] = useState<number>(0);

  // ========== Evolution State ==========
  const [evoStartingProportions, setEvoStartingProportions] = useState<Record<string, number>>(() => {
    const props: Record<string, number> = {};
    STRATEGIES.forEach(s => {
      props[s.id] = s.id === 'always-defect' ? 95 : s.id === 'tit-for-tat' ? 5 : 0;
    });
    return props;
  });
  const [evoGenerations, setEvoGenerations] = useState<number>(100);
  const [evoPopulationSize, setEvoPopulationSize] = useState<number>(200);
  const [evoMutationRate, setEvoMutationRate] = useState<number>(1);
  const [evoRunning, setEvoRunning] = useState<boolean>(false);
  const [evoCurrentGen, setEvoCurrentGen] = useState<number>(0);
  const [evoHistory, setEvoHistory] = useState<EvolutionHistoryEntry[]>([]);
  const [evoFinished, setEvoFinished] = useState<boolean>(false);

  const animationRef = useRef<number | null>(null);

  // Toggle strategy selection for tournament
  const toggleTournamentSelection = (strategyId: string) => {
    const newSelected = new Set(tournamentSelected);
    if (newSelected.has(strategyId)) {
      if (newSelected.size > 2) {
        newSelected.delete(strategyId);
      }
    } else {
      newSelected.add(strategyId);
    }
    setTournamentSelected(newSelected);
  };

  // Update evolution proportion
  const updateEvoProportion = (strategyId: string, value: number) => {
    setEvoStartingProportions(prev => ({
      ...prev,
      [strategyId]: value,
    }));
  };

  // Run a single battle between two strategies
  const runBattle = (strategyA: string, strategyB: string, rounds: number): {
    history: BattleHistoryEntry[],
    totalA: number,
    totalB: number,
  } => {
    const history: BattleHistoryEntry[] = [];
    const myMovesA: Move[] = [];
    const myMovesB: Move[] = [];
    let totalA = 0;
    let totalB = 0;

    for (let i = 0; i < rounds; i++) {
      const moveA = makeMove(strategyA, myMovesA, myMovesB);
      const moveB = makeMove(strategyB, myMovesB, myMovesA);

      const scoreA = PAYOFF[moveA][moveB];
      const scoreB = PAYOFF[moveB][moveA];

      totalA += scoreA;
      totalB += scoreB;

      history.push({
        round: i + 1,
        moveA,
        moveB,
        scoreA,
        scoreB,
      });

      myMovesA.push(moveA);
      myMovesB.push(moveB);
    }

    return { history, totalA, totalB };
  };

  // Start battle
  const startBattle = () => {
    if (battleRunning) return;
    setBattleRunning(true);

    const result = runBattle(battleStrategyA, battleStrategyB, battleRounds);
    setBattleHistory(result.history);
    setBattleTotalA(result.totalA);
    setBattleTotalB(result.totalB);
    setBattleRunning(false);
  };

  // Run full round-robin tournament
  const runTournament = async () => {
    if (tournamentRunning) return;
    setTournamentRunning(true);
    setTournamentProgress(0);
    setTournamentCompleted(0);
    setTournamentResults([]);

    const selected = Array.from(tournamentSelected);
    const scores: Record<string, number> = {};
    const pairings: Record<string, number> = {};

    selected.forEach(s => {
      scores[s] = 0;
      pairings[s] = 0;
    });

    const totalPairings = (selected.length * (selected.length - 1)) / 2;
    let completed = 0;

    for (let i = 0; i < selected.length; i++) {
      for (let j = i + 1; j < selected.length; j++) {
        const a = selected[i];
        const b = selected[j];

        const result = runBattle(a, b, tournamentRounds);
        scores[a] += result.totalA;
        scores[b] += result.totalB;
        pairings[a] += tournamentRounds;
        pairings[b] += tournamentRounds;

        completed++;
        setTournamentCompleted(completed);
        setTournamentProgress(Math.round((completed / totalPairings) * 100));

        // Yield to UI to show progress
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    // Calculate average scores and sort
    const results: TournamentResult[] = selected.map(s => ({
      strategyId: s,
      strategyName: STRATEGIES.find(st => st.id === s)!.name,
      totalScore: scores[s],
      averageScore: scores[s] / pairings[s],
      rank: 0,
    }));

    results.sort((a, b) => b.averageScore - a.averageScore);
    results.forEach((r, i) => {
      r.rank = i + 1;
    });

    setTournamentResults(results);
    setTournamentRunning(false);
  };

  // Initialize evolution population
  const initEvolution = () => {
    // Normalize proportions to sum to 100%
    let total = Object.values(evoStartingProportions).reduce((a, b) => a + b, 0);
    if (total === 0) {
      // If all zero, give everyone equal
      STRATEGIES.forEach(s => evoStartingProportions[s.id] = 100 / STRATEGIES.length);
      total = 100;
    }

    const population: string[] = [];
    Object.entries(evoStartingProportions).forEach(([id, proportion]) => {
      const count = Math.round((proportion / total) * evoPopulationSize);
      for (let i = 0; i < count; i++) {
        population.push(id);
      }
    });

    // If rounding off, pad with random to reach target size
    while (population.length < evoPopulationSize) {
      const randIndex = Math.floor(Math.random() * STRATEGIES.length);
      population.push(STRATEGIES[randIndex].id);
    }
    while (population.length > evoPopulationSize) {
      population.pop();
    }

    return population;
  };

  // Get current proportions
  const getProportions = (population: string[]): Record<string, number> => {
    const counts: Record<string, number> = {};
    STRATEGIES.forEach(s => counts[s.id] = 0);
    population.forEach(id => counts[id]++);
    const proportions: Record<string, number> = {};
    STRATEGIES.forEach(s => {
      proportions[s.id] = (counts[s.id] / population.length) * 100;
    });
    return proportions;
  };

  // Selection: fitness-proportional (roulette wheel)
  const selectParent = (population: string[], fitness: Record<string, number>): string => {
    const totalFitness = population.reduce((sum, id) => sum + fitness[id], 0);
    let rand = Math.random() * totalFitness;
    for (const id of population) {
      rand -= fitness[id];
      if (rand <= 0) {
        return id;
      }
    }
    return population[0]; // fallback
  };

  // Mutate with small probability
  const maybeMutate = (strategyId: string): string => {
    if (Math.random() * 100 < evoMutationRate) {
      const randomIndex = Math.floor(Math.random() * STRATEGIES.length);
      return STRATEGIES[randomIndex].id;
    }
    return strategyId;
  };

  // Run one generation
  const runGeneration = (population: string[]): string[] => {
    // Calculate fitness for each individual by playing random matches
    const fitness: Record<string, number> = {};
    population.forEach(id => fitness[id] = 0);

    // Each individual plays 5 random opponents to estimate fitness
    const matchesPerIndividual = 5;
    for (let i = 0; i < population.length; i++) {
      for (let m = 0; m < matchesPerIndividual; m++) {
        const opponentIndex = Math.floor(Math.random() * population.length);
        const a = population[i];
        const b = population[opponentIndex];
        const result = runBattle(a, b, 10);
        fitness[a] += result.totalA;
        fitness[b] += result.totalB;
      }
    }

    // Create next generation
    const nextPopulation: string[] = [];
    while (nextPopulation.length < population.length) {
      const parent1 = selectParent(population, fitness);
      const parent2 = selectParent(population, fitness);
      // Each parent produces one offspring
      nextPopulation.push(maybeMutate(parent1));
      if (nextPopulation.length < population.length) {
        nextPopulation.push(maybeMutate(parent2));
      }
    }

    return nextPopulation;
  };

  const startEvolution = () => {
    if (evoRunning) return;

    // Reset
    setEvoRunning(true);
    setEvoCurrentGen(0);
    setEvoFinished(false);

    const initialPop = initEvolution();
    const initialHistory: EvolutionHistoryEntry[] = [{
      generation: 0,
      proportions: getProportions(initialPop),
    }];
    setEvoHistory(initialHistory);

    let currentPopulation = initialPop;
    let currentGen = 0;

    const step = () => {
      if (currentGen >= evoGenerations) {
        setEvoRunning(false);
        setEvoFinished(true);
        return;
      }

      currentPopulation = runGeneration(currentPopulation);
      currentGen++;
      setEvoCurrentGen(currentGen);

      setEvoHistory(prev => [
        ...prev,
        {
          generation: currentGen,
          proportions: getProportions(currentPopulation),
        },
      ]);

      animationRef.current = requestAnimationFrame(step);
    };

    animationRef.current = requestAnimationFrame(step);
  };

  const pauseEvolution = () => {
    setEvoRunning(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  };

  const resetEvolution = () => {
    pauseEvolution();
    setEvoCurrentGen(0);
    setEvoHistory([]);
    setEvoFinished(false);
  };

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Get strategy color by id
  const getStrategyColor = (id: string): string => {
    return STRATEGIES.find(s => s.id === id)?.color || '#888';
  };

  // Get strategy name by id
  const getStrategyName = (id: string): string => {
    return STRATEGIES.find(s => s.id === id)?.name || id;
  };

  // SVG Chart for tournament results
  const renderTournamentChart = () => {
    if (tournamentResults.length === 0) return null;

    const maxScore = Math.max(...tournamentResults.map(r => r.averageScore));
    const height = 250;
    const barWidth = 100 / tournamentResults.length;

    return (
      <div className="pd-chart-container">
        <svg width="100%" height={height} className="pd-chart">
          {tournamentResults.map((result, index) => {
            const barHeight = (result.averageScore / maxScore) * (height - 40);
            const x = `${index * barWidth}%`;
            const y = height - barHeight - 20;
            const color = getStrategyColor(result.strategyId);
            return (
              <g key={result.strategyId}>
                <rect
                  x={x}
                  y={y}
                  width={`${barWidth - 2}%`}
                  height={barHeight}
                  fill={color}
                  fillOpacity={0.7}
                  stroke={color}
                  strokeWidth={1}
                  rx={3}
                />
                <text
                  x={`${index * barWidth + barWidth / 2}%`}
                  y={height - 5}
                  textAnchor="middle"
                  fill="var(--muted)"
                  fontSize={10}
                  transform={`rotate(-45, ${index * barWidth + barWidth / 2}%, ${height})`}
                >
                  {result.strategyName.split(' ')[0]}
                </text>
                <text
                  x={`${index * barWidth + barWidth / 2}%`}
                  y={y - 5}
                  textAnchor="middle"
                  fill={color}
                  fontSize={10}
                >
                  {result.averageScore.toFixed(2)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  // SVG Line Chart for evolution
  const renderEvolutionChart = () => {
    if (evoHistory.length === 0) return null;

    const height = 250;
    const maxGen = evoGenerations;

    // Create a path for each strategy
    const paths: { id: string; path: string; color: string }[] = [];

    STRATEGIES.forEach(strategy => {
      if (evoStartingProportions[strategy.id] === 0 &&
          !evoHistory.some(h => h.proportions[strategy.id] > 1)) {
        return; // Skip if strategy never appears
      }

      let pathD = '';
      evoHistory.forEach((entry, index) => {
        const proportion = entry.proportions[strategy.id];
        const x = (entry.generation / maxGen) * 100;
        const y = height - 20 - (proportion / 100) * (height - 40);
        if (index === 0) {
          pathD += `M ${x} ${y}`;
        } else {
          pathD += ` L ${x} ${y}`;
        }
      });

      paths.push({
        id: strategy.id,
        path: pathD,
        color: strategy.color,
      });
    });

    return (
      <div className="pd-chart-container">
        <svg width="100%" height={height} className="pd-chart">
          {/* Y-axis ticks */}
          {[0, 25, 50, 75, 100].map(percent => {
            const y = height - 20 - (percent / 100) * (height - 40);
            return (
              <g key={percent}>
                <line
                  x1="0"
                  y1={y}
                  x2="100%"
                  y2={y}
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth={1}
                  strokeDasharray="4,4"
                />
                <text
                  x={5}
                  y={y + 4}
                  fill="var(--muted)"
                  fontSize={10}
                >
                  {percent}%
                </text>
              </g>
            );
          })}

          {/* X-axis ticks */}
          {[0, 25, 50, 75, 100].map(percent => {
            const x = percent;
            const y = height - 10;
            return (
              <text
                key={percent}
                x={`${x}%`}
                y={y}
                fill="var(--muted)"
                fontSize={10}
                textAnchor="middle"
              >
                {Math.round((percent / 100) * evoGenerations)}
              </text>
            );
          })}

          {/* Lines for each strategy */}
          {paths.map(({ id, path, color }) => (
            <path
              key={id}
              d={path}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeOpacity={0.8}
            />
          ))}
        </svg>

        {/* Legend */}
        <div className="pd-legend">
          {paths.map(({ id, color }) => (
            <div key={id} className="pd-legend-item">
              <span className="pd-legend-color" style={{ backgroundColor: color }} />
              <span className="pd-legend-text">{getStrategyName(id)}</span>
              <span className="pd-legend-value">
                {evoHistory[evoHistory.length - 1].proportions[id].toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="pd-simulation">
      <div className="pd-tabs">
        <button
          className={`pd-tab ${activeTab === 'battle' ? 'active' : ''}`}
          onClick={() => setActiveTab('battle')}
        >
          🎯 对战
        </button>
        <button
          className={`pd-tab ${activeTab === 'tournament' ? 'active' : ''}`}
          onClick={() => setActiveTab('tournament')}
        >
          🏆 阿克塞尔罗德锦标赛
        </button>
        <button
          className={`pd-tab ${activeTab === 'evolution' ? 'active' : ''}`}
          onClick={() => setActiveTab('evolution')}
        >
          🧬 种群进化
        </button>
      </div>

      <div className="pd-content">
        {/* ========== Battle Tab ========== */}
        {activeTab === 'battle' && (
          <div className="pd-tab-content">
            <div className="pd-controls">
              <div className="pd-control-row">
                <div className="pd-control">
                  <label>策略 A</label>
                  <select
                    value={battleStrategyA}
                    onChange={e => setBattleStrategyA(e.target.value)}
                    disabled={battleRunning}
                  >
                    {STRATEGIES.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <div className="pd-desc">{STRATEGIES.find(s => s.id === battleStrategyA)?.description}</div>
                </div>
                <div className="pd-control">
                  <label>策略 B</label>
                  <select
                    value={battleStrategyB}
                    onChange={e => setBattleStrategyB(e.target.value)}
                    disabled={battleRunning}
                  >
                    {STRATEGIES.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <div className="pd-desc">{STRATEGIES.find(s => s.id === battleStrategyB)?.description}</div>
                </div>
              </div>
              <div className="pd-control-row">
                <div className="pd-control">
                  <label>轮数: {battleRounds}</label>
                  <input
                    type="range"
                    min="10"
                    max="1000"
                    step="10"
                    value={battleRounds}
                    onChange={e => setBattleRounds(parseInt(e.target.value))}
                    disabled={battleRunning}
                  />
                </div>
              </div>
              <div className="pd-control-row">
                <button
                  className="pd-btn primary"
                  onClick={startBattle}
                  disabled={battleRunning}
                >
                  ▶ 开始对战
                </button>
              </div>
            </div>

            {battleHistory.length > 0 && (
              <div className="pd-battle-result">
                <div className="pd-battle-scores">
                  <div className="pd-score-card" style={{ borderColor: getStrategyColor(battleStrategyA) }}>
                    <div className="pd-score-name">{getStrategyName(battleStrategyA)}</div>
                    <div className="pd-score-total" style={{ color: getStrategyColor(battleStrategyA) }}>
                      {battleTotalA}
                    </div>
                    <div className="pd-score-avg">avg: {(battleTotalA / battleRounds).toFixed(2)}</div>
                  </div>
                  <div className="pd-score-card" style={{ borderColor: getStrategyColor(battleStrategyB) }}>
                    <div className="pd-score-name">{getStrategyName(battleStrategyB)}</div>
                    <div className="pd-score-total" style={{ color: getStrategyColor(battleStrategyB) }}>
                      {battleTotalB}
                    </div>
                    <div className="pd-score-avg">avg: {(battleTotalB / battleRounds).toFixed(2)}</div>
                  </div>
                </div>

                <div className="pd-battle-history">
                  <div className="pd-history-header">
                    <span>轮次</span>
                    <span>A</span>
                    <span>B</span>
                    <span>得分 A</span>
                    <span>得分 B</span>
                  </div>
                  <div className="pd-history-body">
                    {battleHistory.slice(-20).map(entry => (
                      <div key={entry.round} className="pd-history-row">
                        <span>{entry.round}</span>
                        <span style={{ color: getStrategyColor(battleStrategyA) }}>{entry.moveA}</span>
                        <span style={{ color: getStrategyColor(battleStrategyB) }}>{entry.moveB}</span>
                        <span>{entry.scoreA}</span>
                        <span>{entry.scoreB}</span>
                      </div>
                    ))}
                    {battleHistory.length > 20 && (
                      <div className="pd-history-more">... 显示最后 20 轮，共 {battleHistory.length} 轮</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========== Tournament Tab ========== */}
        {activeTab === 'tournament' && (
          <div className="pd-tab-content">
            <div className="pd-controls">
              <div className="pd-strategy-grid">
                {STRATEGIES.map(s => (
                  <label key={s.id} className="pd-strategy-checkbox">
                    <input
                      type="checkbox"
                      checked={tournamentSelected.has(s.id)}
                      onChange={() => toggleTournamentSelection(s.id)}
                      disabled={tournamentRunning || (tournamentSelected.has(s.id) && tournamentSelected.size <= 2)}
                    />
                    <span className="pd-strategy-color" style={{ backgroundColor: s.color }} />
                    <div className="pd-strategy-info">
                      <span className="pd-strategy-name">{s.name}</span>
                      <span className="pd-strategy-desc">{s.description}</span>
                    </div>
                  </label>
                ))}
              </div>
              <div className="pd-control-row">
                <div className="pd-control">
                  <label>每对轮数: {tournamentRounds}</label>
                  <input
                    type="range"
                    min="50"
                    max="500"
                    step="50"
                    value={tournamentRounds}
                    onChange={e => setTournamentRounds(parseInt(e.target.value))}
                    disabled={tournamentRunning}
                  />
                </div>
              </div>
              {tournamentRunning && (
                <div className="pd-progress">
                  <div className="pd-progress-label">
                    已完成配对: {tournamentCompleted} / { (tournamentSelected.size * (tournamentSelected.size - 1)) / 2 }
                  </div>
                  <div className="pd-progress-bar">
                    <div
                      className="pd-progress-fill"
                      style={{ width: `${tournamentProgress}%` }}
                    />
                  </div>
                </div>
              )}
              <div className="pd-control-row">
                <button
                  className="pd-btn primary"
                  onClick={runTournament}
                  disabled={tournamentRunning || tournamentSelected.size < 2}
                >
                  ▶ 开始锦标赛
                </button>
              </div>
            </div>

            {tournamentResults.length > 0 && (
              <div className="pd-tournament-results">
                <h4>排名结果</h4>
                {renderTournamentChart()}
                <table className="pd-results-table">
                  <thead>
                    <tr>
                      <th>排名</th>
                      <th>策略</th>
                      <th>平均分</th>
                      <th>总分</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tournamentResults.map(r => (
                      <tr key={r.strategyId}>
                        <td className="pd-rank">{r.rank}</td>
                        <td>
                          <span
                            className="pd-rank-name"
                            style={{ color: getStrategyColor(r.strategyId) }}
                          >
                            {r.strategyName}
                          </span>
                        </td>
                        <td>{r.averageScore.toFixed(2)}</td>
                        <td>{r.totalScore.toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ========== Evolution Tab ========== */}
        {activeTab === 'evolution' && (
          <div className="pd-tab-content">
            <div className="pd-controls">
              <div className="pd-evolution-sliders">
                {STRATEGIES.map(s => (
                  <div key={s.id} className="pd-evolution-slider">
                    <div className="pd-slider-label">
                      <span className="pd-slider-color" style={{ backgroundColor: s.color }} />
                      <span>{s.name}</span>
                      <span className="pd-slider-value">{evoStartingProportions[s.id].toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={evoStartingProportions[s.id]}
                      onChange={e => updateEvoProportion(s.id, parseFloat(e.target.value))}
                      disabled={evoRunning}
                    />
                  </div>
                ))}
              </div>
              <div className="pd-control-row">
                <div className="pd-control">
                  <label>代数: {evoGenerations}</label>
                  <input
                    type="range"
                    min="10"
                    max="200"
                    step="10"
                    value={evoGenerations}
                    onChange={e => setEvoGenerations(parseInt(e.target.value))}
                    disabled={evoRunning}
                  />
                </div>
                <div className="pd-control">
                  <label>种群大小: {evoPopulationSize}</label>
                  <input
                    type="range"
                    min="50"
                    max="500"
                    step="50"
                    value={evoPopulationSize}
                    onChange={e => setEvoPopulationSize(parseInt(e.target.value))}
                    disabled={evoRunning}
                  />
                </div>
                <div className="pd-control">
                  <label>突变率: {evoMutationRate}%</label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="1"
                    value={evoMutationRate}
                    onChange={e => setEvoMutationRate(parseInt(e.target.value))}
                    disabled={evoRunning}
                  />
                </div>
              </div>
              <div className="pd-control-row pd-evolution-buttons">
                {!evoRunning && !evoFinished && (
                  <button className="pd-btn primary" onClick={startEvolution}>
                    ▶ 开始进化
                  </button>
                )}
                {evoRunning && (
                  <button className="pd-btn secondary" onClick={pauseEvolution}>
                    ⏸ 暂停
                  </button>
                )}
                {(evoFinished || evoHistory.length > 0) && (
                  <button className="pd-btn secondary" onClick={resetEvolution}>
                    🔄 重置
                  </button>
                )}
              </div>
              {evoRunning && (
                <div className="pd-progress">
                  <div className="pd-progress-label">
                    世代: {evoCurrentGen} / {evoGenerations}
                  </div>
                  <div className="pd-progress-bar">
                    <div
                      className="pd-progress-fill"
                      style={{ width: `${(evoCurrentGen / evoGenerations) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {evoHistory.length > 0 && (
              <div className="pd-evolution-results">
                <h4>种群比例变化</h4>
                {renderEvolutionChart()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PrisonerDilemmaSimulation;
