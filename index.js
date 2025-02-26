const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");
const http = require("http");
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
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
    // Connect to MongoDB
    // await client.connect();
    // console.log("Connected to MongoDB");

    const taskCollection = client.db("jobtaskDB").collection("tasks");

    // Get all tasks
    app.get("/tasks", async (req, res) => {
      try {
        const tasks = await taskCollection.find().toArray();
        res.status(200).send(tasks);
      } catch (error) {
        res.status(500).send({ message: "Error fetching tasks", error });
      }
    });

    // Create a new task
    app.post("/tasks", async (req, res) => {
      try {
        const newTask = req.body;

        // **Timestamp ফরম্যাট ঠিক করা**
        newTask.timestamp = new Date()
          .toLocaleString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
          .replace(",", ""); // কমা রিমুভ করে ফরম্যাট ঠিক করা

        const result = await taskCollection.insertOne(newTask);
        io.emit("taskUpdated"); // Notify all clients
        res.status(201).send(result);
      } catch (error) {
        res.status(500).send({ message: "Error creating task", error });
      }
    });

    // Update task (Drag & Drop or Edit)
    app.get("/tasks/:id", async (req, res) => {
        const { id } = req.params;
        const task = await taskCollection.findOne({ _id: new ObjectId(id) });
        if (task) {
          res.send(task);
        } else {
          res.status(404).send({ message: "Task not found" });
        }
      });


    app.put("/tasks/:id", async (req, res) => {
      const { id } = req.params;
      const { title, description, category } = req.body;

      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid Task ID" });
      }

      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          title,
          description,
          category,
        },
      };

      try {
        const result = await taskCollection.updateOne(filter, updateDoc);
        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "Task not found" });
        }
        io.emit("taskUpdated"); // Notify all clients
        res.status(200).send(result);
      } catch (error) {
        res.status(500).send({ message: "Error updating task", error });
      }
    });

    // Delete task
    app.delete("/tasks/:id", async (req, res) => {
      const { id } = req.params;

      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid Task ID" });
      }

      const filter = { _id: new ObjectId(id) };

      try {
        const result = await taskCollection.deleteOne(filter);
        if (result.deletedCount === 0) {
          return res.status(404).send({ message: "Task not found" });
        }
        io.emit("taskUpdated"); // Notify all clients
        res.status(200).send({ message: "Task deleted successfully" });
      } catch (error) {
        res.status(500).send({ message: "Error deleting task", error });
      }
    });

    io.on("connection", (socket) => {
      // console.log("A user connected");

      socket.on("disconnect", () => {
        // console.log("User disconnected");
      });
    });
  } catch (error) {
    console.error(error);
    process.exit(1); // Exit process on fatal error
  }
}

run().catch(console.dir);

// Root route
app.get("/", (req, res) => res.send("Job Task Management API"));

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
