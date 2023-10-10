const path = require('path');
const express = require("express");
const router = express.Router();
const mysql = require('mysql');

router.get("/", async (req, res) => {
    try {
        var con = mysql.createConnection({
            host: "mysql-commu.mysql.database.azure.com",
            user: "azureadmin",
            password: "Inteltion7",
            database: "inteltioncommu",
            port: 3306
        });

        // Establish connection
        con.connect(function(err) {
            if (err) {
                console.error('Error:', err);
                res.status(500).send('Internal Server Error');
                return;
            }

            con.query("SELECT * FROM user_profile", function (err, result, fields) {
                // Close the connection after the query has completed
                con.end();

                if (err) {
                    console.error('Error:', err);
                    res.status(500).send('Internal Server Error');
                    return;
                }

                // Convert the result to JSON objects
                var jsonResult = JSON.parse(JSON.stringify(result));
                console.log(jsonResult);
                res.status(200).send(jsonResult);
            });
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;
