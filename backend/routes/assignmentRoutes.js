const express = require("express");
const db = require("../database");
const router = express.Router();

router.post("/", (req, res) => {
  const incidentId = Number(req.body.incidentId);
  const ambulanceId = Number(req.body.ambulanceId);
  const hospitalId = Number(req.body.hospitalId);

  if (![incidentId, ambulanceId, hospitalId].every(Number.isInteger)) {
    return res.status(400).json({ error: "Select a valid incident, ambulance and hospital." });
  }

  const incident = db.prepare("SELECT * FROM incidents WHERE id = ?").get(incidentId);
  const ambulance = db.prepare("SELECT * FROM ambulances WHERE id = ?").get(ambulanceId);
  const hospital = db.prepare("SELECT * FROM hospitals WHERE id = ?").get(hospitalId);

  if (!incident || incident.status !== "Active") {
    return res.status(404).json({ error: "Active incident not found." });
  }
  if (incident.assigned_ambulance_id !== null) {
    return res.status(409).json({ error: "This incident already has an ambulance assigned." });
  }
  if (!ambulance || ambulance.available !== 1) {
    return res.status(409).json({ error: "Selected ambulance is not available." });
  }
  if (!hospital) return res.status(404).json({ error: "Hospital not found." });

  const assign = db.transaction(() => {
    db.prepare("UPDATE ambulances SET available = 0 WHERE id = ?").run(ambulanceId);
    db.prepare(
      "UPDATE incidents SET assigned_ambulance_id = ?, assigned_hospital_id = ? WHERE id = ?"
    ).run(ambulanceId, hospitalId, incidentId);
  });
  assign();

  res.json({
    message: `${ambulance.name} assigned to ${incident.name} and ${hospital.name}.`,
    incidentId,
    ambulanceId,
    hospitalId
  });
});

module.exports = router;