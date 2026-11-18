"""Eigenes Dashboard: Panel in der Seitenleiste plus Websocket-Befehl für die Sensorzuordnung."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import voluptuous as vol

from homeassistant.components import frontend, panel_custom, websocket_api
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import entity_registry as er

from .const import (
    CONF_BATTERY_CAPACITY,
    CONF_INVESTMENT,
    CONF_STRING_MODULES,
    CONF_THRESHOLD,
    DEFAULT_THRESHOLD,
    DOMAIN,
    PANEL_URL,
    STATIC_URL,
    SUBENTRY_BATTERY,
    SUBENTRY_STRING,
    VERSION,
)

_LOGGER = logging.getLogger(__name__)

FRONTEND_DIR = Path(__file__).parent / "frontend"


async def async_setup_panel(hass: HomeAssistant) -> None:
    """Panel einmalig registrieren (mehrere Anlagen teilen sich ein Panel)."""
    store: dict[str, Any] = hass.data.setdefault(DOMAIN, {})
    if not store.get("static_registered"):
        # Statische Pfade und Websocket-Befehle lassen sich nicht wieder abmelden
        await hass.http.async_register_static_paths(
            [StaticPathConfig(STATIC_URL, str(FRONTEND_DIR), cache_headers=False)]
        )
        websocket_api.async_register_command(hass, ws_get_config)
        websocket_api.async_register_command(hass, ws_save_layout)
        store["static_registered"] = True
    if store.get("panel_registered"):
        return
    try:
        await panel_custom.async_register_panel(
            hass,
            frontend_url_path=PANEL_URL,
            webcomponent_name="pv-summary-panel",
            sidebar_title="PV Summary",
            sidebar_icon="mdi:solar-power-variant",
            module_url=f"{STATIC_URL}/pv-summary-panel.js?v={VERSION}",
            require_admin=False,
        )
    except ValueError as err:
        # Ein fehlendes Panel darf die Sensoren nicht verhindern
        _LOGGER.warning("Dashboard-Panel '%s' konnte nicht angelegt werden: %s", PANEL_URL, err)
        return
    store["panel_registered"] = True


@callback
def async_remove_panel(hass: HomeAssistant) -> None:
    """Panel entfernen, wenn keine Anlage mehr geladen ist."""
    store: dict[str, Any] = hass.data.get(DOMAIN, {})
    if store.pop("panel_registered", False):
        frontend.async_remove_panel(hass, PANEL_URL, warn_if_unknown=False)


@websocket_api.websocket_command({vol.Required("type"): "pv_summary/config"})
@callback
def ws_get_config(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Liefert je Anlage die Zuordnung Sensor-Schlüssel → aktuelle Entity-ID."""
    registry = er.async_get(hass)
    entries = []
    for entry in hass.config_entries.async_loaded_entries(DOMAIN):
        prefix = f"{entry.entry_id}_"
        entities: dict[str, str] = {}
        # Akkus und Strings: Unter-Eintrag -> {Schlüssel: Entity-ID}
        subs: dict[str, dict[str, Any]] = {
            sub.subentry_id: {
                "id": sub.subentry_id,
                "type": sub.subentry_type,
                "title": sub.title,
                "capacity": sub.data.get(CONF_BATTERY_CAPACITY),
                "modules": int(sub.data.get(CONF_STRING_MODULES) or 1),
                "entities": {},
            }
            for sub in entry.subentries.values()
        }
        for reg_entry in er.async_entries_for_config_entry(registry, entry.entry_id):
            if reg_entry.disabled or not reg_entry.unique_id.startswith(prefix):
                continue
            key = reg_entry.unique_id.removeprefix(prefix)
            sub_id = reg_entry.config_subentry_id
            if sub_id in subs:
                subs[sub_id]["entities"][key.removeprefix(f"{sub_id}_")] = reg_entry.entity_id
            elif sub_id is None:
                entities[key] = reg_entry.entity_id
        config = {**entry.data, **entry.options}
        entries.append(
            {
                "entry_id": entry.entry_id,
                "title": entry.title,
                "threshold": config.get(CONF_THRESHOLD, DEFAULT_THRESHOLD),
                "investment": config.get(CONF_INVESTMENT),
                "layout": getattr(entry, "runtime_data", None) and entry.runtime_data.data.get("layout"),
                "currency": hass.config.currency,
                "entities": entities,
                "batteries": [s for s in subs.values() if s["type"] == SUBENTRY_BATTERY],
                "strings": [s for s in subs.values() if s["type"] == SUBENTRY_STRING],
            }
        )
    connection.send_result(msg["id"], {"version": VERSION, "entries": entries})


def _clean_layout(layout: dict[str, Any]) -> dict[str, Any]:
    """Nur bekannte Felder mit gültigen Werten übernehmen (Positionen in Breiten der Fläche: x 0 bis 1, y 0 bis 10)."""
    tiles: dict[str, dict[str, Any]] = {}
    for key, tile in list((layout.get("tiles") or {}).items())[:1000]:
        if not isinstance(key, str) or len(key) > 100 or not isinstance(tile, dict):
            continue
        try:
            x = min(max(float(tile.get("x", 0)), 0.0), 1.0)
            y = min(max(float(tile.get("y", 0)), 0.0), 10.0)
        except (TypeError, ValueError):
            continue
        tiles[key] = {"x": round(x, 4), "y": round(y, 4), "rot": bool(tile.get("rot"))}
    return {"mode": "own" if layout.get("mode") == "own" else "max", "tiles": tiles}


@websocket_api.websocket_command(
    {
        vol.Required("type"): "pv_summary/layout",
        vol.Required("entry_id"): str,
        vol.Required("layout"): dict,
    }
)
@websocket_api.require_admin
@callback
def ws_save_layout(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Anordnung der Modulansicht einer Anlage speichern (gilt für alle Geräte und Nutzer)."""
    entry = hass.config_entries.async_get_entry(msg["entry_id"])
    if entry is None or entry.domain != DOMAIN or not hasattr(entry, "runtime_data"):
        connection.send_error(msg["id"], "not_found", "PV Summary entry not found")
        return
    layout = _clean_layout(msg["layout"])
    entry.runtime_data.async_set_layout(layout)
    connection.send_result(msg["id"], {"layout": layout})
