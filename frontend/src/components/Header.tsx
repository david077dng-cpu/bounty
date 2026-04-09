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

  return (
    <div className="header">
      <div className="logo">
        <div className="logo-icon">🎯</div>
        <div>
          <div className="logo-text">SKILL BOUNTY</div>
          <div className="logo-sub">Hunter Arena v0.2 · Life Edition</div>
        </div>
      </div>
      <div className="nav">
        <Link to="/" className="nav-link">任务</Link>
        <Link to="/courses" className="nav-link">课程</Link>
        <Link to="/leaderboard" className="nav-link">排行榜</Link>
        {!loading && (
          <>
            {user ? (
              <>
                <Link to="/mcp-connections" className="nav-link">MCP</Link>
                <Link to="/history" className="nav-link">我的记录</Link>
                <div className="user-info">
                  <span className="user-bounty">🏆 {user.totalBounty}</span>
                  <span className="user-tier">{user.tier}</span>
                </div>
                <button className="logout-btn" onClick={handleLogout}>退出</button>
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
