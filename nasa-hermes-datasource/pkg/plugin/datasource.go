package plugin

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/nasa/hermes-datasource/pkg/models"

	_ "github.com/lib/pq"
)

// Make sure Datasource implements required interfaces. This is important to do
// since otherwise we will only get a not implemented error response from plugin in
// runtime. In this example datasource instance implements backend.QueryDataHandler,
// backend.CheckHealthHandler interfaces. Plugin should not implement all these
// interfaces - only those which are required for a particular task.
var (
	_ backend.QueryDataHandler      = (*Datasource)(nil)
	_ backend.CheckHealthHandler    = (*Datasource)(nil)
	_ instancemgmt.InstanceDisposer = (*Datasource)(nil)
)

// NewDatasource creates a new datasource instance.
func NewDatasource(_ context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	config, err := models.LoadPluginSettings(settings)
	if err != nil {
		return nil, fmt.Errorf("Unable to load settings")
	}

	host := config.Host
	port := "5432"
	if strings.Contains(host, ":") {
		h, p, err := net.SplitHostPort(host)
		if err == nil {
			host, port = h, p
		}
	}

	connectionString := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		host, port, config.User, config.Secrets.Password, config.Database)

	db, err := sql.Open("postgres", connectionString)
	if err != nil {
		return nil, fmt.Errorf("Unable to initialize postgres database driver: %w", err)
	}

	ds := &Datasource{
		db: db,
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/components", ds.handleGetComponents)
	mux.HandleFunc("/channels", ds.handleGetChannels)
	mux.HandleFunc("/sources", ds.handleGetSources)
	mux.HandleFunc("/keys", ds.handleGetKeys)
	ds.CallResourceHandler = httpadapter.New(mux)

	return ds, nil
}

// Datasource is an example datasource which can respond to data queries, reports
// its health and has streaming skills.
type Datasource struct {
	db *sql.DB
	backend.CallResourceHandler
}

// Dispose here tells plugin SDK that plugin wants to clean up resources when a new instance
// created. As soon as datasource settings change detected by SDK old datasource instance will
// be disposed and a new one will be created using NewSampleDatasource factory function.
func (d *Datasource) Dispose() {
	// Clean up datasource instance resources.
}

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

type queryModel struct{}

func (d *Datasource) query(_ context.Context, pCtx backend.PluginContext, query backend.DataQuery) backend.DataResponse {
	var response backend.DataResponse

	// Unmarshal the JSON into our queryModel.
	var qm queryModel

	err := json.Unmarshal(query.JSON, &qm)
	if err != nil {
		return backend.ErrDataResponse(backend.StatusBadRequest, fmt.Sprintf("json unmarshal: %v", err.Error()))
	}

	// create data frame response.
	// For an overview on data frames and how grafana handles them:
	// https://grafana.com/developers/plugin-tools/introduction/data-frames
	frame := data.NewFrame("response")

	// add fields.
	frame.Fields = append(frame.Fields,
		data.NewField("time", nil, []time.Time{query.TimeRange.From, query.TimeRange.To}),
		data.NewField("values", nil, []int64{10, 20}),
	)

	// add the frames to the response.
	response.Frames = append(response.Frames, frame)

	return response
}

// CheckHealth handles health checks sent from Grafana to the plugin.
// The main use case for these health checks is the test button on the
// datasource configuration page which allows users to verify that
// a datasource is working as expected.
func (d *Datasource) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	res := &backend.CheckHealthResult{}
	config, err := models.LoadPluginSettings(*req.PluginContext.DataSourceInstanceSettings)

	// Check config
	if err != nil {
		res.Status = backend.HealthStatusError
		res.Message = "Unable to load settings"
		return res, nil
	}
	if config.Host == "" {
		res.Status = backend.HealthStatusError
		res.Message = "Host configuration parameter is missing"
		return res, nil
	}
	if config.Database == "" {
		res.Status = backend.HealthStatusError
		res.Message = "Database configuration parameter is missing"
		return res, nil
	}

	// Check connectivity
	if d.db == nil {
		res.Status = backend.HealthStatusError
		res.Message = "Internal database connection is null"
		return res, nil
	}

	err = d.db.PingContext(ctx)
	if err != nil {
		res.Status = backend.HealthStatusError
		res.Message = fmt.Sprintf("TimescaleDB ping refused: %s", err.Error())
		return res, nil
	}

	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusOk,
		Message: fmt.Sprintf("Successfully connected to database '%s' at '%s'", config.Database, config.Host),
	}, nil
}
