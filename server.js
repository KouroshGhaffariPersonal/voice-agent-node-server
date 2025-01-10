const express = require("express");
const cors = require("cors");
require("dotenv").config();
const multer = require("multer");
//OPEN AI CONNECTION
const OpenAI = require("openai");
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic health check route
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Voice Feedback API is running" });
});

app.get("/test-openai", async (req, res) => {
  try {
    const response = await openai.createCompletion({
      model: "text-davinci-003",
      prompt: "Hello, OpenAI!",
      max_tokens: 5,
    });
    res.json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error communicating with OpenAI");
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
