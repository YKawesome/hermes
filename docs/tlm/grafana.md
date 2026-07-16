---
icon: brands/grafana
---

# Grafana

Check out [using Grafana with TimescaleDB](db/timescaledb#using-grafana-with-timescaledb).

!!! warning "Documentation In Progress"

    This documentation is incomplete while we are migrating from our internal documentation store to the public GitHub.

## Installing the Hermes data source plugin

The Hermes data source plugin is distributed as a release asset on GitHub. If you are using the default [docker compose](https://github.com/nasa/hermes/blob/main/docker-compose.yml), the plugin is pre-installed, and no action is needed. Otherwise, you need to install the plugin following the steps below. Because it is **unsigned**, Grafana must be configured to allow it in addition to installing the files.

After [allowing the unsigned plugin](#allowing-the-unsigned-plugin), pick the method that matches your setup:

- **[Install to Docker Compose](#install-to-docker-compose)** — add an installer service to your stack (recommended).
- **[Install to an existing Grafana instance](#install-to-an-existing-grafana-instance)** — run the install script.
- **[Install to a single Docker container](#install-to-a-single-docker-container)** — mount a host directory.

### Allowing the Unsigned Plugin

Grafana will not load the plugin unless it is explicitly allowed. Use whichever
applies to your setup:

- **Environment variable** (used in the Docker examples below):

    ```bash
    GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=nasa-hermes-datasource
    ```

- **`grafana.ini`** under `[plugins]`:

    ```ini
    [plugins]
    allow_loading_unsigned_plugins = nasa-hermes-datasource
    ```

Restart Grafana after changing `grafana.ini`.

### Install to Docker Compose

Add a short-lived installer service that runs the install script into a shared
volume before Grafana starts. This always installs the latest published release,
with no manual step. This is included in the default [`docker-compose.yml`](https://github.com/nasa/hermes/blob/main/docker-compose.yml), so no modifications are needed, and the plugin is automatically installed if you are using that docker compose.

```yaml
services:
  # Runs once, installs the latest published plugin into a shared volume, then exits
  hermes-plugin-installer:
    image: alpine:latest
    volumes:
      - grafana-plugins:/plugins
    command:
      - sh
      - -c
      - |
        apk add --no-cache curl jq bash unzip &&
        curl -fsSL https://raw.githubusercontent.com/nasa/hermes/main/nasa-hermes-datasource/install.sh \
          | bash -s -- /plugins

  grafana:
    image: grafana/grafana:latest
    restart: unless-stopped
    ports:
      - "3000:3000"
    depends_on:
      hermes-plugin-installer:
        condition: service_completed_successfully
    environment:
      GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS: "nasa-hermes-datasource"
    volumes:
      - grafana-data:/var/lib/grafana
      - grafana-plugins:/var/lib/grafana/plugins

volumes:
  grafana-data:
  grafana-plugins:
```

The `condition: service_completed_successfully` ensures Grafana only starts after
the plugin is installed. The plugin persists in the `grafana-plugins` volume across
restarts; recreating that volume (for example, `docker compose down -v`) triggers a
fresh install of the latest release.

!!! tip "Pinning a specific version"

    To install a fixed version instead of the latest, drop the installer service and
    use Grafana's built-in `GF_INSTALL_PLUGINS` with an explicit release URL:

    ```yaml
        environment:
          GF_INSTALL_PLUGINS: "https://github.com/nasa/hermes/releases/download/grafana-v1.0.0/nasa-hermes-datasource-1.0.0.zip;nasa-hermes-datasource"
          GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS: "nasa-hermes-datasource"
    ```

### Install to an Existing Grafana Instance

The install script downloads the latest published release and extracts it into
your Grafana plugins directory. It requires [`jq`](https://jqlang.github.io/jq/).

```bash
curl -fsSL https://raw.githubusercontent.com/nasa/hermes/main/nasa-hermes-datasource/install.sh | bash
```

The script auto-detects a plugins directory. To install into a specific directory,
pass it as an argument (everything after `bash -s --` is passed to the script):

```bash
curl -fsSL https://raw.githubusercontent.com/nasa/hermes/main/nasa-hermes-datasource/install.sh \
  | bash -s -- /var/lib/grafana/plugins
```

The plugin is installed to `<plugins-dir>/nasa-hermes-datasource/`. Then
[allow the unsigned plugin](#allowing-the-unsigned-plugin) and restart Grafana.

### Install to a Single Docker Container

Install the plugin into a host folder, then mount it into the container:

```bash
# Install the plugin into a host folder
mkdir -p ~/grafana-plugins
curl -fsSL https://raw.githubusercontent.com/nasa/hermes/main/nasa-hermes-datasource/install.sh \
  | bash -s -- ~/grafana-plugins

# Start Grafana with the plugin mounted and allowed
docker run -d -p 3000:3000 \
  -e GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=nasa-hermes-datasource \
  -v ~/grafana-plugins:/var/lib/grafana/plugins \
  --name grafana grafana/grafana:latest
```

### Verifying the installation

Open [http://localhost:3000](http://localhost:3000) (default login `admin` /
`admin`), then navigate to **Administration → Plugins and data → Plugins** and
search for **hermes**. The **Hermes** data source should appear in the list, marked
as an unsigned plugin.

If it does not appear, confirm the plugin was extracted into the correct plugins
directory and that [unsigned plugins are allowed](#allowing-the-unsigned-plugin).
