"""Konstanten für PV Summary."""

from datetime import timedelta

DOMAIN = "pv_overview"

CONF_SOURCE = "source_entity"
CONF_THRESHOLD = "threshold"
CONF_INITIAL_TOTAL = "initial_total"
CONF_HOUSE_POWER = "house_power_entity"  # optional: gemessener Hausverbrauch
CONF_GRID_POWER = "grid_power_entity"  # optional: Netzleistung am Zähler, positiv = Bezug
CONF_GRID_INVERT = "grid_invert"  # True: positive Werte bedeuten Einspeisung
GRID_MIGRATED = "grid_migrated"  # v1.7: altes Hausverbrauch-Feld wurde ins Netz-Feld übernommen
# Ersparnis (optional, nur mit Netz-Zähler): Preise je kWh und Anschaffungskosten in der Währung von Home Assistant
CONF_PRICE_IMPORT = "price_import"  # Strompreis je kWh aus dem Netz
CONF_PRICE_EXPORT = "price_export"  # Einspeisevergütung je kWh
CONF_INVESTMENT = "investment"  # Anschaffungskosten der Anlage

# Eigenes Dashboard (Panel in der Seitenleiste)
VERSION = "1.18.0"
# Eigene Adresse, damit sie nicht mit einem Lovelace-Dashboard "pv-summary" kollidiert
PANEL_URL = "pv-summary-panel"
STATIC_URL = "/pv_summary_static"

# Unter-Einträge (Akkus und Strings, beliebig viele)
SUBENTRY_BATTERY = "battery"
SUBENTRY_STRING = "string"
CONF_BATTERY_CAPACITY = "battery_capacity"  # kWh, optional, gewichtet den gemeinsamen Akkustand
CONF_STRING_POWER = "string_power_entity"
CONF_STRING_VOLTAGE = "string_voltage_entity"
CONF_STRING_CURRENT = "string_current_entity"
CONF_STRING_MODULES = "string_modules"  # Anzahl Module des Strings (für die Modulansicht), Standard 1
CONF_STRING_COLOR = "string_color"  # Aussehen der Module in der Modulansicht: "blue" oder "black" (Full Black)
STRING_COLORS = ("blue", "black")

# Akku-Felder (bis v1.5 direkt in der Integration, seit v1.6 je Akku-Unter-Eintrag)
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
