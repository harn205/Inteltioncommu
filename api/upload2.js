const express = require('express');
const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const { ADLSfilepath } = req.body; // Extract ADLSfilepath from the request body
        console.log('ADLSfilepath:', ADLSfilepath);

        // Your file upload logic or other processing with ADLSfilepath here

        res.status(200).send('ok');
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;
