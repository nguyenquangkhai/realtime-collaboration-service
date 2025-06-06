# Collaborative Editor with Yjs + y-redis

A **production-ready** real-time collaborative text editor built with [Yjs](https://yjs.dev), [Quill](https://quilljs.com), and [y-redis](https://github.com/yjs/y-redis). This implementation provides scalable, persistent collaborative editing with Redis-based distribution.

## Features

- ✅ **Scalable Architecture**: Redis-based distribution for production use
- ✅ **Memory Efficient**: Server doesn't maintain Y.Doc in-memory
- ✅ **Real-time Collaboration**: Multiple users editing simultaneously
- ✅ **Persistent Storage**: Documents saved to Redis and optionally S3/Postgres
- ✅ **Cursor Presence**: See other users' cursors and selections
- ✅ **Rich Text Formatting**: Bold, italic, headers, and more
- ✅ **Room-based Sessions**: Isolated collaborative environments
- ✅ **Automatic Conflict Resolution**: CRDT-based conflict-free editing
- ✅ **Production Ready**: Built for scaling and reliability
- ✅ **Responsive Design**: Works on desktop and mobile

## Project Structure

```
simple-sample/
├── backend/              # y-redis backend server
│   ├── server.js         # y-redis WebSocket server
│   ├── worker.js         # Persistence worker
│   └── package.json      # Backend dependencies
├── frontend/             # React frontend with Quill editor
│   ├── src/
│   │   ├── App.jsx       # Main app component
│   │   ├── Editor.jsx    # Collaborative editor component
│   │   ├── main.jsx      # React entry point
│   │   └── styles.scss   # Styling
│   ├── index.html
│   └── package.json      # Frontend dependencies
├── docker-compose.yml    # Redis & MinIO services
├── start.sh              # Convenient startup script
└── README.md
```

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or pnpm

### Installation & Running

**Quick Start (Recommended):**
```bash
# From the simple-sample directory
./start.sh
```
This will start both servers and provide helpful information.

**Manual Setup:**

1. **Start the Backend Server**
   ```bash
   cd backend
   npm install
   npm start
   ```
   The WebSocket server will start on `http://localhost:3001`
   
   **Alternative with persistence:**
   ```bash
   npm run start:persistent
   ```
   This will persist documents to a local `./data` directory using LevelDB.

2. **Start the Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   The frontend will start on `http://localhost:5173`

3. **Test Collaboration**
   - Open multiple browser tabs/windows to `http://localhost:5173`
   - Make sure all tabs use the same room name
   - Start typing in one tab and see changes appear in others!

## S3 Configuration

To use S3 for persistent storage (recommended for production), configure these environment variables:

### Environment Variables

Create a `.env` file in the `backend/` directory:

```bash
# Storage Configuration
STORAGE_TYPE=s3                    # Use 's3' or 'memory'
S3_BUCKET=your-bucket-name         # S3 bucket for document storage

# S3 Connection (required when STORAGE_TYPE=s3)
S3_ENDPOINT=s3.amazonaws.com       # S3 endpoint
S3_PORT=443                        # S3 port (443 for HTTPS, 80 for HTTP)
S3_SSL=true                        # Use SSL/TLS
S3_ACCESS_KEY=your-access-key      # AWS Access Key ID
S3_SECRET_KEY=your-secret-key      # AWS Secret Access Key

# Worker Configuration
PERSIST_INTERVAL=30000             # Persist every 30 seconds
BATCH_SIZE=10                      # Process 10 documents at once
WORKER_ID=worker-1                 # Unique worker identifier

# Redis Configuration
REDIS_URL=redis://localhost:6379   # Redis connection URL
```

### AWS S3 Setup

1. **Create S3 Bucket**:
   ```bash
   aws s3 mb s3://your-collab-documents
   ```

2. **Set Bucket Policy** (for appropriate access):
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": {
           "AWS": "arn:aws:iam::YOUR-ACCOUNT:user/collab-service"
         },
         "Action": [
           "s3:GetObject",
           "s3:PutObject",
           "s3:DeleteObject",
           "s3:ListBucket"
         ],
         "Resource": [
           "arn:aws:s3:::your-collab-documents",
           "arn:aws:s3:::your-collab-documents/*"
         ]
       }
     ]
   }
   ```

3. **Create IAM User** with S3 permissions and generate access keys

### MinIO (S3-Compatible Local Storage)

For local development, use MinIO as an S3-compatible server:

```bash
# Start MinIO with Docker
docker compose up -d minio

# Access MinIO Console: http://localhost:9001
# Default credentials: minioadmin / minioadmin
```

**MinIO Configuration**:
```bash
STORAGE_TYPE=s3
S3_BUCKET=collaborative-docs
S3_ENDPOINT=localhost
S3_PORT=9000
S3_SSL=false
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
```

## How It Works

### Backend (y-redis Architecture)
- **y-redis Server**: Handles WebSocket connections and real-time sync
- **y-redis Worker**: Manages persistence from Redis to permanent storage
- **Redis**: Acts as cache and distribution channel for document updates
- **Storage Layer**: Supports S3, Postgres, or Memory for permanent persistence
- **Memory Efficient**: Server doesn't maintain Y.Doc in-memory
- **Scalable**: Can run multiple server and worker instances
- **Production Ready**: Built for enterprise-scale collaborative applications

### S3 Persistence Flow
1. **Real-time Updates**: Users edit → Changes go to Redis via WebSocket server
2. **Distribution**: Redis distributes changes to all connected clients in real-time
3. **Background Persistence**: Worker reads from Redis → Saves to S3/Storage every 30s
4. **Recovery**: On startup, server loads documents from S3 → Redis for fast access
5. **Cleanup**: Worker removes old Redis data after successful S3 persistence

### Frontend (React + Quill)
- **Yjs Document**: Creates a shared document (`Y.Doc`)
- **WebSocket Provider**: Connects to the backend for real-time sync
- **Quill Binding**: Binds the Yjs document to the Quill editor
- **Awareness**: Shows cursor positions of other users

### Key Components

1. **Y.Doc**: The main Yjs document that holds shared data
2. **Y.Text**: Shared text type for the editor content
3. **WebsocketProvider**: Handles network communication
4. **QuillBinding**: Synchronizes Quill editor with Yjs document
5. **Awareness**: Manages user presence and cursor positions

## Technologies Used

- **[Yjs](https://yjs.dev)**: Conflict-free replicated data types (CRDTs)
- **[Quill](https://quilljs.com)**: Rich text editor
- **[React](https://reactjs.org)**: Frontend framework
- **[WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)**: Real-time communication
- **[Vite](https://vitejs.dev)**: Frontend build tool

## Customization

### Changing the Room
Users can change the room name in the UI to join different collaborative sessions.

### Adding Features
The editor can be extended with:
- User authentication
- Document persistence (database storage)
- More rich text features
- File uploads
- Comments and suggestions

### Scaling
For production use, consider:
- Adding Redis for document persistence (`y-redis`)
- Using a proper authentication system
- Adding rate limiting
- Implementing document permissions

## License

MIT License - feel free to use this as a starting point for your own collaborative applications! 