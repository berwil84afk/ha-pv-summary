"""Erfasst die PV-Leistung, integriert sie zu Energie und führt Statistiken."""

from __future__ import annotations

from collections.abc import Callable
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
    CONF_BATTERY_INVERT,
    CONF_BATTERY_POWER,
    CONF_HOUSE_POWER,
    CONF_INITIAL_TOTAL,
    CONF_SOURCE,
    CONF_THRESHOLD,
    DEFAULT_THRESHOLD,
    DOMAIN,
    HISTORY_DAYS,
    HISTORY_MONTHS,
    SAVE_DELAY,
    STORAGE_VERSION,
    UPDATE_INTERVAL,
)

if TYPE_CHECKING:
    from homeassistant.config_entries import ConfigEntry

_LOGGER = logging.getLogger(__name__)

UNIT_FACTORS = {"W": 1.0, "kW": 1_000.0, "MW": 1_000_000.0}
PERIOD_KEYS = ("total_kwh", "day_kwh", "week_kwh", "month_kwh", "year_kwh")
EXTRA_DAY_KEYS = ("bat_charge_day_kwh", "bat_discharge_day_kwh", "house_day_kwh")


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
        "bat_charge_day_kwh": 0.0,
        "bat_discharge_day_kwh": 0.0,
        "bat_charge_total_kwh": 0.0,
        "bat_discharge_total_kwh": 0.0,
        "house_day_kwh": 0.0,
        "house_total_kwh": 0.0,
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

        # Akku: Leistung in W, positiv = Laden
        self.battery_power_entity: str | None = config.get(CONF_BATTERY_POWER)
        self._battery_sign = -1.0 if config.get(CONF_BATTERY_INVERT) else 1.0
        self.battery_power: float | None = None
        self._battery_last_time: datetime | None = None

        # Hausverbrauch in W
        self.house_power_entity: str | None = config.get(CONF_HOUSE_POWER)
        self.house_power: float | None = None
        self._house_last_time: datetime | None = None

        self._store: Store[dict[str, Any]] = Store(
            hass, STORAGE_VERSION, f"{DOMAIN}.{entry.entry_id}"
        )
        self._last_time: datetime | None = None
        self._listeners: list[Callable[[], None]] = []
        self._realtime_listeners: list[Callable[[], None]] = []
        self._unsubs: list[Callable[[], None]] = []

    # ------------------------------------------------------------------ Lifecycle

    async def async_start(self) -> None:
        if stored := await self._store.async_load():
            self.data.update(stored)

        today = dt_util.now().date().isoformat()
        if self.data["date"] is None:
            # Erster Start: der heutige Tag ist unvollständig und zählt nicht in Durchschnitte
            self.data["date"] = self.data["start_date"] = today
        self._check_rollover(dt_util.now())

        self._set_power(self.hass.states.get(self.source_entity), dt_util.utcnow())

        self._unsubs = [
            async_track_state_change_event(
                self.hass, [self.source_entity], self._async_source_changed
            ),
            async_track_time_interval(self.hass, self._async_tick, UPDATE_INTERVAL),
            async_track_time_change(
                self.hass, self._async_tick, hour=0, minute=0, second=0
            ),
        ]
        if self.battery_power_entity:
            self._set_battery_power(
                self.hass.states.get(self.battery_power_entity), dt_util.utcnow()
            )
            self._unsubs.append(
                async_track_state_change_event(
                    self.hass, [self.battery_power_entity], self._async_battery_changed
                )
            )
        if self.house_power_entity:
            self._set_house_power(
                self.hass.states.get(self.house_power_entity), dt_util.utcnow()
            )
            self._unsubs.append(
                async_track_state_change_event(
                    self.hass, [self.house_power_entity], self._async_house_changed
                )
            )

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
        """Listener registrieren; realtime = zusätzlich bei jeder Änderung der Quelle."""
        listeners = self._realtime_listeners if realtime else self._listeners
        listeners.append(listener)

        @callback
        def remove() -> None:
            listeners.remove(listener)

        return remove

    # ------------------------------------------------------------------ Events

    @callback
    def _async_source_changed(self, event: Event[EventStateChangedData]) -> None:
        now = dt_util.utcnow()
        self._integrate(now)
        self._set_power(event.data["new_state"], now)
        for listener in list(self._realtime_listeners):
            listener()

    @callback
    def _async_battery_changed(self, event: Event[EventStateChangedData]) -> None:
        now = dt_util.utcnow()
        self._integrate(now)
        self._set_battery_power(event.data["new_state"], now)
        for listener in list(self._realtime_listeners):
            listener()

    @callback
    def _async_house_changed(self, event: Event[EventStateChangedData]) -> None:
        now = dt_util.utcnow()
        self._integrate(now)
        self._set_house_power(event.data["new_state"], now)
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
        if self.battery_power is not None and self._battery_last_time is not None:
            seconds = (now - self._battery_last_time).total_seconds()
            if seconds > 0 and self.battery_power != 0:
                kwh = abs(self.battery_power) * seconds / 3_600_000
                prefix = "bat_charge" if self.battery_power > 0 else "bat_discharge"
                self.data[f"{prefix}_day_kwh"] += kwh
                self.data[f"{prefix}_total_kwh"] += kwh
            self._battery_last_time = now
        if self.house_power is not None and self._house_last_time is not None:
            seconds = (now - self._house_last_time).total_seconds()
            if seconds > 0:
                kwh = self.house_power * seconds / 3_600_000
                self.data["house_day_kwh"] += kwh
                self.data["house_total_kwh"] += kwh
            self._house_last_time = now
        self._check_rollover(dt_util.as_local(now))

    @callback
    def _set_battery_power(self, state: State | None, now: datetime) -> None:
        power = _parse_watts(state)
        self.battery_power = None if power is None else power * self._battery_sign
        self._battery_last_time = now if power is not None else None

    @callback
    def _set_house_power(self, state: State | None, now: datetime) -> None:
        power = _parse_power(state)
        self.house_power = power
        self._house_last_time = now if power is not None else None

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
    def grid_power(self) -> float | None:
        """Netzleistung in W: positiv = Bezug, negativ = Einspeisung (Haus + Akku-Laden − PV)."""
        if self.house_power is None or self.current_power is None:
            return None
        return self.house_power + (self.battery_power or 0.0) - self.current_power

    def best_day(self) -> tuple[float, str | None]:
        """Bester Tag inklusive des laufenden Tages."""
        if self.data["day_kwh"] > self.data["best_day_kwh"]:
            return self.data["day_kwh"], self.data["date"]
        return self.data["best_day_kwh"], self.data["best_day_date"]

    def recent_days(self, days: int = 30) -> dict[str, float]:
        history = self.data["history"]
        return {day: history[day] for day in sorted(history)[-days:]}
