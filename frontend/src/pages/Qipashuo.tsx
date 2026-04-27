import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { qipashuoApi } from '../services/api';
import '../styles/Qipashuo.css';

interface Character {
  name: string;
  emoji: string;
  side: 'pro' | 'con' | 'judge';
  color: string;
  bg: string;
  textColor: string;
  role: string;
  tag: string;
}

interface Step {
  speaker: string;
  task: string;
  stage: string;
  stageIdx: number;
}

const CHARACTERS: Record<string, Character> = {
  maweiwei: { name: '马薇薇', emoji: '马', side: 'pro', color: '#C0392B', bg: '#FADBD8', textColor: '#922B21', role: '正方', tag: '毒舌女王' },
  chenming:  { name: '陈铭',   emoji: '陈', side: 'con', color: '#1A5276', bg: '#D6EAF8', textColor: '#1A5276', role: '反方', tag: '学院暖男' },
  qiuchen:   { name: '邱晨',   emoji: '邱', side: 'pro', color: '#884EA0', bg: '#E8DAEF', textColor: '#6C3483', role: '正方', tag: '理性可爱' },
  chuyan:    { name: '储殷',   emoji: '储', side: 'con', color: '#1E8449', bg: '#D5F5E3', textColor: '#1A6B3A', role: '反方', tag: '接地教授' },
  lidan:     { name: '李诞',   emoji: '李', side: 'judge', color: '#7D6608', bg: '#FDEBD0', textColor: '#7D6608', role: '嘉宾', tag: '佛系观察' },
  luozhenyu: { name: '罗振宇', emoji: '罗', side: 'con', color: '#1A5276', bg: '#D6EAF8', textColor: '#154360', role: '反方', tag: '逻辑控' },
  huangzhizhong: { name: '黄执中', emoji: '黄', side: 'pro', color: '#7B241C', bg: '#FADBD8', textColor: '#7B241C', role: '正方', tag: '催眠大师' },
  host: { name: '马东', emoji: '主', side: 'judge', color: '#E9A800', bg: '#FEF9E7', textColor: '#9A7D0A', role: '主持', tag: '主持人' }
};

const PROMPTS = {
  host: (topic: string, history: string, task: string) => `你是奇葩说的主持人马东。风格：幽默、接地气、偶尔一针见血。你的任务是${task}。辩题是"${topic}"。${history ? '辩论记录：\n'+history : ''}只输出你的发言内容，不要加任何角色前缀。100字以内。`,
  maweiwei: (topic: string, history: string, task: string) => `你是奇葩说辩手马薇薇，外号"毒舌女王"。说话犀利、直接、金句频出，善用讽刺和类比，不客气怼人，但逻辑清晰。你支持辩题"${topic}"的正方立场。任务：${task}。${history ? '辩论记录：\n'+history : ''}只输出发言内容，150字以内，要有马薇薇的毒舌风格。`,
  chenming: (topic: string, history: string, task: string) => `你是奇葩说辩手陈铭，学院派暖男，说话温柔有条理，善于用故事和比喻，经常从人文关怀角度切入，会被观众叫"爹"。你反对辩题"${topic}"，持反方立场。任务：${task}。${history ? '辩论记录：\n'+history : ''}只输出发言内容，150字以内，要有陈铭的温暖学院风格。`,
  qiuchen: (topic: string, history: string, task: string) => `你是奇葩说辩手邱晨，理性可爱，逻辑清晰但不失亲和力，善用数据和生活案例，偶尔萌萌的。你支持辩题"${topic}"的正方立场。任务：${task}。${history ? '辩论记录：\n'+history : ''}只输出发言内容，150字以内，要有邱晨的理性可爱风格。`,
  chuyan: (topic: string, history: string, task: string) => `你是奇葩说辩手储殷，接地气教授，说话直白、有市井烟火气，经常用大白话说透道理，会说一些让人意外的大实话。你反对辩题"${topic}"，持反方立场。任务：${task}。${history ? '辩论记录：\n'+history : ''}只输出发言内容，150字以内，要有储殷的接地气风格。`,
  lidan: (topic: string, history: string, task: string) => `你是奇葩说嘉宾李诞，佛系脱口秀演员，经常用消极但搞笑的视角看问题，喜欢说"都无所谓""活着就好"，但偶尔会说出扎心的真相。任务：${task}。辩题是"${topic}"。${history ? '辩论记录：\n'+history : ''}只输出发言内容，100字以内，要有李诞的佛系毒舌风格。`,
  luozhenyu: (topic: string, history: string, task: string) => `你是奇葩说辩手罗振宇，逻辑控，喜欢引用历史典故和商业案例，说话条理清晰，会说"让我给你看一个数据"，有时略显说教。你反对辩题"${topic}"，持反方立场。任务：${task}。${history ? '辩论记录：\n'+history : ''}只输出发言内容，150字以内，要有罗振宇的逻辑知识分子风格。`,
  huangzhizhong: (topic: string, history: string, task: string) => `你是奇葩说辩手黄执中，催眠大师，说话慢条斯理、娓娓道来，善于用共情和递进式逻辑让人不知不觉被说服，金句深刻有哲学感。你支持辩题"${topic}"的正方立场。任务：${task}。${history ? '辩论记录：\n'+history : ''}只输出发言内容，150字以内，要有黄执中的深沉催眠风格。`
};

const STEPS: Step[] = [
  { speaker: 'host', task: '宣布辩题和今天的辩手阵容，开场白要有综艺感和悬念感，让观众兴奋起来', stage: '开场', stageIdx: 0 },
  { speaker: 'maweiwei', task: '进行立论，说出你支持这个辩题的核心理由，要有马薇薇式的犀利开场金句', stage: '立论', stageIdx: 1 },
  { speaker: 'huangzhizhong', task: '进行立论，补充正方的论点，要有黄执中式的深刻故事感', stage: '立论', stageIdx: 1 },
  { speaker: 'chenming', task: '进行立论，说出你反对这个辩题的核心理由，要有陈铭的温暖叙事风格', stage: '立论', stageIdx: 1 },
  { speaker: 'chuyan', task: '进行立论，用大白话补充反方论点，储殷风格', stage: '立论', stageIdx: 1 },
  { speaker: 'host', task: '宣布进入质询环节，说一句有综艺感的过渡语', stage: '质询', stageIdx: 2 },
  { speaker: 'maweiwei', task: '向反方陈铭提一个尖锐的质询问题，要刁钻，直指对方论点最弱处，马薇薇风格', stage: '质询', stageIdx: 2 },
  { speaker: 'chenming', task: '回应马薇薇的质询，然后反问她一个问题，陈铭风格', stage: '质询', stageIdx: 2 },
  { speaker: 'lidan', task: '作为嘉宾，用李诞式佛系毒舌点评一下刚才的交锋，说一句让人哭笑不得的话', stage: '嘉宾点评', stageIdx: 3 },
  { speaker: 'host', task: '宣布进入自由辩论环节，调动观众情绪', stage: '自由辩论', stageIdx: 3 },
  { speaker: 'qiuchen', task: '自由辩论：攻击反方最弱的论点，邱晨风格，理性可爱，要有金句', stage: '自由辩论', stageIdx: 3 },
  { speaker: 'luozhenyu', task: '自由辩论：回怼正方，罗振宇风格，引用一个让人意外的案例或数据', stage: '自由辩论', stageIdx: 3 },
  { speaker: 'huangzhizhong', task: '自由辩论：用黄执中式的深沉语气说一段话，直击问题本质', stage: '自由辩论', stageIdx: 3 },
  { speaker: 'chuyan', task: '自由辩论：用储殷的大白话怼回去，接地气，让人觉得"有点道理"', stage: '自由辩论', stageIdx: 3 },
  { speaker: 'host', task: '宣布进入总结陈词，说一句煽情又搞笑的过渡语', stage: '总结', stageIdx: 4 },
  { speaker: 'chenming', task: '总结陈词，反方最后的话，要有陈铭的感染力和温度，升华主题', stage: '总结', stageIdx: 4 },
  { speaker: 'maweiwei', task: '总结陈词，正方最后的话，马薇薇式结尾，要有一句让人记住的金句', stage: '总结', stageIdx: 4 },
  { speaker: 'lidan', task: '最终点评：用李诞的佛系视角总结这场辩论，说一句扎心又好笑的话收尾', stage: '李诞点评', stageIdx: 5 },
  { speaker: 'host', task: '宣布这期节目结束，说一句有奇葩说特色的收尾语', stage: '收尾', stageIdx: 5 },
];

const STAGES = ['开场', '立论', '质询', '自由辩论', '总结', '收尾'];

interface DebateBubble {
  id: string;
  speakerKey: string;
  text: string;
  isTyping: boolean;
}

const Qipashuo: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [currentStage, setCurrentStage] = useState('等待开始');
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [bubbles, setBubbles] = useState<DebateBubble[]>([]);
  const [savedDebateId, setSavedDebateId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const debateLogRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  const suggestedTopics = [
    '打工人应该摸鱼吗',
    '恋爱中应该先说分手的人赢了吗',
    '躺平是一种值得尊重的生活方式吗',
    'AI会让人类变得更懒还是更聪明',
    '人类应该移民火星吗'
  ];

  useEffect(() => {
    // Check if Anthropic API key is in env (backend should handle it)
    // For now, we'll call backend endpoint that proxies to Anthropic
    const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    console.log('Backend URL:', backendUrl);
  }, []);

  const scrollToBottom = () => {
    if (debateLogRef.current) {
      debateLogRef.current.scrollTop = debateLogRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [bubbles]);

  const setSuggestedTopic = (t: string) => {
    setTopic(t);
  };

  const callAI = async (speakerKey: string, currentTopic: string, history: string, task: string): Promise<string> => {
    const promptFn = PROMPTS[speakerKey as keyof typeof PROMPTS];
    const systemPrompt = promptFn(currentTopic, history, task);

    const response = await qipashuoApi.call(systemPrompt, task, 1000);
    if (response.data.success && response.data.text) {
      return response.data.text;
    }
    throw new Error(response.data.error || 'No response from AI');
  };

  const appendBubble = (speakerKey: string, isTyping: boolean): string => {
    const id = `bubble_${Date.now()}_${Math.random()}`;
    setBubbles(prev => [...prev, { id, speakerKey, text: '', isTyping }]);
    return id;
  };

  const updateBubble = (id: string, text: string) => {
    setBubbles(prev => prev.map(b => b.id === id ? { ...b, text, isTyping: false } : b));
  };

  const saveCurrentDebate = async () => {
    if (!user || savedDebateId !== null || saving) return;

    const fullContent = bubbles.map(b => ({
      speakerKey: b.speakerKey,
      text: b.text,
    }));

    setSaving(true);
    try {
      const response = await qipashuoApi.save(topic, fullContent);
      if (response.data.success) {
        setSavedDebateId(response.data.id);
        alert(`保存成功！辩论ID: ${response.data.id}`);
      } else {
        alert(`保存失败: ${response.data.error}`);
      }
    } catch (error: any) {
      alert(`保存失败: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const startDebate = async () => {
    if (isRunning) return;
    if (!topic.trim()) {
      alert('请先输入一个辩题！');
      return;
    }

    setIsRunning(true);
    setCurrentStep(0);
    setProgress(0);
    setCurrentStage('开场');
    setBubbles([]);
    setSavedDebateId(null);

    let history = '';
    const total = STEPS.length;

    for (let i = 0; i < STEPS.length; i++) {
      const step = STEPS[i];
      const pct = Math.round((i / total) * 100);
      setProgress(pct);
      setCurrentStep(i + 1);
      setCurrentStage(step.stage);

      const bubbleId = appendBubble(step.speaker, true);
      try {
        const text = await callAI(step.speaker, topic, history, step.task);
        updateBubble(bubbleId, text);
        history += `[${CHARACTERS[step.speaker].name}]: ${text}\n`;
      } catch (e: any) {
        updateBubble(bubbleId, `（这位奇葩今天状态不好: ${e.message}）`);
      }
      await new Promise(r => setTimeout(r, 300));
    }

    setProgress(100);
    setCurrentStage('辩论结束');
    setIsRunning(false);
  };

  const getCharacter = (speakerKey: string): Character => {
    return CHARACTERS[speakerKey] || CHARACTERS.host;
  };

  const isJudge = (speakerKey: string): boolean => {
    const c = getCharacter(speakerKey);
    return c.side === 'judge';
  };

  return (
    <div className="qipashuo-arena">
      <div className="qipa-header">
        <div className="qipa-title">奇葩说辩论竞技场</div>
        <div className="qipa-subtitle">AI 驱动 · 七位奇葩 · 金句连发</div>
      </div>

      <div className="topic-input-area">
        <div className="topic-label">输入辩题，或从下方选一个</div>
        <div className="topic-row">
          <input
            type="text"
            placeholder="例：打工人应该摸鱼吗？"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
          <button onClick={startDebate} disabled={isRunning}>
            {isRunning ? '辩论进行中...' : '开始辩论 ↗'}
          </button>
        </div>
        <div className="suggestions">
          {suggestedTopics.map((t, i) => (
            <div
              key={i}
              className="sug-chip"
              onClick={() => !isRunning && setSuggestedTopic(t)}
            >
              {t}
            </div>
          ))}
        </div>
      </div>

      <div className="cast-row">
        {['maweiwei', 'huangzhizhong', 'qiuchen', 'host', 'chenming', 'chuyan', 'luozhenyu', 'lidan'].map((key) => {
          const c = getCharacter(key);
          const roleColor = c.side === 'pro' ? '#C0392B' : c.side === 'con' ? '#1A5276' : '#E9A800';
          return (
            <div key={key} className="cast-card">
              <div
                className="cast-avatar"
                style={{ background: c.bg, color: c.textColor }}
              >
                {c.emoji}
              </div>
              <div className="cast-name">{c.name}</div>
              <div
                className="cast-role"
                style={{ background: c.bg, color: c.textColor }}
              >
                {c.tag}
              </div>
            </div>
          );
        })}
      </div>

      <div className="stage-label">
        <span id="stageName">{currentStage}</span>
        <span id="stageCount">{isRunning ? `${currentStep} / ${STEPS.length}` : ''}</span>
      </div>
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      <div className="debate-log" ref={debateLogRef}>
        {bubbles.length === 0 ? (
          <div className="empty-state">选好辩题，七位奇葩随时就位 🎤</div>
        ) : (
          bubbles.map((bubble) => {
            const c = getCharacter(bubble.speakerKey);
            return (
              <div key={bubble.id} className="speech-bubble">
                <div
                  className="bubble-avatar"
                  style={{ background: c.bg, color: c.textColor }}
                >
                  {c.emoji}
                </div>
                <div className="bubble-body">
                  <div className="bubble-meta">
                    <span className="bubble-speaker">{c.name}</span>
                    <span
                      className="bubble-tag"
                      style={{ background: c.bg, color: c.textColor }}
                    >
                      {c.tag}
                    </span>
                  </div>
                  <div className={`bubble-text ${isJudge(bubble.speakerKey) ? 'judge-text' : ''}`}>
                    {bubble.isTyping ? (
                      <div className="typing">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    ) : (
                      bubble.text
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <button
        className="start-btn"
        id="startBtn"
        onClick={startDebate}
        disabled={isRunning}
      >
        {isRunning ? '辩论进行中...' : bubbles.length > 0 ? '再来一场' : '开始辩论'}
      </button>

      {user && !isRunning && bubbles.length > 0 && !savedDebateId && (
        <button
          className="save-btn"
          onClick={saveCurrentDebate}
          disabled={saving}
          style={{ marginTop: '12px' }}
        >
          {saving ? '保存中...' : '💾 保存这场辩论到我的历史'}
        </button>
      )}

      {user && savedDebateId && !isRunning && (
        <div className="saved-notice" style={{
          marginTop: '12px',
          padding: '12px',
          background: 'rgba(0, 212, 170, 0.1)',
          border: '1px solid rgba(0, 212, 170, 0.3)',
          borderRadius: '8px',
          textAlign: 'center',
          color: 'var(--color-text-primary)',
          fontSize: '14px',
        }}>
          ✓ 已保存到你的辩论历史 (ID: {savedDebateId})
        </div>
      )}

      {!user && !isRunning && bubbles.length.length > 0 && (
        <div className="login-notice" style={{
          marginTop: '12px',
          padding: '12px',
          background: 'rgba(245, 197, 66, 0.1)',
          border: '1px solid rgba(245, 197, 66, 0.3)',
          borderRadius: '8px',
          textAlign: 'center',
          color: 'var(--color-text-primary)',
          fontSize: '14px',
        }}>
          登录后可以保存辩论历史
        </div>
      )}
    </div>
  );
};

export default Qipashuo;
