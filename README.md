# Order Management SaaS - Frontend

Next.js + React frontend for Order Management System.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **UI Library:** React 19
- **Styling:** Tailwind CSS
- **API Client:** Axios
- **Language:** JavaScript (TypeScript ready)

## Features

- Order dashboard with real-time updates
- WooCommerce order display
- Manual order creation form
- Delivery tracking interface
- Responsive design

## Getting Started

### Prerequisites

- Node.js 18+
- Backend server running (see backend README)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.local.example .env.local
# Edit .env.local with your API URL
```

3. Start development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## Project Structure

```
src/
├── app/              # Next.js App Router pages
├── components/       # React components
│   ├── layout/       # Layout components
│   ├── orders/       # Order-related components
│   └── common/       # Reusable components
├── lib/              # Utilities and API client
├── contexts/         # React contexts
└── styles/           # Global styles
```

## Environment Variables

- `NEXT_PUBLIC_API_URL` - Backend API URL (default: http://localhost:5000/api)

## Deployment

This project is optimized for deployment on Vercel:

```bash
npm run build
```

See `MVP_SIMPLIFIED.md` for deployment instructions.

## License

ISC
