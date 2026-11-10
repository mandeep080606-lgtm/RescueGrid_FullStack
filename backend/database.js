const fs = require("fs");
const path = require("path");
const initSqlJs = require("sql.js");

const databasePath = path.join(__dirname, "rescuegrid.db");
let rawDb;
let transactionDepth = 0;

function persist() {
  if (!rawDb || transactionDepth > 0) return;
  fs.writeFileSync(databasePath, Buffer.from(rawDb.export()));
}
function bindValues(args) {
  return args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
}

const db = {
  ready: null,
  pragma(statement) {
    rawDb.run(`PRAGMA ${statement}`);
  },
  exec(sql) {
    rawDb.exec(sql);
    persist();
  },
  prepare(sql) {
    return {
      get(...args) {
        const stmt = rawDb.prepare(sql);
        try {
          if (args.length) stmt.bind(bindValues(args));
          return stmt.step() ? stmt.getAsObject() : undefined;
        } finally { stmt.free(); }
      },
      all(...args) {
        const stmt = rawDb.prepare(sql);
        const rows = [];
        try {
          if (args.length) stmt.bind(bindValues(args));
          while (stmt.step()) rows.push(stmt.getAsObject());
          return rows;
        } finally { stmt.free(); }
      },
      run(...args) {
        rawDb.run(sql, bindValues(args));
        const changes = rawDb.getRowsModified();
        const lastInsertRowid = rawDb.exec("SELECT last_insert_rowid() AS id")[0]?.values[0][0] ?? 0;
        persist();
        return { changes, lastInsertRowid };
      }
    };
  },
  transaction(callback) {
    return (...args) => {
      rawDb.run("BEGIN TRANSACTION");
      transactionDepth++;
      try {
        const result = callback(...args);
        rawDb.run("COMMIT");
        transactionDepth--;
        persist();
        return result;
      } catch (error) {
        rawDb.run("ROLLBACK");
        transactionDepth--;
        throw error;
      }
    };
  },
  close() {
    if (rawDb) {
      persist();
      rawDb.close();
      rawDb = null;
    }
  }
};

db.ready = (async () => {
  const SQL = await initSqlJs();
  rawDb = fs.existsSync(databasePath)
    ? new SQL.Database(fs.readFileSync(databasePath))
    : new SQL.Database();
  rawDb.run("PRAGMA foreign_keys = ON");
  rawDb.exec(`
    CREATE TABLE IF NOT EXISTS ambulances (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      available INTEGER NOT NULL DEFAULT 1 CHECK(available IN (0,1))
    );
    CREATE TABLE IF NOT EXISTS hospitals (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS incidents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      location TEXT NOT NULL,
      priority TEXT NOT NULL CHECK(priority IN ('High','Medium','Low')),
      status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Completed')),
      assigned_ambulance_id INTEGER,
      assigned_hospital_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(assigned_ambulance_id) REFERENCES ambulances(id),
      FOREIGN KEY(assigned_hospital_id) REFERENCES hospitals(id)
    );
  `);
  const seed = (sql, rows) => {
    const stmt = rawDb.prepare(sql);
    try { rows.forEach(row => stmt.run(row)); } finally { stmt.free(); }
  };
  if (rawDb.exec("SELECT COUNT(*) FROM ambulances")[0].values[0][0] === 0)
    seed("INSERT INTO ambulances (id,name,available) VALUES (?,?,?)", [[101,"Ambulance 101",1],[102,"Ambulance 102",1],[103,"Ambulance 103",0]]);
  if (rawDb.exec("SELECT COUNT(*) FROM hospitals")[0].values[0][0] === 0)
    seed("INSERT INTO hospitals (id,name) VALUES (?,?)", [[1,"Demo Hospital 1"],[2,"Demo Hospital 2"]]);
  if (rawDb.exec("SELECT COUNT(*) FROM incidents")[0].values[0][0] === 0)
    seed("INSERT INTO incidents (id,name,location,priority,status) VALUES (?,?,?,?,'Active')", [[1,"Road Accident","A","High"],[2,"Medical Emergency","B","Medium"],[3,"Fire Incident","C","High"]]);
  persist();
})();

module.exports = db;
