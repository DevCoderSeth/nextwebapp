import mysql from "mysql2/promise";
import bcrypt from "bcrypt";

const sql = mysql.createPool({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  port: process.env.DATABASE_PORT ? parseInt(process.env.DATABASE_PORT) : 3306,
});

async function rehashPasswords() {
  try {
    // Fetch all users with plaintext passwords
    const [users]: [mysql.RowDataPacket[], mysql.FieldPacket[]] =
      await sql.query(`SELECT id, password FROM users`);

    // Iterate through users and rehash passwords
    for (const user of users) {
      const { id, password } = user;

      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Update the password in the database
      await sql.query(`UPDATE users SET password = ? WHERE id = ?`, [
        hashedPassword,
        id,
      ]);

      console.log(`Password for user with ID ${id} updated.`);
    }

    console.log("All user passwords have been updated.");
  } catch (error) {
    console.error("Error rehashing passwords:", error);
  }
}

// Run the script
rehashPasswords();
