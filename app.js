const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const app = express();
const bcrypt = require("bcrypt");
app.use(express.json());
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;
const convertDbObjectToResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();
module.exports = app;

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//login api
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//Get states_List
app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `
  SELECT * FROM state;`;
  const statesArray = await db.all(getStatesQuery);
  let count = 0;
  for (let each of statesArray) {
    statesArray[count] = convertDbObjectToResponseObject(each);
    count = count + 1;
  }
  response.send(statesArray);
});

//GET STATE
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
  SELECT * FROM state WHERE state_id=${stateId}`;
  const stateObject = convertDbObjectToResponseObject(
    await db.get(getStateQuery)
  );

  response.send(stateObject);
});

//POST District
app.post("/districts/", authenticateToken, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;

  const addDistrictDetails = `
    INSERT INTO
      district (district_name, state_id, cases,cured,active,deaths )
    VALUES
      (
        '${districtName}',
         ${stateId},
         ${cases},
         ${cured},
         ${active},
         ${deaths}
      );`;

  const dbResponse = await db.run(addDistrictDetails);
  console.log(dbResponse);

  response.send("District Successfully Added");
});

//GET DISTRICT
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
  SELECT * FROM district WHERE district_id=${districtId}`;
    const districtObject = await db.get(getDistrictQuery);
    const district = {
      districtId: districtObject.district_id,
      districtName: districtObject.district_name,
      stateId: districtObject.state_id,
      cases: districtObject.cases,
      cured: districtObject.cured,
      active: districtObject.active,
      deaths: districtObject.deaths,
    };
    response.send(district);
  }
);

//UPDATE DISTRICT
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;

    const updateDistrictDetails = `
    UPDATE
      district
    SET
    district_name='${districtName}',
    state_id=${stateId},
    cases=${cases},
    cured=${cured},
    active=${active},
    deaths=${deaths}
    WHERE district_id=${districtId};`;

    const dbResponse = await db.run(updateDistrictDetails);

    response.send("District Details Updated");
  }
);

//DELETE DISTRICT

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
    DELETE FROM
      district
    WHERE
      district_id = ${districtId};`;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//GET STATE STATS

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateStatsQuery = `
  SELECT SUM(cases) as totalCases, SUM(cured) as totalCured,SUM(active) as totalActive,SUM(deaths) as totalDeaths from district GROUP BY state_id HAVING state_id=${stateId};`;
    const districtObject = await db.get(getStateStatsQuery);
    response.send(districtObject);
  }
);

//GET STATE OF DISTRICT

app.get(
  "/districts/:districtId/details/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getStateQuery = `
  SELECT state_name  FROM district NATURAL JOIN state WHERE district_id=${districtId};`;
    let stateObject = await db.get(getStateQuery);
    stateObject = { stateName: stateObject.state_name };
    response.send(stateObject);
  }
);
