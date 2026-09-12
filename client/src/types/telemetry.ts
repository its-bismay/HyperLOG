export interface LogEntry {
  trace_id: string;
  timestamp: string;
  service_name: string;
  host: string;
  environment: string;
  log_level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  http_method: string;
  http_status: number;
  response_time_ms: number;
  message: string;
  metadata: string | Record<string, unknown>;
}

export interface ServiceMetric {
  service: string;
  count: number;
  avg_latency_ms: number;
}

export interface TelemetrySummary {
  total_logs: number;
  queue_depth: number;
  levels: Record<string, number>;
  services: ServiceMetric[];
  statuses: Record<string, number>;
}
