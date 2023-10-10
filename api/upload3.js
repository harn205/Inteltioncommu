const express = require('express');
const router = express.Router();
const { BlobServiceClient, StorageSharedKeyCredential } = require("@azure/storage-blob");
import { BlobServiceClient } from "@azure/storage-blob";


router.post("/", async (req, res) => {

const blobServiceClient = BlobServiceClient.fromConnectionString(
"DefaultEndpointsProtocol=https;AccountName=adlsgptdemo;AccountKey=pWsl1VtqH2QACRA7Cr9O/I+zJTQIhi9svshRIKUkVog82NFtrvUPoeQdLkpHA/SHpaDGJhu+F1ix+ASt1Ek63w==;EndpointSuffix=core.windows.net"
);
const containerClient = blobServiceClient.getContainerClient(
"adlsgptdemo"
);
const deleteDocumentFromAzure = async () => {
const response = await containerClient.deleteBlob("Associate Cloud Engineer Exam Short Note (1).pdf");
if (response._response.status !== 202) {
throw new Error(`Error deleting ${"Associate Cloud Engineer Exam Short Note (1).pdf"}`);
}
};

deleteDocumentFromAzure();




// const accountName = "adlsgptdemo";
// const accountKey = "adlsgptdemo";
// const containerName = "adlsgptdemo"; // This is equivalent to a filesystem in ADLS
// const directoryPath = ""; // Path to the folder in ADLS
// const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
// const blobServiceClient = new BlobServiceClient(`https://${accountName}.blob.core.windows.net`, sharedKeyCredential);
// const containerClient = blobServiceClient.getContainerClient(containerName);

// let response = await containerClient.findBlobsByHierarchy(directoryPath, { delimiter: '/' })
  
// console.log(response)
// //   let blobList = [];
// //   for await (const blob of containerClient.findBlobsByHierarchy(directoryPath, { delimiter: '/' })) {
// //     blobList.push(blob.name);
// //   }
// //   console.log(blobList)




});
module.exports = router;
