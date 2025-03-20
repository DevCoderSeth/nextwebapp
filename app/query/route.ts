import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";

const sql = mysql.createPool({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  port: process.env.DATABASE_PORT ? parseInt(process.env.DATABASE_PORT) : 3306,
});

// Function to list invoices with amount = 666
async function listInvoices() {
  try {
    const [rows] = await sql.query(
      `SELECT invoices.amount, customers.name 
       FROM invoices 
       JOIN customers ON invoices.customer_id = customers.id 
       WHERE invoices.amount = 666`
    );
    return rows;
  } catch (error) {
    console.error("Database query error:", error);
    throw new Error(error instanceof Error ? error.message : "Unknown error");
  }
}

// GET request handler
export async function GET(req: NextRequest) {
  try {
    // Fetch invoices with amount = 666
    const invoices = await listInvoices();

    // Return the data in JSON format
    return NextResponse.json(invoices, { status: 200 });
  } catch (error) {
    console.error("Error fetching invoices:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      { message: "Failed to fetch invoices", error: errorMessage },
      { status: 500 }
    );
  }
}
