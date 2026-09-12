import { useState, useEffect, useCallback, useRef } from 'react';
import { HeaderBar } from './components/telemetry/HeaderBar';
import { MetricsRow } from './components/telemetry/MetricsRow';
import { ServiceDistribution } from './components/telemetry/ServiceDistribution';
import { LogExplorer } from './components/telemetry/LogExplorer';
import { fetchAnalyticsSummary, fetchRecentLogs } from './lib/api';
import type { LogEntry, TelemetrySummary } from './types/telemetry';

export default function App() {
  const [summary, setSummary] = useState<TelemetrySummary | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isStreaming, setIsStreaming] = useState(true);
  const [selectedLevel, setSelectedLevel] = useState('ALL');
  const [selectedService, setSelectedService] = useState('ALL');
  const wsRef = useRef<WebSocket | null>(null);

  // Data fetching
  const refreshData = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const [sum, recLogs] = await Promise.all([
        fetchAnalyticsSummary().catch(() => null),
        fetchRecentLogs(100, selectedLevel).catch(() => []),
      ]);
      if (sum) setSummary(sum);
      if (recLogs) setLogs(recLogs);
    } catch (err) {
      console.error('Error refreshing telemetry:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedLevel]);

  // WebSocket live telemetry stream
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: number | undefined;

    const connectWs = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/telemetry`;

      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'telemetry' && payload.data) {
            setSummary(payload.data);
          }
        } catch {
          // ignore parsing error
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        reconnectTimeout = window.setTimeout(connectWs, 3000);
      };

      ws.onerror = () => {
        setWsConnected(false);
      };
    };

    connectWs();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  // Periodic log poll when streaming is enabled
  useEffect(() => {
    refreshData();
    if (!isStreaming) return;

    const interval = setInterval(async () => {
      try {
        const freshLogs = await fetchRecentLogs(100, selectedLevel);
        setLogs(freshLogs);
      } catch {
        // quiet error
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isStreaming, selectedLevel, refreshData]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/30">
      {/* Top Header */}
      <HeaderBar
        wsConnected={wsConnected}
        onRefresh={refreshData}
        isRefreshing={isRefreshing}
      />

      {/* Main Observatory Workspace */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto pb-12 space-y-2">
        {/* Metric Cards Row */}
        <MetricsRow summary={summary} />

        {/* Distribution Graphs & Health */}
        <ServiceDistribution
          summary={summary}
          selectedService={selectedService}
          onSelectService={setSelectedService}
        />

        {/* Log Firehose & Explorer */}
        <LogExplorer
          logs={logs}
          isStreaming={isStreaming}
          onToggleStreaming={() => setIsStreaming((prev) => !prev)}
          selectedLevel={selectedLevel}
          onSelectLevel={setSelectedLevel}
          selectedService={selectedService}
          onSelectService={setSelectedService}
        />
      </main>

      {/* Clean Engineering Footer */}
      <footer className="border-t border-border/60 bg-card/30 py-3 px-6 text-[11px] font-mono text-muted-foreground flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-4">
          <span>HYPERLOG ENGINE // V1.0.0</span>
          <span>PIPELINE: FASTAPI ➔ REDIS STREAMS ➔ ASYNC WORKER ➔ CLICKHOUSE</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-emerald-500">P99 &lt; 5MS SLA</span>
          <span>•</span>
          <span>BUFFER CAPACITY: 1,000,000 LOGS</span>
        </div>
      </footer>
    </div>
  );
}