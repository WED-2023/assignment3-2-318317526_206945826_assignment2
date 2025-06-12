var mysql = require('mysql2');
require("dotenv").config();
console.log("Loaded DB user:", process.env.DBuser);


const config={
connectionLimit:4,
  host: process.env.host,//"localhost"
  user: process.env.DBuser,//"root"
  password: process.env.DBpassword,
  database:process.env.database
  // database:"mydb"
}
const pool = new mysql.createPool(config);

const connection = () => {
  return new Promise((resolve, reject) => {
    pool.getConnection((err, connection) => {
      if (err) {
        console.error("MySQL connection error:", err);
        return reject(err);
      }

      if (connection && connection.threadId) {
        console.log("MySQL pool connected: threadId " + connection.threadId);
      } else {
        console.error("MySQL connection failed – connection is undefined");
        return reject(new Error("Connection object is undefined"));
      }

      const query = (sql, binding) => {
        return new Promise((resolve, reject) => {
          connection.query(sql, binding, (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });
      };

      const release = () => {
        return new Promise((resolve, reject) => {
          if (connection && connection.threadId) {
            console.log("MySQL pool released: threadId " + connection.threadId);
          }
          resolve(connection.release());
        });
      };

      resolve({ query, release });
    });
  });
};

const query = (sql, binding) => {
  return new Promise((resolve, reject) => {
    pool.query(sql, binding, (err, result, fields) => {
      if (err) reject(err);
      resolve(result);
    });
  });
};
module.exports = { pool, connection, query };







