# registry-connector

Connector for fetching and publishing data from external systems to OpenG2P Registry.

| Path | What |
|------|------|
| `api/` | Connector service (FastAPI + Celery) |
| `ui/` | Admin UI for pipelines, runs, and DLQ |

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

See `api/README.md` and `ui/README.md` for deploy and env details.
