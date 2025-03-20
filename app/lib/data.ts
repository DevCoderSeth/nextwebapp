import mysql from "mysql2/promise";
import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoiceRaw,
  Revenue,
} from "./definitions";
import { formatCurrency } from "./utils";

// Set up the MySQL connection pool
const sql = mysql.createPool({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  port: process.env.DATABASE_PORT ? parseInt(process.env.DATABASE_PORT) : 3306,
});

// Fetch revenue data
export async function fetchRevenue() {
  try {
    const [rows] = await sql.query<mysql.RowDataPacket[]>(
      "SELECT * FROM revenue"
    );

    return rows as Revenue[];
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch revenue data.");
  }
}

// Fetch the latest invoices
export async function fetchLatestInvoices() {
  try {
    const [rows] = await sql.query<mysql.RowDataPacket[]>(
      `SELECT invoices.amount, customers.name, customers.image_url, 
              customers.email, invoices.id
       FROM invoices
       JOIN customers ON invoices.customer_id = customers.id
       ORDER BY invoices.date DESC
       LIMIT 5`
    );

    // Format currency for latest invoices
    const latestInvoices = (rows as LatestInvoiceRaw[]).map((invoice) => ({
      ...invoice,
      amount: formatCurrency(invoice.amount), // Format currency
    }));

    return latestInvoices;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch the latest invoices.");
  }
}

// Fetch card data
export async function fetchCardData() {
  try {
    const [rows] = await sql.query<mysql.RowDataPacket[]>(
      `SELECT 
        (SELECT COALESCE(SUM(amount), 0) FROM invoices WHERE status = 'paid') AS totalPaidInvoices,
        (SELECT COALESCE(SUM(amount), 0) FROM invoices WHERE status = 'pending') AS totalPendingInvoices,
        (SELECT COUNT(*) FROM invoices) AS numberOfInvoices,
        (SELECT COUNT(*) FROM customers) AS numberOfCustomers`
    );

    const data = rows[0] as {
      totalPaidInvoices: number;
      totalPendingInvoices: number;
      numberOfInvoices: number;
      numberOfCustomers: number;
    };

    return {
      totalPaidInvoices: formatCurrency(data.totalPaidInvoices),
      totalPendingInvoices: formatCurrency(data.totalPendingInvoices),
      numberOfInvoices: data.numberOfInvoices,
      numberOfCustomers: data.numberOfCustomers,
    };
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch dashboard data.");
  }
}

// Fetch filtered invoices
const ITEMS_PER_PAGE = 6;

export async function fetchFilteredInvoices(
  query: string,
  currentPage: number
) {
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    const [invoices] = await sql.query(
      `
        SELECT
          invoices.id,
          invoices.amount,
          invoices.date,
          invoices.status,
          customers.name,
          customers.email,
          customers.image_url
        FROM invoices
        JOIN customers ON invoices.customer_id = customers.id
        WHERE
          customers.name LIKE ? OR
          customers.email LIKE ? OR
          invoices.amount LIKE ? OR
          invoices.date LIKE ? OR
          invoices.status LIKE ?
        ORDER BY invoices.date DESC
        LIMIT ? OFFSET ?
      `,
      [
        `%${query}%`,
        `%${query}%`,
        `%${query}%`,
        `%${query}%`,
        `%${query}%`,
        ITEMS_PER_PAGE,
        offset,
      ]
    );

    return invoices;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch invoices.");
  }
}

// Fetch total pages for invoices based on a query
export async function fetchInvoicesPages(query: string) {
  try {
    // Explicitly type the query result as RowDataPacket[]
    const [rows] = await sql.execute<mysql.RowDataPacket[]>(
      `
        SELECT COUNT(*) as count
        FROM invoices
        JOIN customers ON invoices.customer_id = customers.id
        WHERE
          customers.name LIKE ? OR
          customers.email LIKE ? OR
          invoices.amount LIKE ? OR
          invoices.date LIKE ? OR
          invoices.status LIKE ?
      `,
      [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`]
    );

    // Extract count and calculate totalPages
    const count = Number(rows[0].count);
    const totalPages = Math.ceil(count / ITEMS_PER_PAGE);

    return totalPages;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch total number of invoices.");
  }
}

// Fetch invoice by ID
export async function fetchInvoiceById(id: string) {
  try {
    // Use RowDataPacket[] to handle the query result
    const [data] = await sql.execute<mysql.RowDataPacket[]>(
      `
        SELECT
          invoices.id,
          invoices.customer_id,
          invoices.amount,
          invoices.status
        FROM invoices
        WHERE invoices.id = ?
      `,
      [id]
    );

    // Map the result to InvoiceForm[] and handle conversion for amount
    const invoice: InvoiceForm[] = data.map((invoice) => ({
      id: invoice.id as string,
      customer_id: invoice.customer_id as string,
      amount: invoice.amount / 100, // Convert amount from cents to dollars
      status: invoice.status as "pending" | "paid",
    }));

    return invoice[0]; // Return the first (and possibly only) invoice
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch invoice.");
  }
}

// Fetch all customers
export async function fetchCustomers() {
  try {
    // Use RowDataPacket[] instead of CustomerField[] for the result type
    const [customers] = await sql.execute<mysql.RowDataPacket[]>(
      `
        SELECT
          id,
          name
        FROM customers
        ORDER BY name ASC
      `
    );

    // Map the result to CustomerField type to match your desired return type
    const customerFields: CustomerField[] = customers.map((customer) => ({
      id: customer.id as string,
      name: customer.name as string,
    }));

    return customerFields;
  } catch (err) {
    console.error("Database Error:", err);
    throw new Error("Failed to fetch all customers.");
  }
}

// Fetch filtered customers
export async function fetchFilteredCustomers(
  query: string
): Promise<CustomersTableType[]> {
  try {
    const [data] = await sql.execute<mysql.RowDataPacket[]>(
      `
		SELECT
		  customers.id,
		  customers.name,
		  customers.email,
		  customers.image_url,
		  COUNT(invoices.id) AS total_invoices,
		  SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
		  SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
		FROM customers
		LEFT JOIN invoices ON customers.id = invoices.customer_id
		WHERE
		  customers.name LIKE ? OR
          customers.email LIKE ?
		GROUP BY customers.id, customers.name, customers.email, customers.image_url
		ORDER BY customers.name ASC
	  `,
      [`%${query}%`, `%${query}%`]
    );

    // Map over the data and ensure it matches the CustomersTableType
    const customers = data.map((customer) => ({
      id: customer.id as string,
      name: customer.name as string,
      email: customer.email as string,
      image_url: customer.image_url as string,
      total_invoices: Number(customer.total_invoices), // Ensure it's a number
      total_pending: Number(customer.total_pending), // Keep it as number, without formatting
      total_paid: Number(customer.total_paid), // Keep it as number, without formatting
    }));

    return customers;
  } catch (err) {
    console.error("Database Error:", err);
    throw new Error("Failed to fetch customer table.");
  }
}
