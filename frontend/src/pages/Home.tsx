import React, { useState, useEffect } from 'react';
import { tasksApi } from '../services/api';
import type { TaskListItem, Category } from '../types';
import TaskCard from '../components/TaskCard';
import '../styles/TaskCard.css';

const Home: React.FC = () => {
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('全部');
  const [hideCompleted, setHideCompleted] = useState<boolean>(false);
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

  const filteredTasks = hideCompleted
    ? tasks.filter(task => !task.completed)
    : tasks;

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
          <span>隐藏已完成</span>
        </label>
      </div>
      <div className="task-grid">
        {filteredTasks.length === 0 ? (
          <div className="empty-state">暂无任务</div>
        ) : (
          filteredTasks.map((task) => <TaskCard key={task.id} task={task} />)
        )}
      </div>
    </div>
  );
};

export default Home;
