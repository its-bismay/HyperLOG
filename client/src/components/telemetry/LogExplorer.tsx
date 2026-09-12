import { useState, useMemo } from 'react';
import {
  Copy,
  Check,
  Pause,
  Play,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { LogEntry } from '@/types/telemetry';

interface LogExplorerProps {
  logs: LogEntry[];
  isStreaming: boolean;
  onToggleStreaming: () => void;
  selectedLevel: string;
  onSelectLevel: (level: string) => void;
  selectedService: string;
  onSelectService: (service: string) => void;
}

export function LogExplorer({
  logs,
  isStreaming,
  onToggleStreaming,
  selectedLevel,
  onSelectLevel,
  selectedService,
  onSelectService,
}: LogExplorerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [inspectedLog, setInspectedLog] = useState<LogEntry | null>(null);
  const [copiedTrace, setCopiedTrace] = useState<string | null>(null);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesLevel =
        selectedLevel === 'ALL' || log.log_level.toUpperCase() === selectedLevel.toUpperCase();
      const matchesService =
        selectedService === 'ALL' || log.service_name === selectedService;

      if (!matchesLevel || !matchesService) return false;

      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        log.message.toLowerCase().includes(term) ||
        log.trace_id.toLowerCase().includes(term) ||
        log.service_name.toLowerCase().includes(term) ||
        log.host.toLowerCase().includes(term)
      );
    });
  }, [logs, selectedLevel, selectedService, searchTerm]);

  const handleCopyTrace = (traceId: string) => {
    navigator.clipboard.writeText(traceId);
    setCopiedTrace(traceId);
    setTimeout(() => setCopiedTrace(null), 2000);
  };

  return (
    <div className="p-4 space-y-3">
      {/* Explorer Controls */}
      <Card size="sm" className="bg-card/40 border-border">
        <CardContent className="p-3 flex flex-wrap items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search query (trace_id, message, host, service)..."
              className="h-8 pl-8 font-mono text-xs bg-background/80 border-border"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* Filters & Stream controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Level filters */}
            <div className="flex items-center border border-border bg-card/60">
              {['ALL', 'ERROR', 'WARN', 'INFO'].map((lvl) => {
                const isActive = selectedLevel === lvl;
                return (
                  <button
                    key={lvl}
                    onClick={() => onSelectLevel(lvl)}
                    className={`px-2.5 py-1 text-xs font-mono transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {lvl}
                  </button>
                );
              })}
            </div>

            {/* Service filter tag */}
            {selectedService !== 'ALL' && (
              <Badge variant="secondary" className="font-mono text-xs gap-1 py-1">
                <span>{selectedService}</span>
                <X
                  className="size-3 cursor-pointer hover:text-foreground"
                  onClick={() => onSelectService('ALL')}
                />
              </Badge>
            )}

            {/* Streaming Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleStreaming}
              className={`h-8 font-mono text-xs gap-1.5 ${
                isStreaming
                  ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                  : 'border-amber-500/40 text-amber-400 bg-amber-500/10'
              }`}
            >
              {isStreaming ? (
                <>
                  <Pause className="size-3" />
                  <span>PAUSE STREAM</span>
                </>
              ) : (
                <>
                  <Play className="size-3" />
                  <span>RESUME STREAM</span>
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Log Explorer Table */}
      <Card size="sm" className="bg-card/40 border-border overflow-hidden">
        <CardHeader className="p-3 pb-2 border-b border-border/50 flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-3.5 text-muted-foreground" />
            <CardTitle className="text-xs font-mono tracking-wider uppercase text-muted-foreground">
              Live Log Firehose
            </CardTitle>
          </div>
          <span className="font-mono text-[11px] text-muted-foreground">
            {filteredLogs.length} events displayed
          </span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead className="sticky top-0 bg-secondary/80 backdrop-blur-xs border-b border-border text-[11px] text-muted-foreground">
                <tr>
                  <th className="py-1.5 px-3 w-40">TIMESTAMP (UTC)</th>
                  <th className="py-1.5 px-2 w-16">LEVEL</th>
                  <th className="py-1.5 px-3 w-36">SERVICE</th>
                  <th className="py-1.5 px-2 w-24">METHOD / STATUS</th>
                  <th className="py-1.5 px-2 w-20 text-right">LATENCY</th>
                  <th className="py-1.5 px-3">MESSAGE</th>
                  <th className="py-1.5 px-2 w-24 text-right">TRACE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      No logs found matching current filters.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const isErr = log.log_level === 'ERROR' || log.log_level === 'FATAL';
                    const isWarn = log.log_level === 'WARN';
                    const isSelected = inspectedLog?.trace_id === log.trace_id;

                    const levelBadgeClass = isErr
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                      : isWarn
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      : 'bg-muted text-muted-foreground border-border';

                    return (
                      <tr
                        key={log.trace_id}
                        onClick={() => setInspectedLog(isSelected ? null : log)}
                        className={`transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-primary/15'
                            : isErr
                            ? 'hover:bg-rose-500/5 bg-rose-500/[0.02]'
                            : 'hover:bg-muted/40'
                        }`}
                      >
                        <td className="py-1.5 px-3 text-muted-foreground text-[11px] whitespace-nowrap">
                          {log.timestamp ? log.timestamp.replace('T', ' ').slice(0, 23) : '—'}
                        </td>
                        <td className="py-1.5 px-2">
                          <Badge
                            variant="outline"
                            className={`font-mono text-[10px] h-4.5 px-1 ${levelBadgeClass}`}
                          >
                            {log.log_level.slice(0, 3)}
                          </Badge>
                        </td>
                        <td className="py-1.5 px-3 font-semibold text-foreground whitespace-nowrap">
                          {log.service_name}
                        </td>
                        <td className="py-1.5 px-2 text-muted-foreground whitespace-nowrap">
                          <span className="text-foreground">{log.http_method}</span>{' '}
                          <span
                            className={
                              log.http_status >= 500
                                ? 'text-rose-400 font-bold'
                                : log.http_status >= 400
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                            }
                          >
                            {log.http_status}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-right text-muted-foreground text-[11px] whitespace-nowrap">
                          {log.response_time_ms}ms
                        </td>
                        <td className="py-1.5 px-3 text-foreground/90 truncate max-w-md">
                          {log.message}
                        </td>
                        <td className="py-1.5 px-2 text-right text-muted-foreground text-[11px] whitespace-nowrap">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyTrace(log.trace_id);
                            }}
                            className="inline-flex items-center gap-1 hover:text-foreground text-[10px] px-1 py-0.5 border border-border/50 bg-card/60"
                            title="Copy trace ID"
                          >
                            {copiedTrace === log.trace_id ? (
                              <Check className="size-2.5 text-emerald-400" />
                            ) : (
                              <Copy className="size-2.5" />
                            )}
                            <span>{log.trace_id.slice(0, 6)}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Inspect Log Drawer / Panel */}
      {inspectedLog && (
        <Card size="sm" className="bg-card/90 border-primary/50 backdrop-blur-md">
          <CardHeader className="p-3 pb-2 border-b border-border flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-primary">
                TRACE INSPECTOR // {inspectedLog.trace_id}
              </span>
              <Badge variant="outline" className="font-mono text-[10px]">
                {inspectedLog.service_name}
              </Badge>
            </div>
            <button
              onClick={() => setInspectedLog(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </CardHeader>
          <CardContent className="p-3 font-mono text-xs space-y-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
              <div>
                <span className="text-muted-foreground block">HOST</span>
                <span className="text-foreground">{inspectedLog.host}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">ENVIRONMENT</span>
                <span className="text-foreground">{inspectedLog.environment}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">HTTP REQUEST</span>
                <span className="text-foreground">
                  {inspectedLog.http_method} {inspectedLog.http_status} ({inspectedLog.response_time_ms}ms)
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">TIMESTAMP</span>
                <span className="text-foreground">{inspectedLog.timestamp}</span>
              </div>
            </div>

            <div className="pt-2">
              <span className="text-muted-foreground text-[11px] block mb-1">MESSAGE</span>
              <div className="p-2 border border-border bg-black/40 text-rose-300 select-all font-mono text-xs">
                {inspectedLog.message}
              </div>
            </div>

            <div className="pt-2">
              <span className="text-muted-foreground text-[11px] block mb-1">METADATA (JSON)</span>
              <pre className="p-2 border border-border bg-black/40 text-muted-foreground text-[11px] overflow-x-auto max-h-32">
                {typeof inspectedLog.metadata === 'string'
                  ? inspectedLog.metadata
                  : JSON.stringify(inspectedLog.metadata, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
