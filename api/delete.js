const { BlobServiceClient} = require("@azure/storage-blob");
const { SearchClient, odata } = require("@azure/search-documents");
const path = require('path');
const express = require("express");
const router = express.Router();
// require('dotenv').config();
const { DocumentAnalysisClient, AzureKeyCredential } = require('@azure/ai-form-recognizer');

// async function deleteFromIndex(filename) {
//   let indexes = [process.env.AZURE_SEARCH_INDEX, process.env.AZURE_SEARCH_INDEX+'-eng', process.env.AZURE_SEARCH_INDEX+'-th']
//   for (let k=0;k<indexes.length;k++){
//     console.log(`deleting index ${indexes[k]}`)
//     let searchClient = new SearchClient(`https://${process.env.AZURE_SEARCH_SERVICE}.search.windows.net/`, indexes[k], new AzureKeyCredential(process.env.AZURE_SEARCH_INDEX_KEY));
//     const extname = path.extname(filename);
//     const basename = path.basename(filename, extname);
//     while (true) {
//       let filter = null;
//       if (filename !== null) {
//         filter = odata`sourcefile eq '${basename}'`;
//       }
//       const response = await searchClient.search("", {
//         filter: filter,
//         top: 1000,
//         includeTotalCount: true,
//       });
//       if (response.count === 0) {
//         break;
//       }
//       // console.log(response.results)
//       let documentsToDelete = [];
//       for await (const result of response.results) {
//         documentsToDelete.push({id: result.document.id});
//       }
//       await searchClient.deleteDocuments(documentsToDelete);
//       console.log(`Removed ${documentsToDelete.length} sections from index ${indexes[k]}`);
//       // await sleep(2000);
//     }
//   }
// }

async function deleteDocumentFromAzure(filename) {
    const blobServiceClient = BlobServiceClient.fromConnectionString(
        "DefaultEndpointsProtocol=https;AccountName=adlsgptdemo;AccountKey=pWsl1VtqH2QACRA7Cr9O/I+zJTQIhi9svshRIKUkVog82NFtrvUPoeQdLkpHA/SHpaDGJhu+F1ix+ASt1Ek63w==;EndpointSuffix=core.windows.net"
      );
    const containerClient = blobServiceClient.getContainerClient(
        "adlsgptdemo"
      );
    const response = await containerClient.deleteBlob(filename);
    console.log(`Successfully deleted '${filename}'`)
    if (response._response.status !== 202) {
        throw new Error(`Error deleting ${filename}`);
        }
    };

// deleteDocumentFromAzure('CDI_April2023_Tasks_en.pdf');

router.post("/", async (req, res) => {
  try {
      const { itemToDelete } = req.body; // Extract ADLSfilepath from the request body
      // console.log('itemToDelete:', itemToDelete);
      itemToDelete.forEach(item => {
        deleteDocumentFromAzure(item.name);
        console.log(`Deleted ${item.name}`);
      });
      // Your file upload logic or other processing with ADLSfilepath here
      
      res.status(200).send('ok');
  } catch (error) {
      console.error('Error:', error);
      res.status(500).send('Internal Server Error');
  }
});
module.exports = router;

