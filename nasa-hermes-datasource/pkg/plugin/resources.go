package plugin

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/lib/pq"
)

func scanStrings(rows *sql.Rows) ([]string, error) {
	defer func() { _ = rows.Close() }()
	var items []string
	for rows.Next() {
		var item string
		if err := rows.Scan(&item); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if items == nil {
		items = []string{}
	}
	return items, nil
}

func (d *Datasource) handleGetTelemetryComponents(w http.ResponseWriter, r *http.Request) {
	components := make(map[string]bool)

	d.hermes.mu.RLock()
	for _, dict := range d.hermes.dicts {
		for _, ns := range dict.GetContent() {
			for _, telemetryDef := range ns.Telemetry {
				if telemetryDef.GetComponent() != "" {
					components[telemetryDef.GetComponent()] = true
				}
			}
		}
	}
	d.hermes.mu.RUnlock()

	items := make([]string, 0, len(components))
	for comp := range components {
		items = append(items, comp)
	}

	writeJSONResponse(w, items)
}

type channelEntry struct {
	Component string `json:"component"`
	Name      string `json:"name"`
}

func (d *Datasource) handleGetTelemetryChannels(w http.ResponseWriter, r *http.Request) {
	channelMap := make(map[channelEntry]bool)

	d.hermes.mu.RLock()
	for _, dict := range d.hermes.dicts {
		for _, ns := range dict.GetContent() {
			for _, telemetryDef := range ns.Telemetry {
				channelMap[channelEntry{
					Component: telemetryDef.GetComponent(),
					Name:      telemetryDef.GetName(),
				}] = true
			}
		}
	}
	d.hermes.mu.RUnlock()

	channels := []channelEntry{}
	for entry := range channelMap {
		channels = append(channels, entry)
	}

	writeJSONResponse(w, channelMap)
}

func (d *Datasource) handleGetTelemetrySources(w http.ResponseWriter, r *http.Request) {
	rows, err := d.db.QueryContext(r.Context(), "SELECT DISTINCT source FROM telemetry WHERE time >= NOW() - INTERVAL '24 hours' LIMIT 100;")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	items, err := scanStrings(rows)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSONResponse(w, items)
}

type keyEntry struct {
	Component string `json:"component"`
	Channel   string `json:"channel"`
	Key       string `json:"key"`
}

func (d *Datasource) handleGetTelemetryKeys(w http.ResponseWriter, r *http.Request) {
	components := r.URL.Query()["components"]
	channels := r.URL.Query()["channels"]
	if len(components) == 0 || len(channels) == 0 {
		writeJSONResponse(w, []keyEntry{})
		return
	}

	// I dont see a way to get keys from the dictionary.
	// compSet := make(map[string]bool)
	// for _, c := range components {
	// 	compSet[c] = true
	// }
	// chanSet := make(map[string]bool)
	// for _, c := range channels {
	// 	chanSet[c] = true
	// }

	// keyMap := make(map[string]bool)

	// d.hermes.mu.RLock()
	// for _, dict := range d.hermes.dicts {
	// 	for _, ns := range dict.GetContent() {
	// 		for _, telemetryDef := range ns.Telemetry {
	// 			if compSet[telemetryDef.GetComponent()] && chanSet[telemetryDef.GetName()] {
	// 				for _, arg := range telemetryDef.GetArgs() {
	// 					if arg.GetName() != "" {
	// 						keyMap[arg.GetName()] = true
	// 					}
	// 				}
	// 			}
	// 		}
	// 	}
	// }
	// d.hermes.mu.RUnlock()

	// keys := make([]keyEntry, 0, len(keyMap))
	// for k := range keyMap {
	// 	keys = append(keys, keyEntry{Key: k})
	// }

	query := `
		SELECT DISTINCT d.component, d.name, t.key 
		FROM telemetry t
		JOIN telemetryDefs d ON t.telemetryDefId = d.id
		WHERE d.component = ANY($1) AND d.name = ANY($2) AND t.key IS NOT NULL
		ORDER BY d.component, d.name, t.key
		LIMIT 200;`

	rows, err := d.db.QueryContext(r.Context(), query, pq.Array(components), pq.Array(channels))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer func() { _ = rows.Close() }()

	items := []keyEntry{}
	for rows.Next() {
		var entry keyEntry
		if err := rows.Scan(&entry.Component, &entry.Channel, &entry.Key); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		items = append(items, entry)
	}
	if err := rows.Err(); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSONResponse(w, items)
}

func (d *Datasource) handleGetEventSources(w http.ResponseWriter, r *http.Request) {
	rows, err := d.db.QueryContext(r.Context(), "SELECT DISTINCT source FROM events WHERE time >= NOW() - INTERVAL '24 hours' LIMIT 100;")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	items, err := scanStrings(rows)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSONResponse(w, items)
}

func writeJSONResponse(w http.ResponseWriter, data any) {
	bytes, err := json.Marshal(data)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(bytes)
}
