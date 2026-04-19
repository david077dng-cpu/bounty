import React, { useEffect, useState } from 'react';
import { illustrationApi, geminiImageApi } from '../services/api';
import '../styles/IllustrationPanel.css';

interface IllustrationPanelProps {
  taskId: string;
  thumbnail?: boolean;
}

const IllustrationPanel: React.FC<IllustrationPanelProps> = ({ taskId, thumbnail = false }) => {
  const [svg, setSvg] = useState<string | null | 'loading'>('loading');
  const [pngUrl, setPngUrl] = useState<string | null>(null);
  const [pngLoading, setPngLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Try Gemini PNG image first
    const loadPng = async () => {
      try {
        const res = await geminiImageApi.get(taskId);
        if (!cancelled && res.data.success && res.data.data.imageUrl) {
          setPngUrl(`http://localhost:3001${res.data.data.imageUrl}`);
          setSvg(null);
        } else {
          // Fallback to SVG
          await loadSvg();
        }
      } catch (err) {
        // Fallback to SVG on error
        await loadSvg();
      } finally {
        if (!cancelled) setPngLoading(false);
      }
    };

    const loadSvg = () => {
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
    };

    loadPng();

    return () => {
      cancelled = true;
    };
  }, [taskId]);

  if (pngLoading && svg === 'loading') {
    if (thumbnail) return null; // Don't show loading state on cards — just absent
    return (
      <div className="illustration-loading">
        <div className="illustration-spinner" />
        <span>生成插图中…</span>
      </div>
    );
  }

  if (pngUrl) {
    if (thumbnail) {
      return (
        <div className="illustration-thumb-wrap">
          <img src={pngUrl} alt="" className="task-thumbnail" />
        </div>
      );
    }
    return (
      <div className="illustration-panel">
        <img src={pngUrl} alt="" className="task-illustration" />
      </div>
    );
  }

  if (svg === 'loading') {
    if (thumbnail) return null;
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
