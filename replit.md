# Butterfly Breeding Management System

## Overview

This is a comprehensive JavaScript-based web application designed for advanced butterfly breeding operations. The system features CNN-powered species classification, automated cage batch tracking, profit optimization, and real-time SMS notifications. Built for professional butterfly breeders who need sophisticated monitoring and management capabilities.

**Status**: Successfully migrated from Replit Agent to standard Replit environment (July 18, 2025)

## Recent Changes
✓ **Migration Completed** (July 18, 2025)
  - Node.js dependencies installed and configured
  - PostgreSQL database created and initialized with all required tables
  - Authentication endpoints fixed (/api/auth/login)
  - JavaScript architecture refactored for better reliability
  - CNN models and payment system properly initialized
  - Server running on port 5000 with full functionality

**Migration Status:** Successfully migrated from Replit Agent to standard Replit environment on July 18, 2025. All core functionality is operational with PostgreSQL database integration.

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
- **Primary Storage**: PostgreSQL database with connection pooling
  - **Batches Table**: Advanced cage batch information with profit calculations
  - **Sales History Tables**: Dedicated tables for marketplace sales (pupae_sales, larva_sales, egg_sales, butterfly_sales)
  - **Breeding Log Table**: Comprehensive breeding activity tracking
  - **Users Table**: User authentication and profile management
  - **Orders & Payments Tables**: E-commerce transaction management
- **File Uploads**: Image storage for batch documentation
- **Real-time State**: Database-backed with WebSocket synchronization
- **Legacy Support**: JSON file fallback for compatibility

## Key Components

### 1. Main Server (`server.js`)
- Express.js REST API with comprehensive breeding management endpoints
- Socket.IO real-time communication for live updates
- Advanced CageBatch class with profit optimization algorithms
- Automated monitoring with cron-based scheduling
- Multi-species support with host plant requirements database

### 2. Advanced Breeding Features
- **Species Database**: 8 butterfly species with host plant requirements
- **Automatic Lifecycle Management**: 4-stage tracking (Egg → Larva → Pupa → Adult) with automatic status updates:
  - Egg → Larva: Automatically marked as "hatched" with feeding schedule reset
  - Larva → Pupa: Automatically marked as "transferred" with feeding schedule stopped
  - Pupa → Butterfly: Automatically marked as "harvested" with feeding schedule resumed
  - Feeding actions: Larvae and Butterflies automatically marked as "fed"
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
- **User Profile System**: Separate seller and purchaser profiles with portfolio tracking
- **Marketplace Integration**: Profile links in marketplace listings for buyer transparency

## Data Flow

### Complete System Workflow
1. **User Registration/Login** → Authentication validation → Session establishment
2. **Batch Creation** → Database storage → Lifecycle tracking initialization → Achievement system activation
3. **Image Upload** → CNN model classification → Result storage → Dashboard updates
4. **Health Monitoring** → Survival rate updates → Profit recalculation → Alert generation
5. **Dashboard Access** → Data aggregation → Visualization rendering → Achievement progress display

### Legacy Monitoring Flow
1. **Batch Creation**: Users create new larval batches with species, count, and feeding schedules
2. **Data Persistence**: Batch information stored in JSON files with datetime serialization
3. **Monitoring Loop**: Application checks for due feedings every 60 seconds
4. **Notification Trigger**: When feeding is due, SMS notifications sent via Twilio
5. **Log Recording**: All feeding events and notifications logged for tracking
6. **Dashboard Updates**: Real-time display of active batches and their status

## External Dependencies

### Required Services
- **PostgreSQL**: Primary database requiring:
  - `DATABASE_URL`
  - `PGUSER`, `PGPASSWORD`, `PGHOST`, `PGPORT`, `PGDATABASE`
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

- July 17, 2025: **Major System Simplification Complete** - Successfully removed Twilio dependency and simplified system to focus on marketplace trading + AI classification. New features:
  - Removed phone number requirement from batch creation
  - Enhanced marketplace with "Buy Now" and "Reserve" functionality for pupae
  - Added purchase confirmation modals with detailed item information
  - Implemented marketplace purchase and reservation endpoints
  - Streamlined UI to focus on pupae trading rather than complex breeding management
  - Integration with AI classification for quality verification before purchase
- July 17, 2025: Successfully completed migration from Replit Agent to Replit environment with full PostgreSQL database initialization and authentication system restoration
- July 16, 2025: Enhanced TensorFlow.js integration with full CNN model support for butterfly species classification, disease detection, and lifecycle stage identification
- July 16, 2025: Successfully enabled SMS notifications with Twilio integration for automated feeding reminders and breeding alerts
- July 16, 2025: Fixed authentication issues and implemented comprehensive profile portfolio display system for breeders
- July 16, 2025: Successfully completed migration from Replit Agent to Replit environment with PostgreSQL database setup and UUID authentication fix
- July 14, 2025: Successfully migrated from Replit Agent to Replit environment
- July 8, 2025: Migration completed from Replit Agent to Replit environment
- July 8, 2025: Added separate user profiles and seller/purchaser functionality
- July 8, 2025: Enhanced marketplace with seller profile links and user tracking
- July 8, 2025: Enhanced lifecycle management with automatic status tracking
- July 8, 2025: Implemented user profile system with seller/purchaser separation
- July 8, 2025: Added marketplace profile links and portfolio tracking
- July 8, 2025: Migration from Replit Agent to Replit environment completed
- June 27, 2025: Complete JavaScript rebuild with advanced breeding features
- June 27, 2025: Initial Python Streamlit setup (deprecated)

## Recent Features Added

### Augmented Reality Lifecycle Viewer (July 14, 2025)
- **AR Integration**: Fully implemented AR Lifecycle Viewer with WebXR support
- **3D Fallback**: Interactive 3D visualization for devices without AR support
- **Lifecycle Stages**: Visual representation of all 4 butterfly lifecycle stages (Egg, Larva, Pupa, Adult)
- **Interactive Elements**: Click-to-select stages with detailed information display
- **Species Integration**: Species-specific AR visualization with dropdown selection
- **Authentication Fix**: Resolved UUID authentication issues for batch creation
- **Visual Enhancement**: Gradient-based stage cards with hover effects and animations
- **Educational Content**: Detailed stage information including duration, characteristics, care requirements, and common issues

### Migration to Replit Environment (July 14, 2025)
- **Environment Migration**: Successfully migrated project from Replit Agent to Replit environment
- **Database Setup**: PostgreSQL database created and initialized with proper connection pooling
- **Package Installation**: All Node.js dependencies installed and configured
- **Database Schema**: All tables created successfully with proper relationships and constraints
- **Connection Optimization**: Enhanced database connection handling with improved timeout settings
- **Full System Verification**: All features working including CNN models, authentication, and real-time updates

## Recent Features Added

### PostgreSQL Database Integration (July 11, 2025)
- **Database Migration**: Successfully migrated from JSON files to PostgreSQL database
- **Marketplace Sales Preservation**: All pupae, larva, egg, and butterfly sales history preserved during migration
- **Enhanced Data Integrity**: Proper foreign key relationships and data validation
- **Improved Performance**: Connection pooling and optimized queries for better scalability
- **Sales History Tables**: Dedicated tables for each lifecycle stage sales (pupae_sales, larva_sales, egg_sales, butterfly_sales)
- **Pupa Marketplace**: Added harvest, sell, and purchase functionality for pupae with database integration
- **Error Resolution**: Fixed UUID validation errors in breeding log and activity tracking

### Migration Completion (July 11, 2025)
- **Project Migration**: Successfully migrated from Replit Agent to Replit environment
- **Enhanced Cage Management**: Added stage-specific tracking with automatic actions based on lifecycle stage
- **Student Dashboard**: Integrated TESDA training portal with enrollment, scholarship information, and career guidance
- **Improved User Experience**: Stage-specific buttons (Mark as Hatched, Fed, Harvested, Forage) with context-sensitive actions
- **Lifecycle Transitions**: Automatic feeding schedule management based on stage transitions

### Gamification System (July 8, 2025)
- **Achievement System**: 16+ achievements across breeding milestones, species diversity, quality metrics, and profit targets
- **Real-time Tracking**: Automatic achievement unlocking based on lifecycle status transitions
- **User Levels**: Point-based progression system with level advancement
- **Leaderboard**: Community ranking system with achievement counts and total points
- **Achievement Notifications**: Pop-up alerts for newly unlocked achievements with staggered display
- **Progress Tracking**: Visual progress bars showing advancement toward next achievements

### User Profile System
- **Profile Pages**: Individual user profiles with statistics, listings, and purchase history
- **Seller/Purchaser Links**: Marketplace items now include seller profile links
- **User Dashboard**: Separate tabs for personal overview, listings, purchases, and contact info
- **Role-Based Access**: Different functionality based on user roles (breeder, purchaser, etc.)

### Enhanced Marketplace
- **Seller Information**: Each listing shows seller rating and profile access
- **User Tracking**: Batches now track the creating user for proper attribution
- **Profile Integration**: Users can view seller profiles directly from marketplace listings

## User Preferences

Preferred communication style: Simple, everyday language.