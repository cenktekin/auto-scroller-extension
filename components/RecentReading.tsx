import React from 'react';
import type { DailyStatsEntry } from '../types';

interface RecentReadingProps {
  days: DailyStatsEntry[];
}

/** Formats a YYYY-MM-DD day key as e.g. "Mon 16". */
function formatDay(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
}

export const RecentReading: React.FC<RecentReadingProps> = ({ days }) => {
  const visible = days.filter(day => day.stats.totalSeconds > 0 || day.stats.totalWords > 0);
  if (visible.length === 0) return null;

  const maxWords = Math.max(...visible.map(day => day.stats.totalWords), 1);

  return (
    <div className="p-3 bg-gray-700/50 rounded-lg space-y-2">
      <h3 className="text-sm font-medium text-gray-300">Last 7 Days</h3>
      <div className="space-y-1.5">
        {visible.map(day => (
          <div key={day.date} className="flex items-center gap-2 text-xs">
            <span className="w-12 shrink-0 text-gray-400">{formatDay(day.date)}</span>
            <div className="flex-1 h-1.5 bg-gray-600/60 rounded overflow-hidden">
              <div
                className="h-full bg-cyan-500 rounded"
                style={{ width: `${Math.max(4, (day.stats.totalWords / maxWords) * 100)}%` }}
              />
            </div>
            <span className="w-20 shrink-0 text-right text-gray-300 tabular-nums">
              {Math.floor(day.stats.totalSeconds / 60)}m · {day.stats.totalWords.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
