# Ops Observability Readiness Anchors

These sources support the OPS-SWEEP-03 remediation. They are engineering
anchors only; they do not certify a live environment.

| Source | Why it applies | No-overclaim boundary | Affected control |
|---|---|---|---|
| Prometheus configuration reference: `authorization.credentials_file` | Prometheus supports bearer-token material through a mounted credentials file, which keeps scrape tokens out of tracked YAML. | This proves the config shape, not the live token rotation or file mount. | OPS-26, metrics scrape authentication |
| Prometheus Alertmanager configuration reference: receivers and `webhook_configs` / file-backed URL fields | Alertmanager receiver definitions must contain real delivery configs or a secret-file contract; empty receivers are not a live paging path. | This proves receiver syntax, not that a pager/webhook is reachable. | OPS-25, alert delivery |
| Grafana Loki operations/authentication docs: multi-tenant requests use `X-Scope-OrgID`; `auth_enabled: false` is a single-tenant/no-auth mode | Local Loki must either use tenant auth or explicitly rely on network isolation. | This proves Loki-side tenant header semantics, not cross-namespace network enforcement. | OPS-27, log access boundary |
| OpenTelemetry Collector configuration docs: exporter TLS settings are part of the collector exporter contract | Collector-to-backend plaintext must be explicit and environment-controlled when service mesh or managed TLS is not used. | This proves config semantics, not live mTLS. | OPS-28, OPS-29 |

Primary URLs:

- <https://prometheus.io/docs/prometheus/latest/configuration/configuration/>
- <https://prometheus.io/docs/alerting/latest/configuration/>
- <https://grafana.com/docs/loki/latest/operations/authentication/>
- <https://grafana.com/docs/loki/latest/operations/multi-tenancy/>
- <https://opentelemetry.io/docs/collector/configuration/>
