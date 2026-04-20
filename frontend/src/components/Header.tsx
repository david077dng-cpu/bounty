import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/Header.css';

const Header: React.FC = () => {
  const { user, logout, loading } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  // Get first character of username for avatar
  const getInitial = () => {
    if (!user || !user.username) return '?';
    return user.username.charAt(0).toUpperCase();
  };

  // Generate a consistent color based on username
  const getAvatarColor = () => {
    if (!user || !user.username) return '#6366f1';
    let hash = 0;
    for (let i = 0; i < user.username.length; i++) {
      hash = user.username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
      '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
      '#06b6d4', '#3b82f6', '#ef4444', '#14b8a6', '#f97316'
    ];
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="header">
      <div className="logo">
        <div className="logo-icon">✨</div>
        <div>
          <div className="logo-text">MAKE KNOWLEDGE DANCE</div>
          <div className="logo-sub">让知识化作灵动的互动体验</div>
        </div>
      </div>
      <div className="nav">
        <Link to="/" className="nav-link">探索发现</Link>
        <Link to="/courses" className="nav-link">主题路线</Link>
        <Link to="/leaderboard" className="nav-link">排行榜</Link>
        <Link to="/chess" className="nav-link">棋局</Link>
        <Link to="/docs" className="nav-link">文档</Link>
        {!loading && user && (
          <Link to="/creation" className="nav-link">创作中心</Link>
        )}
        {!loading && (
          <>
            {user ? (
              <>
                <span className="user-bounty-navbar">🌟 {user.totalBounty} EXP</span>
                <Link to="/dashboard" className="avatar-link">
                  <div
                    className="user-avatar"
                    style={{ backgroundColor: getAvatarColor() }}
                    title="个人档案"
                  >
                    {getInitial()}
                  </div>
                </Link>
                <button className="logout-btn" onClick={handleLogout}>登出</button>
              </>
            ) : (
              <>
                <Link to="/login" className="nav-link">登录</Link>
                <Link to="/register" className="nav-link btn-register">注册</Link>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Header;
