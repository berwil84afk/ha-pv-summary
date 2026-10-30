"""Konstanten für PV Summary."""

from datetime import timedelta

DOMAIN = "pv_overview"

CONF_SOURCE = "source_entity"
CONF_THRESHOLD = "threshold"
CONF_INITIAL_TOTAL = "initial_total"
CONF_HOUSE_POWER = "house_power_entity"  # optional: aktueller Hausverbrauch

# Eigenes Dashboard (Panel in der Seitenleiste)
VERSION = "1.4.1"
# Eigene Adresse, damit sie nicht mit einem Lovelace-Dashboard "pv-summary" kollidiert
PANEL_URL = "pv-summary-panel"
STATIC_URL = "/pv_summary_static"

# Optionaler Akku
SECTION_BATTERY = "battery"
CONF_BATTERY_SOC = "battery_soc_entity"
CONF_BATTERY_VOLTAGE = "battery_voltage_entity"
CONF_BATTERY_TEMPERATURE = "battery_temperature_entity"
CONF_BATTERY_POWER = "battery_power_entity"
CONF_BATTERY_INVERT = "battery_invert"  # True: positive Werte bedeuten Entladen
BATTERY_ENTITY_KEYS = (
    CONF_BATTERY_SOC,
    CONF_BATTERY_VOLTAGE,
    CONF_BATTERY_TEMPERATURE,
    CONF_BATTERY_POWER,
)

DEFAULT_NAME = "PV Anlage"
DEFAULT_THRESHOLD = 10.0  # W – ab dieser Leistung zählt die Zeit als "Produktionszeit"

UPDATE_INTERVAL = timedelta(seconds=30)
SAVE_DELAY = 60  # s
STORAGE_VERSION = 1
HISTORY_DAYS = 400
HISTORY_MONTHS = 36
