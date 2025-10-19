# CMPE-281-Proj
# Smart Home Care Cloud – Interactive Prototypes

This repository contains high-fidelity, front-end prototypes for the **Smart Home Senior Care Cloud** platform. The goal is to showcase how different user personas (home owners, IoT operations, and cloud service staff) would interact with an intelligent monitoring solution that leverages audio/video analytics, machine learning alerts, and enterprise-grade security.

## 🚀 Project Highlights

- **Role-based entry points** through the login experience with contextual feature callouts.
- **Owner dashboard** featuring live KPIs, alert feeds, device management, quick actions, and statistics tailored to a single residence.
- **Alert detail workspace** that visualizes incident timelines, notification history, and recovery actions, including simulated media playback.
- **IoT fleet manager** for operations teams to monitor device health, rollout firmware updates, and inspect MQTT network metrics across many homes.

All interactions are implemented with vanilla HTML, CSS, and JavaScript—no build tooling is required.

## 🗂️ Repository Structure

```text
.
├── index.html                # Login & landing experience
├── owner-dashboard.html      # Owner-facing monitoring dashboard
├── alert-detail.html         # Detailed alert investigation view
├── iot-fleet-manager.html    # IoT operations dashboard
├── assets/
│   ├── css/                  # Component-specific stylesheets
│   └── js/                   # Behavior for each experience + shared utilities
└── README.md
```

## 🧩 Key Features by Screen

| Screen | Highlights |
| --- | --- |
| `index.html` | Role cards with quick navigation, credential form validation, and toast notifications that guide users to the right dashboard. |
| `owner-dashboard.html` | Dynamic alert rendering, device add/edit modals, KPI refreshing, and simulated live alert ingestion. |
| `alert-detail.html` | Timeline of system actions, acknowledgement workflow, notification history, and waveform playback mock. |
| `iot-fleet-manager.html` | Device registry filters, firmware rollout controls, MQTT health indicators, and configuration utilities. |

## 🧭 Getting Started

1. Clone this repository or download the source.
2. Open the desired HTML file directly in a browser, or serve the project via a local web server for best results (e.g., VS Code Live Server, `python -m http.server`, etc.).
3. Interact with the UI elements to explore the simulated workflows. No backend services are required.

```bash
# Example: serve on http://localhost:8000
python -m http.server 8000
```

> **Tip:** When served via a local web server, navigation links between screens work seamlessly because relative URLs stay intact.

## 🛠️ Customization Guide

- **Data & KPIs:** Update the mock data objects inside the corresponding JavaScript files under `assets/js/` to change device inventories, alert feeds, or statistics.
- **Styling:** Adjust CSS tokens (colors, spacing, typography) within `assets/css/base.css` for global tweaks, or update component-level styles in the screen-specific stylesheet.
- **Interactions:** Each screen has a dedicated script that wires up event listeners and state management. Modify these scripts to connect to real APIs or WebSocket endpoints when you transition from prototype to production.

## 📦 Deployment Notes

These prototypes are front-end only. To publish a demo:

1. Host the repository on any static site provider (GitHub Pages, Netlify, Vercel, S3 + CloudFront, etc.).
2. Ensure all assets maintain their relative paths so cross-page navigation and shared resources resolve correctly.
