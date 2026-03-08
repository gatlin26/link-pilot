import { cn } from '@extension/ui';

interface StatusDisplayProps {
  isAhrefsPage: boolean;
  availableCount: number;
  isLight: boolean;
}

export function StatusDisplay({ isAhrefsPage, availableCount, isLight }: StatusDisplayProps) {
  if (!isAhrefsPage) {
    return (
      <div className={cn(
        'rounded-lg p-4 text-center',
        isLight ? 'bg-yellow-50 text-yellow-800' : 'bg-yellow-900/30 text-yellow-200'
      )}>
        <p className="text-sm">当前页面不是 Ahrefs 页面</p>
        <p className="text-xs mt-1 opacity-75">请在 Ahrefs Backlink Checker 页面使用收集功能</p>
      </div>
    );
  }

  return (
    <div className={cn(
      'rounded-lg p-4',
      isLight ? 'bg-green-50 text-green-800' : 'bg-green-900/30 text-green-200'
    )}>
      <p className="text-sm font-medium">可收集外链</p>
      <p className="text-2xl font-bold mt-1">{availableCount} 条</p>
    </div>
  );
}
