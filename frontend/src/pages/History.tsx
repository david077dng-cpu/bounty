import React, { useState, useEffect } from 'react';
import { submissionsApi } from '../services/api';
import type { Submission } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import '../styles/History.css';

const History: React.FC = () => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (user) {
      loadHistory();
    }
  }, [user]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await submissionsApi.my();
      if (res.data.success) {
        setSubmissions(res.data.submissions);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return <div className="loading">加载中...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>📝 训练记录</h2>
      <div>
        {submissions.length === 0 ? (
          <div className="empty-state">
            // 暂无训练记录<br />
            完成训练后结果显示在这里
          </div>
        ) : (
          submissions.map((sub) => (
            <div key={sub.id} className="history-item">
              <div className="history-icon">{sub.task.catIcon}</div>
              <div className="history-info">
                <div className="history-name">{sub.task.id} · {sub.task.name}</div>
                <div className="history-meta">
                  {sub.task.tier === 'easy' ? '🥉 简单' : sub.task.tier === 'medium' ? '🥈 挑战' : '🥇 精英'} ·
                  准确:{sub.accuracy} 推理:{sub.reasoning} 创意:{sub.creativity} 效率:{sub.speed} ·
                  +{sub.bountyEarned} EXP
                </div>
              </div>
              <div className={`history-score score-${sub.grade.toLowerCase()}`}>
                {sub.grade}·{sub.totalScore}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default History;
