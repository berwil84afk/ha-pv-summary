"""Sensoren von PV Summary."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorEntityDescription,
    SensorStateClass,
)
from homeassistant.const import (
    ATTR_UNIT_OF_MEASUREMENT,
    PERCENTAGE,
    STATE_UNAVAILABLE,
    STATE_UNKNOWN,
    UnitOfElectricPotential,
    UnitOfEnergy,
    UnitOfPower,
    UnitOfTemperature,
    UnitOfTime,
)
from homeassistant.core import Event, EventStateChangedData, HomeAssistant, State, callback
from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.event import async_track_state_change_event
from homeassistant.helpers.typing import StateType

from .const import CONF_BATTERY_SOC, CONF_BATTERY_TEMPERATURE, CONF_BATTERY_VOLTAGE, DOMAIN
from .tracker import PVTracker

if TYPE_CHECKING:
    from . import PVConfigEntry

KWH_PER_DAY = "kWh/d"


@dataclass(frozen=True, kw_only=True)
class PVSensorDescription(SensorEntityDescription):
    value_fn: Callable[[PVTracker], StateType]
    attrs_fn: Callable[[PVTracker], dict[str, Any]] | None = None
    realtime: bool = False


def _energy(key: str, data_key: str, state_class: SensorStateClass | None, **kwargs: Any) -> PVSensorDescription:
    return PVSensorDescription(
        key=key,
        translation_key=key,
        device_class=SensorDeviceClass.ENERGY,
        native_unit_of_measurement=UnitOfEnergy.KILO_WATT_HOUR,
        state_class=state_class,
        suggested_display_precision=2,
        value_fn=lambda t: round(t.data[data_key], 4),
        **kwargs,
    )


def _average(key: str, days: int | None) -> PVSensorDescription:
    return PVSensorDescription(
        key=key,
        translation_key=key,
        native_unit_of_measurement=KWH_PER_DAY,
        state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=2,
        icon="mdi:chart-line",
        value_fn=lambda t: None if (v := t.average_daily(days)) is None else round(v, 3),
    )


SENSORS: tuple[PVSensorDescription, ...] = (
    # Normalisierte Leistung der Quelle in W – Grundlage aller Berechnungen
    PVSensorDescription(
        key="power",
        translation_key="power",
        device_class=SensorDeviceClass.POWER,
        native_unit_of_measurement=UnitOfPower.WATT,
        state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=0,
        icon="mdi:solar-power",
        realtime=True,
        value_fn=lambda t: None if t.current_power is None else round(t.current_power, 1),
        attrs_fn=lambda t: {"source": t.source_entity},
    ),
    _energy("total", "total_kwh", SensorStateClass.TOTAL_INCREASING, icon="mdi:solar-power-variant"),
    _energy("today", "day_kwh", SensorStateClass.TOTAL_INCREASING, icon="mdi:solar-power"),
    _energy(
        "yesterday",
        "yesterday_kwh",
        None,
        icon="mdi:calendar-arrow-left",
        attrs_fn=lambda t: {"history": t.recent_days(30)},
    ),
    _energy("week", "week_kwh", SensorStateClass.TOTAL_INCREASING, icon="mdi:calendar-week"),
    _energy(
        "month",
        "month_kwh",
        SensorStateClass.TOTAL_INCREASING,
        icon="mdi:calendar-month",
        attrs_fn=lambda t: {"months": dict(sorted(t.data["months"].items()))},
    ),
    _energy("last_month", "last_month_kwh", None, icon="mdi:calendar-arrow-left"),
    _energy("year", "year_kwh", SensorStateClass.TOTAL_INCREASING, icon="mdi:calendar"),
    PVSensorDescription(
        key="max_power_today",
        translation_key="max_power_today",
        device_class=SensorDeviceClass.POWER,
        native_unit_of_measurement=UnitOfPower.WATT,
        state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=0,
        icon="mdi:flash-alert",
        value_fn=lambda t: round(t.data["day_max_w"], 1),
        attrs_fn=lambda t: {"time": t.data["day_max_time"]},
    ),
    PVSensorDescription(
        key="max_power_alltime",
        translation_key="max_power_alltime",
        device_class=SensorDeviceClass.POWER,
        native_unit_of_measurement=UnitOfPower.WATT,
        suggested_display_precision=0,
        icon="mdi:trophy",
        value_fn=lambda t: round(t.data["alltime_max_w"], 1),
        attrs_fn=lambda t: {"time": t.data["alltime_max_time"]},
    ),
    PVSensorDescription(
        key="avg_power_today",
        translation_key="avg_power_today",
        device_class=SensorDeviceClass.POWER,
        native_unit_of_measurement=UnitOfPower.WATT,
        state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=0,
        icon="mdi:approximately-equal",
        value_fn=lambda t: round(t.average_power_today(), 1),
    ),
    PVSensorDescription(
        key="production_time_today",
        translation_key="production_time_today",
        device_class=SensorDeviceClass.DURATION,
        native_unit_of_measurement=UnitOfTime.HOURS,
        state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=2,
        icon="mdi:timer-sun",
        value_fn=lambda t: round(t.data["day_active_s"] / 3600, 3),
    ),
    _average("avg_daily_7", 7),
    _average("avg_daily_30", 30),
    _average("avg_daily_365", 365),
    _average("avg_daily_total", None),
    PVSensorDescription(
        key="best_day",
        translation_key="best_day",
        device_class=SensorDeviceClass.ENERGY,
        native_unit_of_measurement=UnitOfEnergy.KILO_WATT_HOUR,
        suggested_display_precision=2,
        icon="mdi:medal",
        value_fn=lambda t: round(t.best_day()[0], 3),
        attrs_fn=lambda t: {"date": t.best_day()[1]},
    ),
)


def _battery_power(key: str, value_fn: Callable[[PVTracker], StateType]) -> PVSensorDescription:
    return PVSensorDescription(
        key=key,
        translation_key=key,
        device_class=SensorDeviceClass.POWER,
        native_unit_of_measurement=UnitOfPower.WATT,
        state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=0,
        realtime=True,
        value_fn=value_fn,
    )


def _charge_power(t: PVTracker) -> StateType:
    return None if t.battery_power is None else round(max(t.battery_power, 0.0), 1)


def _discharge_power(t: PVTracker) -> StateType:
    return None if t.battery_power is None else round(max(-t.battery_power, 0.0), 1)


# Nur angelegt, wenn ein Akku-Leistungssensor konfiguriert ist
BATTERY_SENSORS: tuple[PVSensorDescription, ...] = (
    _battery_power(
        "battery_power",
        lambda t: None if t.battery_power is None else round(t.battery_power, 1),
    ),
    _battery_power("battery_charge_power", _charge_power),
    _battery_power("battery_discharge_power", _discharge_power),
    _energy("battery_charged_today", "bat_charge_day_kwh", SensorStateClass.TOTAL_INCREASING, icon="mdi:battery-arrow-up"),
    _energy("battery_discharged_today", "bat_discharge_day_kwh", SensorStateClass.TOTAL_INCREASING, icon="mdi:battery-arrow-down"),
    _energy("battery_charged_total", "bat_charge_total_kwh", SensorStateClass.TOTAL_INCREASING, icon="mdi:battery-arrow-up-outline"),
    _energy("battery_discharged_total", "bat_discharge_total_kwh", SensorStateClass.TOTAL_INCREASING, icon="mdi:battery-arrow-down-outline"),
)


# Nur angelegt, wenn ein Hausverbrauchs-Sensor konfiguriert ist
HOUSE_SENSORS: tuple[PVSensorDescription, ...] = (
    PVSensorDescription(
        key="house_power",
        translation_key="house_power",
        device_class=SensorDeviceClass.POWER,
        native_unit_of_measurement=UnitOfPower.WATT,
        state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=0,
        icon="mdi:home-lightning-bolt",
        realtime=True,
        value_fn=lambda t: None if t.house_power is None else round(t.house_power, 1),
    ),
    _energy("house_today", "house_day_kwh", SensorStateClass.TOTAL_INCREASING, icon="mdi:home-lightning-bolt-outline"),
    _energy("house_total", "house_total_kwh", SensorStateClass.TOTAL_INCREASING, icon="mdi:home-lightning-bolt-outline"),
)


@dataclass(frozen=True, kw_only=True)
class PVMirrorDescription(SensorEntityDescription):
    """Sensor, der einen konfigurierten Akku-Sensor 1:1 übernimmt."""

    config_key: str


MIRROR_SENSORS: tuple[PVMirrorDescription, ...] = (
    PVMirrorDescription(
        key="battery_soc",
        translation_key="battery_soc",
        config_key=CONF_BATTERY_SOC,
        device_class=SensorDeviceClass.BATTERY,
        native_unit_of_measurement=PERCENTAGE,
        state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=0,
    ),
    PVMirrorDescription(
        key="battery_voltage",
        translation_key="battery_voltage",
        config_key=CONF_BATTERY_VOLTAGE,
        device_class=SensorDeviceClass.VOLTAGE,
        native_unit_of_measurement=UnitOfElectricPotential.VOLT,
        state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=2,
    ),
    PVMirrorDescription(
        key="battery_temperature",
        translation_key="battery_temperature",
        config_key=CONF_BATTERY_TEMPERATURE,
        device_class=SensorDeviceClass.TEMPERATURE,
        native_unit_of_measurement=UnitOfTemperature.CELSIUS,
        state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=1,
    ),
)


def _device_info(entry: PVConfigEntry, tracker: PVTracker) -> DeviceInfo:
    return DeviceInfo(
        identifiers={(DOMAIN, entry.entry_id)},
        name=entry.title,
        manufacturer="PV Summary",
        model=tracker.source_entity,
        entry_type=DeviceEntryType.SERVICE,
    )


async def async_setup_entry(
    hass: HomeAssistant,
    entry: PVConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    tracker = entry.runtime_data
    descriptions = (
        SENSORS
        + (BATTERY_SENSORS if tracker.battery_power_entity else ())
        + (HOUSE_SENSORS if tracker.house_power_entity else ())
    )
    entities: list[SensorEntity] = [PVOverviewSensor(tracker, entry, desc) for desc in descriptions]
    entities += [
        PVMirrorSensor(tracker, entry, desc, source)
        for desc in MIRROR_SENSORS
        if (source := tracker.config.get(desc.config_key))
    ]
    async_add_entities(entities)


class PVOverviewSensor(SensorEntity):
    """Ein Statistikwert der PV-Anlage."""

    entity_description: PVSensorDescription
    _attr_has_entity_name = True
    _attr_should_poll = False
    # Verlaufslisten nicht bei jeder Änderung in die Datenbank schreiben
    _unrecorded_attributes = frozenset({"history", "months"})

    def __init__(self, tracker: PVTracker, entry: PVConfigEntry, description: PVSensorDescription) -> None:
        self.entity_description = description
        self._tracker = tracker
        self._attr_unique_id = f"{entry.entry_id}_{description.key}"
        self._attr_device_info = _device_info(entry, tracker)

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(
            self._tracker.async_add_listener(
                self.async_write_ha_state, realtime=self.entity_description.realtime
            )
        )

    @property
    def native_value(self) -> StateType:
        return self.entity_description.value_fn(self._tracker)

    @property
    def extra_state_attributes(self) -> dict[str, Any] | None:
        if self.entity_description.attrs_fn is None:
            return None
        return self.entity_description.attrs_fn(self._tracker)


class PVMirrorSensor(SensorEntity):
    """Übernimmt Wert und Einheit eines Akku-Sensors, damit alles an einem Gerät hängt."""

    entity_description: PVMirrorDescription
    _attr_has_entity_name = True
    _attr_should_poll = False

    def __init__(
        self, tracker: PVTracker, entry: PVConfigEntry, description: PVMirrorDescription, source: str
    ) -> None:
        self.entity_description = description
        self._source = source
        self._attr_unique_id = f"{entry.entry_id}_{description.key}"
        self._attr_device_info = _device_info(entry, tracker)
        self._attr_extra_state_attributes = {"source": source}

    async def async_added_to_hass(self) -> None:
        self._update_from(self.hass.states.get(self._source))
        self.async_on_remove(
            async_track_state_change_event(self.hass, [self._source], self._async_source_changed)
        )

    @callback
    def _async_source_changed(self, event: Event[EventStateChangedData]) -> None:
        self._update_from(event.data["new_state"])
        self.async_write_ha_state()

    @callback
    def _update_from(self, state: State | None) -> None:
        if state is None or state.state in (STATE_UNKNOWN, STATE_UNAVAILABLE):
            self._attr_native_value = None
            return
        try:
            self._attr_native_value = float(state.state)
        except ValueError:
            self._attr_native_value = None
            return
        # Einheit der Quelle übernehmen (z. B. mV oder °F), HA rechnet bei Bedarf um
        if unit := state.attributes.get(ATTR_UNIT_OF_MEASUREMENT):
            self._attr_native_unit_of_measurement = unit
