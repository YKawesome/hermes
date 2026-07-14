<!-- This README file is going to be the one displayed on the Grafana.com website for your plugin. Uncomment and replace the content here before publishing.

Remove any remaining comments before publishing as these may be displayed on Grafana.com -->

# Hermes-Datasource

<!-- To help maximize the impact of your README and improve usability for users, we propose the following loose structure:

**BEFORE YOU BEGIN**
- Ensure all links are absolute URLs so that they will work when the README is displayed within Grafana and Grafana.com
- Be inspired ✨
  - [grafana-polystat-panel](https://github.com/grafana/grafana-polystat-panel)
  - [volkovlabs-variable-panel](https://github.com/volkovlabs/volkovlabs-variable-panel)

**ADD SOME BADGES**

Badges convey useful information at a glance for users whether in the Catalog or viewing the source code. You can use the generator on [Shields.io](https://shields.io/badges/dynamic-json-badge) together with the Grafana.com API
to create dynamic badges that update automatically when you publish a new version to the marketplace.

- For the URL parameter use `https://grafana.com/api/plugins/your-plugin-id`.
- Example queries:
  - Downloads: `$.downloads`
  - Catalog Version: `$.version`
  - Grafana Dependency: `$.grafanaDependency`
  - Signature Type: `$.versionSignatureType`
- Optionally, for the logo parameter use `grafana`.

Full example: ![Dynamic JSON Badge](https://img.shields.io/badge/dynamic/json?logo=grafana&query=$.version&url=https://grafana.com/api/plugins/grafana-polystat-panel&label=Marketplace&prefix=v&color=F47A20)

Consider other [badges](https://shields.io/badges) as you feel appropriate for your project.

## Overview / Introduction
Provide one or more paragraphs as an introduction to your plugin to help users understand why they should use it.

Consider including screenshots:
- in [plugin.json](https://grafana.com/developers/plugin-tools/reference/plugin-json#info) include them as relative links.
- in the README ensure they are absolute URLs.

## Requirements
List any requirements or dependencies they may need to run the plugin.

## Getting Started
Provide a quick start on how to configure and use the plugin.

## Documentation
If your project has dedicated documentation available for users, provide links here. For help in following Grafana's style recommendations for technical documentation, refer to our [Writer's Toolkit](https://grafana.com/docs/writers-toolkit/).

## Contributing
Do you want folks to contribute to the plugin or provide feedback through specific means? If so, tell them how!
-->

![Grafana](https://img.shields.io/badge/Grafana-%3E%3D12.3.0-F47A20?logo=grafana)
![License](https://img.shields.io/badge/License-Apache%202.0-blue)

## Overview

**Hermes-Datasource** is a Grafana backend datasource plugin that connects to a [TimescaleDB](https://www.timescale.com/) database to query and visualize **telemetry** and **event** data from NASA's Hermes flight software (FSW) system.

The plugin provides a multi-select query editor for browsing FSW components, channels, and keys, making it easy to build dashboards over spacecraft telemetry and event streams without writing raw SQL. Multiple components, channels, sources, and keys can be selected in a single query to overlay or compare data series.

## Requirements

- **Grafana** >= 12.3.0
- **TimescaleDB** (PostgreSQL with the TimescaleDB extension) — the plugin expects the Hermes schema (`telemetryDefs`, `telemetry`, `eventDefs`, `events` tables/hypertables) to already exist in the target database.
- **Node.js** >= 22 (for frontend development)
- **Go** >= 1.26 (for backend development)
- **Mage** — Go build tool used for compiling the backend plugin binaries

## Getting Started

### 1. Install the plugin

Install the plugin into your Grafana instance. Once installed, restart Grafana if required.

### 2. Configure the datasource

Navigate to **Connections > Data sources > Add data source** and search for **Hermes-Datasource**. Fill in the connection details:

| Field        | Description                                           | Example              |
|------------- |------------------------------------------------------ |--------------------- |
| **Host**     | TimescaleDB host and port                             | `localhost:5432`     |
| **User**     | Database user (leave blank for OS user)               | `postgres`           |
| **Password** | Database password (stored securely via `secureJsonData`) | `password`        |
| **Database** | Database name                                         | `hermes`             |

Click **Save & Test** to verify connectivity.

### 3. Query data

Create a new panel and select the **Hermes-Datasource**. The query editor supports two query types:

#### Telemetry

Query time-series telemetry values by selecting:

- **Component** *(multi-select)* — One or more FSW components or modules (e.g. `cmdDisp`, `health`). Selecting multiple components queries telemetry across all of them.
- **Channel** *(multi-select)* — One or more telemetry channel names within the selected components. Channels with duplicate names across components are disambiguated with a `(component)` suffix. Each unique combination of component, channel, source, and key produces its own data frame, so selecting multiple channels overlays them on the same panel.
- **Source** *(optional, multi-select)* — One or more FSW source identifiers to filter by. Leave empty to include all sources.
- **Key** *(optional, multi-select)* — One or more value field paths for compound (object/array) channels. Only shown when the selected channels have multiple keys. Leave empty to include all keys.
- **Time Field** — Choose between `TIME` (spacecraft time) or `ERT` (Earth Received Time)
- **Time Override** *(optional)* — Override the dashboard time range with absolute from/to timestamps

Telemetry data is automatically bucketed using TimescaleDB's `time_bucket()` at the query interval and aggregated with `AVG` (numeric) or `MAX` (string).

#### Events

Query event log entries. Fields returned include timestamp, component, event name, severity, message, source, and arguments.

- **Source** *(optional, multi-select)* — Filter events by one or more FSW source identifiers. Leave empty to include all sources.
- **Time Field** — `TIME` or `ERT`
- **Time Override** *(optional)* — Absolute from/to time range

Severity levels: `DIAGNOSTIC`, `ACTIVITY_LOW`, `ACTIVITY_HIGH`, `WARNING_LOW`, `WARNING_HIGH`, `COMMAND`, `FATAL`.

### 4. Template variables

The query editor supports Grafana template variables in the **Component**, **Channel**, **Source**, and **Key** fields, enabling dynamic, reusable dashboards.

## License

This project is licensed under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).
