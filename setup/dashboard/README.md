# QuickBox Lite dashboard

This  is a modified version of QuickBox CE dashboard. Most of the features are preserved: such as Package management center, service controller, network status chart...

The Realtime CPU/Network Graph are removed. Data refresh rate is slightly reduced to save computing resources. You can install Netdata to get more System information instead.


The dashboard disables Socket.IO management actions while disconnected. If the connection drops before an operation returns a result, check the task or service status before retrying. Service badges mark their last confirmed status as stale during the outage.

The status badge reports whether a service is running. The switch shows whether it is enabled at boot. Restart is available for enabled services. Use the switch to enable and start a disabled service.

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

## Runtime environments: prod and mock

One switch decides where every widget gets its data:

```
--env=prod                  this host's real data (default)
--env=mock                  fixture profiles, default profile
--env=mock:<profile>        fixture profiles, named profile
```

`QUICKBOX_ENV` accepts the same values and carries the same meaning; the npm
development scripts forward it as `--env`, so both forms reach the server. There
is no second flag and no `MOCK_ENABLED`/`MOCK_PROFILE` pair any more: one value
carries both the environment and the profile. A flag given later on the command
line wins, so `npm run dev -- --env=prod` overrides the script default.

The packaged unit runs with `NODE_ENV=production`, which vetoes `mock` — the
server logs the refusal and keeps serving real data, so a stray flag can never
put sample hosts behind a real dashboard.

The fixture data lives outside the source tree, in `ws/mock/data/profiles.ts`;
`ws/src` only holds business code. The runtime glue (fixture bootstrap, profile
lifecycle, switch parsing) sits next to it in `ws/mock/`.

## Local development with mock data

The Node dashboard reports the host's real state, which is usually too sparse
to review a layout or a widget change away from a fully configured box. The
development scripts therefore start in mock mode:

```sh
cd setup/dashboard/ws
npm run dev                                    # mock, all-running profile
QUICKBOX_ENV=mock:partial-running npm run dev  # fewer running services and torrents
QUICKBOX_ENV=mock:empty-system npm run dev     # nothing installed
QUICKBOX_ENV=prod npm run dev                  # this host's real data
```

The proxy script uses the same default: `npm run dev:dashboard` starts in mock
mode, and `QUICKBOX_ENV=prod npm run dev:dashboard` serves real data. Running
the built server directly still defaults to prod: `node dist/server.js`.

Available profiles are `all-running`, `partial-running`, `empty-system`,
`installing`, `long-branch`, and `server-locale-zh`. An unknown name logs a
warning and falls back to `all-running`. While mock mode is on, the dashboard
can switch profiles without a restart:

```sh
curl -X POST http://127.0.0.1:8575/test/profile \
     -H 'content-type: application/json' \
     -d '{"profile":"empty-system"}'
```

The profiles cover CPU, memory, load, disk, network, service, package, torrent,
and bandwidth state. The values are not frozen: memory, load, disk usage,
network rate, and the vnstat counters drift over time, so a widget keeps moving
without any user action and the gauges cross their warning thresholds. The
counters reset when you switch profiles. Refresh the dashboard after switching
so every widget re-reads its stream.

In mock mode the host presents itself as Linux, which is where QuickBox runs:
disk usage comes from the fixture instead of the machine's `df`, and the
network counters come from a simulated `/proc/net/dev`.
