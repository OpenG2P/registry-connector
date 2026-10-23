"""Read-only metadata endpoints for UI dropdowns.

These endpoints let the Connector UI populate required form fields
(``g2p_sender_id``, ``g2p_register_mnemonic``) with dropdowns sourced from
platform APIs, so users can't type a mnemonic that doesn't exist.

- Partners: Partner Management staff API
  (``GET {CONNECTOR_PARTNER_MANAGEMENT_BASE_URL}/partners?status=active``).
- Registers: Registry staff API
  (``POST {CONNECTOR_REGISTRY_STAFF_API_BASE_URL}/register-metadata/get_all_registers``).

If a base URL is blank the endpoint returns ``configured=false`` — the UI
should then degrade to a free-text input with a warning.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from ..clients.metadata_client import fetch_partners, fetch_registers
from ..config import get_settings
from ..transports import get_transport_capability, transport_registry

router = APIRouter(prefix="/metadata", tags=["metadata"])


@router.get("/partners")
async def list_partners() -> dict[str, Any]:
    """Return active partners from Partner Management.

    Response shape::

        {"configured": bool, "items": [{"value": "partner_id", "label": "..."}]}

    ``configured=false`` signals the UI that the PM base URL isn't set.
    """
    return await fetch_partners(get_settings())


@router.get("/transports")
async def list_transports() -> dict[str, Any]:
    """Return registered transports with their checkpoint capabilities.

    The UI uses this to warn operators when a connector is configured
    on a transport that cannot do strict incremental polling, and to
    display the global ``strict_incremental`` policy alongside.
    """
    settings = get_settings()
    items: list[dict[str, Any]] = []
    for name in sorted(transport_registry.keys()):
        cap = get_transport_capability(name)
        items.append(
            {
                "transport_type": name,
                "modes": [m.value for m in cap.modes],
                "default_mode": cap.default_mode.value,
                "supports_strict_incremental": cap.supports_strict_incremental,
                "notes": cap.notes,
            }
        )
    return {
        "items": items,
        "policy": {
            "strict_incremental": settings.strict_incremental,
            "full_scan_on_incremental_unsupported": settings.full_scan_on_incremental_unsupported,
        },
    }


@router.get("/registers")
async def list_registers() -> dict[str, Any]:
    """Return register definitions from Registry staff API."""
    return await fetch_registers(get_settings())
