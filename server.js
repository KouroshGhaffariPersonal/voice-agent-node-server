const express = require("express");
const cors = require("cors");
require("dotenv").config();
const multer = require("multer");
const mongoose = require("mongoose");

// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI, {
    dbName: "voicefeedback", // Separate database name for this application
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Agent Schema
const agentSchema = new mongoose.Schema({
  instructions: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Agent = mongoose.model("Agent", agentSchema);

//Conversation Schema
const messageSchema = new mongoose.Schema({
  content: String,
  speaker: String, // 'agent' or 'user'
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const conversationSchema = new mongoose.Schema({
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Agent",
    required: true,
  },
  sessionId: {
    type: String,
    required: true,
    unique: true,
  }, // Unique identifier for each conversation session
  messages: [messageSchema],
  startTime: {
    type: Date,
    default: Date.now,
  },
  endTime: Date,
  status: {
    type: String,
    enum: ["active", "completed"],
    default: "active",
  },
});

const Conversation = mongoose.model("Conversation", conversationSchema);

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

// An endpoint which would work with the client code above - it returns
// the contents of a REST API request to this protected endpoint
// Update the session endpoint to accept POST and use the provided instructions
app.post("/session", async (req, res) => {
  const { instructions } = req.body;

  const r = await fetch("https://api.openai.com/v1/realtime/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-realtime-preview-2024-12-17",
      voice: "alloy",
      modalities: ["text", "audio"],
      input_audio_transcription: {
        model: "whisper-1",
      },
      instructions:
        `You are a researcher with the task of getting the user to talk about ${instructions}. You always start the conversation. You don't wait for voice input from the user to start talking.` ||
        "You are a user researcher for a product called Voice Feedback. You are interviewing a customer about their experience with the product. You don't wait for voice input from the user to start talking",
    }),
  });
  const data = await r.json();

  res.send(data);
});

// New endpoints for agent management
app.post("/create-agent", async (req, res) => {
  try {
    const { instructions } = req.body;
    if (!instructions) {
      return res.status(400).json({
        status: "error",
        message: "Instructions are required",
      });
    }

    const agent = new Agent({ instructions });
    await agent.save();

    res.status(201).json({
      status: "success",
      data: {
        id: agent._id,
        instructions: agent.instructions,
        createdAt: agent.createdAt,
      },
    });
  } catch (error) {
    console.error("Database Error:", error);
    res.status(500).json({
      status: "error",
      message: "Error creating agent",
    });
  }
});

app.get("/agent/:id", async (req, res) => {
  try {
    const agent = await Agent.findById(req.params.id);
    if (!agent) {
      return res.status(404).json({
        status: "error",
        message: "Agent not found",
      });
    }

    res.json({
      status: "success",
      data: {
        id: agent._id,
        instructions: agent.instructions,
        createdAt: agent.createdAt,
      },
    });
  } catch (error) {
    console.error("Database Error:", error);
    res.status(500).json({
      status: "error",
      message: "Error retrieving agent",
    });
  }
});

//endpoints for saving conversation
// Create new conversation
app.post("/conversation", async (req, res) => {
  try {
    const { agentId } = req.body;

    // Generate a unique session ID
    const sessionId = `${agentId}-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    const conversation = new Conversation({
      agentId,
      sessionId,
      messages: [],
    });
    await conversation.save();

    res.status(201).json({
      status: "success",
      data: {
        conversationId: conversation._id,
        sessionId: sessionId,
      },
    });
  } catch (error) {
    console.error("Error creating conversation:", error);
    res.status(500).json({
      status: "error",
      message: "Error creating conversation",
    });
  }
});

// Add endpoint to get all conversations for an agent
app.get("/agent/:agentId/conversations", async (req, res) => {
  try {
    const conversations = await Conversation.find({
      agentId: req.params.agentId,
    }).sort({ startTime: -1 }); // Most recent first

    res.json({
      status: "success",
      data: conversations,
    });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({
      status: "error",
      message: "Error fetching conversations",
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
