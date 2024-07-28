# PROJECT: TENITY

A brief description of what the API server does. Component: CORE

## Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)

## Installation

Step-by-step instructions for setting up the development environment.

### Prerequisites

List of software and tools required:

- [Node.js](https://nodejs.org/)
- [Yarn](https://yarnpkg.com/)

### Steps

1. Open the repository
2. Navigate to the project directory:
3. Install dependencies:
   ```bash
   $ yarn bootstrap
   ```

## Configuration

Details on environment variables and configuration files.

### Environment Variables

Create a `.env` file in the root of the project and add the following variables:

```plaintext
# Environment
ENVIRONMENT=

# Local ports
SERVER_PORT=

# Frontend URL
FRONTEND_URL=

# Database
DATABASE_URL=
MONGODB_URL=

# JWT
JWT_AT_SECRET=

# JWT INVITE USER
JWT_INVITE_USER_TO_GROUP_SECRET=
JWT_INVITE_USER_TO_GROUP_EXPIRES=

# AWS
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
SOURCE_EMAIL=

#PAYMENT
PAYMENT_SERVICE_URL=

# Admin
DEFAULT_ADMIN_PASSWORD=

RETURN_URL_PAYMENT_FOR_MOBILE=
RETURN_URL_PAYMENT_FOR_WEB=


INVITE_USER_TO_GROUP_LINK=


FIREBASE_TYPE=
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
FIREBASE_CLIENT_ID=
FIREBASE_UTH_URI=
FIREBASE_TOKEN_URI=
FIREBASE_AUTH_CERT_URL=
FIREBASE_CLIENT_CERT_URL=
FIREBASE_UNIVERSAL_DOMAIN=

REDIS_URL=
```

## Usage

Instructions for running the server

### How to Run

To start the development server:

```bash
$ yarn start:dev
```
