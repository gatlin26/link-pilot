import { cn } from '@extension/ui';

interface CollectionButtonProps {
  count: 10 | 20;
  onClick: () => void;
  disabled: boolean;
  isLight: boolean;
}

export function CollectionButton({ count, onClick, disabled, isLight }: CollectionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded px-6 py-2 font-medium shadow transition-all',
        'hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
        isLight
          ? 'bg-blue-500 text-white hover:bg-blue-600'
          : 'bg-blue-600 text-white hover:bg-blue-700'
      )}
    >
      收集 {count} 条
    </button>
  );
}
