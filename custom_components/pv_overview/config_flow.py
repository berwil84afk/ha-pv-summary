"""Config Flow für PV Summary."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.config_entries import (
    ConfigEntry,
    ConfigFlow,
    ConfigFlowResult,
    ConfigSubentryFlow,
    OptionsFlow,
    SubentryFlowResult,
)
from homeassistant.const import CONF_NAME
from homeassistant.core import callback
from homeassistant.helpers import selector

from .const import (
    CONF_BATTERY_CAPACITY,
    CONF_BATTERY_INVERT,
    CONF_BATTERY_POWER,
    CONF_BATTERY_SOC,
    CONF_BATTERY_TEMPERATURE,
    CONF_BATTERY_VOLTAGE,
    CONF_GRID_INVERT,
    CONF_GRID_POWER,
    CONF_HOUSE_POWER,
    CONF_INITIAL_TOTAL,
    CONF_SOURCE,
    CONF_STRING_CURRENT,
    CONF_STRING_POWER,
    CONF_STRING_VOLTAGE,
    CONF_THRESHOLD,
    DEFAULT_NAME,
    DEFAULT_THRESHOLD,
    DOMAIN,
    GRID_MIGRATED,
    SUBENTRY_BATTERY,
    SUBENTRY_STRING,
)

SOURCE_SELECTOR = selector.EntitySelector(selector.EntitySelectorConfig(domain="sensor"))
THRESHOLD_SELECTOR = selector.NumberSelector(
    selector.NumberSelectorConfig(
        min=0, max=10_000, step=1, unit_of_measurement="W", mode=selector.NumberSelectorMode.BOX
    )
)
CAPACITY_SELECTOR = selector.NumberSelector(
    selector.NumberSelectorConfig(
        min=0, max=1000, step=0.1, unit_of_measurement="kWh", mode=selector.NumberSelectorMode.BOX
    )
)


def _optional(key: str, config: dict[str, Any]) -> vol.Optional:
    """Optionales Feld, das den bisherigen Wert vorschlägt, sich aber leeren lässt."""
    return vol.Optional(key, description={"suggested_value": config.get(key)})


def _clean(user_input: dict[str, Any], keys: tuple[str, ...]) -> dict[str, Any]:
    """Leere optionale Felder als None speichern, damit Leeren einen Sensor wirklich entfernt."""
    data = dict(user_input)
    for key in keys:
        data[key] = user_input.get(key) or None
    return data


class PVOverviewConfigFlow(ConfigFlow, domain=DOMAIN):
    """Einrichtung über die Oberfläche."""

    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            await self.async_set_unique_id(user_input[CONF_SOURCE])
            self._abort_if_unique_id_configured()
            data = _clean(user_input, (CONF_GRID_POWER, CONF_HOUSE_POWER))
            data[GRID_MIGRATED] = True
            return self.async_create_entry(title=user_input[CONF_NAME], data=data)

        schema = vol.Schema(
            {
                vol.Required(CONF_NAME, default=DEFAULT_NAME): selector.TextSelector(),
                vol.Required(CONF_SOURCE): SOURCE_SELECTOR,
                vol.Optional(CONF_GRID_POWER): SOURCE_SELECTOR,
                vol.Optional(CONF_GRID_INVERT, default=False): selector.BooleanSelector(),
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
            }
        )
        return self.async_show_form(step_id="user", data_schema=schema)

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        return PVOverviewOptionsFlow()

    @classmethod
    @callback
    def async_get_supported_subentry_types(
        cls, config_entry: ConfigEntry
    ) -> dict[str, type[ConfigSubentryFlow]]:
        """Akkus und Strings werden als eigene Einträge an der Integration angelegt."""
        return {SUBENTRY_BATTERY: BatterySubentryFlow, SUBENTRY_STRING: StringSubentryFlow}


class PVOverviewOptionsFlow(OptionsFlow):
    """Quelle, Netz, Hausverbrauch und Schwellwert nachträglich ändern."""

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            return self.async_create_entry(data=_clean(user_input, (CONF_GRID_POWER, CONF_HOUSE_POWER)))

        config = {**self.config_entry.data, **self.config_entry.options}
        schema = vol.Schema(
            {
                vol.Required(CONF_SOURCE, default=config[CONF_SOURCE]): SOURCE_SELECTOR,
                _optional(CONF_GRID_POWER, config): SOURCE_SELECTOR,
                vol.Optional(CONF_GRID_INVERT, default=bool(config.get(CONF_GRID_INVERT))): selector.BooleanSelector(),
                _optional(CONF_HOUSE_POWER, config): SOURCE_SELECTOR,
                vol.Required(
                    CONF_THRESHOLD, default=config.get(CONF_THRESHOLD, DEFAULT_THRESHOLD)
                ): THRESHOLD_SELECTOR,
            }
        )
        return self.async_show_form(step_id="init", data_schema=schema)


class _BaseSubentryFlow(ConfigSubentryFlow):
    """Gemeinsamer Ablauf für Anlegen und Bearbeiten eines Akkus oder Strings."""

    default_title: str
    optional_keys: tuple[str, ...]

    def _schema(self, config: dict[str, Any]) -> vol.Schema:
        raise NotImplementedError

    def _data(self, user_input: dict[str, Any]) -> dict[str, Any]:
        data = _clean(user_input, self.optional_keys)
        data.pop(CONF_NAME, None)
        return data

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> SubentryFlowResult:
        if user_input is not None:
            return self.async_create_entry(title=user_input[CONF_NAME], data=self._data(user_input))
        return self.async_show_form(step_id="user", data_schema=self._schema({CONF_NAME: self.default_title}))

    async def async_step_reconfigure(self, user_input: dict[str, Any] | None = None) -> SubentryFlowResult:
        subentry = self._get_reconfigure_subentry()
        if user_input is not None:
            # Das Update löst über den Update-Listener ein Neuladen der Integration aus
            return self.async_update_and_abort(
                self._get_entry(), subentry, title=user_input[CONF_NAME], data=self._data(user_input)
            )
        return self.async_show_form(
            step_id="reconfigure", data_schema=self._schema({CONF_NAME: subentry.title, **subentry.data})
        )


class BatterySubentryFlow(_BaseSubentryFlow):
    """Akku hinzufügen oder bearbeiten."""

    default_title = "Akku"
    optional_keys = (
        CONF_BATTERY_SOC,
        CONF_BATTERY_VOLTAGE,
        CONF_BATTERY_TEMPERATURE,
        CONF_BATTERY_POWER,
        CONF_BATTERY_CAPACITY,
    )

    def _schema(self, config: dict[str, Any]) -> vol.Schema:
        return vol.Schema(
            {
                vol.Required(CONF_NAME, default=config.get(CONF_NAME)): selector.TextSelector(),
                _optional(CONF_BATTERY_SOC, config): SOURCE_SELECTOR,
                _optional(CONF_BATTERY_POWER, config): SOURCE_SELECTOR,
                vol.Optional(CONF_BATTERY_INVERT, default=bool(config.get(CONF_BATTERY_INVERT))): selector.BooleanSelector(),
                _optional(CONF_BATTERY_CAPACITY, config): CAPACITY_SELECTOR,
                _optional(CONF_BATTERY_VOLTAGE, config): SOURCE_SELECTOR,
                _optional(CONF_BATTERY_TEMPERATURE, config): SOURCE_SELECTOR,
            }
        )


class StringSubentryFlow(_BaseSubentryFlow):
    """PV-String hinzufügen oder bearbeiten."""

    default_title = "String 1"
    optional_keys = (CONF_STRING_VOLTAGE, CONF_STRING_CURRENT)

    def _schema(self, config: dict[str, Any]) -> vol.Schema:
        return vol.Schema(
            {
                vol.Required(CONF_NAME, default=config.get(CONF_NAME)): selector.TextSelector(),
                vol.Required(CONF_STRING_POWER, description={"suggested_value": config.get(CONF_STRING_POWER)}): SOURCE_SELECTOR,
                _optional(CONF_STRING_VOLTAGE, config): SOURCE_SELECTOR,
                _optional(CONF_STRING_CURRENT, config): SOURCE_SELECTOR,
            }
        )
