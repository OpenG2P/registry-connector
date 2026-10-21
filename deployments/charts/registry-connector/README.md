# OpenG2P Registry Connector

Helm chart for the OpenG2P Registry Connector.

One image runs several roles via container args: `api`, `worker`, `beat`,
optional `consumer`. See the chart `values.yaml` and repo `DEPLOYMENT.md`.

```bash
helm dependency update deployments/charts/registry-connector
helm upgrade --install registry-connector deployments/charts/registry-connector \
  --namespace <ns> \
  -f values-override.yaml
```
