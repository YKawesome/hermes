package plugin

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// QueryData handles multiple queries and returns multiple responses.
// req contains the queries []DataQuery (where each query contains RefID as a unique identifier).
// The QueryDataResponse contains a map of RefID to the response for each query, and each response
// contains Frames ([]*Frame).
func (d *Datasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	// create response struct
	response := backend.NewQueryDataResponse()

	// loop over queries and execute them individually.
	for _, q := range req.Queries {
		res := d.query(ctx, req.PluginContext, q)

		// save the response in a hashmap
		// based on with RefID as identifier
		response.Responses[q.RefID] = res
	}

	return response, nil
}

type queryModel struct {
	QueryType        string `json:"queryType"`
	Component        string `json:"component"`
	Channel          string `json:"channel"`
	Source           string `json:"source"`
	TimeOverrideFrom string `json:"timeOverrideFrom,omitempty"`
	TimeOverrideTo   string `json:"timeOverrideTo,omitempty"`
	Key              string `json:"key,omitempty"`
	TimeField        string `json:"timeField"`
}

func (d *Datasource) query(ctx context.Context, pCtx backend.PluginContext, query backend.DataQuery) backend.DataResponse {
	// Unmarshal the JSON into our queryModel.
	var qm queryModel

	err := json.Unmarshal(query.JSON, &qm)
	if err != nil {
		return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("json unmarshal: %v", err.Error()))
	}

	queryFrom := query.TimeRange.From
	queryTo := query.TimeRange.To
	if qm.TimeOverrideFrom != "" {
		if t, err := time.Parse(time.RFC3339Nano, qm.TimeOverrideFrom); err == nil {
			queryFrom = t
		}
	}
	if qm.TimeOverrideTo != "" {
		if t, err := time.Parse(time.RFC3339Nano, qm.TimeOverrideTo); err == nil {
			queryTo = t
		}
	}

	var timeColumn string
	switch qm.TimeField {
	case "time":
		timeColumn = "time"
	case "ert":
		timeColumn = "ert"
	default:
		return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("invalid time type: %s", qm.TimeField))
	}

	switch qm.QueryType {
	case "events":
		return d.queryEvents(ctx, pCtx, qm, queryFrom, queryTo, timeColumn)
	case "telemetry":
		return d.queryTelemetry(ctx, pCtx, qm, queryFrom, queryTo, timeColumn, query.Interval)
	}
	return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("invalid query type: %s", qm.QueryType))
}

var severityLabels = map[int64]string{
	0: "DIAGNOSTIC",
	1: "ACTIVITY_LOW",
	2: "ACTIVITY_HIGH",
	3: "WARNING_LOW",
	4: "WARNING_HIGH",
	5: "COMMAND",
	6: "FATAL",
}

func severityLabel(sev int64) string {
	if label, ok := severityLabels[sev]; ok {
		return label
	}
	return fmt.Sprintf("UNKNOWN(%d)", sev)
}

func (d *Datasource) queryEvents(ctx context.Context, _ backend.PluginContext, qm queryModel, queryFrom time.Time, queryTo time.Time, timeColumn string) backend.DataResponse {
	var response backend.DataResponse

	queryArgs := []interface{}{
		qm.Source,
		queryFrom,
		queryTo,
	}

	eventSQL := fmt.Sprintf(`
		SELECT 
			e.%s,
			d.component,
			d.name,
			d.severity,
			e.message,
			e.source,
			e.args::text AS arguments
		FROM eventDefs d
		JOIN events e ON e.eventDefId = d.id
		WHERE ($1 = '' OR e.source = $1)
		  AND e.%s >= $2
		  AND e.%s <= $3
		ORDER BY e.%s ASC;`, timeColumn, timeColumn, timeColumn, timeColumn)

	rows, err := d.db.QueryContext(ctx, eventSQL, queryArgs...)
	if err != nil {
		return backend.ErrDataResponse(backend.StatusInternal, fmt.Sprintf("events query execution failed: %v", err.Error()))
	}
	defer func() { _ = rows.Close() }()

	frame := data.NewFrame("Events")
	frame.Fields = append(frame.Fields,
		data.NewField(timeColumn, nil, []time.Time{}),
		data.NewField("component", nil, []string{}),
		data.NewField("name", nil, []string{}),
		data.NewField("severity", nil, []string{}),
		data.NewField("message", nil, []string{}),
		data.NewField("source", nil, []string{}),
		data.NewField("args", nil, []string{}),
	)

	for rows.Next() {
		var t time.Time
		var component, name string
		var severity int64
		var message, source, args string

		if err := rows.Scan(&t, &component, &name, &severity, &message, &source, &args); err != nil {
			return backend.ErrDataResponse(backend.StatusInternal, fmt.Sprintf("events row scan failure: %v", err.Error()))
		}

		frame.AppendRow(t, component, name, severityLabel(severity), message, source, args)
	}

	response.Frames = append(response.Frames, frame)
	return response
}

func (d *Datasource) queryTelemetry(ctx context.Context, _ backend.PluginContext, qm queryModel, queryFrom time.Time, queryTo time.Time, timeColumn string, queryInterval time.Duration) backend.DataResponse {
	var response backend.DataResponse
	if qm.Component == "" || qm.Channel == "" {
		return response
	}

	sqlKeyParam := qm.Key
	if qm.Key != "" {
		sqlKeyParam = qm.Key + "%"
	}

	// Set time grouping interval
	intervalStr := fmt.Sprintf("%d seconds", int(queryInterval.Seconds()))
	if queryInterval.Seconds() < 1 {
		intervalStr = "1 second"
	}

	queryArgs := []interface{}{
		qm.Component,
		qm.Channel,
		qm.Source,
		queryFrom,
		queryTo,
		sqlKeyParam,
		intervalStr,
	}

	// TODO: also consider having valueType in telemetryDefs instead of telemetry
	rawSQL := fmt.Sprintf(`
		SELECT 
			time_bucket($7::interval, t.%s) AS time_bucket,
			t.valueType,
			t.key,
			AVG(t.integral::double precision) AS val_int,
			AVG(t.floating::double precision) AS val_float,
			AVG(t.boolval::int::double precision) AS val_bool,
			MAX(t.string) AS val_str 
		FROM telemetryDefs d
		JOIN telemetry t ON t.telemetryDefId = d.id
		WHERE d.component = $1
		  AND d.name = $2
		  AND ($3 = '' OR t.source = $3)
		  AND t.%s >= $4 AND t.%s <= $5
		  AND ($6 = '' OR t.key LIKE $6)
		GROUP BY time_bucket, t.valueType, t.key
		ORDER BY time_bucket ASC;`, timeColumn, timeColumn, timeColumn)

	// Execute the query
	rows, err := d.db.QueryContext(ctx, rawSQL, queryArgs...)
	if err != nil {
		return backend.ErrDataResponse(backend.StatusInternal, fmt.Sprintf("telemetry query execution failed: %v", err.Error()))
	}
	defer func() { _ = rows.Close() }()

	return buildResponse(qm, rows, response)
}

func buildResponse(qm queryModel, rows *sql.Rows, response backend.DataResponse) backend.DataResponse {
	frames := make(map[string]*data.Frame)

	for rows.Next() {
		var t time.Time
		var dbValueType string
		var key string
		var vInt, vFloat, vBool sql.NullFloat64
		var vStr sql.NullString
		if err := rows.Scan(&t, &dbValueType, &key, &vInt, &vFloat, &vBool, &vStr); err != nil {
			return backend.ErrDataResponse(backend.StatusInternal, fmt.Sprintf("telemetry row scan failure: %v", err.Error()))
		}

		frameId := fmt.Sprintf("%s.%s.%s/%s", qm.Component, qm.Channel, key, qm.TimeField)
		frame, exists := frames[frameId]

		// Create new frame
		if !exists {
			frame = data.NewFrame(frameId)
			frame.Fields = append(frame.Fields, data.NewField(qm.TimeField, nil, []time.Time{}))

			var valueField *data.Field
			switch dbValueType {
			case "int", "uint", "float":
				valueField = data.NewField(frameId, nil, []*float64{})
			case "bool":
				valueField = data.NewField(frameId, nil, []*bool{})
			default:
				valueField = data.NewField(frameId, nil, []*string{})
			}
			valueField.Labels = map[string]string{
				"component": qm.Component,
				"channel":   qm.Channel,
				"key":       key,
				"timeField": qm.TimeField,
			}
			frame.Fields = append(frame.Fields, valueField)
			frames[frameId] = frame
		}

		// Put this row into the correct data frame
		switch dbValueType {
		case "int", "uint":
			var valPtr *float64
			if vInt.Valid {
				valPtr = &vInt.Float64
			}
			frame.AppendRow(t, valPtr)
		case "float":
			var valPtr *float64
			if vFloat.Valid {
				valPtr = &vFloat.Float64
			}
			frame.AppendRow(t, valPtr)
		case "bool":
			var valPtr *bool
			if vBool.Valid {
				b := vBool.Float64 > 0
				valPtr = &b
			}
			frame.AppendRow(t, valPtr)
		default:
			var valPtr *string
			if vStr.Valid {
				valPtr = &vStr.String
			}
			frame.AppendRow(t, valPtr)
		}
	}

	// Return all data frames
	for _, frame := range frames {
		response.Frames = append(response.Frames, frame)
	}
	return response
}
