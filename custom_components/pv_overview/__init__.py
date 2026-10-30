"""PV Summary – Statistiken aus einem einzelnen PV-Leistungssensor."""

from __future__ import annotations

from types import MappingProxyType

from homeassistant.config_entries import ConfigEntry, ConfigSubentry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.storage import Store

from .const import (
    BATTERY_ENTITY_KEYS,
    CONF_BATTERY_CAPACITY,
    CONF_BATTERY_INVERT,
    DOMAIN,
    STORAGE_VERSION,
    SUBENTRY_BATTERY,
)
from .panel import async_remove_panel, async_setup_panel
from .tracker import PVTracker

PLATFORMS = [Platform.SENSOR]
LEGACY_BATTERY_KEYS = (*BATTERY_ENTITY_KEYS, CONF_BATTERY_INVERT)

type PVConfigEntry = ConfigEntry[PVTracker]


async def async_setup_entry(hass: HomeAssistant, entry: PVConfigEntry) -> bool:
    """Integration aus einem Config Entry einrichten."""
    _async_migrate_battery(hass, entry)

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
    """Nach Änderung der Optionen oder der Akkus/Strings neu laden."""
    await hass.config_entries.async_reload(entry.entry_id)


@callback
def _async_migrate_battery(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Bis v1.5 stand ein Akku direkt in der Integration; seit v1.6 ist jeder Akku ein Unter-Eintrag."""
    legacy = {**entry.data, **entry.options}
    if not any(key in entry.data or key in entry.options for key in LEGACY_BATTERY_KEYS):
        return
    has_battery = any(sub.subentry_type == SUBENTRY_BATTERY for sub in entry.subentries.values())
    if not has_battery and any(legacy.get(key) for key in BATTERY_ENTITY_KEYS):
        battery = {key: legacy.get(key) or None for key in BATTERY_ENTITY_KEYS}
        battery[CONF_BATTERY_INVERT] = bool(legacy.get(CONF_BATTERY_INVERT))
        battery[CONF_BATTERY_CAPACITY] = None
        hass.config_entries.async_add_subentry(
            entry,
            ConfigSubentry(
                data=MappingProxyType(battery), subentry_type=SUBENTRY_BATTERY, title="Akku", unique_id=None
            ),
        )
    hass.config_entries.async_update_entry(
        entry,
        data={k: v for k, v in entry.data.items() if k not in LEGACY_BATTERY_KEYS},
        options={k: v for k, v in entry.options.items() if k not in LEGACY_BATTERY_KEYS},
    )
    # Spannung und Temperatur gibt es jetzt je Akku, nicht mehr an der Anlage
    registry = er.async_get(hass)
    for key in ("battery_voltage", "battery_temperature"):
        if entity_id := registry.async_get_entity_id("sensor", DOMAIN, f"{entry.entry_id}_{key}"):
            registry.async_remove(entity_id)
