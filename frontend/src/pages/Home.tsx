import React, { useState, useEffect } from 'react';
import { tasksApi } from '../services/api';
import type { TaskListItem, Category } from '../types';
import TaskCard from '../components/TaskCard';
import { useAuth } from '../contexts/AuthContext';
import '../styles/TaskCard.css';

const Home: React.FC = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('全部');
  const [hideCompleted, setHideCompleted] = useState<boolean>(false);
  const [showMineOnly, setShowMineOnly] = useState<boolean>(false);
  const [sortByLikes, setSortByLikes] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTasks();
  }, [selectedCategory]);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const res = await tasksApi.list(selectedCategory === '全部' ? undefined : selectedCategory);
      if (res.data.success) {
        setTasks(res.data.tasks);
        setCategories([{ id: 0, name: '全部', icon: '🌐' }, ...res.data.categories]);
      }
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTasks = tasks
    .filter(task => {
      if (hideCompleted && task.completed) return false;
      if (showMineOnly && task.authorId !== user?.id) return false;
      return true;
    })
    .sort((a, b) => sortByLikes ? (b.likeCount ?? 0) - (a.likeCount ?? 0) : 0);

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div>
      <div className="cat-filter" id="cat-filter">
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={`cat-btn ${selectedCategory === cat.name ? 'active' : ''}`}
            onClick={() => setSelectedCategory(cat.name)}
          >
            {cat.icon} {cat.name}
          </button>
        ))}
        <label className="hide-completed-label">
          <input
            type="checkbox"
            checked={hideCompleted}
            onChange={(e) => setHideCompleted(e.target.checked)}
          />
          <span>隐藏已掌握</span>
        </label>
        {user && (
          <label className="hide-completed-label">
            <input
              type="checkbox"
              checked={showMineOnly}
              onChange={(e) => setShowMineOnly(e.target.checked)}
            />
            <span>只看我的</span>
          </label>
        )}
        <button
          className={`sort-btn${sortByLikes ? ' active' : ''}`}
          onClick={() => setSortByLikes(v => !v)}
        >
          🔥 按热度
        </button>
      </div>
      <div className="task-grid">
        {filteredTasks.length === 0 ? (
          <div className="empty-state">暂无训练挑战</div>
        ) : (
          filteredTasks.map((task) => <TaskCard key={task.id} task={task} />)
        )}
      </div>
    </div>
  );
};

export default Home;
