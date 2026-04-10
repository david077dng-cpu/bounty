import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { creationApi } from '../services/api';
import type { Category } from '../types';
import { useAuth } from '../contexts/AuthContext';
import '../styles/CreationCenter.css';

interface CreatedTask {
  id: string;
  name: string;
  tier: string;
  bounty: number;
  catIcon: string;
  category: string;
  isPublic: boolean;
  author: string;
  questionPreview: string;
}

const CreationCenter: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [tasks, setTasks] = useState<CreatedTask[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    tier: 'medium',
    bounty: 200,
    categoryId: '',
    catIcon: '🔍',
    question: '',
    hint: '',
    answer: '',
    refAccuracy: 80,
    refReasoning: 80,
    refCreativity: 80,
    refSpeed: 80,
    isPublic: true,
    steps: '',
  });

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    loadData();
  }, [user, navigate]);

  const loadData = async () => {
    try {
      const [catRes, taskRes] = await Promise.all([
        creationApi.getCategories(),
        creationApi.listMyTasks(),
      ]);
      if (catRes.data.success) {
        setCategories(catRes.data.categories);
        if (catRes.data.categories.length > 0 && !formData.categoryId) {
          setFormData(prev => ({ ...prev, categoryId: String(catRes.data.categories[0].id) }));
        }
      } else {
        setError(catRes.data.error || 'Failed to load categories');
      }
      if (taskRes.data.success) {
        setTasks(taskRes.data.tasks);
      }
    } catch (error: any) {
      console.error('Failed to load data:', error);
      setError(error.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      // Parse steps from text (each line: type:text)
      let parsedSteps = [];
      if (formData.steps.trim()) {
        parsedSteps = formData.steps.trim().split('\n').map(line => {
          const [type, ...textParts] = line.split(':');
          return [type.trim(), textParts.join(':').trim()];
        });
      }

      const data = {
        ...formData,
        categoryId: parseInt(formData.categoryId),
        bounty: parseInt(String(formData.bounty)),
        refAccuracy: parseInt(String(formData.refAccuracy)),
        refReasoning: parseInt(String(formData.refReasoning)),
        refCreativity: parseInt(String(formData.refCreativity)),
        refSpeed: parseInt(String(formData.refSpeed)),
        steps: parsedSteps,
      };

      const res = await creationApi.createTask(data);
      if (res.data.success) {
        alert('Task created successfully!');
        setActiveTab('list');
        // Reset form
        setFormData({
          id: '',
          name: '',
          tier: 'medium',
          bounty: 200,
          categoryId: categories.length > 0 ? String(categories[0].id) : '',
          catIcon: '🔍',
          question: '',
          hint: '',
          answer: '',
          refAccuracy: 80,
          refReasoning: 80,
          refCreativity: 80,
          refSpeed: 80,
          isPublic: true,
          steps: '',
        });
        loadData();
      } else {
        setError(res.data.error || 'Failed to create task');
      }
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to create task');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this task? This cannot be undone.')) return;
    try {
      await creationApi.deleteTask(id);
      loadData();
    } catch (error) {
      console.error('Failed to delete task:', error);
      alert('Failed to delete task');
    }
  };

  const handleEdit = (task: CreatedTask) => {
    // For simplicity, just go to arena - full edit would need more work
    navigate(`/arena/${task.id}`);
  };

  const { loading: authLoading } = useAuth();

  if (authLoading) {
    return <div className="loading">认证中...</div>;
  }

  if (!user) {
    navigate('/login');
    return null;
  }

  if (loading) return <div className="loading">加载中...</div>;

  return (
    <div className="creation-center">
      <h1>创作中心</h1>
      <p className="page-desc">创建你自己的任务，分享给其他猎人挑战</p>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'list' ? 'active' : ''}`}
          onClick={() => setActiveTab('list')}
        >
          我的任务 ({tasks.length})
        </button>
        <button
          className={`tab ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => setActiveTab('create')}
        >
          + 创建新任务
        </button>
      </div>

      {error && <div className="error-text">{error}</div>}

      {activeTab === 'list' && (
        <div className="tasks-list">
          {tasks.length === 0 ? (
            <div className="empty-state">
              <p>你还没有创建任何任务，点击"创建新任务"开始吧！</p>
            </div>
          ) : (
            tasks.map(task => (
              <div key={task.id} className="task-item">
                <div className="task-item-info">
                  <div className="task-item-header">
                    <span className="task-icon">{task.catIcon}</span>
                    <h3>{task.name}</h3>
                    <span className={`tier-badge tier-${task.tier}`}>{task.tier}</span>
                    <span className="bounty-badge">{task.bounty} 赏金</span>
                    {!task.isPublic && <span className="private-badge">私有</span>}
                  </div>
                  <p className="task-preview">{task.questionPreview}</p>
                  <div className="task-meta">分类: {task.category}</div>
                </div>
                <div className="task-item-actions">
                  <button className="btn-view" onClick={() => handleEdit(task)}>查看</button>
                  <button className="btn-delete" onClick={() => handleDelete(task.id)}>删除</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'create' && (
        <form className="creation-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>任务 ID *</label>
              <input
                type="text"
                name="id"
                value={formData.id}
                onChange={handleInputChange}
                placeholder="e.g. MY001"
                required
              />
              <small>唯一ID，字母数字，如 U001, C001 等</small>
            </div>
            <div className="form-group">
              <label>任务名称 *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="e.g. 我的逻辑题目"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>难度</label>
              <select name="tier" value={formData.tier} onChange={handleInputChange}>
                <option value="easy">easy - 简单</option>
                <option value="medium">medium - 中等</option>
                <option value="hard">hard - 困难</option>
              </select>
            </div>
            <div className="form-group">
              <label>赏金</label>
              <input
                type="number"
                name="bounty"
                value={formData.bounty}
                onChange={handleInputChange}
                min="50"
                max="1000"
                required
              />
            </div>
            <div className="form-group">
              <label>分类</label>
              <select name="categoryId" value={formData.categoryId} onChange={handleInputChange} required>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>图标 (emoji)</label>
              <input
                type="text"
                name="catIcon"
                value={formData.catIcon}
                onChange={handleInputChange}
                placeholder="🔍"
                maxLength={2}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>题目描述 *</label>
            <textarea
              name="question"
              value={formData.question}
              onChange={handleInputChange}
              placeholder="输入题目描述..."
              rows={6}
              required
            />
          </div>

          <div className="form-group">
            <label>提示 (可选)</label>
            <textarea
              name="hint"
              value={formData.hint}
              onChange={handleInputChange}
              placeholder="给点提示吧..."
              rows={2}
            />
          </div>

          <div className="form-group">
            <label>参考答案 *</label>
            <textarea
              name="answer"
              value={formData.answer}
              onChange={handleInputChange}
              placeholder="输入标准解答..."
              rows={6}
              required
            />
          </div>

          <div className="form-group">
            <label>演示步骤 (可选，每行格式: type:text)</label>
            <textarea
              name="steps"
              value={formData.steps}
              onChange={handleInputChange}
              placeholder="think:分析题目...
calc:计算...
ok:结论..."
              rows={8}
            />
            <small>类型: step, think, calc, warn, ok</small>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>参考 准确性</label>
              <input
                type="number"
                name="refAccuracy"
                value={formData.refAccuracy}
                onChange={handleInputChange}
                min="0"
                max="100"
              />
            </div>
            <div className="form-group">
              <label>参考 推理性</label>
              <input
                type="number"
                name="refReasoning"
                value={formData.refReasoning}
                onChange={handleInputChange}
                min="0"
                max="100"
              />
            </div>
            <div className="form-group">
              <label>参考 创造性</label>
              <input
                type="number"
                name="refCreativity"
                value={formData.refCreativity}
                onChange={handleInputChange}
                min="0"
                max="100"
              />
            </div>
            <div className="form-group">
              <label>参考 速度分</label>
              <input
                type="number"
                name="refSpeed"
                value={formData.refSpeed}
                onChange={handleInputChange}
                min="0"
                max="100"
              />
            </div>
          </div>

          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                name="isPublic"
                checked={formData.isPublic}
                onChange={handleInputChange}
              />
              公开任务（所有人可见）
            </label>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-submit">创建任务</button>
          </div>
        </form>
      )}
    </div>
  );
};

export default CreationCenter;
