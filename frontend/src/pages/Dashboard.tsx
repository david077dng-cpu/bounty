import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { mcpApi, authApi } from '../services/api';
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
  
  // Agent API Key state
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [generatingKey, setGeneratingKey] = useState(false);

  useEffect(() => {
    if (user) {
      loadConnections();
      loadApiKey();
    }
  }, [user]);

  const loadApiKey = async () => {
    try {
      const res = await authApi.getApiKey();
      if (res.data.success) {
        setApiKey(res.data.apiKey);
      }
    } catch (err) {
      console.error('Failed to load API key:', err);
    }
  };

  const handleGenerateKey = async () => {
    if (apiKey && !confirm('Generating a new key will invalidate your current key. Continue?')) {
      return;
    }
    setGeneratingKey(true);
    try {
      const res = await authApi.generateApiKey();
      if (res.data.success) {
        setApiKey(res.data.apiKey);
        setShowKey(true);
      }
    } catch (err) {
      console.error('Failed to generate API key:', err);
    } finally {
      setGeneratingKey(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('已复制到剪贴板');
  };

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
        <h2>👤 训练师档案</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{user.totalBounty}</div>
            <div className="stat-label">总EXP</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{user.tasksCompleted}</div>
            <div className="stat-label">已完成训练</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{user.totalScore}</div>
            <div className="stat-label">总分</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{user.tier}</div>
            <div className="stat-label">认知阶段</div>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="dashboard-section quick-links">
        {/* ... existing content ... */}
      </div>

      {/* Agent Access Section */}
      <div className="dashboard-section agent-access">
        <div className="section-header">
          <h2>🤖 Agent 接入</h2>
          <div className="header-badge">Agent-Native</div>
        </div>
        <div className="agent-access-content">
          <p className="section-desc">
            使用 API Key 让你的 AI Agent 自动访问平台任务和工具。
            查看 <a href="/llms.txt" target="_blank" rel="noreferrer">llms.txt</a> 获取接入指南。
          </p>
          
          <div className="api-key-container">
            <div className="api-key-label">您的 Agent API Key</div>
            <div className="api-key-box">
              <input 
                type={showKey ? "text" : "password"} 
                value={apiKey || "尚未生成 API Key"} 
                readOnly 
                className="api-key-input"
              />
              <div className="api-key-actions">
                <button className="btn-icon" onClick={() => setShowKey(!showKey)} title={showKey ? "隐藏" : "显示"}>
                  {showKey ? "👁️‍🗨️" : "👁️"}
                </button>
                {apiKey && (
                  <button className="btn-icon" onClick={() => copyToClipboard(apiKey)} title="复制">
                    📋
                  </button>
                )}
              </div>
            </div>
            <button 
              className="btn-secondary" 
              onClick={handleGenerateKey} 
              disabled={generatingKey}
            >
              {generatingKey ? "生成中..." : (apiKey ? "重新生成" : "生成 API Key")}
            </button>
          </div>

          <div className="agent-mcp-info">
            <div className="info-item">
              <span className="info-label">平台 MCP 端点:</span>
              <code>http://localhost:3001/api/platform/mcp</code>
              <button className="btn-copy-small" onClick={() => copyToClipboard('http://localhost:3001/api/platform/mcp')}>复制</button>
            </div>
          </div>
        </div>
      </div>

      {/* MCP Connections Section */}
      <div className="dashboard-section mcp-section">
        <div className="section-header">
          <h2>🔌 技能连接</h2>
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
            <p>还没有添加任何技能连接。添加一个后就可以在探索中使用技能了。</p>
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
