import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { mcpApi } from '../services/api';
import type { MCPConnection } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/Dashboard.css';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [connections, setConnections] = useState<MCPConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      loadConnections();
    }
  }, [user]);

  const loadConnections = async () => {
    try {
      const res = await mcpApi.list();
      if (res.data.success) {
        setConnections(res.data.connections);
      }
    } catch (error) {
      console.error('Failed to load connections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim() || !newUrl.trim()) {
      setError('Name and URL are required');
      return;
    }
    try {
      const res = await mcpApi.create(newName.trim(), newUrl.trim(), newApiKey.trim() || undefined);
      if (res.data.success) {
        setNewName('');
        setNewUrl('');
        setNewApiKey('');
        setShowCreate(false);
        setError('');
        loadConnections();
      } else {
        setError(res.data.error || 'Failed to create connection');
      }
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to create connection');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this connection?')) return;
    try {
      await mcpApi.delete(id);
      loadConnections();
    } catch (error) {
      console.error('Failed to delete connection:', error);
    }
  };

  const handleTest = async (id: number) => {
    try {
      const res = await mcpApi.test(id);
      if (res.data.success) {
        alert(`Test successful! Found ${res.data.tools.length} tools`);
      } else {
        alert(`Test failed: ${res.data.error}`);
      }
    } catch (error: any) {
      alert(`Test failed: ${error.response?.data?.error || 'Unknown error'}`);
    }
  };

  const { loading: authLoading } = useAuth();

  if (authLoading) {
    return <div className="loading">认证中...</div>;
  }

  if (!user) {
    navigate('/login');
    return null;
  }

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div className="dashboard-page">
      {/* User Stats Section */}
      <div className="dashboard-section user-stats">
        <h2>👤 个人信息</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{user.totalBounty}</div>
            <div className="stat-label">总赏金</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{user.tasksCompleted}</div>
            <div className="stat-label">已完成任务</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{user.totalScore}</div>
            <div className="stat-label">总分</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{user.tier}</div>
            <div className="stat-label">当前段位</div>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="dashboard-section quick-links">
        <h2>🔗 快捷导航</h2>
        <div className="links-grid">
          <Link to="/history" className="quick-link-card">
            <div className="ql-icon">📜</div>
            <div className="ql-text">
              <div className="ql-title">我的提交记录</div>
              <div className="ql-desc">查看所有历史提交和得分</div>
            </div>
          </Link>
          <Link to="/courses" className="quick-link-card">
            <div className="ql-icon">📚</div>
            <div className="ql-text">
              <div className="ql-title">渐进式课程</div>
              <div className="ql-desc">按顺序学习Agent开发技能</div>
            </div>
          </Link>
          <Link to="/leaderboard" className="quick-link-card">
            <div className="ql-icon">🏆</div>
            <div className="ql-text">
              <div className="ql-title">排行榜</div>
              <div className="ql-desc">查看全球猎人排名</div>
            </div>
          </Link>
          <Link to="/creation" className="quick-link-card">
            <div className="ql-icon">✍️</div>
            <div className="ql-text">
              <div className="ql-title">创作中心</div>
              <div className="ql-desc">创建分享你自己的题目</div>
            </div>
          </Link>
        </div>
      </div>

      {/* MCP Connections Section */}
      <div className="dashboard-section mcp-section">
        <div className="section-header">
          <h2>🔌 MCP 服务器连接</h2>
          <button className="btn-add" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? '取消' : '+ 添加连接'}
          </button>
        </div>

        {error && <div className="error-text">{error}</div>}

        {showCreate && (
          <div className="create-form">
            <div className="form-group">
              <label>连接名称</label>
              <input
                type="text"
                placeholder="e.g. My Local MCP"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>服务器 URL</label>
              <input
                type="text"
                placeholder="http://localhost:8000/mcp"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>API Key (可选)</label>
              <input
                type="password"
                placeholder="Leave empty if no auth required"
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.target.value)}
              />
            </div>
            <button className="btn-create" onClick={handleCreate}>创建连接</button>
          </div>
        )}

        {connections.length === 0 ? (
          <div className="empty-state">
            <p>还没有添加任何 MCP 连接。添加一个后就可以在竞技场中调用工具了。</p>
          </div>
        ) : (
          <div className="connections-list">
            {connections.map((conn) => (
              <div key={conn.id} className="connection-item">
                <div className="connection-info">
                  <div className="connection-name">{conn.name}</div>
                  <div className="connection-url">{conn.url}</div>
                  <div className="connection-date">
                    创建于 {new Date(conn.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="connection-actions">
                  <button className="btn-test" onClick={() => handleTest(conn.id)}>测试</button>
                  <button className="btn-delete" onClick={() => handleDelete(conn.id)}>删除</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
