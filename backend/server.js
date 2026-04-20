const express = require("express");
const app = express();

const PORT = process.env.PORT || 10000;
const HOST = "0.0.0.0";

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Arbebus backend is running 🚀");
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    mode: "klaipeda_stable",
    time: new Date().toISOString(),
  });
});

// TEST ROUTING (stabilus, be RAM crash)
app.get("/transit/plan", (req, res) => {
  res.json({
    ok: true,
    route: [
      {
        type: "walk",
        instruction: "Eik į stotelę",
      },
      {
        type: "bus",
        line: "8",
        from: "Akropolis",
        to: "Universitetas",
        time: "5 min",
      },
      {
        type: "walk",
        instruction: "Eik iki galutinio taško",
      },
    ],
  });
});

app.listen(PORT, HOST, () => {
  console.log(`Arbebus backend running on http://${HOST}:${PORT}`);
});