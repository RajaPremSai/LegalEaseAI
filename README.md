# Legal Document AI Assistant

An intelligent solution that transforms complex legal documents into clear, accessible guidance using Google Cloud's generative AI.

## Features

- 📄 Document upload and processing (PDF, DOC, DOCX, TXT)
- 🤖 AI-powered document analysis and simplification
- ❓ Interactive Q&A about document content
- ⚠️ Risk assessment and recommendations
- 🔒 Privacy-first approach with automatic document deletion
- 📱 Mobile-responsive design
- 🌍 Multi-language support

## Tech Stack

- **Frontend**: Next.js, React, TypeScript, Material-UI
- **Backend**: Node.js, Express, TypeScript
- **AI/ML**: Google Cloud Document AI, Vertex AI (PaLM 2)
- **Database**: PostgreSQL, Cloud Firestore
- **Infrastructure**: Google Cloud Platform, Docker
- **Monorepo**: Turborepo with npm workspaces

## Project Structure

```
legal-document-ai-assistant/
├── apps/
│   ├── frontend/          # Next.js web application
│   └── backend/           # Express.js API server
├── packages/
│   └── shared/            # Shared types and utilities
├── .github/
│   └── workflows/         # CI/CD pipelines
└── docker-compose.yml     # Local development environment
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm 9+
- Docker and Docker Compose
- Google Cloud Platform account

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd legal-document-ai-assistant
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Set up Google Cloud credentials:
   - Create a service account in Google Cloud Console
   - Download the service account key as `service-account.json`
   - Place it in the project root

### Development

#### Using Docker (Recommended)

1. Start all services:
   ```bash
   npm run docker:up
   ```

2. Access the applications:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - Database: localhost:5432

3. Stop services:
   ```bash
   npm run docker:down
   ```

#### Local Development

1. Start the development servers:
   ```bash
   npm run dev
   ```

2. The applications will be available at:
   - Frontend: http://localhost:3000
   - Backend: http://localhost:3001

### Available Scripts

- `npm run dev` - Start development servers
- `npm run build` - Build all applications
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run test` - Run tests
- `npm run type-check` - Run TypeScript type checking

## Environment Variables

See `.env.example` for all required environment variables.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Security

This application handles sensitive legal documents. Please ensure:
- All environment variables are properly configured
- Google Cloud IAM permissions are set correctly
- Regular security audits are performed
- Data retention policies are followed