# Web Container Loading Planner 3D

Professional container loading visualization and optimization tool built with React + TypeScript + Three.js + MySQL.

## Features

✨ **Modern 3D Visualization**
- React Three Fiber for real-time 3D rendering
- Orbit camera controls (rotate, zoom, pan)
- Interactive product placement and manipulation
- Green/red highlighting for valid/invalid positions
- Drag & drop support (ready for implementation)

📦 **Container Management**
- Pre-built container types: 20', 40', 40' HC (Safe)
- Custom container creation and management
- Container capacity tracking (volume & weight)

🎯 **Smart Packing**
- 3D Bin Packing Algorithm (EMS heuristic)
- Auto-packing with one click
- Respects:
  - This Side Up constraints
  - Rotation restrictions
  - Stackability rules
  - Weight capacity limits

👥 **Product Management**
- Product groups with color-coding
- Collapse/expand groups
- Customizable group colors
- Bulk product operations

🛠️ **Layout Operations**
- **Undo/Redo**: Full history support (50 actions)
- **Reset Layout**: Clear all items
- **Manual Packing**: Add items one by one
- **Auto Packing**: Automatic placement algorithm
- **Save/Load**: Persistent layout storage

📊 **Real-time Statistics**
- Volume usage percentage
- Weight usage percentage
- Item count
- Empty space visualization
- Dynamic progress bars

📄 **Export Options**
- **PDF Report**: Complete layout report with details
- **PNG Screenshot**: 3D view snapshot

## Architecture

```
project-root/
├── backend/              # Node.js Express API
│   ├── src/
│   │   ├── config/      # Database configuration
│   │   ├── models/      # Sequelize ORM models
│   │   ├── services/    # Business logic
│   │   ├── controllers/ # Route handlers
│   │   ├── routes/      # API routes
│   │   ├── middleware/  # Express middleware
│   │   ├── utils/       # Helper functions & bin packing
│   │   └── server.js    # Express app entry
│   ├── .env
│   └── package.json
│
├── frontend/            # React TypeScript frontend
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── pages/       # Page components
│   │   ├── store/       # Zustand state management
│   │   ├── services/    # API client
│   │   ├── utils/       # Helper functions
│   │   ├── App.tsx
│   │   └── index.tsx
│   ├── public/
│   ├── .env
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── package.json
│
├── db.js               # Database connection (legacy)
├── binpacking.js       # Bin packing algorithm (legacy)
├── schmea.sql          # Database schema
└── README.md
```

## Database Schema

**Key Tables:**
- `users` - User authentication & authorization
- `container_types` - Available containers (20', 40', 40'HC + custom)
- `product_groups` - Product grouping with colors
- `products` - Master products with dimensions & constraints
- `layouts` - Planning sessions per container
- `layout_items` - Placed products with coordinates/rotation
- `layout_history` - Undo/redo snapshots
- `audit_logs` - Activity tracking

## Setup & Installation

### 1. Database Setup

```bash
# Create MySQL database
mysql -u root -p < schmea.sql

# Or create manually:
CREATE DATABASE IF NOT EXISTS `easy-cargo` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Database credentials (update in `.env`):
```
DB_HOST=localhost
DB_PORT=3306
DB_NAME=easy-cargo
DB_USER=root
DB_PASSWORD=
```

### 2. Backend Setup

```bash
# Navigate to project root
cd d:\Documents\easy-cargo-3d

# Install dependencies
npm install

# Run database seed (creates tables & sample data)
npm run seed

# Start backend server (development)
npm run dev

# Or production:
npm start
```

Backend runs on `http://localhost:5000`

**Default Admin Credentials:**
- Email: `admin@easycargo.local`
- Password: `admin123`

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm start

# Or build for production:
npm run build
```

Frontend runs on `http://localhost:3000`

## API Endpoints

### Products
```
GET    /api/products                 # Get all products
GET    /api/products/grouped         # Get products by groups
GET    /api/products/:id             # Get single product
POST   /api/products                 # Create product
PUT    /api/products/:id             # Update product
DELETE /api/products/:id             # Delete product
PUT    /api/products/bulk/quantities # Bulk update quantities
POST   /api/products/groups          # Create product group
PUT    /api/products/groups/:id      # Update product group
```

### Containers
```
GET    /api/containers               # Get all containers
GET    /api/containers/system        # Get built-in containers
GET    /api/containers/:id           # Get single container
POST   /api/containers/custom        # Create custom container
PUT    /api/containers/:id           # Update container
DELETE /api/containers/:id           # Delete container
```

### Layouts
```
GET    /api/layouts                  # Get all layouts
GET    /api/layouts/:id              # Get layout with items
POST   /api/layouts                  # Create layout
PUT    /api/layouts/:id              # Update layout
DELETE /api/layouts/:id              # Delete layout
POST   /api/layouts/:id/auto-pack    # Run auto packing algorithm
POST   /api/layouts/:id/reset        # Clear all items
GET    /api/layouts/:id/stats        # Get layout statistics
POST   /api/layouts/:id/items        # Add item to layout
PUT    /api/layouts/items/:itemId    # Update item position/rotation
DELETE /api/layouts/items/:itemId    # Remove item from layout
```

## 3D Bin Packing Algorithm

The system uses an **Empty Maximal Space (EMS)** heuristic:

1. **Best-Fit Decreasing**: Items sorted by volume (largest first)
2. **Orientation Selection**: Respects:
   - `this_side_up` - No rotation on X/Z
   - `rotation_allowed` - Can rotate on Y (vertical axis)
3. **Space Management**: Maintains list of maximal free spaces
4. **Constraints Checking**:
   - Container boundaries
   - Weight capacity
   - Stackability rules
   - Maximum stack height

See `src/utils/binpacking.js` for implementation details.

## State Management (Zustand)

**PlannerStore tracks:**
- Current layout & container selection
- All layout items with positions/rotations
- Product groups & containers
- Undo/redo history (50 actions max)
- UI state (panels, loading, etc.)

Actions available:
- `setCurrentLayout`, `setSelectedLayoutItem`
- `addLayoutItem`, `updateLayoutItem`, `removeLayoutItem`
- `pushToHistory`, `undo`, `redo`
- `toggleLeftPanel`, `toggleRightPanel`

## Component Structure

### ContainerViewer3D
- Main 3D viewer with Three.js
- Container outline + grid
- Interactive product boxes
- Color-coded validity (green/red)

### RightPanel
- Container information
- Live statistics dashboard
- Volume & weight usage tracking
- Progress visualization

### ProductGroups
- Left sidebar product list
- Expandable groups
- Color picker for groups
- Auto-insert button per group

### Toolbar
- Undo/Redo buttons
- Reset & Delete operations
- Auto-pack trigger
- Export PDF/PNG
- Panel toggles

### LeftPanel
- Layout list browser
- Create new layouts
- Delete layouts
- Status badges

## Usage Guide

### Creating a Layout

1. Click **"New Layout"** in left panel
2. Enter layout name
3. Select container type (20'/40'/40'HC or custom)
4. Click **"Create"**

### Adding Products

1. Navigate to **Products** section (bottom of left panel)
2. Expand a product group
3. See product list with quantities & attributes

### Auto Packing

**Option 1: Per Group**
- Click ⚡ button on product group
- All items in group auto-packed

**Option 2: All Products**
- Click ⚡ **Auto Pack** in toolbar
- All products auto-packed into container

### Manual Placement

1. Select item in 3D viewer (green highlight)
2. Drag to move (when implemented)
3. Use right panel to see container space

### Undo/Redo

- Click ↶ **Undo** or ↷ **Redo** in toolbar
- Up to 50 actions tracked
- History resets on new layout

### Exporting

1. Click 📄 **Export PDF** for full report
2. Click 📸 **Export PNG** for 3D screenshot
3. Files saved to downloads

## Roadmap / TODOs

- [ ] Drag & drop implementation in 3D viewer
- [ ] Snapping to grid
- [ ] Collision detection improvements
- [ ] Layer management for stacking
- [ ] Print-friendly PDF reports with diagrams
- [ ] Batch operations
- [ ] Real-time collaboration
- [ ] Odoo integration for product/order sync
- [ ] Advanced packing algorithms (genetic algorithm)
- [ ] Performance optimizations for large layouts

## Technologies Used

**Frontend:**
- React 18 with TypeScript
- React Three Fiber for 3D rendering
- Three.js for WebGL
- Zustand for state management
- Tailwind CSS for styling
- Lucide React for icons
- Axios for API calls

**Backend:**
- Node.js + Express.js
- Sequelize ORM
- MySQL 8.0+
- Helmet for security
- CORS enabled

**Development:**
- Vite / Create React App
- Nodemon for hot reload
- ESLint + Prettier

## Performance Considerations

- **Large Layouts**: Bin packing optimized for 100+ items
- **3D Rendering**: WebGL acceleration enabled
- **Database**: Indexed queries on common filters
- **API**: Pagination support for list endpoints
- **History**: Limited to 50 items (configurable)

## Security Notes

- Passwords hashed with bcryptjs
- CORS enabled for frontend origin
- Helmet middleware for common vulnerabilities
- Input validation on all endpoints
- Database connection pooling enabled

## Troubleshooting

**Backend won't start:**
```bash
# Check database connection
npm run seed

# Verify .env is correct
cat .env

# Check port 5000 is available
netstat -an | grep 5000
```

**Frontend showing blank screen:**
```bash
# Clear cache
npm cache clean --force

# Rebuild
npm run build

# Check console for errors
# Open DevTools: F12
```

**Auto-pack not working:**
- Ensure products have quantities > 0
- Check product dimensions < container dimensions
- Verify weight doesn't exceed capacity

## Support & Documentation

For issues or questions:
1. Check error messages in browser console (F12)
2. Check server logs: `npm run dev`
3. Review API response in Network tab
4. Check `.env` configuration

## License

MIT

---

**Built with ❤️ for efficient container loading**
