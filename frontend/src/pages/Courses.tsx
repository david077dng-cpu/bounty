import React, { useState, useEffect } from 'react';
import { coursesApi } from '../services/api';
import type { Course } from '../types';
import { Link } from 'react-router-dom';
import '../styles/Courses.css';

const Courses: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [difficultyTiers, setDifficultyTiers] = useState<Array<{
    key: string;
    name: string;
    description: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hideCompleted, setHideCompleted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    setLoading(true);
    try {
      const res = await coursesApi.list();
      if (res.data.success) {
        setCourses(res.data.courses);
        setDifficultyTiers(res.data.difficultyTiers);
      } else {
        setError(res.data.error || 'Failed to load courses');
      }
    } catch (error) {
      console.error('Failed to load courses:', error);
      setError('Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'var(--cyan)';
      case 'intermediate': return 'var(--gold)';
      case 'advanced': return 'var(--red)';
      default: return 'var(--muted)';
    }
  };

  const getLessonStatusIcon = (unlocked: boolean, completed: boolean) => {
    if (completed) return '✅';
    if (unlocked) return '🔓';
    return '🔒';
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  if (error) {
    return <div className="error-text">{error}</div>;
  }

  return (
    <div className="courses-page">
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2>📚 LLM Agent 技能学习路线</h2>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={hideCompleted}
              onChange={e => setHideCompleted(e.target.checked)}
            />
            隐藏已完成
          </label>
        </div>
        <div style={{ marginBottom: 16 }}>
          <input
            type="text"
            placeholder="🔍 搜索课程或lesson..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text)',
              fontSize: '14px',
            }}
          />
        </div>
      </div>

      {/* Check if any courses will be displayed after filtering */}
      {(() => {
        let hasAnyVisibleCourses = false;
        difficultyTiers.forEach(tier => {
          courses.filter(c => c.difficulty === tier.key).forEach(course => {
            const hasMatchingLesson = course.lessons.some(lesson => {
              const matchesHideCompleted = !hideCompleted || !lesson.completed;
              if (!searchQuery) {
                return matchesHideCompleted;
              }
              const query = searchQuery.toLowerCase();
              const matchesSearch =
                lesson.title.toLowerCase().includes(query) ||
                course.name.toLowerCase().includes(query) ||
                course.description.toLowerCase().includes(query);
              return matchesHideCompleted && matchesSearch;
            });
            if (hasMatchingLesson) {
              hasAnyVisibleCourses = true;
            }
          });
        });

        if (!hasAnyVisibleCourses) {
          return (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: 'var(--muted)',
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>🔍</div>
              <p style={{ fontSize: '16px', margin: 0 }}>暂无匹配的课程</p>
              <p style={{ fontSize: '14px', margin: '8px 0 0 0' }}>试试换个关键词或者取消「隐藏已完成」试试</p>
            </div>
          );
        }

        return null;
      })()}

      {difficultyTiers.map(tier => (
        <div key={tier.key} className="difficulty-section">
          <h3 className="difficulty-header" style={{ color: getDifficultyColor(tier.key) }}>
            <span className="difficulty-badge" style={{ backgroundColor: getDifficultyColor(tier.key) }}></span>
            {tier.name}
          </h3>
          <p className="difficulty-description">{tier.description}</p>

          <div className="courses-list">
            {courses
              .filter(c => c.difficulty === tier.key)
              .map(course => {
                // Filter lessons based on search query and hideCompleted setting
                const filteredLessons = course.lessons.filter(lesson => {
                  const matchesHideCompleted = !hideCompleted || !lesson.completed;
                  if (!searchQuery) return matchesHideCompleted;

                  const query = searchQuery.toLowerCase();
                  const matchesSearch =
                    lesson.title.toLowerCase().includes(query) ||
                    course.name.toLowerCase().includes(query) ||
                    course.description.toLowerCase().includes(query);
                  return matchesHideCompleted && matchesSearch;
                });

                // If search query active and no lessons match, don't show the course card
                if (searchQuery && filteredLessons.length === 0) return null;

                return (
                <div key={course.id} className="course-card">
                  <div className="course-header">
                    <div className="course-icon">{course.icon}</div>
                    <div className="course-info">
                      <h4 className="course-name">{course.name}</h4>
                      <p className="course-description">{course.description}</p>
                    </div>
                  </div>
                  <div className="lessons-list">
                    {filteredLessons.map(lesson => (
                      <Link
                        key={lesson.id}
                        to={`/arena/${lesson.taskId}?lesson=${lesson.id}`}
                        className={`lesson-item ${!lesson.unlocked ? 'locked' : ''} ${lesson.completed ? 'completed' : ''}`}
                      >
                        <span className="lesson-status">
                          {getLessonStatusIcon(lesson.unlocked, lesson.completed)}
                        </span>
                        <span className="lesson-title">{lesson.title}</span>
                        {lesson.isMcpTask && <span className="mcp-badge">MCP</span>}
                        <span className="lesson-bounty">+{lesson.bounty}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })
            .filter(Boolean) // Remove null entries from filtered-out courses
          }
          </div>
        </div>
      ))}
    </div>
  );
};

export default Courses;
