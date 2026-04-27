import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TaskListItem } from '../types';
import '../styles/TaskCard.css';
import IllustrationPanel from './IllustrationPanel';

interface TaskCardProps {
  task: TaskListItem;
}

const TaskCard: React.FC<TaskCardProps> = ({ task }) => {
  const navigate = useNavigate();
  const [debateTopic, setDebateTopic] = useState<string | null>(null);
  const [debateQuote, setDebateQuote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClick = () => {
    navigate(`/arena/${task.id}`);
  };

  // Extract a memorable quote/sentence from text
  const extractQuote = (text: string): string | null => {
    // Look for bold text that looks like a quote/gold sentence
    const boldMatches = text.match(/\*\*([^*]{15, 60})\*\*/g);
    if (boldMatches && boldMatches.length > 0) {
      // Pick the first good one
      const quote = boldMatches[0].replace(/\*\*/g, '').trim();
      if (quote.length >= 10 && quote.length <= 60) {
        return quote;
      }
    }

    // Split into lines and look for a short punchy sentence
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 10 && l.length < 60);
    // Look for lines that have punctuation at the end - likely a complete thought
    const punchyLines = lines.filter(l => /[。.!？！]$/.test(l));
    if (punchyLines.length > 0) {
      // Pick a random one but prefer earlier
      return punchyLines[Math.floor(Math.random() * Math.min(3, punchyLines.length))];
    }
    if (lines.length > 0) {
      return lines[0];
    }

    return null;
  };

  useEffect(() => {
    if (!task.isInteractive) return;

    const loadDebateTopic = async () => {
      setLoading(true);
      try {
        // Try qipashuo-debate.md first (main debate file)
        const urls = [
          `/debate/${task.id}/qipashuo-debate.md`,
          `/debate/${task.id}/debate-1.md`,
          `/debate/${task.id}/index.json`
        ];

        for (const url of urls) {
          try {
            const res = await fetch(url);
            if (!res.ok) continue;

            const text = await res.text();
            // Check if it's HTML (404 fallback)
            const trimmed = text.trim().toLowerCase();
            if (trimmed.startsWith('<!doctype') || trimmed.startsWith('<html')) {
              continue;
            }

            // Extract topic from markdown
            // Look for patterns: **辩题：** ... , # **...**, # ..., "辩题": ...
            const topicMatch = text.match(/\*\*辩题\*\*:\s*([^\n]+)/) ||
                               text.match(/\*\*辩题：\*\*\s*([^\n]+)/) ||
                               text.match(/^#\s+(.+)$/m);

            if (topicMatch && topicMatch[1]) {
              let topic = topicMatch[1].replace(/\*/g, '').trim();
              // Truncate long topics
              if (topic.length > 60) {
                topic = topic.substring(0, 57) + '...';
              }
              setDebateTopic(topic);

              // Try to extract a quote after the topic
              const afterTopic = text.slice(text.indexOf(topicMatch[0]) + topicMatch[0].length);
              const quote = extractQuote(afterTopic);
              if (quote) {
                setDebateQuote(quote);
              }
              break;
            }
          } catch (e) {
            continue;
          }
        }
      } catch (e) {
        // Ignore - just don't show preview
      } finally {
        setLoading(false);
      }
    };

    loadDebateTopic();
  }, [task.id, task.isInteractive]);

  return (
    <div className={`task-card ${task.tier} ${task.completed ? 'completed' : ''}`} onClick={handleClick}>
      {!task.isInteractive && <IllustrationPanel taskId={task.id} thumbnail />}
      {task.isInteractive && debateTopic && (
        <div className="debate-preview">
          <div className="debate-preview-header">
            <span className="debate-icon">🎤</span>
            <span className="debate-label">Agent 辩论</span>
          </div>
          <div className="debate-topic">{debateTopic}</div>
          {debateQuote && (
            <div className="debate-quote">
              <span className="quote-mark">“</span>{debateQuote}<span className="quote-mark">”</span>
            </div>
          )}
        </div>
      )}
      <div className="task-header">
        <div className="task-name">
          {task.catIcon} {task.id} · {task.name}
        </div>
        <div className="bounty">+{task.bounty} EXP</div>
      </div>
      <div className="task-desc">{task.questionPreview}</div>
      <div className="task-meta">
        <span className={`tag ${task.tier}`}>
          {task.tier === 'easy' ? '🥉 简单' : task.tier === 'medium' ? '🥈 挑战' : '🥇 精英'}
        </span>
        <span className="tag cat">{task.category}</span>
        {task.completed && <span className="tag completed">✅ 已掌握</span>}
        {task.isInteractive && <span className="tag interactive-tag">🤖 交互</span>}
        <span className="task-social-counts">🤍 {task.likeCount ?? 0}  💬 {task.commentCount ?? 0}</span>
      </div>
    </div>
  );
};

export default TaskCard;
