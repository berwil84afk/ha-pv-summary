"""Config Flow für PV Summary."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult, OptionsFlow
from homeassistant.const import CONF_NAME
from homeassistant.core import callback
from homeassistant.data_entry_flow import section
from homeassistant.helpers import selector

from .const import (
    BATTERY_ENTITY_KEYS,
    CONF_BATTERY_INVERT,
    CONF_HOUSE_POWER,
    CONF_INITIAL_TOTAL,
    CONF_SOURCE,
    CONF_THRESHOLD,
    DEFAULT_NAME,
    DEFAULT_THRESHOLD,
    DOMAIN,
    SECTION_BATTERY,
)

SOURCE_SELECTOR = selector.EntitySelector(selector.EntitySelectorConfig(domain="sensor"))
THRESHOLD_SELECTOR = selector.NumberSelector(
    selector.NumberSelectorConfig(
        min=0, max=10_000, step=1, unit_of_measurement="W", mode=selector.NumberSelectorMode.BOX
    )
)


def _battery_section(config: dict[str, Any]) -> section:
    """Aufklappbarer Abschnitt mit den optionalen Akku-Sensoren."""
    fields: dict[Any, Any] = {
        vol.Optional(key, description={"suggested_value": config.get(key)}): SOURCE_SELECTOR
        for key in BATTERY_ENTITY_KEYS
    }
    fields[vol.Optional(CONF_BATTERY_INVERT, default=bool(config.get(CONF_BATTERY_INVERT)))] = (
        selector.BooleanSelector()
    )
    configured = any(config.get(key) for key in BATTERY_ENTITY_KEYS)
    return section(vol.Schema(fields), {"collapsed": not configured})


def _flatten(user_input: dict[str, Any]) -> dict[str, Any]:
    """Akku-Abschnitt in flache Werte umwandeln; leere Felder werden zu None."""
    data = {key: value for key, value in user_input.items() if key != SECTION_BATTERY}
    data[CONF_HOUSE_POWER] = user_input.get(CONF_HOUSE_POWER) or None
    battery = user_input.get(SECTION_BATTERY, {})
    for key in BATTERY_ENTITY_KEYS:
        data[key] = battery.get(key) or None
    data[CONF_BATTERY_INVERT] = bool(battery.get(CONF_BATTERY_INVERT, False))
    return data


class PVOverviewConfigFlow(ConfigFlow, domain=DOMAIN):
    """Einrichtung über die Oberfläche."""

    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            await self.async_set_unique_id(user_input[CONF_SOURCE])
            self._abort_if_unique_id_configured()
            return self.async_create_entry(title=user_input[CONF_NAME], data=_flatten(user_input))

        schema = vol.Schema(
            {
                vol.Required(CONF_NAME, default=DEFAULT_NAME): selector.TextSelector(),
                vol.Required(CONF_SOURCE): SOURCE_SELECTOR,
                vol.Optional(CONF_HOUSE_POWER): SOURCE_SELECTOR,
                vol.Required(CONF_THRESHOLD, default=DEFAULT_THRESHOLD): THRESHOLD_SELECTOR,
                vol.Required(CONF_INITIAL_TOTAL, default=0): selector.NumberSelector(
                    selector.NumberSelectorConfig(
                        min=0,
                        max=100_000_000,
                        step=0.001,
                        unit_of_measurement="kWh",
                        mode=selector.NumberSelectorMode.BOX,
                    )
                ),
                vol.Required(SECTION_BATTERY): _battery_section({}),
            }
        )
        return self.async_show_form(step_id="user", data_schema=schema)

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        return PVOverviewOptionsFlow()


class PVOverviewOptionsFlow(OptionsFlow):
    """Sensoren und Schwellwert nachträglich ändern."""

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            return self.async_create_entry(data=_flatten(user_input))

        config = {**self.config_entry.data, **self.config_entry.options}
        schema = vol.Schema(
            {
                vol.Required(CONF_SOURCE, default=config[CONF_SOURCE]): SOURCE_SELECTOR,
                vol.Optional(
                    CONF_HOUSE_POWER, description={"suggested_value": config.get(CONF_HOUSE_POWER)}
                ): SOURCE_SELECTOR,
                vol.Required(
                    CONF_THRESHOLD, default=config.get(CONF_THRESHOLD, DEFAULT_THRESHOLD)
                ): THRESHOLD_SELECTOR,
                vol.Required(SECTION_BATTERY): _battery_section(config),
            }
        )
        return self.async_show_form(step_id="init", data_schema=schema)
