# Larval Management & Feeding Notification System

## Overview

This is a Streamlit-based web application designed to manage larval batches and send automated feeding notifications via SMS. The system tracks multiple larval batches, monitors their feeding schedules, and sends timely reminders to ensure proper care and feeding of laboratory specimens.

## System Architecture

### Frontend Architecture
- **Framework**: Streamlit web application
- **UI Pattern**: Multi-page navigation with sidebar
- **Pages**: Dashboard, Add New Batch, Settings, Feeding Log
- **State Management**: Streamlit session state for data persistence
- **Deployment**: Autoscale deployment on Replit infrastructure

### Backend Architecture
- **Language**: Python 3.11
- **Data Persistence**: JSON file-based storage (no database)
- **Core Services**:
  - `DataManager`: Handles all data operations and batch management
  - `twilio_service`: SMS notification service integration
- **Background Processing**: Automatic notification checks every 60 seconds

### Data Storage
- **Primary Storage**: JSON files for data persistence
  - `larval_batches.json`: Stores batch information and schedules
  - `feeding_log.json`: Tracks feeding history and events
- **Session State**: In-memory storage for application state
- **Data Format**: JSON with ISO datetime serialization

## Key Components

### 1. Main Application (`app.py`)
- Streamlit web interface with multi-page navigation
- Real-time notification checking and dashboard updates
- Session state management for data persistence
- Auto-refresh functionality for monitoring active batches

### 2. Data Manager (`data_manager.py`)
- Centralized data operations for batch and feeding log management
- JSON serialization/deserialization with datetime handling
- Business logic for batch lifecycle management
- Integration with notification system

### 3. Twilio Service (`twilio_service.py`)
- SMS notification delivery via Twilio API
- Environment-based configuration for credentials
- Message formatting and delivery confirmation
- Error handling and user feedback

### 4. Configuration
- Environment variables for Twilio credentials
- Streamlit server configuration for headless deployment
- Python package management via pyproject.toml

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
- Python 3.11 runtime environment
- Network access for Twilio API calls
- File system access for JSON data storage

## Deployment Strategy

### Platform
- **Target**: Replit autoscale deployment
- **Runtime**: Python 3.11 with Nix package management
- **Port**: 5000 (configured for external access)

### Configuration
- Headless Streamlit server configuration
- Environment variable management for secrets
- Automatic dependency resolution via uv.lock

### Scalability Considerations
- File-based storage suitable for small to medium datasets
- Stateless application design enables horizontal scaling
- Session state management may require sticky sessions in multi-instance deployments

## Changelog

- June 27, 2025. Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.