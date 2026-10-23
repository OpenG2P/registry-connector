"""HTTP clients for Connector UI metadata dropdowns.

Partners come from Partner Management admin API
(``GET {base}/partners?status=active``). Registers come from the Registry
staff API (``POST {base}/register-metadata/get_all_registers``).

Auth is optional client-credentials (or a static bearer) so the connector
can call staff APIs with a service account. When the target base URL is
blank the caller treats the source as unconfigured and the UI falls back
to free-text inputs.
"""

from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx

from ..config import Settings, get_settings

_logger = logging.getLogger("connector.metadata_client")

_token_cache: tuple[str, float, float] | None = None  # token, obtained_at, expires_in


def _reset_token_cache() -> None:
    """Test helper."""
    global _token_cache
    _token_cache = None


async def _access_token(settings: Settings) -> str | None:
    """Return a Bearer token, or None when no auth is configured."""
    global _token_cache

    static = (settings.metadata_bearer_token or "").strip()
    if static:
        return static

    token_url = (settings.metadata_token_url or "").strip()
    client_id = (settings.metadata_client_id or "").strip()
    if not token_url or not client_id:
        return None

    now = time.monotonic()
    if _token_cache is not None:
        token, obtained_at, expires_in = _token_cache
        if now - obtained_at < expires_in - 30:
            return token

    data: dict[str, str] = {
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": settings.metadata_client_secret or "",
    }
    scope = (settings.metadata_client_scope or "").strip()
    if scope:
        data["scope"] = scope

    async with httpx.AsyncClient(timeout=settings.metadata_timeout_seconds) as client:
        resp = await client.post(token_url, data=data)
        resp.raise_for_status()
        body = resp.json()

    token = body["access_token"]
    expires_in = float(body.get("expires_in", 3600))
    _token_cache = (token, now, expires_in)
    return token


async def _auth_headers(settings: Settings) -> dict[str, str]:
    token = await _access_token(settings)
    if not token:
        return {}
    return {"Authorization": f"Bearer {token}"}


def _dropdown_item(value: str, label: str | None = None) -> dict[str, str]:
    return {"value": value, "label": label or value}


async def fetch_partners(settings: Settings | None = None) -> dict[str, Any]:
    """List active partners from Partner Management.

    Response shape matches the Connector UI contract::

        {"configured": bool, "items": [{"value": "...", "label": "..."}], "error"?: str}
    """
    settings = settings or get_settings()
    base = (settings.partner_management_base_url or "").strip()
    if not base:
        return {"configured": False, "items": []}

    url = f"{base.rstrip('/')}/partners"
    try:
        headers = await _auth_headers(settings)
        async with httpx.AsyncClient(timeout=settings.metadata_timeout_seconds) as client:
            resp = await client.get(
                url,
                params={"status": "active"},
                headers=headers,
            )
            resp.raise_for_status()
            body = resp.json()
    except httpx.HTTPError:
        _logger.exception("Failed to list partners from Partner Management")
        return {"configured": True, "items": [], "error": "request_failed"}

    partners = body.get("partners") if isinstance(body, dict) else None
    if partners is None and isinstance(body, list):
        partners = body
    if not isinstance(partners, list):
        _logger.error("Unexpected partners payload: %s", type(body).__name__)
        return {"configured": True, "items": [], "error": "unexpected_payload"}

    items: list[dict[str, str]] = []
    for row in partners:
        if not isinstance(row, dict):
            continue
        partner_id = (row.get("partner_id") or "").strip()
        if not partner_id:
            continue
        name = (row.get("name") or "").strip()
        label = f"{partner_id} — {name}" if name and name != partner_id else partner_id
        items.append(_dropdown_item(partner_id, label))

    items.sort(key=lambda i: i["value"].lower())
    return {"configured": True, "items": items}


def _g2p_list_registers_body() -> dict[str, Any]:
    """Minimal G2P request envelope for staff ``get_all_registers``."""
    now = datetime.now(timezone.utc).isoformat()
    return {
        "request_header": {
            "sender_app_mnemonic": "OpenG2P Connector Service",
            "sender_app_url": "connector",
            "request_id": str(uuid.uuid4()),
            "request_timestamp": now,
        },
        "request_body": {
            "pagination_request": {
                "current_page": 1,
                "page_size": 500,
                "sort_by": "",
                "filter_by": "",
                "search_text": "",
            },
            "request_payload": {},
        },
    }


async def fetch_registers(settings: Settings | None = None) -> dict[str, Any]:
    """List register definitions from Registry staff API."""
    settings = settings or get_settings()
    base = (settings.registry_staff_api_base_url or "").strip()
    if not base:
        return {"configured": False, "items": []}

    url = f"{base.rstrip('/')}/register-metadata/get_all_registers"
    try:
        headers = await _auth_headers(settings)
        headers = {**headers, "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=settings.metadata_timeout_seconds) as client:
            resp = await client.post(url, json=_g2p_list_registers_body(), headers=headers)
            resp.raise_for_status()
            body = resp.json()
    except httpx.HTTPError:
        _logger.exception("Failed to list registers from Registry staff API")
        return {"configured": True, "items": [], "error": "request_failed"}

    if not isinstance(body, dict):
        return {"configured": True, "items": [], "error": "unexpected_payload"}

    response_header = body.get("response_header") or {}
    if response_header.get("response_status") == "ERROR":
        _logger.error(
            "Staff API get_all_registers error: %s %s",
            response_header.get("response_error_code"),
            response_header.get("response_error_message"),
        )
        return {"configured": True, "items": [], "error": "api_error"}

    response_body = body.get("response_body") or {}
    payload = response_body.get("response_payload") or []
    if not isinstance(payload, list):
        return {"configured": True, "items": [], "error": "unexpected_payload"}

    items: list[dict[str, str]] = []
    for row in payload:
        if not isinstance(row, dict):
            continue
        mnemonic = (row.get("register_mnemonic") or "").strip()
        if not mnemonic:
            continue
        subject = (row.get("register_subject") or "").strip()
        label = f"{mnemonic} — {subject}" if subject else mnemonic
        items.append(_dropdown_item(mnemonic, label))

    items.sort(key=lambda i: i["value"].lower())
    return {"configured": True, "items": items}
