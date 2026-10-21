# registry-connector

Connector for fetching and publishing data from external systems to OpenG2P Registry.

| Path | What |
|------|------|
| `api/` | Connector service (FastAPI + Celery) |
| `ui/` | Admin UI for pipelines, runs, and DLQ |
| `docker/` | Container images (`registry-connector-api`, `registry-connector-ui`) |
| `deployments/charts/registry-connector` | Helm chart |

Packaging layout matches other OpenG2P Gen2 services (see
[master-data-service](https://github.com/OpenG2P/master-data-service/tree/1.1)).

## Quick start

```bash
# API (default http://127.0.0.1:8050)
cd api
cp .env.example .env
pip install -e .
python -m openg2p_connector_service.main

# UI
cd ui
npm install
npm run dev
```

## Build images

```bash
# API / worker / beat / consumer (same image, role via container args)
docker build -f docker/registry-connector-api/Dockerfile \
  -t openg2p/registry-connector-api:develop .

# Admin UI (context = ui/)
docker build -f docker/registry-connector-ui/Dockerfile \
  -t openg2p/registry-connector-ui:develop ui
```

## Helm

```bash
helm dependency update deployments/charts/registry-connector
helm upgrade --install registry-connector deployments/charts/registry-connector \
  --namespace <ns> \
  -f values-override.yaml
```

See `api/README.md`, `api/DEPLOYMENT.md`, and `ui/README.md` for env and role details.
