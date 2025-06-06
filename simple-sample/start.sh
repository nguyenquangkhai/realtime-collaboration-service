#!/bin/bash

# Start script for the collaborative editor with y-redis
echo "🚀 Starting Collaborative Editor (y-redis)..."

# Function to handle cleanup
cleanup() {
    echo "🛑 Shutting down servers..."
    kill $REDIS_PID $BACKEND_PID $WORKER_PID $FRONTEND_PID 2>/dev/null
    docker compose down 2>/dev/null
    exit 0
}

# Trap interrupts and call cleanup
trap cleanup INT TERM

# Check if Docker is available
if command -v docker &> /dev/null; then
    echo "🐳 Starting Redis with Docker..."
    docker compose up -d redis
    sleep 3
    REDIS_DOCKER=true
else
    echo "📡 Docker not available, attempting to start Redis locally..."
    if command -v redis-server &> /dev/null; then
        redis-server &
        REDIS_PID=$!
        sleep 2
        REDIS_DOCKER=false
    else
        echo "❌ Redis not found. Please install Redis or Docker."
        echo "   - Install Redis: https://redis.io/download"
        echo "   - Or install Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi
fi

# Start backend server
echo "📡 Starting y-redis server..."
cd backend

# Check if .env file exists, create basic one if not
if [ ! -f .env ]; then
    echo "📝 Creating basic .env file..."
    cat > .env << EOF
# Basic Configuration
PORT=3001
HOST=localhost
REDIS_URL=redis://localhost:6379

# Storage Configuration (memory for development)
STORAGE_TYPE=memory

# Worker Configuration
WORKER_ID=worker-1
PERSIST_INTERVAL=30000
BATCH_SIZE=10
EOF
fi

echo "📦 Installing backend dependencies..."
npm install

echo "🚀 Starting server..."
npm start &
BACKEND_PID=$!

# Check if server started successfully
sleep 2
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "❌ Backend server failed to start. Check the logs above."
    exit 1
fi

# Start worker for S3 persistence
echo "🔧 Starting y-redis worker..."
npm run worker &
WORKER_PID=$!

# Check if worker started successfully
sleep 2
if ! kill -0 $WORKER_PID 2>/dev/null; then
    echo "❌ Worker failed to start. Check the logs above."
    exit 1
fi

cd ..

# Wait for backend to start
sleep 3

# Start frontend server
echo "🌐 Starting frontend server (Vite)..."
cd frontend

echo "📦 Installing frontend dependencies..."
npm install

echo "🚀 Starting frontend..."
npm run dev &
FRONTEND_PID=$!

# Check if frontend started successfully
sleep 3
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "❌ Frontend server failed to start. Check the logs above."
    exit 1
fi

cd ..

# Display information
echo ""
echo "✅ Servers started!"
echo "🔗 Redis:    redis://localhost:6379"
echo "📡 Backend:  http://localhost:3001 (y-redis WebSocket)"
echo "🔧 Worker:   Running (Redis → S3/Storage persistence)"
echo "🌐 Frontend: http://localhost:5173"
echo ""
echo "🏗️  Architecture:"
echo "   📱 Frontend (React + Quill + Yjs)"
echo "   📡 y-redis Server (WebSocket connections)"
echo "   🔧 y-redis Worker (Redis → Storage persistence)"
echo "   🔗 Redis (Real-time distribution & caching)"
echo "   💾 Storage (S3/Memory - permanent persistence)"
echo ""
echo "👥 To test collaboration:"
echo "   1. Open http://localhost:5173 in multiple browser tabs"
echo "   2. Make sure all tabs use the same room name"
echo "   3. Start typing in one tab and see changes in others!"
echo "   4. Changes are now persisted via Redis!"
echo ""
echo "📊 Additional services (if Docker is available):"
if [ "$REDIS_DOCKER" = true ]; then
    echo "   🔗 Redis UI: redis-cli (connect to localhost:6379)"
    echo "   💾 MinIO (S3): http://localhost:9001 (admin/admin)"
fi
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for background processes
wait 