// Runs once before the entire Jest test suite.
// Creates the pizza_test database and all required tables.
// This keeps the production `pizza` database completely untouched during tests.

const mysql = require("mysql2/promise");

module.exports = async () => {
  // Tell config.js to use the test database name
  process.env.NODE_ENV = "test";

  // config and dbModel are loaded AFTER setting NODE_ENV so they pick up the test DB name
  const config = require("../src/config");
  const dbModel = require("../src/database/dbModel");

  const { host, user, password, connectTimeout } = config.db.connection;
  const testDb = config.db.connection.database; // resolves to 'pizza_test'

  const conn = await mysql.createConnection({
    host,
    user,
    password,
    connectTimeout,
  });
  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${testDb}\``);
    await conn.query(`USE \`${testDb}\``);
    for (const stmt of dbModel.tableCreateStatements) {
      await conn.query(stmt);
    }
  } finally {
    await conn.end();
  }
};
