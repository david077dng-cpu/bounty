import React, { useEffect, useRef } from 'react';
import type { SlashCommand } from '../types';
import '../styles/SlashCommand.css';

interface SlashCommandPopupProps {
  visible: boolean;
  commands: SlashCommand[];
  selectedIndex: number;
  onSelect: (command: SlashCommand) => void;
  onHighlight: (index: number) => void;
  onClose: () => void;
  x: number;
  y: number;
  containerRef: React.RefObject<HTMLElement>;
}

const SlashCommandPopup: React.FC<SlashCommandPopupProps> = ({
  visible,
  commands,
  selectedIndex,
  onSelect,
  onHighlight,
  onClose,
  x,
  y,
  containerRef,
}) => {
  const popupRef = useRef<HTMLDivElement>(null);

  // Auto scroll selected item into view
  useEffect(() => {
    if (popupRef.current && commands.length > 0) {
      const items = popupRef.current.querySelectorAll('.slash-command-item');
      const selectedItem = items[selectedIndex];
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, commands.length]);

  // Click outside to close
  useEffect(() => {
    if (!visible) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [visible, onClose]);

  // Adjust position to stay within container
  const getAdjustedPosition = () => {
    if (!containerRef.current || !popupRef.current) {
      return { left: x, top: y, bottomAligned: false };
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const popupWidth = 380; // max-width from CSS
    const popupHeight = 380; // max-height from CSS

    let left = x;
    let top = y;
    let bottomAligned = false;

    // Adjust horizontally
    if (left + popupWidth > containerRect.width - 10) {
      left = Math.max(10, containerRect.width - popupWidth - 10);
    }

    // Adjust vertically - if it would go below the container, position above the cursor
    if (top + popupHeight > containerRect.height - 10) {
      bottomAligned = true;
      top = y - 10; // position above cursor
    }

    return { left, top, bottomAligned };
  };

  if (!visible || commands.length === 0) {
    return null;
  }

  const pos = getAdjustedPosition();

  return (
    <div
      ref={popupRef}
      className={`slash-command-popup ${pos.bottomAligned ? 'bottom-aligned' : ''}`}
      style={{ left: pos.left, top: pos.top }}
    >
      <div className="slash-command-popup-header">
        <span>斜杠命令 / {commands.length} 可用</span>
      </div>
      <div className="slash-command-list">
        {commands.length === 0 ? (
          <div className="slash-command-empty">未找到匹配的命令</div>
        ) : (
          commands.map((command, index) => (
            <div
              key={command.id}
              className={`slash-command-item ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => onSelect(command)}
              onMouseEnter={() => onHighlight(index)}
            >
              <div className="slash-command-icon">
                {command.icon || '⚡'}
              </div>
              <div className="slash-command-content">
                <div className="slash-command-name-row">
                  <span className="slash-command-name">/{command.name}</span>
                  <span className={`slash-command-category ${command.category}`}>
                    {command.category}
                  </span>
                </div>
                <div className="slash-command-description">
                  {command.description}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SlashCommandPopup;
