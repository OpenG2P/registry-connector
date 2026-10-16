ARG PYTHON_IMAGE=python:3.10-slim
FROM ${PYTHON_IMAGE}

# Build from repo root:
#   docker build -f docker/registry-connector-api/Dockerfile -t openg2p/registry-connector-api:develop .

ARG CONNECTOR_PIP_EXTRAS=""

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    CONNECTOR_APP_HOST=0.0.0.0 \
    CONNECTOR_APP_PORT=8050

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends tini \
    && rm -rf /var/lib/apt/lists/*

COPY api/pyproject.toml api/README.md /app/
COPY api/src /app/src

RUN python -m pip install --upgrade pip setuptools wheel \
    && if [ -n "$CONNECTOR_PIP_EXTRAS" ]; then \
        python -m pip install ".[${CONNECTOR_PIP_EXTRAS}]"; \
    else \
        python -m pip install .; \
    fi

COPY docker/registry-connector-api/docker-entrypoint.sh /app/docker-entrypoint.sh

RUN useradd --create-home --home-dir /home/connector --shell /usr/sbin/nologin connector \
    && chmod +x /app/docker-entrypoint.sh \
    && chown -R connector:connector /app

USER connector

EXPOSE 8050

ENTRYPOINT ["/usr/bin/tini", "--", "/app/docker-entrypoint.sh"]
CMD ["api"]
