import React, { useState, useEffect, useRef } from 'react';
import { socialApi, SocialComment } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import '../styles/SocialPanel.css';

interface SocialPanelProps {
  taskId: string;
  taskAuthorId?: number | null;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

const SocialPanel: React.FC<SocialPanelProps> = ({ taskId, taskAuthorId }) => {
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [comments, setComments] = useState<SocialComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [liking, setLiking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [statsRes, commentsRes] = await Promise.all([
          socialApi.getStats(taskId),
          socialApi.getComments(taskId),
        ]);
        if (statsRes.data.success) {
          setLikeCount(statsRes.data.likeCount);
          setLiked(statsRes.data.liked);
        }
        if (commentsRes.data.success) {
          setComments(commentsRes.data.comments);
        }
      } catch {
        // silently fail — social features are non-critical
      }
    };
    loadData();
  }, [taskId]);

  const handleLike = async () => {
    if (!user || liking) return;
    // Optimistic update
    const prevLiked = liked;
    const prevCount = likeCount;
    setLiked(!liked);
    setLikeCount(liked ? likeCount - 1 : likeCount + 1);
    setLiking(true);
    try {
      const res = await socialApi.toggleLike(taskId);
      if (res.data.success) {
        setLiked(res.data.liked);
        setLikeCount(res.data.likeCount);
      }
    } catch {
      // Rollback on error
      setLiked(prevLiked);
      setLikeCount(prevCount);
    } finally {
      setLiking(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await socialApi.addComment(taskId, newComment.trim());
      if (res.data.success) {
        setComments(prev => [...prev, res.data.comment]);
        setNewComment('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || '评论失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      await socialApi.deleteComment(commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch {
      setError('删除失败');
    }
  };

  const canDelete = (comment: SocialComment) =>
    !!user && (user.id === comment.user.id || user.id === taskAuthorId);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmitComment();
    }
  };

  const autoResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewComment(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  return (
    <div className="social-panel">
      <div className="social-like-row">
        <button
          className={`like-btn${liked ? ' liked' : ''}`}
          onClick={handleLike}
          disabled={!user || liking}
          title={user ? (liked ? '取消点赞' : '点赞') : '登录后点赞'}
        >
          {liked ? '❤️' : '🤍'}
          <span className="like-count">{likeCount}</span>
        </button>
        {!user && <span className="social-hint">登录后可点赞评论</span>}
      </div>

      <div className="comments-section">
        <div className="comments-header">
          💬 评论 <span className="comment-count">({comments.length})</span>
        </div>

        {comments.length === 0 ? (
          <div className="comments-empty">暂无评论，来抢沙发吧</div>
        ) : (
          <div className="comments-list">
            {comments.map(comment => (
              <div key={comment.id} className="comment-item">
                <div className="comment-avatar">
                  {comment.user.username.charAt(0).toUpperCase()}
                </div>
                <div className="comment-body">
                  <div className="comment-meta">
                    <span className="comment-username">{comment.user.username}</span>
                    <span className="comment-time">{timeAgo(comment.createdAt)}</span>
                    {canDelete(comment) && (
                      <button
                        className="comment-delete-btn"
                        onClick={() => handleDeleteComment(comment.id)}
                        title="删除评论"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <div className="comment-content">{comment.content}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {user && (
          <div className="comment-input-row">
            <textarea
              ref={textareaRef}
              className="comment-textarea"
              placeholder="写下你的评论… (Ctrl+Enter 发送)"
              value={newComment}
              onChange={autoResize}
              onKeyDown={handleKeyDown}
              maxLength={500}
              rows={2}
            />
            <div className="comment-input-footer">
              {error && <span className="comment-error">{error}</span>}
              <span className="comment-char-count">{newComment.length}/500</span>
              <button
                className="comment-send-btn"
                onClick={handleSubmitComment}
                disabled={!newComment.trim() || submitting}
              >
                {submitting ? '发送中…' : '发送'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SocialPanel;
