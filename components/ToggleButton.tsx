import React from 'react';

interface ToggleButtonProps {
  enabled: boolean;
  onClick: () => void;
  activeClass?: string;
  disabled?: boolean;
  title?: string;
}

export const ToggleButton: React.FC<ToggleButtonProps> = ({
  enabled,
  onClick,
  activeClass = 'bg-cyan-500 text-white',
  disabled = false,
  title,
}) => (
  <button
    onClick={onClick}
    aria-pressed={enabled}
    disabled={disabled}
    title={title}
    className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
      disabled
        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
        : enabled
          ? activeClass
          : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
    }`}
  >
    {enabled ? 'ON' : 'OFF'}
  </button>
);
