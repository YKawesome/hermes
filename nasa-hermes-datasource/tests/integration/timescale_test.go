package integration

import (
	"context"
	"net"
	"os/exec"
	"testing"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

const (
	timescaledb = "postgres://postgres:password@localhost:5432/hermes?sslmode=disable"
	hermesGrpc  = "localhost:50051"
)

func BenchmarkTimescaleQueries(b *testing.B) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	hermesCmd := exec.CommandContext(ctx, "go", "run", ".",
		"--bind-type", "tcp",
		"--bind", hermesGrpc,
	)
	hermesCmd.Dir = "../../../cmd/backend"
	if err := hermesCmd.Start(); err != nil {
		b.Fatalf("Hermes backend failed to start: %v", err)
	}

	hermesReady := false
	for range 10 {
		hermesConn, err := net.DialTimeout("tcp", hermesGrpc, 500*time.Millisecond)
		if err == nil {
			hermesConn.Close()
			hermesReady = true
			break
		}

		if hermesCmd.ProcessState != nil && hermesCmd.ProcessState.Exited() {
			b.Fatalf("Hermes backend process crashed during startup loop!\n")
		}

		time.Sleep(1 * time.Second)
	}
	if !hermesReady {
		b.Fatalf("Hermes backend gRPC connection timed out\n")
	}

	hermesConn, err := grpc.NewClient(hermesGrpc, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		b.Fatalf("Hermes backend gRPC connection failed: %v", err)
	}
	defer hermesConn.Close()
}
