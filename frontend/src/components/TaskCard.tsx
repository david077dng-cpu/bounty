import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { TaskListItem } from '../types';
import '../styles/TaskCard.css';

interface TaskCardProps {
  task: TaskListItem;
}

const TaskCard: React.FC<TaskCardProps> = ({ task }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/arena/${task.id}`);
  };

  return (
    <div className={`task-card ${task.tier} ${task.completed ? 'completed' : ''}`} onClick={handleClick}>
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
        <span className="task-social-counts">🤍 {task.likeCount ?? 0}  💬 {task.commentCount ?? 0}</span>
      </div>
      <button className="run-btn">{task.completed ? '▶ 再次训练' : '▶ 开始训练'}</button>
    </div>
  );
};

export default TaskCard;
