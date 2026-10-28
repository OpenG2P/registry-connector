"""Idempotent in-process schema upgrades.

We don't ship Alembic yet, so evolving columns on ``connector_definitions``
is handled here. Each step is ``ADD COLUMN IF NOT EXISTS`` so it's safe to
run on every startup and on every worker boot.

Keep this lean — anything non-trivial should graduate to a real migration
tool.
"""

import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

_logger = logging.getLogger("connector.db.migrations")

_STEPS: list[str] = [
    "ALTER TABLE connector_definitions "
    "ADD COLUMN IF NOT EXISTS g2p_sender_id VARCHAR(128)",
    "ALTER TABLE connector_definitions "
    "ADD COLUMN IF NOT EXISTS g2p_register_mnemonic VARCHAR(128)",
    "ALTER TABLE idempotency_keys "
    "ADD COLUMN IF NOT EXISTS redelivery_count INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE ingestion_runs "
    "ADD COLUMN IF NOT EXISTS redelivery_count INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE ingestion_runs "
    "ADD COLUMN IF NOT EXISTS run_payload_json TEXT",
    # Aware UTC writes failed on TIMESTAMP WITHOUT TIME ZONE (asyncpg bind error),
    # which rolled back poll commits and left last_poll_at stuck → re-ingest loops.
    """
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'connector_definitions'
          AND column_name = 'last_poll_at'
          AND data_type = 'timestamp without time zone'
      ) THEN
        ALTER TABLE connector_definitions
          ALTER COLUMN last_poll_at TYPE TIMESTAMPTZ
          USING last_poll_at AT TIME ZONE 'UTC';
      END IF;
    END $$
    """,
]


async def apply(conn: AsyncConnection) -> None:
    for stmt in _STEPS:
        try:
            await conn.execute(text(stmt))
        except Exception:
            _logger.exception("Failed DDL: %s", stmt)
            raise
