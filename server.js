const app = require("express")();
const port = 8000;
const generateTokenRouter = require("./api/generate_token");
const databaseRouter = require("./api/database");

// for accepting post from data
const bodyParser = require("express").json;

var Parser = require('body-parser');
app.use(Parser.json({limit: '20mb'}));

app.use(bodyParser());

const cors = require("cors");
app.use(cors());

app.use("/generate_token", generateTokenRouter);
app.use("/database", databaseRouter);


app.get("/", (req, res) => {
  res.send("Hello World!");
});

var server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

server.timeout = 120000;