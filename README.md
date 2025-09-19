# CloneMentor Pro

> **Professional Elementor Webpage Cloner** - Transform any website into a perfect, editable Elementor template with one click.

![CloneMentor Pro](./public/logo.svg)

## 🚀 Features

- **One-Click Cloning** - Simply enter any URL and get a complete Elementor template
- **Pixel-Perfect Accuracy** - Maintains exact layouts, spacing, typography, and styling
- **AI-Powered Engine** - Advanced algorithms understand page structure intelligently
- **Fully Editable** - Every element is fully editable in Elementor's drag-and-drop builder
- **Lightning Fast** - Advanced processing completes pages in seconds
- **Clean Code Export** - Generates optimized Elementor JSON with no bloat
- **Media Extraction** - Automatically captures all images, backgrounds, and media
- **Gamified UX** - Watch the magic happen with our engaging scanning animation

## 🛠️ Technology Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Framer Motion
- **Backend**: Node.js, Express, Puppeteer
- **Core Engine**: AI-powered CSS/HTML analysis with Elementor conversion
- **Deployment**: Docker, Docker Compose
- **Future**: Stripe integration, Redis caching, PostgreSQL

## 🏗️ Project Structure

```
CloneMentorPro/
├── src/                    # React frontend
│   ├── components/         # React components
│   │   ├── Hero.jsx       # Landing page hero
│   │   ├── Scanner.jsx    # Gamified scanning interface
│   │   ├── Features.jsx   # Features showcase
│   │   ├── Pricing.jsx    # Pricing plans
│   │   └── Footer.jsx     # Footer component
│   ├── App.jsx           # Main app component
│   ├── main.jsx          # React entry point
│   └── index.css         # Global styles
├── server/                # Node.js backend
│   ├── core/             # Core cloning engine
│   │   ├── elementor-converter.js  # HTML to Elementor JSON
│   │   └── web-scraper.js         # Puppeteer scraping
│   ├── routes/           # API routes
│   │   ├── clone.js      # Cloning endpoints
│   │   └── stripe.js     # Payment endpoints
│   └── index.js          # Server entry point
├── public/               # Static assets
├── research-elementor-format.md  # Elementor format documentation
├── Dockerfile           # Container configuration
├── docker-compose.yml   # Multi-service setup
└── package.json         # Dependencies and scripts
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Chrome/Chromium (for Puppeteer)
- Docker (optional, for deployment)

### Development Setup

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd CloneMentorPro
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start Development Servers**
   ```bash
   # Terminal 1 - Backend
   npm run server
   
   # Terminal 2 - Frontend
   npm run dev
   ```

4. **Access the Application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000
   - Health Check: http://localhost:5000/api/health

### Production Deployment

#### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build manually
docker build -t clonementor-pro .
docker run -p 5000:5000 clonementor-pro
```

#### Manual Deployment

```bash
# Build frontend
npm run build

# Start production server
NODE_ENV=production PORT=5000 npm run server
```

## 📚 API Documentation

### Clone Endpoint

**POST** `/api/clone/scan`

Scan and clone a webpage into Elementor format.

```json
{
  "url": "https://example.com"
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "1234567890",
  "template": {
    "version": "0.4",
    "title": "Example Domain",
    "type": "page",
    "content": [...],
    "page_settings": {...},
    "metadata": {...}
  },
  "metadata": {
    "originalUrl": "https://example.com",
    "title": "Example Domain",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "elementsCount": 5,
    "hasImages": true,
    "hasFonts": false
  }
}
```

### Health Check

**GET** `/api/health`

Check server status.

## 🎯 Core Algorithms

### 1. Web Scraping Engine

- **Puppeteer Integration**: Headless Chrome automation
- **Dynamic Content**: Waits for JavaScript execution
- **CSS Extraction**: Captures both external and computed styles
- **Media Collection**: Downloads images and background assets
- **Font Detection**: Identifies and preserves custom fonts

### 2. Elementor Conversion Engine

- **Structure Analysis**: Identifies sections, columns, and widgets
- **CSS Parsing**: Converts CSS properties to Elementor settings
- **Widget Mapping**: Maps HTML elements to Elementor widgets
- **Responsive Design**: Preserves mobile/tablet breakpoints
- **Clean Output**: Generates optimized, bloat-free JSON

### 3. Gamified UX Engine

- **Real-time Progress**: Live updates during cloning process
- **Visual Scanning**: Animated scan lines and progress bars
- **Phase Messaging**: Clear status updates for each step
- **Error Handling**: Graceful failure with retry options

## 🔧 Configuration

### Environment Variables

```bash
# Server Configuration
PORT=5000
NODE_ENV=development

# Stripe Configuration (Future)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

### Puppeteer Configuration

The scraper is optimized for:
- Headless Chrome execution
- Network optimization
- Cross-origin handling
- Resource cleanup
- Error recovery

## 🚨 Important Notes

### Legal Compliance

CloneMentor Pro is designed for legitimate use cases:
- Redesigning your own websites
- Creating templates from open-source sites
- Educational and development purposes

**Users are responsible for:**
- Respecting copyright laws
- Obtaining necessary permissions
- Following website terms of service

### Performance Optimization

- **Caching**: Future Redis integration for faster repeat clones
- **Concurrent Processing**: Multiple clones can run simultaneously
- **Resource Limits**: Configurable timeouts and memory limits
- **Error Recovery**: Automatic retry mechanisms

## 🛣️ Roadmap

### Phase 1: Core MVP ✅
- Basic cloning engine
- Elementor conversion
- Gamified frontend
- API endpoints

### Phase 2: Enhancement 🚧
- Stripe payment integration
- User authentication
- Credit system
- Advanced CSS handling

### Phase 3: Scale 📋
- Redis caching
- Database integration
- API rate limiting
- Advanced analytics

### Phase 4: Advanced 🎯
- Batch cloning
- Custom integrations
- White-label options
- Enterprise features

## 🤝 Contributing

CloneMentor Pro is a professional product. Contact the development team for contribution guidelines.

## 📄 License

Proprietary - All rights reserved.

---

**CloneMentor Pro** - Where any webpage becomes your perfect Elementor template. 🎯

Built with ❤️ by the CloneMentor team.