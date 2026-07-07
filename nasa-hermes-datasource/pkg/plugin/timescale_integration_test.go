package plugin

import (
	"context"
	"database/sql"
	"encoding/json"
	"math/rand"
	"net"
	"os/exec"
	"testing"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	hermesGrpc "github.com/nasa/hermes/pkg/grpc"
	pb "github.com/nasa/hermes/pkg/pb"
)

const (
	timescaleConnStr  = "postgres://postgres:password@localhost:5432/hermes?sslmode=disable"
	hermesGrpcConnStr = "localhost:50051"
)

func BenchmarkTimescaleQueries(b *testing.B) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	hermesConn := startHermesBackend(b, ctx)
	defer hermesConn.Close()

	hermesClient := hermesGrpc.NewApiClient(hermesConn)

	startTimescaleGrafana(b, ctx, hermesClient)
	emitData(b, ctx, hermesClient)
	query(b, ctx)
}

func startCommand(b *testing.B, ctx context.Context, dir, name string, args ...string) {
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Dir = dir
	if err := cmd.Start(); err != nil {
		b.Fatalf("Command start failed [%s %v]: %v", name, args, err)
	}

	// TODO: stop littering hermes backends on my comupter
	// b.Cleanup(func() {
	// 	if cmd.Process != nil {
	// 		_ = cmd.Process.Kill()
	// 	}
	// })
}

func runCommand(b *testing.B, ctx context.Context, dir, name string, args ...string) {
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Dir = dir
	if err := cmd.Run(); err != nil {
		b.Fatalf("Command run failed [%s %v]: %v", name, args, err)
	}
}

func waitPort(b *testing.B, target string) {
	for range 10 {
		conn, err := net.DialTimeout("tcp", target, 500*time.Millisecond)
		if err == nil {
			conn.Close()
			return
		}
		time.Sleep(1 * time.Second)
	}
	b.Fatalf("Network connection timed out: %s\n", target)
}

func startHermesBackend(b *testing.B, ctx context.Context) *grpc.ClientConn {
	b.Log("Starting Hermes backend")

	startCommand(b, ctx, "../../../cmd/backend", "go", "run", ".", "--bind-type", "tcp", "--bind", hermesGrpcConnStr)
	waitPort(b, hermesGrpcConnStr)

	hermesConn, err := grpc.NewClient(hermesGrpcConnStr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		b.Fatalf("Hermes backend gRPC connection failed: %v", err)
	}
	b.Log("Hermes backend started")
	return hermesConn
}

func startTimescaleGrafana(b *testing.B, ctx context.Context, hermesClient hermesGrpc.ApiClient) {
	b.Log("Starting TimescaleDB Grafana Docker")

	runCommand(b, ctx, "../..", "docker", "compose", "up", "-d")
	b.Cleanup(func() {
		runCommand(b, context.Background(), "../..", "docker", "compose", "down", "-v")
	})
	waitPort(b, "localhost:5432")

	b.Log("TimescaleDB Grafana Docker Started")
	time.Sleep(10 * time.Second) // Dirty hack to make sure db starts
	b.Log("Hermes connecting to TimescaleDB")

	timescaleConfig := map[string]interface{}{
		"host":     "localhost",
		"port":     5432,
		"user":     "postgres",
		"password": "password",
		"database": "hermes",
		"sslmode":  "disable",
	}

	timescaleConfigBytes, err := json.Marshal(timescaleConfig)
	if err != nil {
		b.Fatalf("Failed to marshal database config map: %v", err)
	}

	timescaleProfile := &pb.Profile{
		Name:     "TimescaleDB",
		Provider: "TimescaleDB",
		Settings: string(timescaleConfigBytes),
	}

	timescaleProfileID, err := hermesClient.AddProfile(ctx, timescaleProfile)
	if err != nil {
		b.Fatalf("Hermes failed to add profile: %v", err)
	}

	_, err = hermesClient.StartProfile(ctx, timescaleProfileID)
	if err != nil {
		b.Fatalf("Hermes failed to start profile: %v", err)
	}

	b.Log("Hermes connected to TimescaleDB")
}

func emitData(b *testing.B, ctx context.Context, hermesClient hermesGrpc.ApiClient) {
	timeStart := time.Now().AddDate(0, 0, -1)
	timeSecondsTotal := 1 * 24 * 60 * 60

	sources := []string{"source-alpha", "source-beta"}

	for timeSeconds := 0; timeSeconds < timeSecondsTotal; timeSeconds++ {
		timeUnix := timeStart.Add(time.Duration(timeSeconds) * time.Second)
		source := sources[timeSeconds%len(sources)]

		timeProto := &pb.Time{
			Unix: timestamppb.New(timeUnix),
			Sclk: float64(timeSeconds),
		}

		telemetryPacket := &pb.SourcedTelemetry{
			Source: source,
			Telemetry: &pb.Telemetry{
				Ref: &pb.TelemetryRef{
					Component: "TimescaleDB",
					Name:      "TestTelemetry1",
				},
				Time: timeProto,
				Value: &pb.Value{
					Value: &pb.Value_F{
						F: rand.Float64() * 100.0,
					},
				},
				Labels: map[string]string{
					"key": "test_key_1",
				},
			},
		}
		if _, err := hermesClient.EmitTelemetry(ctx, telemetryPacket); err != nil {
			b.Fatalf("Hermes failed to emit telemetry at index %d: %v", timeSeconds, err)
		}

		if timeSeconds%60 == 0 {
			eventPacket := &pb.SourcedEvent{
				Source: source,
				Event: &pb.Event{
					Ref: &pb.EventRef{
						Component: "TimescaleDB",
						Name:      "TestTelemetry1",
					},
					Time:    timeProto,
					Message: "Test Event Message",
				},
			}
			if _, err := hermesClient.EmitEvent(ctx, eventPacket); err != nil {
				b.Fatalf("Hermes failed to emit event at index %d: %v", timeSeconds, err)
			}
		}

		if timeSeconds%(60*60) == 0 {
			b.Logf("Emitted %d/%d seconds of data", timeSeconds, timeSecondsTotal)
		}
	}
}

func query(b *testing.B, ctx context.Context) {
	pluginDB, err := sql.Open("postgres", timescaleConnStr)
	if err != nil {
		b.Fatalf("Grafana plugin failed to open database pool: %v", err)
	}
	defer pluginDB.Close()

	ds := &Datasource{
		db: pluginDB,
	}

	queryModel := queryModel{
		QueryType:  "telemetry",
		Components: []string{"TimescaleDB"},
		Channels:   []string{"TestTelemetry1"},
		Sources:    []string{},
		TimeField:  "time",
	}
	queryJSON, err := json.Marshal(queryModel)
	if err != nil {
		b.Fatalf("Failed to marshal queryModel: %v", err)
	}

	timeNow := time.Now()
	request := &backend.QueryDataRequest{
		Queries: []backend.DataQuery{
			{
				RefID: "TestQueryId1",
				JSON:  queryJSON,
				TimeRange: backend.TimeRange{
					From: timeNow.AddDate(-1, 0, 0),
					To:   timeNow,
				},
				Interval: 1 * time.Second,
			},
		},
	}

	b.Log("Benchmarking queries")
	b.Run("Query Benchmark", func(b *testing.B) {
		b.ResetTimer()

		for i := 0; i < b.N; i++ {
			response, err := ds.QueryData(ctx, request)
			if err != nil {
				b.Fatalf("Failed to query data: %v", err)
			}

			if queryResp, exists := response.Responses["TestQueryId1"]; exists {
				if queryResp.Status != backend.StatusOK && queryResp.Error != nil {
					b.Fatalf("Error returned by query data: %v", queryResp.Error)
				}
			} else {
				b.Fatal("Missing expected data from query data")
			}
		}
	})
}
