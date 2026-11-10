# RescueGrid – Full-Stack Emergency Response Intelligence System

## Features
- Dashboard statistics backed by SQLite
- Create, view and complete emergency incidents
- Emergency priority classification
- Ambulance and hospital resource assignment
- Automatic ambulance release when an incident is completed
- Dijkstra shortest-route calculation and Leaflet map
- REST API with input validation and transactional assignment updates
- Data persists after refresh/restart

## Requirements
- Node.js 18 or later
- npm

## Run the project
1. Extract `RescueGrid_FullStack.zip`.
2. Open the extracted `RescueGrid_FullStack` folder in VS Code.
3. Open the VS Code terminal in this folder.
4. Run:

   ```bash
   npm.cmd install
   npm.cmd start
   ```

5. Open `http://localhost:3000` in your browser.

Do not open `public/index.html` directly. Open the localhost URL so the frontend can call the backend API.

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Check backend |
| GET | `/api/incidents` | List incidents |
| POST | `/api/incidents` | Create incident |
| PATCH | `/api/incidents/:id/complete` | Complete incident |
| GET | `/api/ambulances` | List ambulances |
| GET | `/api/hospitals` | List hospitals |
| POST | `/api/assignments` | Assign ambulance and hospital |

### Example: create incident
```json
{
  "name": "Road Accident",
  "location": "A",
  "priority": "High"
}
```

### Example: create assignment
```json
{
  "incidentId": 1,
  "ambulanceId": 101,
  "hospitalId": 1
}
```

## Database
SQLite database is created automatically at `backend/rescuegrid.db` on first run. Sample incidents, ambulances and hospitals are inserted only when their respective tables are empty.

## Important project note
This is an academic demonstration using simulated Pune-area coordinates and a sample road graph. It is not connected to real emergency services, live ambulance GPS, real hospital availability, or verified road traffic. Do not use it for actual emergency dispatch.
