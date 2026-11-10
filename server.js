const express = require("express");
const cors = require("cors");
const path = require("path");
const incidentRoutes = require("./backend/routes/incidentRoutes");
const ambulanceRoutes = require("./backend/routes/ambulanceRoutes");
const hospitalRoutes = require("./backend/routes/hospitalRoutes");
const assignmentRoutes = require("./backend/routes/assignmentRoutes");
const db = require("./backend/database");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", application: "RescueGrid API" });
});

app.use("/api/incidents", incidentRoutes);
app.use("/api/ambulances", ambulanceRoutes);
app.use("/api/hospitals", hospitalRoutes);
app.use("/api/assignments", assignmentRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Requested API endpoint was not found." });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error." });
});

db.ready.then(() => {
  app.listen(PORT, () => {
    console.log(`RescueGrid running at http://localhost:${PORT}`);
  });
}).catch(error => {
  console.error("Database initialization failed:", error);
  process.exit(1);
});

process.on("SIGINT", () => {
  db.close();
  process.exit(0);
});