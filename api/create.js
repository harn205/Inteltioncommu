const express = require("express");
const router = express.Router();
require('dotenv').config();
const { BlobServiceClient } = require("@azure/storage-blob");
const path = require('path');
const { Buffer } = require('buffer');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const { DefaultAzureCredential } = require("@azure/identity");
const { DocumentAnalysisClient, AzureKeyCredential } = require('@azure/ai-form-recognizer');
const { SearchIndexClient } = require("@azure/search-documents");
const pdf = require('pdf-parse');
const crypto = require('crypto');
const htmlEscape = require('html-escape'); // Import a library for HTML escaping if needed
const axios = require('axios');
const { SearchClient } = require("@azure/search-documents");

const { SearchIndex, SearchFieldDataType, SemanticSettings, SemanticConfiguration, VectorSearchAlgorithmConfiguration, HnswParameters, PrioritizedFields, SimpleField, SearchableField } = require("@azure/search-documents");

async function createSearchIndex(indexName) {
    console.log(`Ensuring search index ${indexName} exists`);
    
    const endpoint = `https://${process.env.AZURE_SEARCH_SERVICE}.search.windows.net/`;

    const searchClient = new SearchIndexClient(endpoint, new AzureKeyCredential(process.env.AZURE_SEARCH_INDEX_KEY)); 
    const indexNames = [];
    
    // Use the .byPage() method to retrieve all pages of index names
    for await (const page of searchClient.listIndexes().byPage()) {
        for (const index of page) {
            indexNames.push(index.name);
        }
    }
    
    if (!indexNames.includes(indexName)) {
        const index = {
            name: indexName,
            fields: [
                { name: "id", type: "Edm.String", key: true },
                { name: "content", type: "Edm.String", searchable: true, analyzerName: "en.microsoft" },
                { name: "embedding", type: "Collection(Edm.String)", hidden: false, searchable: true, filterable: false, sortable: false, facetable: false, vectorSearch: { dimensions: 1536, configuration: "default" } },
                { name: "category", type: "Edm.String", filterable: true, facetable: true },
                { name: "sourcepage", type: "Edm.String", filterable: true, facetable: true },
                { name: "sourcefile", type: "Edm.String", filterable: true, facetable: true }
            ],
            semanticSettings: {
                configurations: [
                    {
                        name: "default",
                        prioritizedFields: {
                            titleField: null,
                            prioritizedContentFields: [{ name: "content" }]
                        }
                    }
                ]
            },
            vectorSearch: {
                algorithmConfigurations: [
                    {
                        name: "default",
                        kind: "hnsw",
                        hnswParameters: {
                            metric: "cosine"
                        }
                    }
                ]
            }
        };

        console.log(`Creating ${indexName} search index`);
        await searchClient.createIndex(index);
    } else {
        console.log(`Search index ${indexName} already exists`);
    }
}

// router.get("/", async (req, res) => {
//     // const data = req.body;
//     // await upload_blobs('./uploads/test.pdf');
//     let tmp = await createSearchIndex('test');
//     // let pagemap = await getDocumentText('./uploads/test.pdf');
//     res.status(200);
// });

module.exports = {createSearchIndex};
