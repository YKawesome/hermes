package plugin

import (
	"encoding/json"
	"net/http"
)

func (d *Datasource) handleGetTelemetryComponents(w http.ResponseWriter, r *http.Request) {
	rows, err := d.db.QueryContext(r.Context(), "SELECT DISTINCT component FROM telemetryDefs ORDER BY component;")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := []string{}
	for rows.Next() {
		var item string
		if err := rows.Scan(&item); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		items = append(items, item)
	}
	writeJSONResponse(w, items)
}

func (d *Datasource) handleGetTelemetryChannels(w http.ResponseWriter, r *http.Request) {
	component := r.URL.Query().Get("component")
	if component == "" {
		writeJSONResponse(w, []string{})
		return
	}

	rows, err := d.db.QueryContext(r.Context(), "SELECT name FROM telemetryDefs WHERE component = $1 ORDER BY name;", component)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := []string{}
	for rows.Next() {
		var item string
		if err := rows.Scan(&item); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		items = append(items, item)
	}
	writeJSONResponse(w, items)
}

func (d *Datasource) handleGetTelemetrySources(w http.ResponseWriter, r *http.Request) {
	rows, err := d.db.QueryContext(r.Context(), "SELECT DISTINCT source FROM telemetry WHERE time >= NOW() - INTERVAL '24 hours' LIMIT 100;")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := []string{}
	for rows.Next() {
		var item string
		if err := rows.Scan(&item); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		items = append(items, item)
	}
	writeJSONResponse(w, items)
}

func (d *Datasource) handleGetTelemetryKeys(w http.ResponseWriter, r *http.Request) {
	component := r.URL.Query().Get("component")
	channel := r.URL.Query().Get("channel")
	if component == "" || channel == "" {
		writeJSONResponse(w, []string{})
		return
	}

	query := `
		SELECT DISTINCT t.key 
		FROM telemetry t
		JOIN telemetryDefs d ON t.telemetryDefId = d.id
		WHERE d.component = $1 AND d.name = $2 AND t.key IS NOT NULL
		LIMIT 200;`

	rows, err := d.db.QueryContext(r.Context(), query, component, channel)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := []string{}
	for rows.Next() {
		var item string
		if err := rows.Scan(&item); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		items = append(items, item)
	}
	writeJSONResponse(w, items)
}

func (d *Datasource) handleGetEventSources(w http.ResponseWriter, r *http.Request) {
	rows, err := d.db.QueryContext(r.Context(), "SELECT DISTINCT source FROM events WHERE time >= NOW() - INTERVAL '24 hours' LIMIT 100;")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := []string{}
	for rows.Next() {
		var item string
		if err := rows.Scan(&item); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		items = append(items, item)
	}
	writeJSONResponse(w, items)
}

func writeJSONResponse(w http.ResponseWriter, data interface{}) {
	bytes, err := json.Marshal(data)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(bytes)
}
