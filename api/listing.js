const { BlobServiceClient } = require("@azure/storage-blob");
const express = require('express');
const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const blobServiceClient = BlobServiceClient.fromConnectionString(
            "DefaultEndpointsProtocol=https;AccountName=adlsgptdemo;AccountKey=pWsl1VtqH2QACRA7Cr9O/I+zJTQIhi9svshRIKUkVog82NFtrvUPoeQdLkpHA/SHpaDGJhu+F1ix+ASt1Ek63w==;EndpointSuffix=core.windows.net"
        );
        const containerClient = blobServiceClient.getContainerClient("adlsgptdemo");

        const maxPageSize = 10;
        let i = 1;
        let marker;
        const listOptions = {
            includeMetadata: true, // Include metadata when listing blobs
            includeSnapshots: false,
            includeTags: false,
            includeVersions: false,
            prefix: ''
        };

        let iterator = containerClient.listBlobsFlat(listOptions).byPage({ maxPageSize });
        let response = (await iterator.next()).value;

        const formattedBlobs = [];

        for (const blob of response.segment.blobItems) {
            // const modifiedDate = blob.metadata && blob.metadata.modifiedDate ? new Date(blob.metadata.modifiedDate) : null;
            // console.log(blob.properties.lastModified )
            formattedBlobs.push({ id: i++, name: blob.name, modifiedDate:blob.properties.lastModified });
        }

        marker = response.continuationToken;

        iterator = containerClient.listBlobsFlat().byPage({
            continuationToken: marker,
            maxPageSize: maxPageSize * 2
        });
        response = (await iterator.next()).value;

        for (const blob of response.segment.blobItems) {
            // const modifiedDate = blob.metadata && blob.metadata.modifiedDate ? new Date(blob.metadata.modifiedDate) : null;
            formattedBlobs.push({ id: i++, name: blob.name, modifiedDate:blob.properties.lastModified });
        }

        // Sort blobs by modified date in descending order
        formattedBlobs.sort((a, b) => b.modifiedDate - a.modifiedDate);

        // Log the formattedBlobs array or return it as needed
        // console.log(JSON.stringify(formattedBlobs, null, 2));
        res.send(JSON.stringify(formattedBlobs, null, 2));
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;

