// Runs once after the entire Jest test suite.
// Drops the pizza_test database to leave the system in a clean state.

const mysql = require("mysql2/promise");

module.exports = async () => {
  const config = require("../src/config");
  const { host, user, password, connectTimeout } = config.db.connection;
  const testDb = config.db.connection.database; // resolves to 'pizza_test'

  const conn = await mysql.createConnection({
    host,
    user,
    password,
    connectTimeout,
  });
  try {
    await conn.query(`DROP DATABASE IF EXISTS \`${testDb}\``);
  } finally {
    await conn.end();
  }
};
