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
const pdf = require('pdf-parse');
const crypto = require('crypto');
const htmlEscape = require('html-escape'); // Import a library for HTML escaping if needed
const axios = require('axios');
const { SearchClient } = require("@azure/search-documents");
const {createSearchIndex} = require('./create')
const mstranslator = require("./translate");

async function blobNameFromFilePage(filename, page) {
    try {
        if (path.extname(filename).toLowerCase() === '.pdf') {
            const basename = path.basename(filename, path.extname(filename));
            return `${basename}-${page}.pdf`;
        } else {
            return path.basename(filename);
        }
    } catch (error) {
        console.log(error);
    }
}

// async function upload_blobs(filename){
//     try{
//         console.log(`===================== Uploaded blob`);
//         const AzureDeveloperCliCredential = new DefaultAzureCredential();
//         console.log(AzureDeveloperCliCredential);
//         const blob_service = new BlobServiceClient(process.env.blobServiceClient_endpoint, AzureDeveloperCliCredential);
//         // console.log(blob_service);
//         const blob_container = blob_service.getContainerClient(process.env.AZURE_STORAGE_CONTAINER)
//         // console.log(blob_container);
//         const extname = path.extname(filename); // Get the file extension including the dot (e.g., ".txt")
//         const basename = path.basename(filename, extname); // Get the file name without the extension
//         let blobName = "";
//         if (filename.toLowerCase().endsWith('.pdf')) {
//             const pdfDoc = await PDFDocument.load(fs.readFileSync(filename));
//             const pages = pdfDoc.getPages();
//             for (let i = 0; i < pages.length; i++) {
//               blobName = await blobNameFromFilePage(filename, i+1); // Customize the blob name as needed
//               let newPdfDoc = await PDFDocument.create();
//               let [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [i]);
//               newPdfDoc.addPage(copiedPage);
//               let f = await newPdfDoc.save();
//               let blockBlobClient = blob_container.getBlockBlobClient(blobName);
//               await blockBlobClient.upload(f, f.length);
//               console.log(`Uploaded blob for page ${i} -> ${blobName}`);
//             }
//           } else {
//             console.log('The file is not a PDF.');
//           }
//         // return result;
//     } catch (err) {
//         console.log(err);
//     }
// }

async function table_to_html(table) {
  let tableHtml = "<table>";
  const rows = Array.from({ length: table.rowCount }, (_, rowIndex) => {
    return table.cells.filter(cell => cell.rowIndex === rowIndex).sort((a, b) => a.columnIndex - b.columnIndex);
  });

  for (const rowCells of rows) {
    tableHtml += "<tr>";
    for (const cell of rowCells) {
      const tag = (cell.kind === "columnHeader" || cell.kind === "rowHeader") ? "th" : "td";
      let cellSpans = "";
      if (cell.columnSpan > 1) {
        cellSpans += ` colSpan="${cell.columnSpan}"`;
      }
      if (cell.rowSpan > 1) {
        cellSpans += ` rowSpan="${cell.rowSpan}"`;
      }
      tableHtml += `<${tag}${cellSpans}>${htmlEscape(cell.content)}</${tag}>`;
    }
    tableHtml += "</tr>";
  }
  tableHtml += "</table>";
  return tableHtml;
}


async function getDocumentText(filename) {
    try {
        console.log(`===================== getDocumentText`);
        let offset = 0;
        let pageMap = [];
        // Determine if you want to use local PDF parsing or Azure Form Recognizer
        let useLocalPdfParser = false; // Set to true or false based on your preference
        if (useLocalPdfParser) {
            let dataBuffer = fs.readFileSync(filename);
            let data = await pdf(dataBuffer);
            for (let page_num = 0; page_num < data.numpages; page_num++) {
            let page_text = data.pages[page_num].text;
            pageMap.push({ page_num, offset, page_text });
            offset += page_text.length;
            }
        } else {
            // Use Azure Form Recognizer
            let formRecognizerClient = new DocumentAnalysisClient(`https://${process.env.AZURE_FORMRECOGNIZER_SERVICE}.cognitiveservices.azure.com/`, new AzureKeyCredential(process.env.AZURE_FORMRECOGNIZER_KEY), "V2023_07_31");
            //========
            const blobServiceClient = BlobServiceClient.fromConnectionString('DefaultEndpointsProtocol=https;AccountName=adlsgptdemo;AccountKey=pWsl1VtqH2QACRA7Cr9O/I+zJTQIhi9svshRIKUkVog82NFtrvUPoeQdLkpHA/SHpaDGJhu+F1ix+ASt1Ek63w==;EndpointSuffix=core.windows.net');
            const containerClient = blobServiceClient.getContainerClient('adlsgptdemo');
            const blobClient = containerClient.getBlobClient(filename);

            await blobClient.downloadToFile('./uploads/'+filename);

            let fileStream = fs.createReadStream('./uploads/'+filename);
            let poller = await formRecognizerClient.beginAnalyzeDocument('prebuilt-layout', fileStream);
            let formRecognizerResults = await poller.pollUntilDone();
            for (const page of formRecognizerResults.pages) {
                let tablesOnPage = formRecognizerResults.tables.filter((table) => table.boundingRegions[0].pageNumber === page.pageNumber);
                let page_offset = page.spans[0].offset
                let page_length = page.spans[0].length
                let table_chars = Array(page_length).fill(-1);//[-1]*page_length
                for (let i=0;i<tablesOnPage.length;i++){
                    let table_id = i;
                    let table = tablesOnPage[i];
                    for (let k=0;k<table.spans.length;k++){
                      let span = table.spans[k];
                        // # replace all table spans with "table_id" in table_chars array
                        for (let j=0;j<span.length;j++){
                            let idx = span.offset - page_offset + j;
                            if (idx >=0 && idx < page_length){
                                table_chars[idx] = table_id
                            }
                        }
                    }
                }
                // Similar logic as your Python code for processing tables
                // Build page text with tables
                let page_text = '';
                let added_tables = new Set();
                // Add tables as HTML to page_text
                for (let l=0;l<table_chars.length;l++){
                    let idx = l;
                    let table_id = table_chars[l];
                    if (table_id == -1){
                        page_text += formRecognizerResults.content[page_offset + idx]
                    } else if (!added_tables.has(table_id)){
                        page_text += table_to_html(tablesOnPage[table_id])
                        added_tables.add(table_id)
                    }
                }
                page_text += ' '; // Add space or separator between pages
                pageMap.push({ page_num: page.pageNumber - 1, offset, page_text });
                offset += page_text.length;
            }
        }
        return pageMap;
    } catch (error) {
        console.log(error);
    }
}

function filenameToID(filename) {
    try {
        // Replace characters that are not alphanumeric, underscore, or hyphen with underscores
        const filenameAscii = filename.replace(/[^0-9a-zA-Z_-]/g, '_');
        // Generate a SHA-256 hash of the filename and encode it as base64
        const filenameHash = crypto
            .createHash('sha256')
            .update(filename)
            .digest('base64')
            .replace(/\//g, '_')
            .replace(/\+/g, '-');
        return `file-${filenameAscii}-${filenameHash}`;
    } catch (error) {
        console.log(error);
    }
  }

const SENTENCE_ENDINGS = [".", "!", "?"];
const WORDS_BREAKS = [",", ";", ":", " ", "(", ")", "[", "]", "{", "}", "\t", "\n"];
const SECTION_OVERLAP = 100; // Define the overlap size as needed
const MAX_SECTION_LENGTH = 1000; // Define the maximum section length as needed
const SENTENCE_SEARCH_LIMIT = 100; // Define the sentence search limit as needed
  
function* splitText(pageMap) {
    const findPage = (offset) => {
        const numPages = pageMap.length;
        for (let i = 0; i < numPages - 1; i++) {
            // console.log(pageMap[0]);
            if (offset >= pageMap[i].offset && offset < pageMap[i + 1].offset) {
                return i;
            }
        }
        return numPages - 1;
    };
    // console.log(1);
    // console.log(pageMap);
    let allText = "";
    for (let j=0;j<pageMap.length;j++){
      allText += pageMap[j].page_text;
    }
    // console.log(allText);
    let length = allText.length;
    let start = 0;
    let end = length;
    while (start + SECTION_OVERLAP < length) {
      let lastWord = -1;
      end = start + MAX_SECTION_LENGTH;
  
      if (end > length) {
        end = length;
      } else {
        while (end < length && end - start - MAX_SECTION_LENGTH < SENTENCE_SEARCH_LIMIT && !SENTENCE_ENDINGS.includes(allText[end])) {
          if (WORDS_BREAKS.includes(allText[end])) {
            lastWord = end;
          }
          end++;
        }
        if (end < length && !SENTENCE_ENDINGS.includes(allText[end]) && lastWord > 0) {
          end = lastWord;
        }
      }
      if (end < length) {
        end++;
      }
      lastWord = -1;
      while (start > 0 && start > end - MAX_SECTION_LENGTH - 2 * SENTENCE_SEARCH_LIMIT && !SENTENCE_ENDINGS.includes(allText[start])) {
        if (WORDS_BREAKS.includes(allText[start])) {
          lastWord = start;
        }
        start--;
      }
      if (!SENTENCE_ENDINGS.includes(allText[start]) && lastWord > 0) {
        start = lastWord;
      }
      if (start > 0) {
        start++;
      }
  
      const sectionText = allText.slice(start, end); //check
      yield [sectionText, findPage(start)];
  
      const lastTableStart = sectionText.lastIndexOf("<table");
      if (lastTableStart > 2 * SENTENCE_SEARCH_LIMIT && lastTableStart > sectionText.lastIndexOf("</table")) {
        start = Math.min(end - SECTION_OVERLAP, start + lastTableStart);
      } else {
        start = end - SECTION_OVERLAP;
      }
    }
  
    if (start + SECTION_OVERLAP < end) {
      yield [allText.slice(start, end), findPage(start)];
    }
}

async function computeEmbedding(text) {
  try {
    // Refresh your OpenAI token as needed
    // refreshOpenaiToken();
    const response = await axios.post(`https://api.openai.com/v1/engines/${process.env.AZURE_OPENAI_EMB_DEPLOYMENT}/completions`,
      {
        prompt: text, max_tokens: 1000,
      },
      {
        headers: {
          Authorization: process.env.AZURE_OPENAI_API_KEY, // Replace with your OpenAI API key
          'Content-Type': 'application/json',
        },
      }
    );

    const embedding = response.data;
    console.log(embedding);
    return embedding;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

async function createSections(filename, pageMap, useVectors) {
    console.log(`===================== createSections`);
    let fileID = filenameToID(filename);
    let sections = [];
    let split_text = splitText(pageMap);

    // To get the next value from the generator
    let index = 0;
    for (const item of split_text){
      let content= item[0];
      let pagenum= item[1];
      const extname = path.extname(filename);
      const basename = path.basename(filename, extname);
      let section = {
        id: `${fileID}-page-${index}`,
        content: content,
        category: null, // Replace with your desired category
        sourcepage: await blobNameFromFilePage(filename, pagenum),
        sourcefile: basename,
      };
      // console.log(2);
      if (useVectors) {
        section.embedding = computeEmbedding(content);
      }
      sections.push(section);
      index++;
    }
  
    return sections;
}

async function indexSections(filename, sections) {
    console.log(`===================== Upload Section to Index`);    
    let indexes = [process.env.AZURE_SEARCH_INDEX, process.env.AZURE_SEARCH_INDEX+'-eng', process.env.AZURE_SEARCH_INDEX+'-th']
    let lang = ['not', 'en', 'th']
    for(let k=0;k<indexes.length;k++){
      console.log(`Indexing sections from '${filename}' into search index '${indexes[k]}'`);
      await createSearchIndex(indexes[k]);
      let searchClient = new SearchClient(`https://${process.env.AZURE_SEARCH_SERVICE}.search.windows.net/`, indexes[k], new AzureKeyCredential(process.env.AZURE_SEARCH_INDEX_KEY));
      let tmp_section = sections;
      if (lang[k] != 'not'){
        for (let j=0;j<tmp_section.length;j++){
          tmp_section[j].content = await mstranslator.translateText(sections[j].content, lang[k]);
        }
      }
      let i = 0;
      let batch = []; 
      for (const s of tmp_section) {
        batch.push(s);
        i += 1;
        if (i % 1000 === 0) {
            const results = await searchClient.uploadDocuments(batch);
            let succeeded = 0;
            for(let i=0;i<results.results.length;i++){
              if(results.results[i].succeeded){
                succeeded++;
              }
            }
            // let succeeded = results.filter(r => r.succeeded).length;    
            console.log(`Indexed ${results.length} sections, ${succeeded} succeeded`);
            batch = [];
        }
    }
    if (batch.length > 0) {
        const results = await searchClient.uploadDocuments(batch);
        let succeeded = 0;
        for(let i=0;i<results.results.length;i++){
          if(results.results[i].succeeded){
            succeeded++;
          }
        }
        console.log(`\tIndexed ${results.length} sections, ${succeeded} succeeded`);
    }
    }
}


// get my profile
router.get("/", async (req, res) => {
    const data = req.body;
    // await upload_blobs('./uploads/test.pdf');
    let pagemap = await getDocumentText('IT_Guide_for_New_Employee.pdf');
    // console.log(pagemap);
    let sections = await createSections('IT_Guide_for_New_Employee.pdf', pagemap, false);
    // console.log(sections);
    await indexSections('IT_Guide_for_New_Employee.pdf', sections)
    res.status(200);
});


module.exports = router;
