# QuickBox Lite dashboard

This  is a modified version of QuickBox CE dashboard. Most of the features are preserved: such as Package management center, service controller, network status chart...

The Realtime CPU/Network Graph are removed. Data refresh rate is slightly reduced to save computing resources. You can install Netdata to get more System information instead.


The dashboard disables Socket.IO management actions while disconnected. If the connection drops before an operation returns a result, check the task or service status before retrying. Service badges mark their last confirmed status as stale during the outage.

## Default dashboard language

Set the server default with `box lang <language>`. The dashboard reads that
setting on page load after a valid `locale` or `lang` query parameter and the
browser's saved dashboard preference. With no server default, it uses a
supported browser language or falls back to English. Choosing a language in the
Dashboard menu saves it for that browser.

## Prometheus metrics

The Node dashboard service exposes Prometheus text metrics at
`http://127.0.0.1:8575/metrics` by default. Configure the scraper on the same host and
network namespace as the WS service. This endpoint accepts direct loopback
requests. Dashboard traffic forwarded by Nginx still uses the gateway, and
forwarded requests cannot scrape metrics through it.

```yaml
scrape_configs:
  - job_name: quickbox-ws
    metrics_path: /metrics
    static_configs:
      - targets: ['127.0.0.1:8575']
```

- Prometheus `up{job="quickbox-ws"}` reports whether the target can be scraped.
  `quickbox_ws_healthy` is `1` while the process can serve requests without a
  fatal error and `0` during the fatal shutdown window.
- `quickbox_ws_process_*` reports start time, uptime, CPU time, resident memory
  and V8 heap usage.
- `quickbox_ws_socket_connections` reports active Socket.IO connections by path
  and transport. `quickbox_ws_socket_connections_total` counts accepted connections.
- `quickbox_ws_push_samplers*` reports active, in-flight and failed samplers by
  stream. `quickbox_ws_push_samples_total` counts successes, errors and
  timeouts. `quickbox_ws_push_last_success_timestamp_seconds` tracks the most
  recent success. Push samplers run only while clients subscribe.
- `quickbox_ws_service_collector_status` reports the last observed state of the
  systemd and process collectors. Check
  `quickbox_ws_service_collector_last_refresh_timestamp_seconds` for the age
  of the snapshot. A collector that has yet to run reports `unknown`.

Scraping reads the current in-memory state. It does not launch a service check
or start push sampling.
