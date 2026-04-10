import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { mcpApi } from '../services/api';
import type { MCPConnection, MCPTool } from '../types';
import '../styles/MCPConnections.css';

const MCPConnections: React.FC = () => {
  const [connections, setConnections] = useState<MCPConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formApiKey, setFormApiKey] = useState('');
  const [testing, setTesting] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{tools: MCPTool[]; error?: string} | null>(null);
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      loadConnections();
    }
  }, [user]);

  if (authLoading) {
    return <div className="loading">认证中...</div>;
  }

  if (!user) {
    navigate('/login');
    return null;
  }

  const loadConnections = async () => {
    setLoading(true);
    try {
      const res = await mcpApi.list();
      if (res.data.success) {
        setConnections(res.data.connections);
      } else {
        setError(res.data.error || 'Failed to load connections');
      }
    } catch (error) {
      console.error('Failed to load connections:', error);
      setError('Failed to load connections');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await mcpApi.create(formName, formUrl, formApiKey || undefined);
      setFormName('');
      setFormUrl('');
      setFormApiKey('');
      setShowModal(false);
      loadConnections();
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to create connection');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this connection?')) return;
    try {
      await mcpApi.delete(id);
      loadConnections();
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to delete connection');
    }
  };

  const handleTest = async (id: number) => {
    setTesting(id);
    setTestResult(null);
    try {
      const res = await mcpApi.test(id);
      if (res.data.success) {
        setTestResult({ tools: res.data.tools });
      } else {
        setTestResult({ tools: [], error: res.data.error });
      }
    } catch (error: any) {
      setTestResult({ tools: [], error: error.response?.data?.error || 'Test failed' });
    } finally {
      setTesting(null);
    }
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div className="mcp-page">
      <div className="page-header">
        <h2>🔌 技能连接</h2>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + 添加连接
        </button>
      </div>

      {error && <div className="error-text">{error}</div>}

      {connections.length === 0 ? (
        <div className="empty-state">
          // 暂无技能连接<br />
          添加一个技能连接以在训练中使用工具
        </div>
      ) : (
        <div className="connections-list">
          {connections.map(conn => (
            <div key={conn.id} className="connection-card">
              <div className="connection-info">
                <div className="connection-name">{conn.name}</div>
                <div className="connection-url">{conn.url}</div>
                <div className="connection-meta">
                  {conn.hasApiKey && <span className="has-api-key">🔑 Has API Key</span>}
                  <span>Last used: {new Date(conn.lastUsed).toLocaleString()}</span>
                </div>
              </div>
              <div className="connection-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => handleTest(conn.id)}
                  disabled={testing === conn.id}
                >
                  {testing === conn.id ? '测试中...' : '测试'}
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => handleDelete(conn.id)}
                >
                  删除
                </button>
              </div>
              {testing === conn.id && (
                <div className="testing-indicator">Testing connection...</div>
              )}
              {testResult && testResult.tools && testResult.tools.length > 0 && (
                <div className="tools-list">
                  <div className="tools-label">Available tools ({testResult.tools.length}):</div>
                  <ul>
                    {testResult.tools.map((tool, i) => (
                      <li key={i}>
                        <strong>{tool.name}</strong>
                        {tool.description && <p>{tool.description}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {testResult && testResult.error && (
                <div className="error-text">{testResult.error}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>添加技能连接</h3>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>连接名称</label>
                <input
                  type="text"
                  className="form-input"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="My MCP Server"
                  required
                />
              </div>
              <div className="form-group">
                <label>Server URL</label>
                <input
                  type="url"
                  className="form-input"
                  value={formUrl}
                  onChange={e => setFormUrl(e.target.value)}
                  placeholder="http://localhost:8000/mcp"
                  required
                />
              </div>
              <div className="form-group">
                <label>API Key (可选)</label>
                <input
                  type="password"
                  className="form-input"
                  value={formApiKey}
                  onChange={e => setFormApiKey(e.target.value)}
                  placeholder="Leave empty if no authentication"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  取消
                </button>
                <button type="submit" className="btn btn-primary">
                  添加
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MCPConnections;
