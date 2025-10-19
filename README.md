# CMPE-281-Proj
# Smart Home Care Cloud – Interactive Prototypes

This repository contains high-fidelity, front-end prototypes for the **Smart Home Senior Care Cloud** platform. The goal is to showcase how different user personas (home owners, IoT operations, and cloud service staff) would interact with an intelligent monitoring solution that leverages audio/video analytics, machine learning alerts, and enterprise-grade security.

## 🚀 Project Highlights

- **Role-based entry points** through the login experience with contextual feature callouts.
- **Owner dashboard** featuring live KPIs, alert feeds, device management, quick actions, and statistics tailored to a single residence.
- **Alert detail workspace** that visualizes incident timelines, notification history, and recovery actions, including simulated media playback.
- **IoT fleet manager** for operations teams to monitor device health, rollout firmware updates, and inspect MQTT network metrics across many homes.
- **Vite-powered development** with modern build tooling for optimized production builds.

## 🗂️ Repository Structure

```
.
├── assets/
│   └── css/
│       └── iot-fleet.css         # IoT fleet manager styling (legacy)
├── vite-project/
│   ├── src/
│   │   └── assets/
│   │       ├── css/              # All CSS stylesheets for the application
│   │       │   ├── alert-detail.css
│   │       │   ├── base.css
│   │       │   ├── home.css
│   │       │   ├── iot-fleet.css
│   │       │   └── owner-dashboard.css
│   │       └── js/               # JavaScript modules for interactivity
│   │           ├── alert-detail.js
│   │           ├── iot-fleet.js
│   │           ├── login.js
│   │           ├── owner-dashboard.js
│   │           └── toast.js
│   ├── admin-dashboard.html
│   ├── alert-detail.html
│   ├── home.html
│   ├── index.html
│   ├── iot-fleet-manager.html
│   ├── owner-dashboard.html
│   ├── package.json              # Node dependencies and scripts
│   ├── package-lock.json
│   ├── vite.config.js            # Vite configuration
│   └── .gitignore
└── README.md
```

## 🎨 CSS Asset Details

### Root Level: `assets/css/`
- **`iot-fleet.css`** - Legacy stylesheet for IoT fleet management interface

### Vite Project: `vite-project/src/assets/css/`

The main application stylesheets are organized by page/component:

- **`base.css`** - Global styles, CSS variables, typography, and reusable utility classes shared across all pages
- **`home.css`** - Styling for the home/landing page with role-based navigation cards
- **`alert-detail.css`** - Styles for the detailed alert investigation view, including timeline visualizations and media playback controls
- **`iot-fleet.css`** - Styling for the IoT fleet manager dashboard with device registry, firmware controls, and MQTT health indicators
- **`owner-dashboard.css`** - Styles for the owner-facing monitoring dashboard including KPI cards, alert feeds, and device management modals

**Purpose of CSS files:** These stylesheets define the visual presentation and layout of the application. Each file is scoped to specific pages or components, making the codebase maintainable and modular. The `base.css` file establishes design tokens and common patterns, while page-specific files handle unique layout requirements.

## 💻 JavaScript Asset Details

### `vite-project/src/assets/js/`

The JavaScript modules provide interactivity and dynamic behavior:

- **`login.js`** - Handles authentication form validation, role selection, and navigation to appropriate dashboards
- **`owner-dashboard.js`** - Powers the owner dashboard with dynamic alert rendering, device management modals, KPI updates, and simulated live data ingestion
- **`alert-detail.js`** - Manages alert timeline rendering, acknowledgement workflows, notification history display, and media playback controls
- **`iot-fleet.js`** - Controls IoT fleet management features including device filtering, firmware rollout operations, and MQTT health monitoring
- **`toast.js`** - Shared utility module for displaying temporary notification messages across all pages

**Usage:** These modules are loaded by their corresponding HTML pages and implement the interactive features without requiring any backend services. All data is mocked client-side for prototyping purposes.

## 🧩 Key Features by Screen

| Screen | Highlights |
| --- | --- |
| `index.html` | Role cards with quick navigation, credential form validation, and toast notifications that guide users to the right dashboard. |
| `owner-dashboard.html` | Dynamic alert rendering, device add/edit modals, KPI refreshing, and simulated live alert ingestion. |
| `alert-detail.html` | Timeline of system actions, acknowledgement workflow, notification history, and waveform playback mock. |
| `iot-fleet-manager.html` | Device registry filters, firmware rollout controls, MQTT health indicators, and configuration utilities. |

## 🧭 Getting Started

### Running the Vite Project

The main application is built with Vite for modern development experience:

1. **Navigate to the vite-project directory:**
   ```bash
   cd vite-project
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   This will start Vite's development server with hot module replacement (HMR), typically on `http://localhost:5173`

4. **Build for production:**
   ```bash
   npm run build
   ```
   Creates an optimized production build in the `dist/` folder

5. **Preview production build:**
   ```bash
   npm run preview
   ```
   Serves the production build locally for testing

### Vite-Specific Features

- **Hot Module Replacement (HMR)** - Instant updates without full page reloads during development
- **Fast build times** - Leverages native ES modules and esbuild for blazing-fast bundling
- **Automatic asset optimization** - CSS minification, tree-shaking, and code splitting out of the box
- **Development server** - Built-in dev server with automatic HTTPS support

### Alternative: Direct Browser Usage

For quick prototyping without the build step:

1. Clone this repository or download the source
2. Serve the `vite-project` directory via a local web server (e.g., VS Code Live Server, `python -m http.server`, etc.)
3. Open the desired HTML file in your browser

```bash
# Example: serve on http://localhost:8000
cd vite-project
python -m http.server 8000
```

> **Tip:** When served via a local web server, navigation links between screens work seamlessly because relative URLs stay intact.

## 🛠️ Customization Guide

- **Data & KPIs:** Update the mock data objects inside the corresponding JavaScript files under `vite-project/src/assets/js/` to change device inventories, alert feeds, or statistics.
- **Styling:** Modify CSS files in `vite-project/src/assets/css/` to customize colors, layouts, and component styles. Start with `base.css` for global theme changes.
- **Pages:** Edit HTML files in the `vite-project/` root to adjust structure and content.
- **Build configuration:** Modify `vite.config.js` to customize build settings, add plugins, or configure deployment options.

## 📦 Dependencies

The project uses minimal dependencies managed through npm. See `vite-project/package.json` for the complete list. The main dependency is Vite itself for development and build tooling.

## 🔧 Development Workflow

1. Make changes to HTML, CSS, or JS files
2. Vite automatically detects changes and updates the browser (HMR)
3. Test features in the browser
4. Build for production when ready to deploy
5. Preview the production build to ensure everything works as expected

---

**Built with vanilla HTML, CSS, JavaScript, and powered by Vite for modern development experience.**
