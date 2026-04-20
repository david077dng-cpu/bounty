import React, { useState, useEffect, useRef } from 'react';
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

interface GeneratedTask {
  name: string;
  question: string;
  hint: string;
  answer: string;
  steps: string;
  refAccuracy: number;
  refReasoning: number;
  refCreativity: number;
  refSpeed: number;
  suggestedTier: string;
  suggestedCatIcon: string;
  saved?: boolean;
  skipped?: boolean;
}

interface CardForm {
  id: string;
  name: string;
  tier: string;
  bounty: number;
  categoryId: string;
  catIcon: string;
  question: string;
  hint: string;
  answer: string;
  refAccuracy: number;
  refReasoning: number;
  refCreativity: number;
  refSpeed: number;
  isPublic: boolean;
  steps: string;
}

const defaultBountyForTier = (tier: string) =>
  tier === 'hard' ? 500 : tier === 'medium' ? 200 : 100;

const CreationCenter: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'ai'>('list');
  const [tasks, setTasks] = useState<CreatedTask[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Manual creation form state
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
    // Interactive fields
    interactiveType: '', // '' = normal, 'turn_based', 'puzzle', 'game'
    interactiveConfig: '', // JSON string
  });

  // AI generation state
  const [aiSourceText, setAiSourceText] = useState('');
  const [aiUrlInput, setAiUrlInput] = useState('');
  const [aiFetchingUrl, setAiFetchingUrl] = useState(false);
  const [aiGenCount, setAiGenCount] = useState(3);
  const [aiGenTier, setAiGenTier] = useState('medium');
  const [aiGenCategory, setAiGenCategory] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiStep, setAiStep] = useState<1 | 3>(1);
  const [aiGeneratedTasks, setAiGeneratedTasks] = useState<GeneratedTask[]>([]);
  const [aiExpandedCard, setAiExpandedCard] = useState<number | null>(null);
  const [aiCardForms, setAiCardForms] = useState<{ [k: number]: CardForm }>({});
  const [aiSavedCount, setAiSavedCount] = useState(0);
  const [aiError, setAiError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sourceTextareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResizeSource = () => {
    const el = sourceTextareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 600) + 'px';
  };

  useEffect(() => {
    setTimeout(autoResizeSource, 0);
  }, [aiSourceText]);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
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
          const firstId = String(catRes.data.categories[0].id);
          setFormData(prev => ({ ...prev, categoryId: firstId }));
          setAiGenCategory(firstId);
        }
      } else {
        setError(catRes.data.error || 'Failed to load categories');
      }
      if (taskRes.data.success) setTasks(taskRes.data.tasks);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // ── Manual create handlers ────────────────────────────────────────────────

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
      let parsedSteps: [string, string][] = [];
      if (formData.steps.trim()) {
        parsedSteps = formData.steps.trim().split('\n').map(line => {
          const [type, ...textParts] = line.split(':');
          return [type.trim(), textParts.join(':').trim()] as [string, string];
        });
      }
      let parsedInteractiveConfig: any = null;
      if (formData.interactiveType && formData.interactiveConfig.trim()) {
        try {
          parsedInteractiveConfig = JSON.parse(formData.interactiveConfig.trim());
        } catch (e) {
          setError('互动配置JSON格式不正确');
          return;
        }
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
        interactiveConfig: parsedInteractiveConfig,
      };
      const res = await creationApi.createTask(data);
      if (res.data.success) {
        alert('Task created successfully!');
        setActiveTab('list');
        setFormData({
          id: '', name: '', tier: 'medium', bounty: 200,
          categoryId: categories.length > 0 ? String(categories[0].id) : '',
          catIcon: '🔍', question: '', hint: '', answer: '',
          refAccuracy: 80, refReasoning: 80, refCreativity: 80, refSpeed: 80,
          isPublic: true, steps: '',
          interactiveType: '', interactiveConfig: '',
        });
        loadData();
      } else {
        setError(res.data.error || 'Failed to create task');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create task');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this task? This cannot be undone.')) return;
    try {
      await creationApi.deleteTask(id);
      loadData();
    } catch {
      alert('Failed to delete task');
    }
  };

  const handleEdit = (task: CreatedTask) => navigate(`/arena/${task.id}`);

  // ── AI generation handlers ────────────────────────────────────────────────

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setAiSourceText(ev.target?.result as string);
    reader.readAsText(file);
  };

  const handleFetchUrl = async () => {
    if (!aiUrlInput.trim()) return;
    setAiFetchingUrl(true);
    setAiError('');
    try {
      const res = await creationApi.fetchUrl(aiUrlInput.trim());
      if (res.data.success) {
        setAiSourceText(res.data.text);
      } else {
        setAiError(res.data.error || 'Failed to fetch URL');
      }
    } catch (err: any) {
      setAiError(err.response?.data?.error || 'Failed to fetch URL');
    } finally {
      setAiFetchingUrl(false);
    }
  };

  const handleGenerate = async () => {
    const text = aiSourceText;
    if (!text.trim()) {
      setAiError('请先输入或加载来源文本');
      return;
    }
    setAiGenerating(true);
    setAiError('');
    try {
      const res = await creationApi.generateTasks(text, aiGenCount, aiGenTier);
      if (res.data.success && res.data.tasks?.length > 0) {
        const genTasks: GeneratedTask[] = res.data.tasks;
        setAiGeneratedTasks(genTasks);
        const forms: { [k: number]: CardForm } = {};
        genTasks.forEach((task, idx) => {
          const autoId = 'AI' + Math.random().toString(36).slice(2, 7).toUpperCase();
          forms[idx] = {
            id: autoId,
            name: task.name || '',
            tier: task.suggestedTier || aiGenTier,
            bounty: defaultBountyForTier(task.suggestedTier || aiGenTier),
            categoryId: aiGenCategory || (categories.length > 0 ? String(categories[0].id) : ''),
            catIcon: task.suggestedCatIcon || '🎯',
            question: task.question || '',
            hint: task.hint || '',
            answer: task.answer || '',
            refAccuracy: task.refAccuracy ?? 80,
            refReasoning: task.refReasoning ?? 80,
            refCreativity: task.refCreativity ?? 80,
            refSpeed: task.refSpeed ?? 80,
            isPublic: true,
            steps: task.steps || '',
          };
        });
        setAiCardForms(forms);
        setAiSavedCount(0);
        setAiExpandedCard(null);
        setAiStep(3);
      } else {
        setAiError(res.data.error || 'AI 未能生成任务，请尝试更换来源内容');
      }
    } catch (err: any) {
      setAiError(err.response?.data?.error || '生成失败，请检查 ARK API 配置');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleCardFormChange = (idx: number, field: string, value: any) => {
    setAiCardForms(prev => ({ ...prev, [idx]: { ...prev[idx], [field]: value } }));
  };

  const handleSaveCard = async (idx: number) => {
    const form = aiCardForms[idx];
    if (!form?.id?.trim()) {
      // Fallback: generate one if still empty
      handleCardFormChange(idx, 'id', 'AI' + Math.random().toString(36).slice(2, 7).toUpperCase());
    }
    setAiError('');
    try {
      let parsedSteps: [string, string][] = [];
      if (form.steps?.trim()) {
        parsedSteps = form.steps.trim().split('\n').map(line => {
          const [type, ...textParts] = line.split(':');
          return [type.trim(), textParts.join(':').trim()] as [string, string];
        });
      }
      const data = {
        ...form,
        categoryId: parseInt(form.categoryId),
        bounty: parseInt(String(form.bounty)),
        refAccuracy: parseInt(String(form.refAccuracy)),
        refReasoning: parseInt(String(form.refReasoning)),
        refCreativity: parseInt(String(form.refCreativity)),
        refSpeed: parseInt(String(form.refSpeed)),
        steps: parsedSteps,
      };
      const res = await creationApi.createTask(data);
      if (res.data.success) {
        setAiGeneratedTasks(prev => {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], saved: true };
          return updated;
        });
        setAiExpandedCard(null);
        setAiSavedCount(c => c + 1);
        loadData();
      } else {
        setAiError(res.data.error || 'Failed to save task');
      }
    } catch (err: any) {
      setAiError(err.response?.data?.error || 'Failed to save task');
    }
  };

  const handleSkipCard = (idx: number) => {
    setAiGeneratedTasks(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], skipped: true };
      return updated;
    });
    if (aiExpandedCard === idx) setAiExpandedCard(null);
  };

  const handleResetAi = () => {
    setAiStep(1);
    setAiGeneratedTasks([]);
    setAiCardForms({});
    setAiError('');
    setAiExpandedCard(null);
    setAiSavedCount(0);
    setAiSourceText('');
    setAiUrlInput('');
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const { loading: authLoading } = useAuth();
  if (authLoading) return <div className="loading">认证中...</div>;
  if (!user) { navigate('/login'); return null; }
  if (loading) return <div className="loading">加载中...</div>;

  const activeCount = aiGeneratedTasks.filter(t => !t.saved && !t.skipped).length;

  return (
    <div className="creation-center">
      <h1>创作中心</h1>
      <p className="page-desc">创建知识体验，分享给其他探索者</p>

      <div className="tabs">
        <button className={`tab ${activeTab === 'list' ? 'active' : ''}`} onClick={() => setActiveTab('list')}>
          我的挑战 ({tasks.length})
        </button>
        <button className={`tab ${activeTab === 'create' ? 'active' : ''}`} onClick={() => setActiveTab('create')}>
          + 手动创建
        </button>
        <button className={`tab ${activeTab === 'ai' ? 'active' : ''}`} onClick={() => setActiveTab('ai')}>
          ✨ AI 生成
        </button>
      </div>

      {error && <div className="error-text">{error}</div>}

      {/* ── My Tasks List ── */}
      {activeTab === 'list' && (
        <div className="tasks-list">
          {tasks.length === 0 ? (
            <div className="empty-state">
              <p>你还没有创建任何挑战，点击"手动创建"或"AI 生成"开始吧！</p>
            </div>
          ) : (
            tasks.map(task => (
              <div key={task.id} className="task-item">
                <div className="task-item-info">
                  <div className="task-item-header">
                    <span className="task-icon">{task.catIcon}</span>
                    <h3>{task.name}</h3>
                    <span className={`tier-badge tier-${task.tier}`}>{task.tier}</span>
                    <span className="bounty-badge">{task.bounty} EXP</span>
                    {!task.isPublic && <span className="private-badge">私密</span>}
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

      {/* ── Manual Create Form ── */}
      {activeTab === 'create' && (
        <form className="creation-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>挑战 ID *</label>
              <input type="text" name="id" value={formData.id} onChange={handleInputChange} placeholder="e.g. MY001" required />
              <small>唯一ID，字母数字，如 U001, C001 等</small>
            </div>
            <div className="form-group">
              <label>挑战名称 *</label>
              <input type="text" name="name" value={formData.name} onChange={handleInputChange} placeholder="e.g. 我的逻辑训练" required />
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
              <label>EXP</label>
              <input type="number" name="bounty" value={formData.bounty} onChange={handleInputChange} min="50" max="1000" required />
            </div>
            <div className="form-group">
              <label>分类</label>
              <select name="categoryId" value={formData.categoryId} onChange={handleInputChange} required>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>图标 (emoji)</label>
              <input type="text" name="catIcon" value={formData.catIcon} onChange={handleInputChange} placeholder="🔍" maxLength={2} required />
            </div>
          </div>

          <div className="form-group">
            <label>挑战描述 *</label>
            <textarea name="question" value={formData.question} onChange={handleInputChange} placeholder="输入挑战描述..." rows={6} required />
          </div>

          <div className="form-group">
            <label>提示 (可选)</label>
            <textarea name="hint" value={formData.hint} onChange={handleInputChange} placeholder="给点提示吧..." rows={2} />
          </div>

          <div className="form-group">
            <label>参考方案 *</label>
            <textarea name="answer" value={formData.answer} onChange={handleInputChange} placeholder="输入标准解答..." rows={6} required />
          </div>

          <div className="form-group">
            <label>演示步骤 (可选，每行格式: type:text)</label>
            <textarea name="steps" value={formData.steps} onChange={handleInputChange}
              placeholder={"think:分析题目...\ncalc:计算...\nok:结论..."} rows={8} />
            <small>类型: step, think, calc, warn, ok</small>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>参考 准确性</label>
              <input type="number" name="refAccuracy" value={formData.refAccuracy} onChange={handleInputChange} min="0" max="100" />
            </div>
            <div className="form-group">
              <label>参考 推理性</label>
              <input type="number" name="refReasoning" value={formData.refReasoning} onChange={handleInputChange} min="0" max="100" />
            </div>
            <div className="form-group">
              <label>参考 创造性</label>
              <input type="number" name="refCreativity" value={formData.refCreativity} onChange={handleInputChange} min="0" max="100" />
            </div>
            <div className="form-group">
              <label>参考 速度分</label>
              <input type="number" name="refSpeed" value={formData.refSpeed} onChange={handleInputChange} min="0" max="100" />
            </div>
          </div>

          <div className="form-group checkbox-group">
            <label>
              <input type="checkbox" name="isPublic" checked={formData.isPublic} onChange={handleInputChange} />
              公开任务（所有人可见）
            </label>
          </div>

          {/* Interactive Task Options */}
          <div className="form-group">
            <label>互动类型</label>
            <select name="interactiveType" value={formData.interactiveType} onChange={handleInputChange}>
              <option value="">普通任务（单次提交）</option>
              <option value="turn_based">回合制对话（用户 ↔ AI 多轮问答）</option>
              <option value="puzzle">渐进式解谜（多步解锁）</option>
              <option value="game">自定义游戏互动</option>
            </select>
            <small>
              选择互动类型后需要填写互动配置 JSON。<br/>
              • turn_based 需要: {'{ systemPrompt, initialQuestion, maxTurns, finalEvaluationPrompt }'}<br/>
              • puzzle 需要: {'{ title, description, steps: [{question, hint, answerPattern, nextUnlockHint}], finalRewardText }'}
            </small>
          </div>

          {formData.interactiveType && (
            <div className="form-group">
              <label>互动配置 (JSON)</label>
              <textarea
                name="interactiveConfig"
                value={formData.interactiveConfig}
                onChange={handleInputChange}
                placeholder='{
  "systemPrompt": "你是一个助手...",
  "initialQuestion": "第一个问题...",
  "maxTurns": 5,
  "finalEvaluationPrompt": "请评价..."
}'
                rows={10}
                required
              />
            </div>
          )}

          <button type="submit" className="btn-submit" disabled={loading}>
            {loading ? '保存中...' : '保存挑战'}
          </button>
        </form>
      )}

      {/* ── AI Generate Tab ── */}
      {activeTab === 'ai' && (
        <div className="ai-generate">
          {aiError && <div className="error-text">{aiError}</div>}

          {/* Step 1: Source Input */}
          {aiStep === 1 && (
            <div className="ai-step">
              <div className="ai-step-header">
                <span className="ai-step-num">1</span>
                <h2>选择来源</h2>
              </div>

              {/* URL fetch row — always visible */}
              <div className="form-group">
                <label>从网页获取内容（可选）</label>
                <div className="url-input-row">
                  <input
                    type="text"
                    value={aiUrlInput}
                    onChange={e => setAiUrlInput(e.target.value)}
                    placeholder="https://..."
                    onKeyDown={e => e.key === 'Enter' && handleFetchUrl()}
                  />
                  <button type="button" className="btn-fetch" onClick={handleFetchUrl} disabled={aiFetchingUrl}>
                    {aiFetchingUrl ? '获取中...' : '获取内容'}
                  </button>
                </div>
              </div>

              {/* Unified content textarea */}
              <div className="form-group">
                <div className="source-textarea-label">
                  <label>来源文本</label>
                  <button type="button" className="btn-upload-inline" onClick={() => fileInputRef.current?.click()}>
                    📄 上传文件
                  </button>
                  <input ref={fileInputRef} type="file" accept=".txt,.md" style={{ display: 'none' }} onChange={handleFileUpload} />
                </div>
                <textarea
                  ref={sourceTextareaRef}
                  value={aiSourceText}
                  onChange={e => { setAiSourceText(e.target.value); autoResizeSource(); }}
                  onInput={autoResizeSource}
                  placeholder="粘贴书籍章节、文章内容，或从上方输入URL自动获取..."
                  className="textarea-autogrow"
                  rows={8}
                />
                <small>{aiSourceText.length} 字符</small>
              </div>


              <div className="gen-options">
                <div className="ai-step-header" style={{ marginBottom: 12 }}>
                  <span className="ai-step-num">2</span>
                  <h2>生成选项</h2>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>生成数量</label>
                    <select value={aiGenCount} onChange={e => setAiGenCount(parseInt(e.target.value))}>
                      <option value={1}>1 道</option>
                      <option value={2}>2 道</option>
                      <option value={3}>3 道</option>
                      <option value={4}>4 道</option>
                      <option value={5}>5 道</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>难度</label>
                    <select value={aiGenTier} onChange={e => setAiGenTier(e.target.value)}>
                      <option value="easy">easy - 简单</option>
                      <option value="medium">medium - 中等</option>
                      <option value="hard">hard - 困难</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>默认分类</label>
                    <select value={aiGenCategory} onChange={e => setAiGenCategory(e.target.value)}>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn-generate"
                  onClick={handleGenerate}
                  disabled={aiGenerating || !aiSourceText.trim()}
                >
                  {aiGenerating ? (
                    <><span className="spinner-inline" />  AI 生成中...</>
                  ) : (
                    '✨ 生成任务'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Review Results */}
          {aiStep === 3 && (
            <div className="ai-step">
              <div className="ai-review-header">
                <div className="ai-step-header">
                  <span className="ai-step-num">3</span>
                  <h2>审核结果</h2>
                </div>
                <div className="ai-review-meta">
                  <span className="saved-badge">已保存 {aiSavedCount} / {aiGeneratedTasks.length}</span>
                  <button className="btn-link" onClick={handleResetAi}>重新生成</button>
                </div>
              </div>

              <div className="generated-tasks">
                {aiGeneratedTasks.map((task, idx) => (
                  <div
                    key={idx}
                    className={`gen-task-card ${task.saved ? 'card-saved' : ''} ${task.skipped ? 'card-skipped' : ''}`}
                  >
                    <div className="gen-task-header">
                      <span className="gen-task-icon">{task.suggestedCatIcon || '🎯'}</span>
                      <div className="gen-task-title">
                        <strong>{task.name}</strong>
                        <span className={`tier-badge tier-${task.suggestedTier}`}>{task.suggestedTier}</span>
                      </div>
                      {task.saved && <span className="status-tag tag-saved">✓ 已保存</span>}
                      {task.skipped && <span className="status-tag tag-skipped">已跳过</span>}
                      {!task.saved && !task.skipped && (
                        <div className="gen-task-actions">
                          <button
                            className="btn-edit-card"
                            onClick={() => setAiExpandedCard(aiExpandedCard === idx ? null : idx)}
                          >
                            {aiExpandedCard === idx ? '收起' : '编辑并保存'}
                          </button>
                          <button className="btn-skip-card" onClick={() => handleSkipCard(idx)}>跳过</button>
                        </div>
                      )}
                    </div>

                    <p className="gen-task-preview">{task.question.slice(0, 120)}{task.question.length > 120 ? '...' : ''}</p>

                    {/* Inline edit form */}
                    {aiExpandedCard === idx && !task.saved && !task.skipped && aiCardForms[idx] && (
                      <div className="inline-edit-form">
                        <div className="form-row">
                          <div className="form-group">
                            <label>挑战 ID * <small>(全局唯一)</small></label>
                            <input
                              type="text"
                              value={aiCardForms[idx].id}
                              onChange={e => handleCardFormChange(idx, 'id', e.target.value)}
                              placeholder="e.g. AI001"
                            />
                          </div>
                          <div className="form-group">
                            <label>名称</label>
                            <input
                              type="text"
                              value={aiCardForms[idx].name}
                              onChange={e => handleCardFormChange(idx, 'name', e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="form-row">
                          <div className="form-group">
                            <label>难度</label>
                            <select value={aiCardForms[idx].tier} onChange={e => handleCardFormChange(idx, 'tier', e.target.value)}>
                              <option value="easy">easy</option>
                              <option value="medium">medium</option>
                              <option value="hard">hard</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label>EXP</label>
                            <input type="number" value={aiCardForms[idx].bounty} onChange={e => handleCardFormChange(idx, 'bounty', e.target.value)} min="50" max="1000" />
                          </div>
                          <div className="form-group">
                            <label>分类</label>
                            <select value={aiCardForms[idx].categoryId} onChange={e => handleCardFormChange(idx, 'categoryId', e.target.value)}>
                              {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="form-group">
                            <label>图标</label>
                            <input type="text" value={aiCardForms[idx].catIcon} onChange={e => handleCardFormChange(idx, 'catIcon', e.target.value)} maxLength={2} />
                          </div>
                        </div>

                        <div className="form-group">
                          <label>挑战描述</label>
                          <textarea value={aiCardForms[idx].question} onChange={e => handleCardFormChange(idx, 'question', e.target.value)} rows={4} />
                        </div>

                        <div className="form-group">
                          <label>提示</label>
                          <textarea value={aiCardForms[idx].hint} onChange={e => handleCardFormChange(idx, 'hint', e.target.value)} rows={2} />
                        </div>

                        <div className="form-group">
                          <label>参考答案</label>
                          <textarea value={aiCardForms[idx].answer} onChange={e => handleCardFormChange(idx, 'answer', e.target.value)} rows={4} />
                        </div>

                        <div className="form-group">
                          <label>演示步骤 (每行: type:text)</label>
                          <textarea value={aiCardForms[idx].steps} onChange={e => handleCardFormChange(idx, 'steps', e.target.value)} rows={5} />
                          <small>类型: step, think, calc, warn, ok</small>
                        </div>

                        <div className="form-row">
                          {(['refAccuracy', 'refReasoning', 'refCreativity', 'refSpeed'] as const).map(field => (
                            <div className="form-group" key={field}>
                              <label>
                                {{ refAccuracy: '准确性', refReasoning: '推理性', refCreativity: '创造性', refSpeed: '速度分' }[field]}
                              </label>
                              <input type="number" value={(aiCardForms[idx] as any)[field]} onChange={e => handleCardFormChange(idx, field, e.target.value)} min="0" max="100" />
                            </div>
                          ))}
                        </div>

                        <div className="form-group checkbox-group">
                          <label>
                            <input type="checkbox" checked={aiCardForms[idx].isPublic} onChange={e => handleCardFormChange(idx, 'isPublic', e.target.checked)} />
                            公开任务
                          </label>
                        </div>

                        <div className="inline-form-actions">
                          <button type="button" className="btn-submit" onClick={() => handleSaveCard(idx)}>
                            保存此任务
                          </button>
                          <button type="button" className="btn-cancel" onClick={() => setAiExpandedCard(null)}>
                            取消
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {activeCount === 0 && (
                <div className="ai-done-banner">
                  {aiSavedCount > 0
                    ? `🎉 已完成！共保存了 ${aiSavedCount} 道任务，前往"我的挑战"查看`
                    : '所有任务已跳过'}
                  <button className="btn-link" onClick={() => setActiveTab('list')} style={{ marginLeft: 12 }}>查看我的挑战</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CreationCenter;
