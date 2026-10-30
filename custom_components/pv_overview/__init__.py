"""PV Summary – Statistiken aus einem einzelnen PV-Leistungssensor."""

from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import DOMAIN, STORAGE_VERSION
from .panel import async_remove_panel, async_setup_panel
from .tracker import PVTracker

PLATFORMS = [Platform.SENSOR]

type PVConfigEntry = ConfigEntry[PVTracker]


async def async_setup_entry(hass: HomeAssistant, entry: PVConfigEntry) -> bool:
    """Integration aus einem Config Entry einrichten."""
    tracker = PVTracker(hass, entry)
    await tracker.async_start()
    entry.runtime_data = tracker

    entry.async_on_unload(entry.add_update_listener(_async_update_listener))
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    await async_setup_panel(hass)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: PVConfigEntry) -> bool:
    """Config Entry entladen und Zählerstände sichern."""
    unloaded = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unloaded:
        await entry.runtime_data.async_stop()
        others = [e for e in hass.config_entries.async_loaded_entries(DOMAIN) if e.entry_id != entry.entry_id]
        if not others:
            async_remove_panel(hass)
    return unloaded


async def async_remove_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Gespeicherte Daten beim Löschen der Integration entfernen."""
    await Store(hass, STORAGE_VERSION, f"{DOMAIN}.{entry.entry_id}").async_remove()


async def _async_update_listener(hass: HomeAssistant, entry: PVConfigEntry) -> None:
    """Nach Änderung der Optionen neu laden."""
    await hass.config_entries.async_reload(entry.entry_id)
