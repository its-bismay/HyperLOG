import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { TelemetrySummary } from '@/types/telemetry';

interface ServiceDistributionProps {
  summary: TelemetrySummary | null;
  selectedService: string;
  onSelectService: (service: string) => void;
}

export function ServiceDistribution({
  summary,
  selectedService,
  onSelectService,
}: ServiceDistributionProps) {
  const total = summary?.total_logs || 1;
  const services = summary?.services || [];
  const statuses = summary?.statuses || {};
  const levels = summary?.levels || {};

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 p-4 pb-0">
      {/* Services Overview */}
      <Card size="sm" className="bg-card/40 border-border lg:col-span-2">
        <CardHeader className="p-3 pb-2 border-b border-border/50 flex-row items-center justify-between">
          <CardTitle className="text-xs font-mono tracking-wider uppercase text-muted-foreground">
            Distributed Services (ClickHouse Aggregation)
          </CardTitle>
          <span className="font-mono text-[11px] text-muted-foreground">
            {services.length} active services
          </span>
        </CardHeader>
        <CardContent className="p-3">
          <div className="space-y-2">
            {services.length === 0 ? (
              <div className="text-xs font-mono text-muted-foreground py-4 text-center">
                Waiting for incoming log telemetry...
              </div>
            ) : (
              services.map((svc) => {
                const percent = Math.round((svc.count / total) * 100);
                const isSelected = selectedService === svc.service;

                return (
                  <div
                    key={svc.service}
                    onClick={() => onSelectService(isSelected ? 'ALL' : svc.service)}
                    className={`p-2 border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-primary bg-primary/10'
                        : 'border-border/60 bg-card/60 hover:border-border hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                      <span className="font-semibold text-foreground">{svc.service}</span>
                      <div className="flex items-center gap-3 text-muted-foreground text-[11px]">
                        <span>{svc.avg_latency_ms} ms avg</span>
                        <span className="text-foreground font-medium">{svc.count.toLocaleString()} logs</span>
                        <span className="w-8 text-right text-muted-foreground">{percent}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-secondary/50 h-1">
                      <div
                        className="bg-primary h-full transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* HTTP Status & Severity */}
      <div className="flex flex-col gap-3">
        {/* Status Codes */}
        <Card size="sm" className="bg-card/40 border-border flex-1">
          <CardHeader className="p-3 pb-2 border-b border-border/50">
            <CardTitle className="text-xs font-mono tracking-wider uppercase text-muted-foreground">
              HTTP Status Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 space-y-2 font-mono text-xs">
            {Object.entries(statuses).map(([code, count]) => {
              const pct = Math.round((count / total) * 100);
              const is2xx = code.startsWith('2');
              const is4xx = code.startsWith('4');
              const is5xx = code.startsWith('5');
              const colorClass = is2xx
                ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                : is4xx
                ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                : is5xx
                ? 'text-rose-400 border-rose-500/30 bg-rose-500/10'
                : 'text-foreground border-border';

              return (
                <div key={code} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`font-mono text-[10px] h-4.5 px-1.5 ${colorClass}`}>
                      {code}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {is2xx ? 'OK' : is4xx ? 'Client Err' : is5xx ? 'Server Err' : 'Other'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-foreground">{count.toLocaleString()}</span>
                    <span className="text-muted-foreground w-7 text-right">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Severity */}
        <Card size="sm" className="bg-card/40 border-border">
          <CardHeader className="p-3 pb-2 border-b border-border/50">
            <CardTitle className="text-xs font-mono tracking-wider uppercase text-muted-foreground">
              Log Severity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 flex items-center justify-between gap-2 font-mono text-xs">
            {['INFO', 'WARN', 'ERROR'].map((lvl) => {
              const count = levels[lvl] || 0;
              const isErr = lvl === 'ERROR';
              const isWarn = lvl === 'WARN';

              return (
                <div key={lvl} className="flex-1 p-2 border border-border/60 bg-card/60 text-center">
                  <span className={`text-[10px] font-bold block ${isErr ? 'text-rose-400' : isWarn ? 'text-amber-400' : 'text-primary'}`}>
                    {lvl}
                  </span>
                  <span className="text-sm font-semibold text-foreground block mt-0.5">
                    {count.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
