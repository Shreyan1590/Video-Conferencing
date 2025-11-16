## Cliqtrix Video Conferencing – Dev Guide

### Backend (Node.js + Express + Socket.IO)

- **Install dependencies**

```bash
cd backend
npm install
```

- **Run in development**

```bash
npm run dev
```

The backend listens on **http://localhost:4000**.

- **Environment variables**

Create a `.env` file in `backend`:

```bash
PORT=4000
CORS_ORIGIN=http://localhost:5173
JWT_SECRET=super_secret_jwt_key_change_me
```

### Frontend (React + TypeScript + Vite)

- **Install dependencies**

```bash
cd frontend
npm install
```

- **Run in development**

```bash
npm run dev
```

The frontend runs on **http://localhost:5173** and proxies `/api` and `/socket.io` to the backend.

### Docker / Docker Compose

- **Build and run both services**

```bash
docker-compose up --build
```

This starts:

- **Backend** on `http://localhost:4000`
- **Frontend** on `http://localhost:5173`

### Linting & Formatting

- **Backend**

```bash
cd backend
npm run lint
npm run format
```

- **Frontend**

```bash
cd frontend
npm run lint
npm run format
```


