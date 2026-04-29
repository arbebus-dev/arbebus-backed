# Arbebus - Modern Transit Navigation

Arbebus is a privacy-first, high-performance transit navigation app inspired by Apple Maps architecture principles. Built for seamless multimodal transportation in Lithuania, featuring real-time bus tracking, intelligent route planning, and location-aware notifications.

## 🏗️ Architecture Overview

Following Apple Maps design principles, Arbebus implements a modular, privacy-focused architecture with clean separation of concerns:

### Core Principles
- **Privacy-First**: Minimal data collection, on-device processing where possible
- **Performance**: Optimized for speed and battery efficiency
- **Accuracy**: Real-time transit data with live vehicle tracking
- **Modularity**: Clean separation between UI, business logic, and data layers
- **Real-Time**: Live transit updates and intelligent notifications

### System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Mobile App    │    │   Backend API   │    │   Data Layer    │
│   (React Native)│◄──►│   (Node.js)     │◄──►│   (PostgreSQL)  │
│                 │    │                 │    │                 │
│ • Maps & UI     │    │ • Transit API   │    │ • GTFS Data     │
│ • Route Planning│    │ • Live Vehicles │    │ • Real-time     │
│ • Notifications │    │ • Places Search │    │ • Caching       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Key Components

#### Frontend (Mobile App)
- **Framework**: React Native with Expo
- **Navigation**: Expo Router with file-based routing
- **Maps**: React Native Maps with vector rendering
- **State Management**: React hooks with context
- **Real-time Updates**: WebSocket connections for live data

#### Backend (API Server)
- **Runtime**: Node.js with Express.js
- **Database**: PostgreSQL with PostGIS for spatial queries
- **Caching**: Redis for performance optimization
- **External APIs**: GTFS feeds, live vehicle data, geocoding

#### Data Layer
- **Transit Data**: GTFS (General Transit Feed Specification)
- **Spatial Data**: PostGIS for geographic operations
- **Real-time**: Live vehicle positions and arrival times
- **Caching**: Redis for frequently accessed data

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 13+
- Redis (optional, for caching)
- Expo CLI

### Installation

1. **Clone and install dependencies**
   ```bash
   git clone <repository-url>
   cd arbebus
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Set up database**
   ```bash
   npm run backend:schema
   npm run backend:import-gtfs
   ```

4. **Start development servers**
   ```bash
   # Terminal 1: Backend
   npm run backend

   # Terminal 2: Frontend
   npm start
   ```

## 📱 Features

### Core Functionality
- **Real-time Transit**: Live bus positions and arrival times
- **Intelligent Routing**: Multimodal journey planning
- **Location Services**: GPS-based stop detection and notifications
- **Offline Support**: Cached routes and basic functionality
- **Privacy Protection**: Minimal data collection and local processing

### Advanced Features
- **Leave Alerts**: Smart notifications based on walking time
- **Places Integration**: POI search and location discovery
- **News Feed**: Transit-related updates and announcements
- **Push Notifications**: Expo-powered cross-platform alerts

## 🛠️ Development

### Project Structure
```
arbebus/
├── app/                    # Frontend (Expo Router)
├── backend/               # API Server
│   ├── services/         # Business logic
│   ├── routes/          # API endpoints
│   └── data/            # Static data files
├── components/           # Reusable UI components
├── core/                # Shared business logic
├── types/               # TypeScript definitions
└── scripts/            # Development utilities
```

### Key Scripts
- `npm start` - Start Expo development server
- `npm run backend` - Start API server
- `npm run lint` - Run ESLint
- `npm run android` - Build for Android
- `npm run ios` - Build for iOS

### Testing
```bash
# Test transit planning
npm run test-transit-plan

# Health check
curl http://localhost:10000/health
```

## 🔧 Configuration

### Environment Variables
```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/arbebus

# External APIs
GTFS_SOURCE_URL=https://example.com/gtfs.zip
OPENROUTESERVICE_API_KEY=your-api-key

# App Configuration
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Database Setup
```bash
# Create schema
npm run backend:schema

# Import GTFS data
npm run backend:import-gtfs

# Verify setup
npm run backend:check-db
```

## 📊 API Documentation

### Core Endpoints

#### Transit Planning
```http
POST /transit/plan
Content-Type: application/json

{
  "origin": {"latitude": 55.7033, "longitude": 21.1443},
  "destination": {"latitude": 55.7090, "longitude": 21.1312}
}
```

#### Live Vehicles
```http
GET /live-buses
```

#### Places Search
```http
GET /places/search?q=akropolis&lat=55.7033&lon=21.1443
```

## 🔒 Privacy & Security

Arbebus follows privacy-first principles:
- **No tracking**: Location data used only for transit features
- **Local processing**: Route calculations performed on-device where possible
- **Minimal data retention**: Transit data cached temporarily
- **Transparent data usage**: Clear user consent for all features

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

### Code Style
- TypeScript for type safety
- ESLint for code quality
- Prettier for formatting
- Conventional commits

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Inspired by Apple Maps architecture principles
- Built with Expo and React Native
- Powered by open transit data (GTFS)
- Lithuanian transit data from visimarsrutai.lt
