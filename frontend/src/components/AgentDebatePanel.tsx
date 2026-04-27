import React, { useEffect, useState } from 'react';
import '../styles/AgentDebatePanel.css';

interface AgentDebatePanelProps {
  taskId: string;
}

interface DebateFile {
  filename: string;
  displayName: string;
  content: string;
}

const AgentDebatePanel: React.FC<AgentDebatePanelProps> = ({ taskId }) => {
  const [debates, setDebates] = useState<DebateFile[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDebates();
  }, [taskId]);

  const loadDebates = async () => {
    try {
      let loadedDebates: DebateFile[] = [];

      // First try to load index.json which lists all markdown files
      let indexLoaded = false;
      try {
        const indexUrl = `/debate/${taskId}/index.json`;
        const indexRes = await fetch(indexUrl);
        if (indexRes.ok) {
          const indexData = await indexRes.json();
          // indexData should be an array of { filename: string, displayName?: string }
          const files = Array.isArray(indexData) ? indexData : [];

          for (const file of files) {
            const filename = typeof file === 'string' ? file : file.filename;
            if (!filename || !filename.endsWith('.md')) continue;

            try {
              const url = `/debate/${taskId}/${filename}`;
              const res = await fetch(url);
              if (res.ok) {
                const content = await res.text();
                // Check if it's actually HTML (Vite 404 fallback returns 200 OK HTML)
                const trimmed = content.trim().toLowerCase();
                if (trimmed.startsWith('<!doctype') || trimmed.startsWith('<html')) {
                  continue; // This is the 404 fallback page, skip
                }

                let displayName: string;
                if (typeof file === 'object' && file.displayName) {
                  displayName = file.displayName;
                } else if (filename.includes('qipashuo') || filename.includes('qps')) {
                  displayName = 'QiPaShuo 奇葩说';
                } else {
                  displayName = filename
                    .replace(/\.md$/, '')
                    .replace(/-/g, ' ')
                    .replace(/\b\w/g, c => c.toUpperCase());
                }

                loadedDebates.push({ filename, displayName, content });
              }
            } catch (e) {
              // Skip missing files
            }
          }
          if (loadedDebates.length > 0) {
            indexLoaded = true;
          }
        }
      } catch (e) {
        // index.json doesn't exist, fall back to guessing common names
      }

      // Only add fallback files if NO files were loaded from index.json
      // This prevents duplicate tabs
      if (!indexLoaded || loadedDebates.length === 0) {
        const possibleFiles = ['debate-1.md', 'debate-2.md', 'debate-3.md', 'debate-4.md', 'debate-5.md', 'qipashuo-debate.md', 'qps-debate.md'];
        const fallbackDebates: DebateFile[] = [];

        for (const filename of possibleFiles) {
          try {
            const url = `/debate/${taskId}/${filename}`;
            const res = await fetch(url);
            if (res.ok) {
              const content = await res.text();
              // Check for HTML fallback (case-insensitive)
              const trimmed = content.trim().toLowerCase();
              if (trimmed.startsWith('<!doctype') || trimmed.startsWith('<html')) {
                continue;
              }
              // Generate display name from filename
              let displayName: string;
              if (filename.includes('qipashuo') || filename.includes('qps')) {
                displayName = 'QiPaShuo 奇葩说';
              } else if (filename === 'debate-1.md') {
                displayName = '标准辩论';
              } else {
                displayName = filename
                  .replace(/\.md$/, '')
                  .replace(/-/g, ' ')
                  .replace(/\b\w/g, c => c.toUpperCase());
              }

              // Avoid duplicates
              if (!loadedDebates.some(d => d.filename === filename)) {
                fallbackDebates.push({ filename, displayName, content });
              }
            }
          } catch (e) {
            // File doesn't exist, skip
          }
        }
        loadedDebates = [...loadedDebates, ...fallbackDebates];
      }

      setDebates(loadedDebates);
      setLoading(false);

      if (loadedDebates.length === 0) {
        setError('No debate files found');
      }
    } catch (e) {
      setError('Failed to load debate files');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="agent-debate-panel">
        <div className="debate-loading">🎤 加载 Agent 辩论...</div>
      </div>
    );
  }

  if (error || debates.length === 0) {
    return null; // Don't show anything if no debates
  }

  const selectedDebate = debates[selectedIndex];

  // Parse speaker from heading and assign color based on role
  const getSpeakerColor = (speaker: string): string => {
    const lower = speaker.toLowerCase();
    if (lower.includes('正方')) return '#ef4444';
    if (lower.includes('反方')) return '#3b82f6';
    if (lower.includes('马东') || lower.includes('法官') || lower.includes('主持')) return '#6b7280';
    if (lower.includes('马薇薇')) return '#ef4444';
    if (lower.includes('黄执中')) return '#8b5cf6';
    if (lower.includes('储殷')) return '#f59e0b';
    if (lower.includes('罗振宇')) return '#ec4899';
    if (lower.includes('陈铭')) return '#3b82f6';
    if (lower.includes('邱晨')) return '#14b8a6';
    if (lower.includes('李诞')) return '#6b7280';
    return '#6366f1';
  };

  // Split content by --- and render sections with proper styling
  const renderContent = () => {
    if (collapsed) return null;

    if (!selectedDebate) return null;

    const sections = selectedDebate.content.split(/\n---\n/);

    return (
      <div className="debate-content">
        {sections.map((section, idx) => {
          const trimmed = section.trim();
          if (!trimmed) return null;

          const lines = trimmed.split('\n');
          const firstLine = lines[0];

          if (firstLine.startsWith('## ')) {
            // Heading section - debate turn
            const headingText = firstLine.replace('## ', '');
            const bodyText = lines.slice(1).join('\n').trim();

            let speaker = '';
            let title = '';
            const colonMatch = headingText.match(/^(.+?)\s*[-–]\s*(.+)$/);
            if (colonMatch) {
              speaker = colonMatch[1];
              title = colonMatch[2];
            } else {
              title = headingText;
            }

            const speakerColor = getSpeakerColor(speaker || title);

            return (
              <div key={idx} className="debate-section debate-turn">
                <div className="debate-turn-header">
                  {speaker && (
                    <span className="debate-speaker" style={{ color: speakerColor }}>
                      {speaker}
                    </span>
                  )}
                  {title && <span className="debate-title">{title}</span>}
                </div>
                <div className="debate-body">
                  {bodyText.split('\n').map((line, i) => {
                    const trimmedLine = line.trim();
                    if (!trimmedLine) return <br key={i} />;
                    return <p key={i}>{trimmedLine}</p>;
                  })}
                </div>
              </div>
            );
          }

          if (firstLine.startsWith('# ')) {
            // Main title
            return (
              <div key={idx} className="debate-section debate-main-title">
                <h1>{trimmed.replace('# ', '').trim()}</h1>
              </div>
            );
          }

          // Regular content section (like header info)
          return (
            <div key={idx} className="debate-section debate-info">
              {trimmed.split('\n').map((line, i) => {
                const trimmedLine = line.trim();
                if (!trimmedLine) return <br key={i} />;
                return <p key={i}>{trimmedLine}</p>;
              })}
            </div>
          );
        })}
      </div>
    );
  };

  const toggleCollapsed = () => {
    setCollapsed(!collapsed);
  };

  const debateCount = debates.length;

  return (
    <div className="agent-debate-panel">
      <div className="debate-panel-header">
        <span>🎤 Agent 辩论 {debateCount > 1 ? `(${debateCount}场)` : ''}</span>
        <button
          className="collapse-toggle"
          onClick={toggleCollapsed}
          title={collapsed ? '展开查看完整辩论' : '折叠辩论面板'}
        >
          {collapsed ? '▼ 展开' : '▲ 折叠'}
        </button>
      </div>

      {!collapsed && debates.length > 1 && (
        <div className="debate-tabs">
          {debates.map((debate, idx) => (
            <button
              key={idx}
              className={`debate-tab ${idx === selectedIndex ? 'active' : ''}`}
              onClick={() => setSelectedIndex(idx)}
            >
              {debate.displayName}
            </button>
          ))}
        </div>
      )}

      {!collapsed && (
        <div className="debate-tab-content">
          {renderContent()}
        </div>
      )}
    </div>
  );
};

export default AgentDebatePanel;
