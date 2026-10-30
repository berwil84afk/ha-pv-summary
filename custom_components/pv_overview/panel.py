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
                "entities": entities,
                "batteries": [s for s in subs.values() if s["type"] == SUBENTRY_BATTERY],
                "strings": [s for s in subs.values() if s["type"] == SUBENTRY_STRING],
            }
        )
    connection.send_result(msg["id"], {"version": VERSION, "entries": entries})
