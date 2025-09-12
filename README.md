# JoeyJob

## Project Overview

JoeyJob is an online booking and scheduling platform designed for service-based businesses (plumbers, HVAC, electricians, etc.) where the provider travels to the customer's location. Built on a modern TanStack Start foundation, it provides a robust, type-safe full-stack application with enterprise-grade features.

## Core Features
• Multi-step embeddable or standalone booking forms for customers to select services and schedule appointments
• Employee availability checking from Simpro integration
• Per-service scheduling settings (buffers, lead times, assigned employees)
• Optional Facebook/Meta integration for conversion tracking (Pixel and Conversions API)
• Global or per-form webhooks for advanced external integrations
• Admin impersonation for troubleshooting
• Stripe subscription billing
• Planned: PostHog analytics integration

## Tech Stack

### Core Framework
- **TanStack Start**: Full-stack React framework with SSR support
- **TanStack Router**: Type-safe routing with automatic code generation
- **TanStack Query**: Powerful data synchronization and caching
- **TypeScript**: Strict configuration with comprehensive type safety

### Database & Storage
- **PostgreSQL**: Primary database with Drizzle ORM
- **Redis**: Session storage and caching layer
- **Sharp**: Image processing and optimization

### Authentication & Authorization
- **Better Auth**: Extensible authentication system with custom providers
- **Simpro OAuth**: Primary authentication source (provides employee data for availability checking)
- **Planned**: Minuba integration for Danish business systems (invoicing/orders)
- Organization-based multi-tenancy with role-based access control

### UI & Styling
- **Taali UI**: Custom component library built on shadcn/ui
- **Radix UI**: Accessible, unstyled UI primitives
- **Tailwind CSS v4**: Utility-first CSS with Vite plugin
- **Framer Motion**: Animation library for smooth transitions

### Email & Payments
- **React Email**: Component-based email templates
- **Resend**: Transactional email service
- **Stripe**: Subscription billing and payment processing

### Development Tools
- **Vite**: Next-generation build tool with HMR
- **ESLint & Prettier**: Code quality and formatting
- **Vitest**: Unit and integration testing
- **Docker**: Local development environment for databases

## Documentation

### Architecture & Implementation
- **[Architecture & Tech Stack](./docs/01-architecture-tech-stack.md)** - Complete technology stack and architectural patterns
- **[Authentication & Authorization](./docs/02-authentication-authorization.md)** - Better Auth setup with Simpro integration and role-based access
- **[Error Handling & Workflow](./docs/10-error-handling-workflow-file-management.md)** - Comprehensive error handling, development workflow, and file management

### Integration Guides
- **Simpro Integration** - OAuth authentication and employee data synchronization
- **Minuba Integration** (Planned) - Danish business system for invoicing and order management

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Redis 6+
- Docker (for local development)

### Environment Setup
```bash
# Clone the repository
git clone <repository-url>
cd joeyjob

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
```

### Required Environment Variables
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/joeyjob"
REDIS_URL="redis://localhost:6379"

# Authentication
BETTER_AUTH_URL="http://localhost:5722"
BETTER_AUTH_SECRET="your-32-character-secret-key"
VITE_BETTER_AUTH_URL="http://localhost:5722"

# Simpro OAuth (Primary Auth)
SIMPRO_CLIENT_ID="your-simpro-client-id"
SIMPRO_CLIENT_SECRET="your-simpro-client-secret"
SIMPRO_API_URL="https://api.simpro.co"

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Email (Resend)
RESEND_API_KEY="re_..."
```

### Database Setup
```bash
# Start PostgreSQL and Redis with Docker
npm run db:dev

# Run database migrations
npx drizzle-kit push

# Seed initial data (optional)
npm run seed:todos
```

### Development
```bash
# Start development server (port 5722)
npm run dev

# Run type checking
npm run typecheck

# Run linting
npm run lint

# Format code
npm run format

# Run tests
npm run test
```

## Project Structure

```
src/
├── app.tsx                    # Application entry point
├── router.tsx                 # TanStack Router configuration
├── routes/                    # File-based routing
│   ├── _authenticated/        # Protected routes
│   └── api/                   # API routes
├── features/                  # Feature-based modules
│   ├── auth/                  # Authentication
│   ├── billing/               # Stripe billing
│   ├── organization/          # Multi-tenancy
│   └── todos/                 # Example feature
├── lib/                       # Shared utilities
│   ├── auth/                  # Better Auth setup
│   ├── db/                    # Database connections
│   ├── errors/                # Error handling
│   └── storage/               # File storage
├── taali/                     # Taali UI components
│   └── components/ui/         # shadcn-based components
├── database/                  # Database schema
└── emails/                    # Email templates
```

## Scripts

### Development
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run test` - Run tests

### Database
- `npm run db:dev` - Start local databases
- `npm run db:down` - Stop databases
- `npm run db:reset` - Reset databases

### Code Quality
- `npm run typecheck` - TypeScript type checking
- `npm run lint` - ESLint checking
- `npm run lint:fix` - Auto-fix linting issues
- `npm run format` - Format code with Prettier

### Internationalization
- `npm run i18n:extract` - Extract translation keys
- `npm run i18n:audit` - Find missing translations

### Error Management
- `npm run errors:check` - Find unused error codes
- `npm run errors:fix` - Remove unused error codes

## Deployment

### Build for Production
```bash
npm run build
```

### Start Production Server
```bash
npm run start
```

The application will be served from `.output/server/index.mjs` with all assets optimized and bundled.

## Contributing

Please refer to the documentation in the `/docs` folder for detailed implementation guidelines and architectural decisions.

## License

[Your License Here]