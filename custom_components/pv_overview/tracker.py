"""Erfasst die PV-Leistung, integriert sie zu Energie und führt Statistiken."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, datetime, timedelta
import logging
from typing import TYPE_CHECKING, Any

from homeassistant.const import (
    ATTR_UNIT_OF_MEASUREMENT,
    STATE_UNAVAILABLE,
    STATE_UNKNOWN,
)
from homeassistant.core import Event, EventStateChangedData, HomeAssistant, State, callback
from homeassistant.helpers.event import (
    async_track_state_change_event,
    async_track_time_change,
    async_track_time_interval,
)
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

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
    DEFAULT_THRESHOLD,
    DOMAIN,
    HISTORY_DAYS,
    HISTORY_MONTHS,
    SAVE_DELAY,
    STORAGE_VERSION,
    SUBENTRY_BATTERY,
    SUBENTRY_STRING,
    UPDATE_INTERVAL,
)

if TYPE_CHECKING:
    from homeassistant.config_entries import ConfigEntry

_LOGGER = logging.getLogger(__name__)

UNIT_FACTORS = {"W": 1.0, "kW": 1_000.0, "MW": 1_000_000.0}
PERIOD_KEYS = ("total_kwh", "day_kwh", "week_kwh", "month_kwh", "year_kwh")
EXTRA_DAY_KEYS = (
    "bat_charge_day_kwh",
    "bat_discharge_day_kwh",
    "house_day_kwh",
    "grid_import_day_kwh",
    "grid_export_day_kwh",
)


def _default_data(initial_total: float) -> dict[str, Any]:
    return {
        "total_kwh": initial_total,
        "day_kwh": 0.0,
        "week_kwh": 0.0,
        "month_kwh": 0.0,
        "year_kwh": 0.0,
        "yesterday_kwh": 0.0,
        "last_month_kwh": 0.0,
        "day_max_w": 0.0,
        "day_max_time": None,
        "alltime_max_w": 0.0,
        "alltime_max_time": None,
        "day_active_s": 0.0,
        "best_day_kwh": 0.0,
        "best_day_date": None,
        "completed_days": 0,
        "completed_kwh": 0.0,
        "date": None,
        "start_date": None,
        "history": {},  # "YYYY-MM-DD" -> kWh
        "months": {},  # "YYYY-MM" -> kWh
        # Summe aller Akkus
        "bat_charge_day_kwh": 0.0,
        "bat_discharge_day_kwh": 0.0,
        "bat_charge_total_kwh": 0.0,
        "bat_discharge_total_kwh": 0.0,
        "house_day_kwh": 0.0,
        "house_total_kwh": 0.0,
        "grid_import_day_kwh": 0.0,
        "grid_import_total_kwh": 0.0,
        "grid_export_day_kwh": 0.0,
        "grid_export_total_kwh": 0.0,
        # Je Unter-Eintrag: subentry_id -> Zähler
        "batteries": {},
        "strings": {},
    }


def _parse_watts(state: State | None) -> float | None:
    """Zustand eines Leistungssensors in Watt umrechnen (None = kein gültiger Wert)."""
    if state is None or state.state in (STATE_UNKNOWN, STATE_UNAVAILABLE):
        return None
    try:
        value = float(state.state)
    except ValueError:
        return None
    return value * UNIT_FACTORS.get(state.attributes.get(ATTR_UNIT_OF_MEASUREMENT), 1.0)


def _parse_power(state: State | None) -> float | None:
    """PV-Leistung in W; manche Wechselrichter melden nachts leicht negative Werte."""
    power = _parse_watts(state)
    return None if power is None else max(power, 0.0)


def _parse_float(state: State | None) -> float | None:
    if state is None or state.state in (STATE_UNKNOWN, STATE_UNAVAILABLE):
        return None
    try:
        return float(state.state)
    except ValueError:
        return None


@dataclass
class Battery:
    """Ein Akku aus einem Unter-Eintrag; Leistung in W, positiv = Laden."""

    sub_id: str
    title: str
    power_entity: str | None
    soc_entity: str | None
    voltage_entity: str | None
    temperature_entity: str | None
    capacity: float | None
    sign: float = 1.0
    power: float | None = None
    last_time: datetime | None = None


@dataclass
class PVString:
    """Ein PV-String aus einem Unter-Eintrag."""

    sub_id: str
    title: str
    power_entity: str
    voltage_entity: str | None
    current_entity: str | None
    power: float | None = None
    last_time: datetime | None = None


class PVTracker:
    """Hält alle Zähler und benachrichtigt die Sensoren."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass = hass
        self.config: dict[str, Any] = {**entry.data, **entry.options}
        config = self.config
        self.source_entity: str = config[CONF_SOURCE]
        self.threshold = float(config.get(CONF_THRESHOLD, DEFAULT_THRESHOLD))
        self.data = _default_data(float(entry.data.get(CONF_INITIAL_TOTAL, 0.0)))
        self.current_power: float | None = None

        self.batteries: dict[str, Battery] = {}
        self.strings: dict[str, PVString] = {}
        for sub in entry.subentries.values():
            if sub.subentry_type == SUBENTRY_BATTERY:
                self.batteries[sub.subentry_id] = Battery(
                    sub_id=sub.subentry_id,
                    title=sub.title,
                    power_entity=sub.data.get(CONF_BATTERY_POWER),
                    soc_entity=sub.data.get(CONF_BATTERY_SOC),
                    voltage_entity=sub.data.get(CONF_BATTERY_VOLTAGE),
                    temperature_entity=sub.data.get(CONF_BATTERY_TEMPERATURE),
                    capacity=sub.data.get(CONF_BATTERY_CAPACITY) or None,
                    sign=-1.0 if sub.data.get(CONF_BATTERY_INVERT) else 1.0,
                )
            elif sub.subentry_type == SUBENTRY_STRING:
                self.strings[sub.subentry_id] = PVString(
                    sub_id=sub.subentry_id,
                    title=sub.title,
                    power_entity=sub.data[CONF_STRING_POWER],
                    voltage_entity=sub.data.get(CONF_STRING_VOLTAGE),
                    current_entity=sub.data.get(CONF_STRING_CURRENT),
                )

        # Netz am Zähler (positiv = Bezug) und optional gemessener Hausverbrauch, beide in W
        self.grid_power_entity: str | None = config.get(CONF_GRID_POWER)
        self._grid_sign = -1.0 if config.get(CONF_GRID_INVERT) else 1.0
        self.grid_measured: float | None = None
        self.house_power_entity: str | None = config.get(CONF_HOUSE_POWER)
        self.house_measured: float | None = None
        # Zeitpunkt der letzten Integration von Haus und Netz (beide können berechnet sein)
        self._balance_last_time: datetime | None = None

        self._store: Store[dict[str, Any]] = Store(
            hass, STORAGE_VERSION, f"{DOMAIN}.{entry.entry_id}"
        )
        self._last_time: datetime | None = None
        self._listeners: list[Callable[[], None]] = []
        self._realtime_listeners: list[Callable[[], None]] = []
        self._unsubs: list[Callable[[], None]] = []
        # Entity-ID der Quelle -> Funktion, die den neuen Zustand übernimmt
        self._setters: dict[str, Callable[[State | None, datetime], None]] = {}

    @property
    def has_battery_power(self) -> bool:
        return any(b.power_entity for b in self.batteries.values())

    @property
    def has_battery_soc(self) -> bool:
        return any(b.soc_entity for b in self.batteries.values())

    # ------------------------------------------------------------------ Lifecycle

    async def async_start(self) -> None:
        if stored := await self._store.async_load():
            self.data.update(stored)
        for sub_id in self.batteries:
            self.data["batteries"].setdefault(sub_id, {"charge_day": 0.0, "discharge_day": 0.0, "charge_total": 0.0, "discharge_total": 0.0})
        for sub_id in self.strings:
            self.data["strings"].setdefault(sub_id, {"day": 0.0, "total": 0.0})
        # Zähler gelöschter Akkus/Strings verwerfen
        for key, known in (("batteries", self.batteries), ("strings", self.strings)):
            for sub_id in list(self.data[key]):
                if sub_id not in known:
                    del self.data[key][sub_id]

        today = dt_util.now().date().isoformat()
        if self.data["date"] is None:
            # Erster Start: der heutige Tag ist unvollständig und zählt nicht in Durchschnitte
            self.data["date"] = self.data["start_date"] = today
        self._check_rollover(dt_util.now())

        self._setters[self.source_entity] = self._set_power
        if self.grid_power_entity:
            self._setters[self.grid_power_entity] = self._set_grid_power
        if self.house_power_entity:
            self._setters[self.house_power_entity] = self._set_house_power
        for battery in self.batteries.values():
            if battery.power_entity:
                self._setters[battery.power_entity] = self._battery_setter(battery)
        for pv_string in self.strings.values():
            self._setters[pv_string.power_entity] = self._string_setter(pv_string)

        now = dt_util.utcnow()
        for entity_id, setter in self._setters.items():
            setter(self.hass.states.get(entity_id), now)

        self._unsubs = [
            async_track_state_change_event(
                self.hass, list(self._setters), self._async_source_changed
            ),
            async_track_time_interval(self.hass, self._async_tick, UPDATE_INTERVAL),
            async_track_time_change(
                self.hass, self._async_tick, hour=0, minute=0, second=0
            ),
        ]

    async def async_stop(self) -> None:
        for unsub in self._unsubs:
            unsub()
        self._unsubs.clear()
        self._integrate(dt_util.utcnow())
        await self._store.async_save(self.data)

    @callback
    def async_add_listener(
        self, listener: Callable[[], None], realtime: bool = False
    ) -> Callable[[], None]:
        """Listener registrieren; realtime = zusätzlich bei jeder Änderung einer Quelle."""
        listeners = self._realtime_listeners if realtime else self._listeners
        listeners.append(listener)

        @callback
        def remove() -> None:
            listeners.remove(listener)

        return remove

    # ------------------------------------------------------------------ Events

    @callback
    def _async_source_changed(self, event: Event[EventStateChangedData]) -> None:
        setter = self._setters.get(event.data["entity_id"])
        if setter is None:
            return
        now = dt_util.utcnow()
        self._integrate(now)
        setter(event.data["new_state"], now)
        for listener in list(self._realtime_listeners):
            listener()

    @callback
    def _async_tick(self, _now: datetime) -> None:
        self._integrate(dt_util.utcnow())
        self._store.async_delay_save(lambda: self.data, SAVE_DELAY)
        for listener in self._realtime_listeners + self._listeners:
            listener()

    # ------------------------------------------------------------------ Berechnung

    @callback
    def _integrate(self, now: datetime) -> None:
        """Energie seit dem letzten Messpunkt aufaddieren (Leistung bleibt bis zur nächsten Änderung konstant)."""
        if self.current_power is not None and self._last_time is not None:
            seconds = (now - self._last_time).total_seconds()
            if seconds > 0:
                kwh = self.current_power * seconds / 3_600_000
                for key in PERIOD_KEYS:
                    self.data[key] += kwh
                if self.current_power >= self.threshold:
                    self.data["day_active_s"] += seconds
            self._last_time = now
        for battery in self.batteries.values():
            if battery.power is not None and battery.last_time is not None:
                seconds = (now - battery.last_time).total_seconds()
                if seconds > 0 and battery.power != 0:
                    kwh = abs(battery.power) * seconds / 3_600_000
                    kind = "charge" if battery.power > 0 else "discharge"
                    own = self.data["batteries"][battery.sub_id]
                    own[f"{kind}_day"] += kwh
                    own[f"{kind}_total"] += kwh
                    self.data[f"bat_{kind}_day_kwh"] += kwh
                    self.data[f"bat_{kind}_total_kwh"] += kwh
                battery.last_time = now
        for pv_string in self.strings.values():
            if pv_string.power is not None and pv_string.last_time is not None:
                seconds = (now - pv_string.last_time).total_seconds()
                if seconds > 0:
                    kwh = pv_string.power * seconds / 3_600_000
                    own = self.data["strings"][pv_string.sub_id]
                    own["day"] += kwh
                    own["total"] += kwh
                pv_string.last_time = now
        # Haus und Netz: der Wert seit dem letzten Aufruf gilt bis jetzt (er ändert sich nur mit einer Quelle)
        if self._balance_last_time is not None:
            seconds = (now - self._balance_last_time).total_seconds()
            if seconds > 0:
                if (house := self.house_power) is not None:
                    kwh = house * seconds / 3_600_000
                    self.data["house_day_kwh"] += kwh
                    self.data["house_total_kwh"] += kwh
                if self.grid_power_entity and (grid := self.grid_power) is not None:
                    kind = "import" if grid > 0 else "export"
                    kwh = abs(grid) * seconds / 3_600_000
                    self.data[f"grid_{kind}_day_kwh"] += kwh
                    self.data[f"grid_{kind}_total_kwh"] += kwh
        self._balance_last_time = now
        self._check_rollover(dt_util.as_local(now))

    def _battery_setter(self, battery: Battery) -> Callable[[State | None, datetime], None]:
        @callback
        def setter(state: State | None, now: datetime) -> None:
            power = _parse_watts(state)
            battery.power = None if power is None else power * battery.sign
            battery.last_time = now if power is not None else None

        return setter

    def _string_setter(self, pv_string: PVString) -> Callable[[State | None, datetime], None]:
        @callback
        def setter(state: State | None, now: datetime) -> None:
            pv_string.power = _parse_power(state)
            pv_string.last_time = now if pv_string.power is not None else None

        return setter

    @callback
    def _set_house_power(self, state: State | None, now: datetime) -> None:
        self.house_measured = _parse_power(state)

    @callback
    def _set_grid_power(self, state: State | None, now: datetime) -> None:
        power = _parse_watts(state)
        self.grid_measured = None if power is None else power * self._grid_sign

    @callback
    def _set_power(self, state: State | None, now: datetime) -> None:
        power = _parse_power(state)
        self.current_power = power
        # Bei ungültigem Wert wird nicht über die Lücke integriert
        self._last_time = now if power is not None else None
        if power is None:
            return
        stamp = dt_util.as_local(now).isoformat()
        if power > self.data["day_max_w"]:
            self.data["day_max_w"] = power
            self.data["day_max_time"] = stamp
        if power > self.data["alltime_max_w"]:
            self.data["alltime_max_w"] = power
            self.data["alltime_max_time"] = stamp

    @callback
    def _check_rollover(self, now_local: datetime) -> None:
        """Tages-, Wochen-, Monats- und Jahreszähler beim Datumswechsel abschließen."""
        today = now_local.date()
        current = date.fromisoformat(self.data["date"])
        if today <= current:
            return

        data = self.data
        day_kwh = round(data["day_kwh"], 4)
        key = current.isoformat()

        history: dict[str, float] = data["history"]
        history[key] = day_kwh
        for old in sorted(history)[:-HISTORY_DAYS]:
            del history[old]

        if key != data["start_date"]:
            data["completed_days"] += 1
            data["completed_kwh"] += day_kwh
        if day_kwh > data["best_day_kwh"]:
            data["best_day_kwh"] = day_kwh
            data["best_day_date"] = key

        yesterday = (today - timedelta(days=1)).isoformat()
        data["yesterday_kwh"] = history.get(yesterday, 0.0)

        data["day_kwh"] = 0.0
        data["day_max_w"] = 0.0
        data["day_max_time"] = None
        data["day_active_s"] = 0.0
        for extra_key in EXTRA_DAY_KEYS:
            data[extra_key] = 0.0
        for own in data["batteries"].values():
            own["charge_day"] = own["discharge_day"] = 0.0
        for own in data["strings"].values():
            own["day"] = 0.0

        if today.isocalendar()[:2] != current.isocalendar()[:2]:
            data["week_kwh"] = 0.0
        if (today.year, today.month) != (current.year, current.month):
            months: dict[str, float] = data["months"]
            month_kwh = round(data["month_kwh"], 3)
            months[current.strftime("%Y-%m")] = month_kwh
            for old in sorted(months)[:-HISTORY_MONTHS]:
                del months[old]
            data["last_month_kwh"] = month_kwh
            data["month_kwh"] = 0.0
        if today.year != current.year:
            data["year_kwh"] = 0.0

        data["date"] = today.isoformat()
        _LOGGER.debug("Tageswechsel %s -> %s, Tagesproduktion %.3f kWh", current, today, day_kwh)

    # ------------------------------------------------------------------ Auswertungen

    def average_daily(self, days: int | None) -> float | None:
        """Ø Tagesproduktion über die letzten `days` abgeschlossenen Tage (None = seit Beginn)."""
        if days is None:
            if not self.data["completed_days"]:
                return None
            return self.data["completed_kwh"] / self.data["completed_days"]

        today = dt_util.now().date()
        values = [
            kwh
            for day, kwh in self.data["history"].items()
            if day != self.data["start_date"]
            and 1 <= (today - date.fromisoformat(day)).days <= days
        ]
        return sum(values) / len(values) if values else None

    def average_power_today(self) -> float:
        """Ø Leistung während der heutigen Produktionszeit in W."""
        hours = self.data["day_active_s"] / 3600
        if hours < 1 / 60:
            return 0.0
        return self.data["day_kwh"] * 1000 / hours

    @property
    def battery_power(self) -> float | None:
        """Summe aller Akkus in W (positiv = Laden), None wenn kein Akku einen Wert liefert."""
        values = [b.power for b in self.batteries.values() if b.power is not None]
        return sum(values) if values else None

    def battery_soc(self) -> float | None:
        """Gemeinsamer Akkustand in %: nach Kapazität gewichtet, sonst einfacher Durchschnitt."""
        values: list[tuple[float, float | None]] = []
        for battery in self.batteries.values():
            if battery.soc_entity and (soc := _parse_float(self.hass.states.get(battery.soc_entity))) is not None:
                values.append((soc, battery.capacity))
        if not values:
            return None
        if all(capacity for _, capacity in values):
            total = sum(capacity for _, capacity in values)
            return sum(soc * capacity for soc, capacity in values) / total
        return sum(soc for soc, _ in values) / len(values)

    @property
    def has_balance(self) -> bool:
        """Haus und Netz lassen sich bestimmen (Netz-Zähler oder Hausverbrauch eingetragen)."""
        return bool(self.grid_power_entity or self.house_power_entity)

    @property
    def house_power(self) -> float | None:
        """Hausverbrauch in W: gemessen, sonst PV + Netz − Akku (Akku positiv = Laden)."""
        if self.house_measured is not None:
            return self.house_measured
        if self.grid_measured is None or self.current_power is None:
            return None
        return max(self.current_power + self.grid_measured - (self.battery_power or 0.0), 0.0)

    @property
    def grid_power(self) -> float | None:
        """Netzleistung in W: positiv = Bezug, negativ = Einspeisung. Gemessen, sonst Haus + Akku − PV."""
        if self.grid_measured is not None:
            return self.grid_measured
        if self.house_measured is None or self.current_power is None:
            return None
        return self.house_measured + (self.battery_power or 0.0) - self.current_power

    def best_day(self) -> tuple[float, str | None]:
        """Bester Tag inklusive des laufenden Tages."""
        if self.data["day_kwh"] > self.data["best_day_kwh"]:
            return self.data["day_kwh"], self.data["date"]
        return self.data["best_day_kwh"], self.data["best_day_date"]

    def recent_days(self, days: int = 30) -> dict[str, float]:
        history = self.data["history"]
        return {day: history[day] for day in sorted(history)[-days:]}
