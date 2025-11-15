# Alert Monitoring System - Backend Server

This is the backend API server for the Alert Monitoring System, implementing Cameron's Database & API Integration component.

## Features

- **PostgreSQL** for relational data (users, houses, devices, alerts)
- **MongoDB** for time-series data (telemetry, ML inference)
- **JWT Authentication** with access and refresh tokens
- **Role-Based Access Control** (OWNER, ADMIN, STAFF, CAREGIVER)
- **WebSocket** for real-time updates
- **RESTful API** with comprehensive endpoints

## Prerequisites

- Node.js 18+ 
- PostgreSQL 15+
- MongoDB 7+

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up PostgreSQL

Create the database:

```bash
createdb alert_monitoring
```

Initialize the schema:

```bash
psql -d alert_monitoring -f db/schema.sql
```

This will create all tables and insert sample data including:
- Admin user: `admin@example.com` / `admin123`
- Owner user: `owner@example.com` / `admin123`
- Caregiver user: `caregiver@example.com` / `admin123`

### 3. Set Up MongoDB

Start MongoDB (if not already running):

```bash
mongod --dbpath /path/to/data
```

The application will automatically create collections and indexes on first connection.

### 4. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and update the values:

```env
PORT=3000
NODE_ENV=development

# Update with your PostgreSQL credentials
DB_URL=postgresql://postgres:password@localhost:5432/alert_monitoring

# Update with your MongoDB connection string
MONGO_URL=mongodb://localhost:27017/alert_monitoring

# Generate a secure random string for production
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-min-256-bits
```

### 5. Start the Server

Development mode (with auto-reload):

```bash
npm run dev
```

Production mode:

```bash
npm start
```

The server will start on `http://localhost:3000` (or the PORT specified in .env).

## API Endpoints

### Authentication

- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - User logout
- `POST /api/v1/auth/register` - Register new user (admin only)

### Houses

- `GET /api/v1/houses` - List houses (filtered by ownership)

### Devices

- `GET /api/v1/devices` - List devices with filtering and pagination
- `POST /api/v1/devices` - Register new device
- `GET /api/v1/devices/:id` - Get device details
- `POST /api/v1/devices/:id/metrics` - Ingest telemetry data

### Metrics

- `GET /api/v1/metrics/alerts-by-day` - Daily alert aggregation
- `GET /api/v1/metrics/device/:id` - Device health metrics

### ML

- `POST /api/v1/ml/predict` - ML inference endpoint (mocked)

### WebSocket

- `ws://localhost:3000/ws` - Real-time updates

## Testing the API

### 1. Login

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@example.com","password":"admin123"}'
```

Save the `access_token` from the response.

### 2. List Houses

```bash
curl http://localhost:3000/api/v1/houses \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 3. List Devices

```bash
curl http://localhost:3000/api/v1/devices \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 4. Register a Device

```bash
curl -X POST http://localhost:3000/api/v1/devices \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "house_id": "YOUR_HOUSE_ID",
    "device_type": "microphone",
    "name": "Kitchen Mic"
  }'
```

### 5. Send Telemetry

```bash
curl -X POST http://localhost:3000/api/v1/devices/YOUR_DEVICE_ID/metrics \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "metrics": {
      "snr": 45.2,
      "rms": 0.023,
      "decibel": 65.5
    }
  }'
```

### 6. Get Device Metrics

```bash
curl http://localhost:3000/api/v1/metrics/device/YOUR_DEVICE_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 7. Get Alerts by Day

```bash
curl "http://localhost:3000/api/v1/metrics/alerts-by-day?start_date=2025-11-01&end_date=2025-11-14" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Database Schema

### PostgreSQL Tables

- `users` - User accounts with roles
- `houses` - Properties owned by users
- `devices` - IoT devices in houses
- `alerts` - Alert records
- `alert_history` - Alert action audit trail
- `refresh_tokens` - JWT refresh tokens

### MongoDB Collections

- `telemetry` - Time-series sensor data
- `ml_inference` - ML model predictions

## Security

- All endpoints (except auth) require JWT authentication
- Passwords are hashed with bcrypt (10 salt rounds)
- Access tokens expire after 1 hour
- Refresh tokens expire after 7 days
- Role-based access control enforced on sensitive endpoints

## Development Notes

- The server uses connection pooling for both PostgreSQL and MongoDB
- WebSocket broadcasts are sent to all connected clients
- Error responses follow a consistent format
- All timestamps are stored in ISO 8601 format

## Troubleshooting

### PostgreSQL Connection Error

- Verify PostgreSQL is running: `pg_isready`
- Check connection string in `.env`
- Ensure database exists: `psql -l | grep alert_monitoring`

### MongoDB Connection Error

- Verify MongoDB is running: `mongosh --eval "db.version()"`
- Check connection string in `.env`
- Ensure MongoDB is accessible on the specified port

### JWT Errors

- Ensure `JWT_SECRET` is set in `.env`
- For production, use a secure random string (min 256 bits)

## License

MIT
