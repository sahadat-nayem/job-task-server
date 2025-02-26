const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");
const http = require("http");
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["https://your-frontend.vercel.app"], // ফ্রন্টএন্ড URL ঠিক করো
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.gcvod.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    console.log("✅ Connected to MongoDB");

    const taskCollection = client.db("jobtaskDB").collection("tasks");

    // Get all tasks
    app.get("/tasks", async (req, res) => {
      try {
        const tasks = await taskCollection.find().toArray();
        res.status(200).send(tasks);
      } catch (error) {
        console.error("Error fetching tasks:", error);
        res.status(500).send({ message: "Error fetching tasks", error });
      }
    });

    // Create a new task
    app.post("/tasks", async (req, res) => {
      try {
        const newTask = req.body;
        newTask.timestamp = new Date().toISOString();

        const result = await taskCollection.insertOne(newTask);
        io.emit("taskUpdated");
        res.status(201).send(result);
      } catch (error) {
        console.error("Error creating task:", error);
        res.status(500).send({ message: "Error creating task", error });
      }
    });

    // Get a single task by ID
    app.get("/tasks/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const task = await taskCollection.findOne({ _id: new ObjectId(id) });

        if (!task) {
          return res.status(404).send({ message: "Task not found" });
        }

        res.status(200).send(task);
      } catch (error) {
        console.error("Error fetching task:", error);
        res.status(500).send({ message: "Error fetching task", error });
      }
    });

    // Update task
    app.put("/tasks/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { title, description, category } = req.body;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid Task ID" });
        }

        const result = await taskCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { title, description, category } }
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "Task not found" });
        }

        io.emit("taskUpdated");
        res.status(200).send({ message: "Task updated successfully" });
      } catch (error) {
        console.error("Error updating task:", error);
        res.status(500).send({ message: "Error updating task", error });
      }
    });

    // Delete task
    app.delete("/tasks/:id", async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid Task ID" });
        }

        const result = await taskCollection.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
          return res.status(404).send({ message: "Task not found" });
        }

        io.emit("taskUpdated");
        res.status(200).send({ message: "Task deleted successfully" });
      } catch (error) {
        console.error("Error deleting task:", error);
        res.status(500).send({ message: "Error deleting task", error });
      }
    });

    // WebSocket connection
    io.on("connection", (socket) => {
      console.log("A user connected:", socket.id);

      socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
      });
    });

  } catch (error) {
    console.error("❌ Fatal Error:", error);
    process.exit(1);
  }
}

run().catch(console.dir);

// Root route
app.get("/", (req, res) => res.send("✅ Job Task Management API is running..."));

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
