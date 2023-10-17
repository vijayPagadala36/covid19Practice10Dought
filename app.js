const express = require("express");
const app = express();
app.use(express.json());

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`Db Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

app.post("/signup/", async (request, response) => {
  const { userName, password } = request.body;
  const modifiedPassword = await bcrypt.hash(password, 10);
  const userQuery = `INSERT INTO user (username, password) VALUES ('${userName}', '${modifiedPassword}');`;
  const dbRequest = await db.run(userQuery);
  response.send("Posted");
});

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const userQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbResponse = await db.get(userQuery);
  if (dbResponse === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isMatched = await bcrypt.compare(password, dbResponse.password);
    console.log(isMatched);
    console.log(dbResponse);
    if (isMatched === true) {
      const payLoad = { username: username };
      const jwtToken = await jwt.sign(payLoad, "MyToken");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const middleWare = (request, response, next) => {
  let jwtToken;
  const authHeaders = request.headers["authorization"];
  if (authHeaders !== undefined) {
    jwtToken = authHeaders.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MyToken", async (error, user) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = user.username;
        next();
      }
    });
  }
};

app.get("/states/", middleWare, async (request, response) => {
  const stateQuery = `SELECT * FROM state;`;
  const dbResponse = await db.all(stateQuery);
  response.send(dbResponse);
});

app.get("/states/:stateId/", middleWare, async (request, response) => {
  const { stateId } = request.params;
  const statesQuery = `SELECT * FROM state WHERE state_id = ${stateId};`;
  const dbResponse = await db.get(statesQuery);
  response.send(dbResponse);
});

app.post("/districts/", middleWare, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const districtsQuery = `INSERT INTO district (district_name, state_id, cases, cured, active, deaths)
    VALUES ('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;
  const dbResponse = await db.run(districtsQuery);
  response.send("District Successfully Added");
});

app.get("/districts/:districtId/", middleWare, async (request, response) => {
  const { districtId } = request.params;
  const districtQuery = `SELECT * FROM district WHERE district_id = ${districtId};`;
  const dbResponse = await db.get(districtQuery);
  response.send(dbResponse);
});

app.delete("/districts/:districtId/", middleWare, async (request, response) => {
  const { districtId } = request.params;
  const districtQuery = `DELETE FROM district WHERE district_id = ${districtId};`;
  const dbResponse = await db.run(districtQuery);
  response.send("District Removed");
});

app.put("/districts/:districtId/", middleWare, async (request, response) => {
  const { districtId } = request.params;
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const districtQuery = `UPDATE district SET 
  district_name = '${districtName}',
  state_id = ${stateId},
   cases = ${cases},
  cured = ${cured},
  active = ${active},
  deaths = ${deaths}`;
  const dbResponse = await db.run(districtQuery);
  response.send("District Details Updated");
});

app.get("/states/:stateId/stats/", middleWare, async (request, response) => {
  const { stateId } = request.params;
  const resultQuery = `SELECT sum(cases)  AS totalCases, SUM(cured)  AS totalCured, SUM(active)  AS totalActive, SUM(deaths)  AS totalDeaths
    FROM (district INNER JOIN state ON district.state_id = state.state_id) AS t WHERE t.state_id = ${stateId};`;
  const dbResponse = await db.get(resultQuery);
  response.send(dbResponse);
});

module.exports = app;
