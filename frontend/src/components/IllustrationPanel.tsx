import React, { useEffect, useState } from 'react';
import { illustrationApi } from '../services/api';
import '../styles/IllustrationPanel.css';

interface IllustrationPanelProps {
  taskId: string;
  thumbnail?: boolean;
}

const IllustrationPanel: React.FC<IllustrationPanelProps> = ({ taskId, thumbnail = false }) => {
  const [svg, setSvg] = useState<string | null | 'loading'>('loading');

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) setSvg(null);
    }, 35000);

    illustrationApi.get(taskId)
      .then(res => {
        if (!cancelled) setSvg(res.data?.data?.svg ?? null);
      })
      .catch(() => {
        if (!cancelled) setSvg(null);
      })
      .finally(() => clearTimeout(timer));

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [taskId]);

  if (svg === 'loading') {
    if (thumbnail) return null; // Don't show loading state on cards — just absent
    return (
      <div className="illustration-loading">
        <div className="illustration-spinner" />
        <span>生成插图中…</span>
      </div>
    );
  }

  if (!svg) return null;

  if (thumbnail) {
    return (
      <div className="illustration-thumb-wrap">
        <div dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
    );
  }

  return (
    <div className="illustration-panel">
      <div dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
};

export default IllustrationPanel;
