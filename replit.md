# Electricity Meter Reading App (Iraq)

## Overview

A field application for electricity meter readers in Iraq to efficiently collect meter readings and photos during daily routes. The app enables readers to view assigned meters, record new readings with photos, and track completion progress. Built as a React Native/Expo mobile application with an Express.js backend and PostgreSQL database.

**Target Users**: Field electricity meter readers in Iraq
**Primary Language**: Arabic (RTL layout)
**Platform**: Cross-platform mobile (iOS, Android) with web support

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React Native with Expo SDK 54
- **Navigation**: React Navigation (Native Stack) - stack-only navigation for single-purpose workflow
- **State Management**: TanStack React Query for server state, React useState for local state
- **Styling**: StyleSheet API with custom theme system supporting light/dark modes
- **Fonts**: Cairo font family (Arabic-optimized)
- **RTL Support**: Forced RTL layout via I18nManager for Arabic interface
- **Animations**: React Native Reanimated for smooth interactions

### Screen Structure
1. **MetersListScreen**: Main dashboard showing assigned meters with search, progress indicator, and completion status
2. **ReadingEntryScreen**: Form for inputting readings, capturing photos via camera, and adding notes
3. **SettingsScreen**: User preferences and profile settings

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM with PostgreSQL
- **API Style**: RESTful JSON API
- **Schema Validation**: Zod (via drizzle-zod integration)

### Data Model
- **Readers**: User accounts for meter readers (id, username, password, displayName)
- **Meters**: Assigned meters with subscriber info, previous readings, amounts (accountNumber, meterNumber, category, subscriberName, record/block/property sequence)
- **Readings**: Individual reading entries with photos and notes

### Key Design Decisions

**Stack-only Navigation**: Chosen over tab navigation because the app has a focused, linear workflow - list meters → enter reading → return. This matches the field worker's mental model.

**Forced RTL Layout**: The app is Arabic-first, so RTL is enforced at the I18nManager level rather than being optional.

**High-Contrast Theme**: Designed for outdoor/variable lighting conditions with large color-coded status indicators for quick visual scanning.

**Offline-First Consideration**: While not fully implemented, the architecture with React Query supports caching patterns that could enable offline functionality.

## External Dependencies

### Database
- **PostgreSQL**: Primary data store (requires DATABASE_URL environment variable)
- **Drizzle ORM**: Database access layer with migrations in `/migrations` folder

### Native Capabilities
- **expo-camera**: Capture meter photos in the field
- **expo-image-picker**: Alternative image selection
- **expo-file-system**: Local file management and Base64 conversion for photos
- **expo-media-library**: Save photos to device gallery in "قراءات الكهرباء" album
- **expo-sharing**: Export functionality for readings
- **expo-haptics**: Tactile feedback on interactions

### Photo Storage
Photos are handled with dual storage:
1. **Local Gallery**: Photos are saved to device photo gallery in a dedicated album called "قراءات الكهرباء" using expo-media-library
2. **Cloud Storage**: Photos are uploaded to Replit Object Storage via `/api/upload-photo` endpoint
   - Photos are converted to Base64 and sent to server
   - Server stores photos in `photos/` path in Object Storage
   - Photos can be retrieved via `/api/photo/:path` endpoint
   - Admin panel displays clickable links to view photos

### Admin Panel Features
Located at `/admin` on the backend server (port 5000):
- **Readings Management**: Edit and delete individual readings
- **Month Filtering**: Filter readings by specific month (current year + 2 previous years)
- **Multiple Filters**: Search, reader, type (reading/skipped), photo status, location status, date range
- **Sortable Columns**: Click column headers to sort ascending/descending
- **Export Options**: Excel export for readers, meters, and readings data

### Third-Party Services
- **Google Fonts**: Cairo font family loaded via @expo-google-fonts/cairo

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `EXPO_PUBLIC_DOMAIN`: API server domain for client requests
- `REPLIT_DEV_DOMAIN`: Development domain (auto-set by Replit)

### Build & Development
- **Metro Bundler**: React Native JavaScript bundler
- **esbuild**: Server-side TypeScript bundling
- **drizzle-kit**: Database migrations and schema management