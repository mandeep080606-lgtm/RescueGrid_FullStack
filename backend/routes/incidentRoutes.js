const express = require("express");
const db = require("../database");
const router = express.Router();

const incidentSelect = `
  SELECT i.id, i.name, i.location, i.priority, i.status,
         a.name AS assignedAmbulance, h.name AS assignedHospital,
         i.created_at AS createdAt
  FROM incidents i
  LEFT JOIN ambulances a ON a.id = i.assigned_ambulance_id
  LEFT JOIN hospitals h ON h.id = i.assigned_hospital_id
`;

router.get("/", (req, res) => {
  const rows = db.prepare(incidentSelect + " ORDER BY i.id").all();
  res.json(rows);
});

router.post("/", (req, res) => {
  const { name, location, priority } = req.body;
  const allowed = ["High", "Medium", "Low"];
  if (typeof name !== "string" || !name.trim() || name.trim().length > 200) {
    return res.status(400).json({ error: "Incident name is required (maximum 200 characters)." });
  }
  if (!["A", "B", "C", "D", "E"].includes(location)) {
    return res.status(400).json({ error: "Choose a valid incident location." });
  }
  if (!allowed.includes(priority)) {
    return res.status(400).json({ error: "Priority must be High, Medium or Low." });
  }
  const result = db.prepare(
    "INSERT INTO incidents (name, location, priority) VALUES (?, ?, ?)"
  ).run(name.trim(), location, priority);
  const incident = db.prepare(incidentSelect + " WHERE i.id = ?").get(result.lastInsertRowid);
  res.status(201).json(incident);
});

router.patch("/:id/complete", (req, res) => {
  const id = Number(req.params.id);
  const incident = db.prepare("SELECT * FROM incidents WHERE id = ?").get(id);
  if (!incident) return res.status(404).json({ error: "Incident not found." });
  if (incident.status === "Completed") {
    return res.status(409).json({ error: "Incident is already completed." });
  }

  const complete = db.transaction(() => {
    if (incident.assigned_ambulance_id !== null) {
      db.prepare("UPDATE ambulances SET available = 1 WHERE id = ?")
        .run(incident.assigned_ambulance_id);
    }
    db.prepare(
      "UPDATE incidents SET status = 'Completed', assigned_ambulance_id = NULL, assigned_hospital_id = NULL WHERE id = ?"
    ).run(id);
  });
  complete();

  const updated = db.prepare(incidentSelect + " WHERE i.id = ?").get(id);
  res.json(updated);
});

module.exports = router;