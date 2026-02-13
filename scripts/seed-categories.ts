import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const categoryData = [
  { id: 1, name: "حكومي" },
  { id: 2, name: "حكومي" },
  { id: 4, name: "صناعي" },
  { id: 5, name: "صناعي" },
  { id: 6, name: "صناعي" },
  { id: 7, name: "صناعي" },
  { id: 17, name: "صناعي" },
  { id: 22, name: "زراعي" },
  { id: 21, name: "منزلي" },
  { id: 26, name: "منزلي" },
  { id: 27, name: "منزلي" },
  { id: 28, name: "منزلي" },
  { id: 9, name: "تجاري" },
  { id: 19, name: "تجاري" },
  { id: 24, name: "تجاري" },
  { id: 33, name: "تجاري" },
  { id: 29, name: "منزلي" },
  { id: 39, name: "منزلي" },
  { id: 8, name: "حكومي" },
  { id: 23, name: "حكومي" },
  { id: 101, name: "حكومي" },
  { id: 102, name: "حكومي" },
  { id: 104, name: "صناعي" },
  { id: 105, name: "صناعي" },
  { id: 106, name: "صناعي" },
  { id: 107, name: "صناعي" },
  { id: 108, name: "حكومي" },
  { id: 109, name: "تجاري" },
  { id: 117, name: "صناعي" },
  { id: 119, name: "تجاري" },
  { id: 121, name: "منزلي" },
  { id: 122, name: "زراعي" },
  { id: 123, name: "حكومي" },
  { id: 124, name: "تجاري" },
  { id: 126, name: "منزلي" },
  { id: 127, name: "منزلي" },
  { id: 128, name: "منزلي" },
  { id: 129, name: "منزلي" },
  { id: 133, name: "تجاري" },
  { id: 139, name: "منزلي" },
  { id: 0, name: "بدون صنف" }
];

async function main() {
  try {
    console.log("Seeding categories table...");
    for (const cat of categoryData) {
      await pool.query(
        "INSERT INTO categories (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = $2",
        [cat.id, cat.name]
      );
    }
    console.log("Categories seeded successfully.");
  } catch (error) {
    console.error("Error seeding categories:", error);
  } finally {
    await pool.end();
  }
}

main();
