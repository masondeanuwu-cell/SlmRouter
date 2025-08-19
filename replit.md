# HTTP Proxy Dashboard

## Overview

This is a full-stack web application that provides an HTTP proxy server with a real-time dashboard interface. The application captures, logs, and displays all HTTP traffic passing through the proxy, with HTML rewriting capabilities to ensure all requests from embedded iframes flow through the proxy. It features a React-based dashboard for configuring proxy settings, monitoring traffic in real-time, and viewing detailed request statistics.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite as the build tool
- **UI Components**: Built with Radix UI primitives and styled with Tailwind CSS following the shadcn/ui design system
- **State Management**: TanStack Query (React Query) for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation for type-safe form handling

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful endpoints under `/api` namespace
- **Proxy Logic**: Custom implementation using Axios for HTTP requests and Cheerio for HTML parsing/rewriting
- **Request Logging**: Comprehensive middleware for capturing and logging all proxy traffic
- **Error Handling**: Centralized error handling with proper HTTP status codes

### Data Storage Solutions
- **Database**: PostgreSQL with Neon Database serverless driver
- **ORM**: Drizzle ORM with type-safe schema definitions
- **Schema Design**: Three main entities:
  - `proxy_configs`: Stores proxy configuration settings
  - `request_logs`: Records all HTTP requests passing through the proxy
  - `server_stats`: Tracks aggregate statistics and performance metrics
- **Fallback Storage**: In-memory storage implementation for development/testing

### Authentication and Authorization
- **Current State**: No authentication system implemented
- **Session Management**: Basic session handling infrastructure present but not actively used
- **Security**: CORS handling and request validation through Zod schemas

### Core Features
- **HTML Rewriting**: Automatically modifies HTML content to redirect all embedded resources through the proxy
- **Real-time Monitoring**: Live dashboard showing active connections, request counts, and data transfer statistics
- **Traffic Logging**: Detailed logging of all HTTP requests including method, URL, response status, size, and duration
- **Iframe Preview**: Embedded preview of proxied content with expansion capabilities
- **Configuration Management**: Dynamic proxy configuration with persistent storage

## External Dependencies

### Database Services
- **Neon Database**: Serverless PostgreSQL database with connection pooling
- **Drizzle Kit**: Database migration and schema management tools

### Frontend Libraries
- **Radix UI**: Comprehensive set of accessible UI primitives for React
- **TanStack Query**: Powerful data synchronization for React applications
- **Tailwind CSS**: Utility-first CSS framework with custom design tokens
- **Wouter**: Minimalist routing library for React
- **Lucide React**: Modern icon library with consistent design

### Backend Services
- **Axios**: HTTP client for making proxy requests to target servers
- **Cheerio**: Server-side jQuery implementation for HTML parsing and manipulation
- **Express**: Fast, unopinionated web framework for Node.js

### Development Tools
- **Vite**: Next-generation frontend build tool with hot module replacement
- **TypeScript**: Static type checking and enhanced developer experience
- **ESBuild**: Fast JavaScript bundler for production builds
- **PostCSS**: Tool for transforming CSS with JavaScript plugins

### Utility Libraries
- **Zod**: TypeScript-first schema declaration and validation library
- **Class Variance Authority**: Utility for creating type-safe CSS class variants
- **Date-fns**: Modern JavaScript date utility library
- **Nanoid**: URL-friendly unique string ID generator