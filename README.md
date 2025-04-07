# Microservices Social Media Application

## Overview

This is a microservices-based social media application with the following services:

- Auth Service: Handles user authentication and authorization
- Users Service: Manages user profiles and information
- Posts Service: Handles creation and retrieval of posts
- Likes Service: Manages likes on posts
- Gateway Service: API Gateway that routes requests to appropriate services

## Prerequisites

- Docker and Docker Compose
- Node.js (for local development)
- pnpm (for package management)

## Getting Started

### Starting the Application

To start all services using Docker Compose:

\`\`\`bash

# Build and start all containers

docker-compose up --build

# Run in detached mode

docker-compose up --build -d
\`\`\`

### Stopping the Application

To stop all services:

\`\`\`bash
docker-compose down
\`\`\`

## Services

### Auth Service

- **Port**: 3001
- **Functionality**: User registration, login, logout, and token management
- **Endpoints**:
  - POST /api/auth/register - Register a new user
  - POST /api/auth/login - Login a user
  - POST /api/auth/logout - Logout a user
  - GET /api/auth/me - Get current authenticated user

### Users Service

- **Port**: 3002
- **Functionality**: User profile management
- **Endpoints**:
  - GET /api/users/:id - Get user by ID
  - GET /api/users/me - Get current user profile
  - PUT /api/users/me - Update current user profile
  - GET /api/users/search - Search for users

### Posts Service

- **Port**: 3003
- **Functionality**: Create, read, update, and delete posts
- **Endpoints**:
  - POST /api/posts - Create a new post
  - GET /api/posts - Get all posts
  - GET /api/posts/:id - Get post by ID
  - PUT /api/posts/:id - Update a post
  - DELETE /api/posts/:id - Delete a post

### Likes Service

- **Port**: 3004
- **Functionality**: Like and unlike posts
- **Endpoints**:
  - POST /api/likes - Like a post
  - DELETE /api/likes/:postId - Unlike a post
  - GET /api/likes/post/:postId - Get likes for a post
  - GET /api/likes/user/:userId - Get likes by a user

### Gateway Service

- **Port**: 3000
- **Functionality**: Routes API requests to appropriate services
- **Base URL**: http://localhost:3000/api

## Development

### Running Services Locally

Each service can be run locally for development:

\`\`\`bash
cd services/<service-name>
pnpm install
pnpm dev
\`\`\`

### Running Tests

To run tests for a specific service:

\`\`\`bash
cd services/<service-name>
pnpm test
\`\`\`

## Architecture

The application follows a microservices architecture with:

- Independent services with their own databases
- Kafka for event-driven communication between services
- Redis for caching
- JWT for authentication
- API Gateway pattern for request routing

## Technologies

- Node.js and Express
- Sequelize ORM with SQLite
- Kafka for messaging
- Redis for caching
- Docker for containerization
- JWT for authentication
