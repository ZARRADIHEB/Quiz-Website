const express = require("express");
const mongoose = require("mongoose");
const path = require("path");

const MONGO_URI =
  "mongodb+srv://iZ17:DBZARRADiheb007@app-data.nrewa.mongodb.net/quiz_website?retryWrites=true&w=majority&appName=App-Data";
const PORT = 3000;

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});
const wrap = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

function normalize(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

const sentenceSchema = new mongoose.Schema(
  {
    german: { type: String, required: true, trim: true },
    arabic: { type: String, required: true, trim: true },
    pairKey: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

const settingsSchema = new mongoose.Schema(
  {
    profile: { type: String, default: "default", unique: true },
    theme: { type: String, enum: ["light", "dark"], default: "light" },
    streak: { type: Number, default: 0 },
    lastQuizDate: { type: String, default: null },
  },
  { versionKey: false },
);

const Sentence = mongoose.model("Sentence", sentenceSchema);
const Settings = mongoose.model("Settings", settingsSchema);

function mapSentence(doc) {
  return {
    id: String(doc._id),
    german: doc.german,
    arabic: doc.arabic,
    createdAt: doc.createdAt,
  };
}

async function getSettings() {
  let settings = await Settings.findOne({ profile: "default" }).lean();
  if (!settings) {
    settings = await Settings.create({ profile: "default" });
    settings = settings.toObject();
  }
  return settings;
}

app.get(
  "/api/sentences",
  wrap(async (_req, res) => {
    const rows = await Sentence.find().sort({ createdAt: -1 }).lean();
    res.json(rows.map(mapSentence));
  }),
);

app.post(
  "/api/sentences",
  wrap(async (req, res) => {
    const german = String(req.body.german || "").trim();
    const arabic = String(req.body.arabic || "").trim();
    const createdAt = req.body.createdAt
      ? new Date(req.body.createdAt)
      : new Date();

    if (!german || !arabic) {
      return res.status(400).json({ error: "German and Arabic are required." });
    }

    const pairKey = `${normalize(german)}|${normalize(arabic)}`;
    try {
      const doc = await Sentence.create({ german, arabic, pairKey, createdAt });
      return res.status(201).json(mapSentence(doc.toObject()));
    } catch (err) {
      if (err && err.code === 11000) {
        return res.status(409).json({ error: "Sentence pair already exists." });
      }
      throw err;
    }
  }),
);

app.put(
  "/api/sentences/:id",
  wrap(async (req, res) => {
    const german = String(req.body.german || "").trim();
    const arabic = String(req.body.arabic || "").trim();
    if (!german || !arabic) {
      return res.status(400).json({ error: "German and Arabic are required." });
    }

    const pairKey = `${normalize(german)}|${normalize(arabic)}`;
    try {
      const updated = await Sentence.findByIdAndUpdate(
        req.params.id,
        { german, arabic, pairKey },
        { new: true, runValidators: true },
      ).lean();

      if (!updated) {
        return res.status(404).json({ error: "Sentence not found." });
      }
      return res.json(mapSentence(updated));
    } catch (err) {
      if (err && err.code === 11000) {
        return res.status(409).json({ error: "Sentence pair already exists." });
      }
      throw err;
    }
  }),
);

app.delete(
  "/api/sentences/:id",
  wrap(async (req, res) => {
    const deleted = await Sentence.findByIdAndDelete(req.params.id).lean();
    if (!deleted) {
      return res.status(404).json({ error: "Sentence not found." });
    }
    res.status(204).send();
  }),
);

app.post(
  "/api/sentences/import",
  wrap(async (req, res) => {
    const input = Array.isArray(req.body) ? req.body : [];
    const cleaned = input
      .map((item) => ({
        german: String(item.german || "").trim(),
        arabic: String(item.arabic || "").trim(),
        createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
      }))
      .filter((item) => item.german && item.arabic)
      .map((item) => ({
        ...item,
        pairKey: `${normalize(item.german)}|${normalize(item.arabic)}`,
      }));

    if (!cleaned.length) {
      return res.json({ inserted: 0 });
    }

    let inserted = 0;
    for (const row of cleaned) {
      try {
        const result = await Sentence.updateOne(
          { pairKey: row.pairKey },
          { $setOnInsert: row },
          { upsert: true },
        );
        inserted += Number(result.upsertedCount || 0);
      } catch {
        // Skip invalid/duplicate records and continue.
      }
    }

    return res.json({ inserted });
  }),
);

app.get(
  "/api/settings",
  wrap(async (_req, res) => {
    const settings = await getSettings();
    res.json({
      theme: settings.theme || "light",
      streak: Number(settings.streak || 0),
      lastQuizDate: settings.lastQuizDate || null,
    });
  }),
);

app.patch(
  "/api/settings/theme",
  wrap(async (req, res) => {
    const theme = req.body && req.body.theme === "dark" ? "dark" : "light";
    const updated = await Settings.findOneAndUpdate(
      { profile: "default" },
      { $set: { theme } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    res.json({ theme: updated.theme });
  }),
);

app.post(
  "/api/settings/streak",
  wrap(async (_req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const current = await getSettings();

    let nextStreak = Number(current.streak || 0);
    if (!current.lastQuizDate) {
      nextStreak = 1;
    } else if (current.lastQuizDate === today) {
      nextStreak = Number(current.streak || 0);
    } else if (current.lastQuizDate === yesterday) {
      nextStreak = Number(current.streak || 0) + 1;
    } else {
      nextStreak = 1;
    }

    const updated = await Settings.findOneAndUpdate(
      { profile: "default" },
      { $set: { streak: nextStreak, lastQuizDate: today } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();

    res.json({
      streak: Number(updated.streak || 0),
      lastQuizDate: updated.lastQuizDate || null,
    });
  }),
);

app.use(express.static(path.resolve(__dirname)));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Unexpected server error." });
});

mongoose
  .connect(MONGO_URI)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`MongoDB connected: ${MONGO_URI}`);
    });
  })
  .catch((err) => {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  });
