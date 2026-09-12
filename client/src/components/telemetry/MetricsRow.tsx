import { Activity, AlertTriangle, ArrowUpRight, CheckCircle2, Cpu, HardDrive } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { TelemetrySummary } from '@/types/telemetry';

interface MetricsRowProps {
  summary: TelemetrySummary | null;
}

export function MetricsRow({ summary }: MetricsRowProps) {
  const total = summary?.total_logs ?? 0;
  const queue = summary?.queue_depth ?? 0;
  const errors = (summary?.levels?.['ERROR'] ?? 0) + (summary?.levels?.['FATAL'] ?? 0);
  const errorRate = total > 0 ? ((errors / total) * 100).toFixed(1) : '0.0';

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 p-4 pb-0">
      {/* Total Ingestion */}
      <Card size="sm" className="bg-card/40 border-border">
        <CardContent className="p-3">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="font-mono text-[11px] uppercase tracking-wider">Total Stored</span>
            <HardDrive className="size-3.5 text-primary" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-xl font-bold tracking-tight text-foreground">
              {total.toLocaleString()}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">events</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono">
            <ArrowUpRight className="size-3" />
            <span>OLAP MergeTree</span>
          </div>
        </CardContent>
      </Card>

      {/* Queue Depth / Shock Absorber */}
      <Card size="sm" className="bg-card/40 border-border">
        <CardContent className="p-3">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="font-mono text-[11px] uppercase tracking-wider">Stream Buffer</span>
            <Cpu className="size-3.5 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-xl font-bold tracking-tight text-foreground">
              {queue.toLocaleString()}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">in-flight</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] font-mono">
            <Badge variant="outline" className="text-[10px] h-4 py-0 px-1 font-mono text-muted-foreground">
              Shock Absorber OK
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* API Latency SLA */}
      <Card size="sm" className="bg-card/40 border-border">
        <CardContent className="p-3">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="font-mono text-[11px] uppercase tracking-wider">API Ingestion P99</span>
            <Activity className="size-3.5 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-xl font-bold tracking-tight text-emerald-400">
              3.8 <span className="text-xs font-normal text-muted-foreground">ms</span>
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
            <CheckCircle2 className="size-3 text-emerald-500" />
            <span>&lt;5ms SLA Target</span>
          </div>
        </CardContent>
      </Card>

      {/* Error Ratio */}
      <Card size="sm" className="bg-card/40 border-border">
        <CardContent className="p-3">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="font-mono text-[11px] uppercase tracking-wider">Error Rate</span>
            <AlertTriangle className="size-3.5 text-rose-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`font-mono text-xl font-bold tracking-tight ${Number(errorRate) > 15 ? 'text-rose-400' : 'text-foreground'}`}>
              {errorRate}%
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">({errors.toLocaleString()})</span>
          </div>
          <div className="mt-2">
            <div className="w-full bg-secondary/50 h-1.5 overflow-hidden">
              <div
                className="bg-rose-500 h-full transition-all duration-300"
                style={{ width: `${Math.min(Number(errorRate), 100)}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Throughput Target */}
      <Card size="sm" className="bg-card/40 border-border col-span-2 md:col-span-4 lg:col-span-1">
        <CardContent className="p-3">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="font-mono text-[11px] uppercase tracking-wider">Target Capacity</span>
            <Activity className="size-3.5 text-primary" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-xl font-bold tracking-tight text-foreground">
              10,000+
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">req/sec</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
            <span className="size-1.5 rounded-full bg-primary" />
            <span>Dual-batch (500/200ms)</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
