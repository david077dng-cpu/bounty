import React, { useState, useEffect } from 'react';
import { coursesApi } from '../services/api';
import type { Course } from '../types';
import { Link } from 'react-router-dom';
import '../styles/Courses.css';

const Courses: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [userStats, setUserStats] = useState({
    totalCourses: 0,
    totalLessons: 0,
    completedLessons: 0,
    currentLevel: 'Rookie',
    currentLevelIndex: 1,
  });

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    setLoading(true);
    try {
      const res = await coursesApi.list();
      if (res.data.success) {
        setCourses(res.data.courses);
        calculateStats(res.data.courses);
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

  const calculateStats = (coursesList: Course[]) => {
    let totalLessons = 0;
    let completedLessons = 0;
    let totalCourses = coursesList.length;

    coursesList.forEach(course => {
      totalLessons += course.lessons.length;
      completedLessons += course.lessons.filter(l => l.completed).length;
    });

    // Determine current level based on completed lessons
    let currentLevel = 'Digi-Egg';
    let currentLevelIndex = 0;
    if (completedLessons >= 20) {
      currentLevel = 'Mega';
      currentLevelIndex = 4;
    } else if (completedLessons >= 12) {
      currentLevel = 'Ultimate';
      currentLevelIndex = 3;
    } else if (completedLessons >= 6) {
      currentLevel = 'Champion';
      currentLevelIndex = 2;
    } else if (completedLessons >= 1) {
      currentLevel = 'Rookie';
      currentLevelIndex = 1;
    }

    setUserStats({
      totalCourses,
      totalLessons,
      completedLessons,
      currentLevel,
      currentLevelIndex,
    });
  };

  const getDifficultyBadgeClass = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'rookie';
      case 'intermediate': return 'champion';
      case 'advanced': return 'ultimate';
      default: return 'rookie';
    }
  };

  const getDifficultyBadgeText = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'BEGINNER';
      case 'intermediate': return 'INTERMEDIATE';
      case 'advanced': return 'ADVANCED';
      default: return 'BEGINNER';
    }
  };

  const getAvatarColor = (courseId: number) => {
    const colors = ['teal', 'amber', 'purple', 'coral', 'blue'];
    return colors[courseId % colors.length];
  };


  const getCourseTypeFromTags = (course: Course): string => {
    // Try to infer type from course name/description/tags
    const text = `${course.name} ${course.description} ${course.icon}`.toLowerCase();
    if (text.includes('code') || text.includes('python') || text.includes('debug')) return 'code';
    if (text.includes('logic') || text.includes('reason') || text.includes('推理')) return 'logic';
    if (text.includes('agent') || text.includes('skill') || text.includes('prompt')) return 'agent';
    if (text.includes('合成') || text.includes('design')) return 'skill';
    return 'all';
  };

  const getLessonCount = (course: Course) => {
    return course.lessons.length;
  };

  const getCompletedLessonCount = (course: Course) => {
    return course.lessons.filter(l => l.completed).length;
  };

  const getCourseProgress = (course: Course) => {
    if (course.lessons.length === 0) return 0;
    return Math.round((getCompletedLessonCount(course) / course.lessons.length) * 100);
  };

  const getEvolutionStepClass = (index: number) => {
    if (index < userStats.currentLevelIndex) return 'done';
    if (index === userStats.currentLevelIndex) return 'active';
    return 'locked';
  };

  const getEvolutionStepEmoji = (index: number) => {
    const emojis = ['🌱', '📘', '⚡', '🔥', '👑'];
    return emojis[index] || '❓';
  };

  const getEvolutionStepName = (index: number) => {
    const names = [
      { name: 'Novice', desc: '基础认知' },
      { name: 'Apprentice', desc: '工具使用' },
      { name: 'Expert', desc: '系统协作' },
      { name: 'Master', desc: '知识综合' },
      { name: 'Visionary', desc: '自主创造' },
    ];
    return names[index] || { name: 'Unknown', desc: 'Unknown' };
  };

  const filterCards = (type: string) => {
    setActiveFilter(type);
  };

  const filteredCourses = () => {
    if (activeFilter === 'all') {
      return courses;
    }
    return courses.filter(course => getCourseTypeFromTags(course) === activeFilter);
  };

  // Get daily challenges (first 4 incomplete lessons)
  const getDailyChallenges = () => {
    const challenges: any[] = [];
    for (const course of courses) {
      for (const lesson of course.lessons) {
        if (!lesson.completed && lesson.unlocked) {
          challenges.push({ ...lesson, course });
          if (challenges.length >= 4) break;
        }
      }
      if (challenges.length >= 4) break;
    }
    // If we don't have enough, add some completed ones too
    if (challenges.length < 4) {
      for (const course of courses) {
        for (const lesson of course.lessons) {
          if (lesson.completed && !challenges.find(c => c.id === lesson.id)) {
            challenges.push({ ...lesson, course });
            if (challenges.length >= 4) break;
          }
        }
        if (challenges.length >= 4) break;
      }
    }
    return challenges;
  };

  const getChallengeIconClass = (difficulty: string) => {
    if (difficulty === 'beginner') return 'code';
    if (difficulty === 'intermediate') return 'logic';
    if (difficulty === 'advanced') return 'agent';
    return 'debug';
  };

  const getChallengeDifficultyClass = (bounty: number) => {
    if (bounty <= 50) return 'diff-easy';
    if (bounty <= 120) return 'diff-med';
    if (bounty <= 300) return 'diff-hard';
    return 'diff-ex';
  };

  const getChallengeDifficultyText = (bounty: number) => {
    if (bounty <= 50) return 'EASY';
    if (bounty <= 120) return 'MEDIUM';
    if (bounty <= 300) return 'HARD';
    return 'EXPERT';
  };

  const getSkillDex = () => {
    const dex = [
      { type: 'Agent-Skill', emoji: '🤖', bg: '#E6F1FB', level: 'Champion', status: '▲ 进化中' },
      { type: 'Code-Skill', emoji: '💻', bg: '#E1F5EE', level: 'Champion', status: '● 活跃' },
      { type: 'Debug-Skill', emoji: '🔬', bg: '#FAEEDA', level: 'Rookie → Champion', status: '⚡ 待进化' },
      { type: '未解锁', emoji: '❓', bg: 'var(--color-background-secondary)', level: '达到 Ultimate 后解锁', status: '🔒 锁定', locked: true },
    ];
    return dex;
  };

  if (loading) {
    return <div className="courses-page loading">加载中...</div>;
  }

  if (error) {
    return <div className="courses-page error-text">{error}</div>;
  }

  return (
    <div className="courses-page">
      <div className="hero">
        <div className="hero-grid">
          <div>
            <div className="hero-badge">KNOWLEDGE DANCE PLATFORM v2.4</div>
            <h1>探索你的<span> Knowledge</span><br />完成升华</h1>
            <p className="hero-desc">每一条知识都是一个等待起舞的灵感。完成挑战，积累经验，让你的认知从基础成长到大师级别。</p>
            <div className="digi-dots">
              {[...Array(7)].map((_, i) => (
                <div key={i} className={`digi-dot ${i <= userStats.currentLevelIndex ? 'active' : ''}`}></div>
              ))}
            </div>
          </div>
          <div className="hero-stats">
            <div className="stat-box">
              <div className="stat-num">{userStats.totalCourses}</div>
              <div className="stat-label">课程</div>
            </div>
            <div className="stat-box">
              <div className="stat-num">{userStats.completedLessons}</div>
              <div className="stat-label">已完成</div>
            </div>
            <div className="stat-box">
              <div className="stat-num">{userStats.currentLevel}</div>
              <div className="stat-label">当前等级</div>
            </div>
          </div>
        </div>
      </div>

      <div className="section-label">学习路径 // LEARNING PATH</div>
      <div className="path-section">
        <div className="path-card">
          <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
            你的当前进度 — <span style={{ fontFamily: 'var(--mono)', color: 'var(--color-text-info)' }}>
              Level {userStats.currentLevelIndex + 1} · {userStats.currentLevel}
            </span>
          </div>
          <div className="path-steps">
            {[...Array(5)].map((_, index) => {
              const stepInfo = getEvolutionStepName(index);
              return (
                <React.Fragment key={index}>
                  <div className="path-step">
                    <div className={`step-circle ${getEvolutionStepClass(index)}`}>
                      {getEvolutionStepEmoji(index)}
                      {index < userStats.currentLevelIndex && <div className="step-badge">✓</div>}
                    </div>
                    <div className="step-name">
                      {stepInfo.name}<br />{stepInfo.desc}
                    </div>
                  </div>
                  {index < 4 && <div className="step-arrow">→</div>}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      <div className="section-label">推荐课程 // RECOMMENDED</div>
      <div className="filter-row">
        {['all', 'logic', 'code', 'agent', 'knowledge'].map((type) => (
          <button
            key={type}
            className={`filter-btn ${activeFilter === type ? 'on' : ''}`}
            onClick={() => filterCards(type)}
          >
            {type === 'all' && '全部'}
            {type === 'logic' && '逻辑推理'}
            {type === 'code' && '代码技能'}
            {type === 'agent' && 'Agent 设计'}
            {type === 'knowledge' && 'Knowledge 提炼'}
          </button>
        ))}
      </div>
      <div className="courses-grid" id="courses-grid">
        {filteredCourses().map((course) => {
          const progress = getCourseProgress(course);
          const badgeClass = getDifficultyBadgeClass(course.difficulty);
          const badgeText = getDifficultyBadgeText(course.difficulty);
          const avatarColor = getAvatarColor(course.id);
          const type = getCourseTypeFromTags(course);
          const totalLessons = getLessonCount(course);
          const estimatedHours = Math.max(1, Math.round(totalLessons / 3));

          // Extract skill tags from description or generate
          const skillTags = course.description
            .split(/[，。,\s]+/)
            .filter(word => word.length > 2 && word.length < 12)
            .slice(0, 3);
          if (skillTags.length === 0) {
            skillTags.push('agent', 'tool', 'prompt');
          }

          return (
            <Link
              key={course.id}
              to={`/courses#course-${course.id}`}
              className={`course-card ${progress > 0 && progress < 100 ? 'featured' : ''}`}
              data-type={type}
              style={{ textDecoration: 'none' }}
            >
              <div className="card-top">
                <div className={`digi-avatar ${avatarColor}`}>{course.icon}</div>
                <div className="badge-row">
                  <div className={`badge ${badgeClass}`}>{badgeText}</div>
                  {progress === 0 && <div className="badge new">NEW</div>}
                  {progress > 50 && <div className="badge hot">HOT</div>}
                </div>
              </div>
              {course.lessons.length > 1 && (
                <div className="evo-chain">
                  Knowledge→
                  <span>{course.name.split(' ')[0]}</span>
                  <span className="evo-arrow">→</span>
                  <span>{badgeText}</span>
                </div>
              )}
              <div className="card-title">{course.name}</div>
              <div className="card-desc">{course.description}</div>
              <div className="skill-tags">
                {skillTags.map((tag, i) => (
                  <span key={i} className="skill-tag">{tag.toLowerCase().replace(/\W/g, '')}</span>
                ))}
              </div>
              <div className="card-meta">
                <span>⏱ {estimatedHours}h {estimatedHours > 1 ? `${Math.round(totalLessons % 3 * 30)}m` : ''}</span>
                <span>⚔ {totalLessons} 挑战</span>
                <span>★ {4.5 + Math.round((course.id % 5) / 2) / 10}</span>
              </div>
              <div className="progress-row">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                </div>
                <div className="progress-pct">{progress}%</div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="section-label">今日挑战 // DAILY CHALLENGES</div>
      <div className="challenge-section">
        <div className="challenge-grid">
          {getDailyChallenges().map((challenge) => (
            <Link
              key={challenge.id}
              to={`/arena/${challenge.taskId}?lesson=${challenge.id}`}
              className="challenge-card"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div className={`ch-icon ${getChallengeIconClass(challenge.course.difficulty)}`}>
                {challenge.course.icon}
              </div>
              <div>
                <div className="ch-title">{challenge.title}</div>
                <div className="ch-sub">{challenge.course.name}</div>
                <div className={`ch-diff ${getChallengeDifficultyClass(challenge.bounty)}`}>
                  ● {getChallengeDifficultyText(challenge.bounty)} · +{challenge.bounty} XP
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="bottom-grid">
        <div>
          <div className="section-label">排行榜 // LEADERBOARD</div>
          <div className="leaderboard">
            <div className="lb-row">
              <div className="lb-rank gold">01</div>
              <div className="lb-avatar">🦁</div>
              <div className="lb-name">AgentMaster_Rex</div>
              <div className="lb-level">Mega</div>
              <div className="lb-pts">9842</div>
            </div>
            <div className="lb-row">
              <div className="lb-rank">02</div>
              <div className="lb-avatar">🐉</div>
              <div className="lb-name">SkillForge_Luna</div>
              <div className="lb-level">Ultimate</div>
              <div className="lb-pts">7631</div>
            </div>
            <div className="lb-row">
              <div className="lb-rank">03</div>
              <div className="lb-avatar">⚡</div>
              <div className="lb-name">LogicBeast_Kai</div>
              <div className="lb-level">Ultimate</div>
              <div className="lb-pts">6200</div>
            </div>
            <div className="lb-row" style={{
              background: 'var(--color-background-info)',
              borderRadius: 'var(--border-radius-md)',
              padding: '10px 8px'
            }}>
              <div className="lb-rank" style={{ color: 'var(--color-text-info)' }}>07</div>
              <div className="lb-avatar">🤖</div>
              <div className="lb-name" style={{ color: 'var(--color-text-info)', fontWeight: 500 }}>You</div>
              <div className="lb-level" style={{ color: 'var(--color-text-info)' }}>{userStats.currentLevel}</div>
              <div className="lb-pts">{userStats.completedLessons * 100 + userStats.totalCourses * 50}</div>
            </div>
          </div>
        </div>

        <div>
          <div className="section-label">我的 Knowledge 图鉴 // KNOWLEDGE DEX</div>
          <div className="leaderboard">
            {getSkillDex().map((dex, index) => (
              <div key={index} className="lb-row" style={dex.locked ? { opacity: 0.5 } : {}}>
                <div className="lb-avatar" style={{ background: dex.bg }}>{dex.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>{dex.type}</div>
                  <div style={{
                    fontSize: '10px',
                    color: 'var(--color-text-secondary)',
                    fontFamily: 'var(--mono)'
                  }}>
                    {dex.level}
                  </div>
                </div>
                <div style={{
                  fontFamily: 'var(--mono)',
                  fontSize: '10px',
                  color: dex.status.includes('升华') ? 'var(--color-text-info)' :
                          dex.status.includes('活跃') ? 'var(--color-text-success)' :
                          'var(--color-text-secondary)'
                }}>
                  {dex.status}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Courses;
 Courses;
