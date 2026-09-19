FROM golang:1.27.1-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o main cmd/main.go

FROM alpine:3.23

RUN apk --no-cache add ca-certificates
WORKDIR /app

COPY --from=builder /app/main .

CMD ["./main"]
