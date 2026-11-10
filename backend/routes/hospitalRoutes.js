const express = require("express");
const db = require("../database");
const router = express.Router();

router.get("/", (req, res) => {
  res.json(db.prepare("SELECT id, name FROM hospitals ORDER BY id").all());
});

module.exports = router;