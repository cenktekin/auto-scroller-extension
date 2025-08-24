
import React from 'react';

interface ColorButtonProps {
  color: string;
  isSelected: boolean;
  onClick: () => void;
}

export const ColorButton: React.FC<ColorButtonProps> = ({ color, isSelected, onClick }) => {
  const neonShadow = `0 0 5px ${color}, 0 0 10px ${color}`;
  return (
    <button
      onClick={onClick}
      className={`w-8 h-8 rounded-full transition-all duration-200 ease-in-out transform ${isSelected ? 'scale-110 ring-2 ring-offset-2 ring-offset-gray-800' : 'ring-1 ring-gray-600'}`}
      style={{ 
        backgroundColor: color, 
        borderColor: color,
        boxShadow: isSelected ? neonShadow : 'none',
      }}
      aria-label={`Select ${color} color`}
    />
  );
};