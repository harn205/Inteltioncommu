const path = require('path');
const express = require("express");
const router = express.Router();
const {CommunicationIdentityClient,} = require("@azure/communication-identity");
const { DefaultAzureCredential } = require("@azure/identity");
const mysql = require('mysql');
const util = require('util');

var con = mysql.createConnection({
    host: "mysql-commu.mysql.database.azure.com",
    user: "azureadmin",
    password: "Inteltion7",
    database: "inteltioncommu",
    port: 3306
});

const nonExistingUser = function(username) {
    return new Promise(async (resolve, reject) => {
        const connectionString =
            "endpoint=https://inteltion-commu.unitedstates.communication.azure.com/;accesskey=yvXqDm9ZKqlLkC2iz0JhwBVf95uFoLRv7mjZoaTAR84gde3DZfen+gcZjrNOWMORpEzy0OmwR30VOcsDMzf1yA==";

        // Instantiate the identity client
        const identityClient = new CommunicationIdentityClient(connectionString);

        try {
            let identityResponse = await identityClient.createUser();
            let tokenResponse = await identityClient.getToken(identityResponse, ["voip"]);

            // Get the token and its expiration date from the response
            const { token, expiresOn } = tokenResponse;

            // Insert a new record into the 'user_profile' table
            var sql = "INSERT INTO user_profile (username, communicationID) VALUES (?, ?)";
            var values = [username, identityResponse.communicationUserId];
            con.query(sql, values, function (err, result) {
                if (err) {
                    reject(err);
                } else {
                    // console.log(`\n username is : ${username}`);
                    // console.log(`\n Communication ID is : ${identityResponse.communicationUserId}`);
                    // console.log(`\n with token: ${token}`);

                    // Resolve the promise with the desired object
                    const responseData = {
                        "username": username,
                        "commuID": identityResponse.communicationUserId,
                        "token": token
                    };
                    resolve(responseData);
                }
            });
        } catch (error) {
            reject(error);
        }
    });
};

const existingUser = util.promisify((username, callback) => {
  con.query(`SELECT * FROM user_profile WHERE username='${username}'`, function (err, result, fields) {
      if (err) {
          return callback(err, null);
      }
      if (result.length > 0) {
          const commuID = result[0].communicationID;
          const connectionString =
              "endpoint=https://inteltion-commu.unitedstates.communication.azure.com/;accesskey=yvXqDm9ZKqlLkC2iz0JhwBVf95uFoLRv7mjZoaTAR84gde3DZfen+gcZjrNOWMORpEzy0OmwR30VOcsDMzf1yA==";
          const identityClient = new CommunicationIdentityClient(connectionString);
          let identityResponse = { "communicationUserId": commuID };
          identityClient.getToken(identityResponse, ["voip"])
              .then(tokenResponse => {
                  const { token, expiresOn } = tokenResponse;
                  const responseData = {
                      "username": username,
                      "communicationID": commuID,
                      "token": token
                  };
                  callback(null, responseData);
              })
              .catch(error => {
                  callback(error, null);
              });
      } else {
          callback(null, null); // User not found
      }
  });
});

async function generateToken(username) {
    let connection;
    try {
        // Create a new connection
        connection = mysql.createConnection({
            host: "mysql-commu.mysql.database.azure.com",
            user: "azureadmin",
            password: "Inteltion7",
            database: "inteltioncommu",
            port: 3306
        });

        // Connect to the database
        await util.promisify(connection.connect).call(connection);

        // Perform the query
        const result = await util.promisify(connection.query).call(connection, `SELECT * FROM user_profile where username = '${username}'`);

        // Check the result and log accordingly
        if (result.length === 0) {
            console.log(`\nUser '${username}' is not found, Creating new user and generating new token...`);
            const data = await nonExistingUser(username);
            return data; // Return data from nonExistingUser
        } else {
            console.log(`\nUser '${username}' is existed on the database, generating new token...`);
            const data = await existingUser(username);
            return data; // Return data from existingUser
        }
    } catch (error) {
        console.error(error);
        throw error; // Re-throw the error to be caught by the caller
    } finally {
        // End the database connection in the 'finally' block
        if (connection && connection.end) {
            connection.end(); // Close the connection
        }
    }
}


// Example on how to generate Token
// generateToken('peanut')
//     .then(data => {
//         console.log(data); // Log the data returned from generateToken
//     })
//     .catch(error => {
//         console.error('Error:', error);
//     });



router.post("/", async (req, res) => {
    try {
        const { username } = req.body; // Extract ADLSfilepath from the request body
        console.log(`\nReceive '${username}' from front end...`)
        generateToken(username)
        .then(data => {
            console.log(`\nGenerated Token for user '${username}' is : `,data.token); // Log the data returned from generateToken
            res.status(200).send(data.token);
        })
        .catch(error => {
            console.error('Error:', error);
        });
        
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
  });
  module.exports = router;