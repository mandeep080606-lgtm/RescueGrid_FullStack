const express = require("express");
const db = require("../database");
const router = express.Router();

router.get("/", (req, res) => {
  const rows = db.prepare(
    "SELECT id, name, available FROM ambulances ORDER BY id"
  ).all().map(row => ({ ...row, available: Boolean(row.available) }));
  res.json(rows);
});

module.exports = router;