"""Metadata dropdowns call Partner Management / Registry staff APIs."""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from openg2p_connector_service.clients import metadata_client
from openg2p_connector_service.config import Settings


@pytest.fixture(autouse=True)
def _clear_token_cache():
    metadata_client._reset_token_cache()
    yield
    metadata_client._reset_token_cache()


def _settings(**kwargs) -> Settings:
    base = {
        "partner_management_base_url": "",
        "registry_staff_api_base_url": "",
        "metadata_token_url": "",
        "metadata_client_id": "",
        "metadata_client_secret": "",
        "metadata_bearer_token": "",
        "metadata_timeout_seconds": 5.0,
    }
    base.update(kwargs)
    return Settings.model_construct(**base)


@pytest.mark.asyncio
async def test_partners_unconfigured():
    result = await metadata_client.fetch_partners(_settings())
    assert result == {"configured": False, "items": []}


@pytest.mark.asyncio
async def test_partners_from_pm_api():
    payload = {
        "count": 2,
        "partners": [
            {"partner_id": "BANK_A", "name": "Bank A", "status": "active"},
            {"partner_id": "NGO_B", "name": "NGO_B", "status": "active"},
        ],
    }
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = payload

    mock_client = AsyncMock()
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = None
    mock_client.get = AsyncMock(return_value=mock_resp)

    with patch("openg2p_connector_service.clients.metadata_client.httpx.AsyncClient", return_value=mock_client):
        result = await metadata_client.fetch_partners(
            _settings(
                partner_management_base_url="http://pm.example",
                metadata_bearer_token="tok",
            )
        )

    assert result["configured"] is True
    assert result["items"] == [
        {"value": "BANK_A", "label": "BANK_A — Bank A"},
        {"value": "NGO_B", "label": "NGO_B"},
    ]
    mock_client.get.assert_awaited_once()
    args, kwargs = mock_client.get.await_args
    assert args[0] == "http://pm.example/partners"
    assert kwargs["params"] == {"status": "active"}
    assert kwargs["headers"]["Authorization"] == "Bearer tok"


@pytest.mark.asyncio
async def test_partners_http_error():
    mock_client = AsyncMock()
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = None
    mock_client.get = AsyncMock(side_effect=httpx.ConnectError("down"))

    with patch("openg2p_connector_service.clients.metadata_client.httpx.AsyncClient", return_value=mock_client):
        result = await metadata_client.fetch_partners(
            _settings(partner_management_base_url="http://pm.example")
        )

    assert result == {"configured": True, "items": [], "error": "request_failed"}


@pytest.mark.asyncio
async def test_registers_from_staff_api():
    payload = {
        "response_header": {"response_status": "SUCCESS"},
        "response_body": {
            "response_payload": [
                {"register_mnemonic": "Farmer", "register_subject": "Farmer"},
                {"register_mnemonic": "Household", "register_subject": ""},
            ]
        },
    }
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = payload

    mock_client = AsyncMock()
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = None
    mock_client.post = AsyncMock(return_value=mock_resp)

    with patch("openg2p_connector_service.clients.metadata_client.httpx.AsyncClient", return_value=mock_client):
        result = await metadata_client.fetch_registers(
            _settings(registry_staff_api_base_url="http://staff.example")
        )

    assert result["configured"] is True
    assert result["items"] == [
        {"value": "Farmer", "label": "Farmer — Farmer"},
        {"value": "Household", "label": "Household"},
    ]
    args, kwargs = mock_client.post.await_args
    assert args[0] == "http://staff.example/register-metadata/get_all_registers"
    assert "request_header" in kwargs["json"]


@pytest.mark.asyncio
async def test_meta_partners_endpoint(app_client, monkeypatch):
    async def _fake(_settings=None):
        return {
            "configured": True,
            "items": [{"value": "P1", "label": "P1"}],
        }

    monkeypatch.setattr(
        "openg2p_connector_service.controllers.metadata.fetch_partners",
        _fake,
    )
    resp = await app_client.get("/metadata/partners")
    assert resp.status_code == 200
    assert resp.json()["items"][0]["value"] == "P1"
