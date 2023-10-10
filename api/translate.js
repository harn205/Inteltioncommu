const axios = require('axios');
require('dotenv').config();

async function translateText(text, lang) {
    //console.time('translateText');
    let url = `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${lang}`;
    let headers = {
        'Ocp-Apim-Subscription-Key': process.env.AZURE_TRANSLATE_KEY,
        'Ocp-Apim-Subscription-Region': process.env.AZURE_TRANSLATE_REGION,
        'Content-type': 'application/json'
    };
    let body = [{
        'text': text
    }];

    try {
        let response = await axios.post(url, body, {headers: headers});
        let answer;
        if(!response.data[0].translations[0].text){
            answer = '';
        }else{
            answer = response.data[0].translations[0].text;
        }
        return answer;
    } catch (error) {
        console.error('Error in Azure Translator:', error);
    }
}

module.exports = {
    translateText
};