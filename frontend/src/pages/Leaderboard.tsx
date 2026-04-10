import React, { useState, useEffect } from 'react';
import { leaderboardApi } from '../services/api';
import type { LeaderboardEntry } from '../types';
import { useAuth } from '../contexts/AuthContext';
import '../styles/Leaderboard.css';

const Leaderboard: React.FC = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const res = await leaderboardApi.get(50);
      if (res.data.success) {
        setLeaderboard(res.data.leaderboard);
      }
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  const getRankClass = (index: number) => {
    if (index === 0) return 'gold';
    if (index === 1) return 'silver';
    if (index === 2) return 'bronze';
    return '';
  };

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>🌟 排名榜</h2>
      <div className="lb-header">
        <div>#</div>
        <div>训练师</div>
        <div style={{ textAlign: 'right' }}>得分</div>
        <div style={{ textAlign: 'right' }}>EXP</div>
        <div style={{ textAlign: 'right' }}>训练</div>
      </div>
      <div>
        {leaderboard.map((entry, index) => (
          <div
            key={entry.id}
            className={`lb-row ${user?.id === entry.id ? 'me' : ''}`}
          >
            <div className={`rank ${getRankClass(index)}`}>
              {index < 3 ? medals[index] : index + 1}
            </div>
            <div>
              <div className="skill-name">{entry.username}</div>
              <div className="skill-tier">{entry.tier}</div>
            </div>
            <div className="lb-score">{entry.totalScore.toLocaleString()}</div>
            <div className="lb-bounty">{entry.totalBounty.toLocaleString()}</div>
            <div className="lb-tasks">{entry.tasksCompleted}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Leaderboard;
