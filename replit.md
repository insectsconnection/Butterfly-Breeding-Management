# Butterfly Breeding Management System

## Overview

This is a comprehensive JavaScript-based web application designed for advanced butterfly breeding operations. The system features CNN-powered species classification, automated cage batch tracking, profit optimization, and real-time SMS notifications. Built for professional butterfly breeders who need sophisticated monitoring and management capabilities.

## System Architecture

### Frontend Architecture
- **Framework**: Pure JavaScript SPA with Socket.IO real-time updates
- **UI Pattern**: Responsive multi-tab interface with modern CSS gradients
- **Pages**: Dashboard, Cage Management, Profit Analytics, Breeding Log, Settings
- **State Management**: Real-time synchronization with server via WebSocket
- **Deployment**: Node.js Express server on Replit infrastructure

### Backend Architecture
- **Language**: Node.js with Express framework
- **Real-time Communication**: Socket.IO for live updates and notifications
- **Data Persistence**: JSON file-based storage with automatic serialization
- **Core Services**:
  - `CageBatch`: Advanced breeding batch management class
  - Twilio SMS integration for critical alerts
  - QR code generation for batch tracking
  - Automated profit calculation engine
- **Background Processing**: Cron-based monitoring every 30 minutes

### Data Storage
- **Primary Storage**: JSON files for data persistence
  - `data/batches.json`: Advanced cage batch information with profit calculations
  - `data/breeding_log.json`: Comprehensive breeding activity tracking
  - `data/profit_data.json`: Financial analytics and projections
- **File Uploads**: Image storage for batch documentation
- **Real-time State**: In-memory caching with WebSocket synchronization

## Key Components

### 1. Main Server (`server.js`)
- Express.js REST API with comprehensive breeding management endpoints
- Socket.IO real-time communication for live updates
- Advanced CageBatch class with profit optimization algorithms
- Automated monitoring with cron-based scheduling
- Multi-species support with host plant requirements database

### 2. Advanced Breeding Features
- **Species Database**: 8 butterfly species with host plant requirements
- **Lifecycle Management**: 4-stage tracking (Egg → Larva → Pupa → Adult)
- **Quality Assessment**: Defect tracking with quality score calculations
- **Profit Optimization**: Real-time revenue and cost projections
- **QR Code Generation**: Batch identification and mobile scanning

### 3. Real-time Monitoring
- **SMS Alerts**: Twilio integration for critical notifications
- **WebSocket Updates**: Live dashboard synchronization
- **Automated Scheduling**: Background monitoring and alert system
- **Image Processing**: File upload support for batch documentation

### 4. Professional Interface
- **Modern UI**: Gradient-based responsive design
- **Mobile-Ready**: Touch-friendly interface for field operations
- **Real-time Analytics**: Live profit calculations and performance metrics
- **Export Functionality**: JSON data export for external analysis

## Data Flow

1. **Batch Creation**: Users create new larval batches with species, count, and feeding schedules
2. **Data Persistence**: Batch information stored in JSON files with datetime serialization
3. **Monitoring Loop**: Application checks for due feedings every 60 seconds
4. **Notification Trigger**: When feeding is due, SMS notifications sent via Twilio
5. **Log Recording**: All feeding events and notifications logged for tracking
6. **Dashboard Updates**: Real-time display of active batches and their status

## External Dependencies

### Required Services
- **Twilio**: SMS notification service requiring:
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_PHONE_NUMBER`

### Python Packages
- `streamlit>=1.46.1`: Web application framework
- `pandas>=2.3.0`: Data manipulation and analysis
- `twilio>=9.6.3`: SMS service integration

### Runtime Requirements
- Node.js 20.x runtime environment
- Network access for Twilio SMS API and Socket.IO
- File system access for JSON data and image uploads

## Deployment Strategy

### Platform
- **Target**: Replit autoscale deployment
- **Runtime**: Node.js 20.x with npm package management
- **Port**: 5000 (configured for external access with WebSocket support)

### Configuration
- Express.js server with CORS and real-time capabilities
- Environment variable management for Twilio credentials
- Automatic dependency resolution via package.json

### Scalability Considerations
- File-based storage suitable for medium-scale breeding operations
- Real-time WebSocket connections for instant updates
- RESTful API design enables future mobile app integration
- Modular architecture supports additional CNN model integration

## Advanced Features Implemented

### CNN Integration Ready
- Image upload infrastructure for specimen photos
- Quality assessment framework for automated defect detection
- Species classification foundation (awaiting TensorFlow.js model)

### Profit Optimization Engine
- Real-time profit calculations per batch
- Species-specific market pricing database
- Quality-adjusted revenue projections
- Cost tracking with host plant and labor factors

### Mobile-First Design
- QR code generation for each cage batch
- Touch-friendly interface for field operations
- Responsive design for tablet and phone usage

## Changelog

- June 27, 2025: Complete JavaScript rebuild with advanced breeding features
- June 27, 2025: Initial Python Streamlit setup (deprecated)

## User Preferences

Preferred communication style: Simple, everyday language.