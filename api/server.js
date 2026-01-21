const express = require("express");
const { Pool } = require("pg");
const Joi = require("joi");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors());

// Налаштування для хмарної бази даних
// Використовуємо лише DATABASE_URL. SSL необхідний для більшості хмарних провайдерів.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Дозволяє підключатися до хмарних баз без перевірки сертифікатів
  },
});

// Схема валідації Joi
const userSchema = Joi.object({
  name: Joi.string().min(2).required(),
  email: Joi.string().email().required(),
  age: Joi.number().integer().min(1).max(120).required(),
  comment: Joi.string().allow("", null).max(500),
});

// Маршрут для моніторингу (Health Check)
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// Збереження користувача
app.post("/api/users", async (req, res) => {
  const { error, value } = userSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  const { name, email, age, comment } = value;
  try {
    const result = await pool.query(
      "INSERT INTO users (name, email, age, comment) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, email, age, comment],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505")
      return res.status(400).json({ error: "Email вже існує" });
    res.status(500).json({ error: "DB Error" });
  }
});

// Отримання користувачів
app.get("/api/users", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM users ORDER BY created_at DESC",
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "DB Error" });
  }
});

// Запис логів активності
app.post("/api/log", async (req, res) => {
  const { action } = req.body;

  if (!action) {
    return res.status(400).json({ error: "Action is required" });
  }

  try {
    await pool.query("INSERT INTO activity_logs (action) VALUES ($1)", [
      action,
    ]);
    res.sendStatus(201);
  } catch (err) {
    console.error("Log error:", err);
    res.status(500).json({ error: "Failed to log action" });
  }
});

// Отримання статистики для Chart.js
app.get("/api/stats", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT action, COUNT(*) as count FROM activity_logs GROUP BY action",
    );
    // Повертаємо дані у форматі: [{ action: 'login', count: '10' }, ...]
    res.json(result.rows);
  } catch (err) {
    console.error("Stats error:", err);
    res.status(500).json({ error: "DB Error" });
  }
});

// Динамічний порт для хмари
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Cloud Server is running on port ${PORT}`);
});
