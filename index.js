import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import bcrypt from "bcrypt";

const app = express();
const PORT = process.env.PORT || 8000;

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));


mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('Connected to MongoDB Atlas'))
.catch(err => console.error('MongoDB connection error:', err));

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  password: { type: String, required: true }
});

const User = mongoose.model("User", userSchema);

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  status: { type: String, enum: ["pending", "completed"], default: "pending" },
  dueDate: Date,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

const Task = mongoose.model("Task", taskSchema);

app.post('/add-user', async (req, res) => {
  try {
    const { username, pass, confirmPass } = req.body;

    if (!username || !pass || !confirmPass) {
      return res.redirect(`/register.html?error=Input+all+fields`);
    }

    if (pass !== confirmPass) {
      return res.redirect(`/register.html?error=Passwords+do+not+match`);
    }

    const hashedPassword = await bcrypt.hash(pass, 10);

    const user = new User({
      username,
      password: hashedPassword
    });

    await user.save();
    return res.redirect(`/register.html?error=User+created+successfully+.+Go+to+login+page`);
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
});

// Login User
app.post('/login', async (req, res) => {
  try {
    const { username, pass } = req.body;
    const user = await User.findOne({ username });

    if (!user) return res.send("User not found");
    const match = await bcrypt.compare(pass, user.password);

    if (match) {
      // Login successful, redirect to dashboard with user ID as query param
      return res.redirect(`/dashboard.html?userId=${user._id}`);
    } else {
      return res.redirect(`/index.html?error=Invalid+password`);
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});


app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "register.html"));
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Add Task
app.post('/tasks/add', async (req, res) => {
  try {
    const { title, description, dueDate, userId } = req.body;

    const task = new Task({
      title,
      description,
      dueDate: dueDate ? new Date(dueDate) : null,
      userId
    });

    await task.save();
    res.send({ success: true, task });
  } catch (err) {
    res.status(500).send({ success: false, error: err.message });
  }
});

// Get All Tasks
app.get('/tasks/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, sortBy } = req.query;

    const filter = { userId };
    if (status) filter.status = status;

    let tasks = await Task.find(filter);

    // Identify overdue tasks
    const now = new Date();
    tasks = tasks.map(task => ({
      ...task.toObject(),
      overdue: task.status === "pending" && task.dueDate && task.dueDate < now
    }));

    // Optional sorting
    if (sortBy === "dueDate") {
      tasks.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    }

    res.send(tasks);
  } catch (err) {
    res.status(500).send(err);
  }
});

// Mark Task as Completed
app.post('/tasks/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findByIdAndUpdate(id, { status: "completed" }, { new: true });
    res.send({ success: true, task });
  } catch (err) {
    res.status(500).send({ success: false, error: err.message });
  }
});

app.get("/tasks/:userId/stats", async (req, res) => {

  try {
    const { userId } = req.params
    const tasks = await Task.find({ userId })
    const now = new Date()
    const total = tasks.length
    const completed = tasks.filter(t => t.status === "completed").length
    const pending = tasks.filter(t => t.status === "pending").length
    const overdue = tasks.filter(
      t => t.status === "pending" && t.dueDate && t.dueDate < now
    ).length

    res.json({
      total,
      completed,
      pending,
      overdue
    })

  } catch (err) {

    res.status(500).json({
      message: "Error getting stats"
    })
  }
})

// Get User Info by ID
app.get("/user/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).send({ error: "User not found" });
    res.json({ username: user.username });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Delete a Task
app.delete('/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findByIdAndDelete(id);
    if (!task) return res.status(404).send({ success: false, error: "Task not found" });
    res.send({ success: true });
  } catch (err) {
    res.status(500).send({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});