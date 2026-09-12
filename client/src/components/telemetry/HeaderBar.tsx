import { useState } from 'react';
import { Database, Flame, RefreshCw, Server, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { sendSimulatedBurst } from '@/lib/api';

interface HeaderBarProps {
  wsConnected: boolean;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export function HeaderBar({ wsConnected, onRefresh, isRefreshing }: HeaderBarProps) {
  const [burstLoading, setBurstLoading] = useState(false);
  const [burstCount, setBurstCount] = useState<number | null>(null);

  const handleBurst = async (count: number) => {
    try {
      setBurstLoading(true);
      const sent = await sendSimulatedBurst(count);
      setBurstCount(sent);
      setTimeout(() => setBurstCount(null), 3000);
      onRefresh();
    } catch (err) {
      console.error('Failed burst:', err);
    } finally {
      setBurstLoading(false);
    }
  };

  return (
    <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-50">
      <div className="flex h-12 items-center justify-between px-4">
        {/* Left: Brand / System info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-mono text-sm font-semibold tracking-wider text-foreground">
            <div className="size-5 rounded-none bg-primary flex items-center justify-center text-primary-foreground font-mono text-xs">
              H
            </div>
            <span>HYPERLOG</span>
            <span className="text-xs text-muted-foreground font-normal">/ TELEMETRY CONSOLE</span>
          </div>

          <div className="hidden md:flex items-center gap-2 pl-4 border-l border-border">
            <Badge variant="outline" className="gap-1.5 font-mono text-[11px] py-0 h-5">
              <span className={`size-1.5 rounded-full ${wsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              {wsConnected ? 'WEBSOCKET ACTIVE' : 'RECONNECTING'}
            </Badge>

            <Badge variant="outline" className="gap-1 font-mono text-[11px] text-muted-foreground py-0 h-5 hidden lg:inline-flex">
              <Server className="size-3" />
              REDIS: STREAMS
            </Badge>

            <Badge variant="outline" className="gap-1 font-mono text-[11px] text-muted-foreground py-0 h-5 hidden lg:inline-flex">
              <Database className="size-3" />
              CLICKHOUSE: MERGETREE
            </Badge>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {burstCount && (
            <span className="font-mono text-xs text-emerald-400 animate-pulse hidden sm:inline">
              +{burstCount} logs injected
            </span>
          )}

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={burstLoading}
              onClick={() => handleBurst(200)}
              className="font-mono text-xs h-7 gap-1"
            >
              <Zap className="size-3 text-amber-400" />
              <span>Burst 200</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={burstLoading}
              onClick={() => handleBurst(1000)}
              className="font-mono text-xs h-7 gap-1 hidden sm:inline-flex"
            >
              <Flame className="size-3 text-rose-400" />
              <span>Spike 1k</span>
            </Button>

            <Button
              variant="outline"
              size="icon-sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="h-7 w-7"
              title="Manual refresh"
            >
              <RefreshCw className={`size-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
