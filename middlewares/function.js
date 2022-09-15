const  randomWords = require('random-words');
const HtmlFilter = require('html-filter');


function RandomList_ofWords(number) {
   let randomSentence = randomWords(number);
   let merged_word = randomSentence[0];
   for (let i = 1; i < randomSentence.length; i++) {
      merged_word += ' ' + randomSentence[i];
   }
   return merged_word;
};

function getAllowedCharacters(allowedCharacters) {
   if (allowedCharacters === 'letterAndnumber') return 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
   if (allowedCharacters === 'number') return '0123456789'
   if (allowedCharacters === 'letter') return 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
   return 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%&'
}

function generateRandomString(length, allowedCharacters) {
   allowedCharacters = getAllowedCharacters(allowedCharacters);

   var result = '',
   charactersLength = allowedCharacters.length; 

   for (var i = 0; i < length; i++) {
      result += allowedCharacters.charAt(Math.floor(Math.random() * charactersLength));
   }
   return result;
}

// Html Sanitizer Function
function stringToTags(string, symbol, startTag, endTag) {
   let splitedString = string.split(symbol);

   if (splitedString.length <= 1) return string; // Return If Nothing To format

   let formatedString = splitedString[0];

   splitedString.shift();

   let Start_Or_End;
   for (let i = 0; i < splitedString.length; i++) {
      if (!Start_Or_End) {
         formatedString += startTag;
         Start_Or_End = true;
      } else {
         formatedString += endTag;
         Start_Or_End = undefined;
      }
      formatedString += splitedString[i];
   }
   return formatedString;
}
function sanitizeHTML(string) {
   const filter = new HtmlFilter();
   string = filter.filter(string);

   string = string.split('\n').join('<br>');
   string = stringToTags(string, '**', '<b>', '</b>');
   string = stringToTags(string, '*B', '<h3>', '</h3>');
   string = stringToTags(string, '*M', '<h5>', '</h5>');
   string = stringToTags(string, '*S', '<h6>', '</h6>');
   string = stringToTags(string, '*', ' <em>', '</em>');

   return string;
};

// Pagination
async function paginatedResults(model, query = {}, {page = 1, limit = 12}, paginateArray) {
   page = isNaN(parseInt(page)) || page == 0 ? 1 : parseInt(page);
   if (page > 5000) page = 5000;

   const startIndex = (page - 1) * limit;
   const endIndex = page * limit;

   const results = {};

   // Count Document
   let countedDocuments;
   if (paginateArray) countedDocuments = paginateArray.length;
   else countedDocuments = await model.countDocuments(query).exec();

   // NextPage Creation
   results.nextPage = [page];
   if (startIndex > 0) results.nextPage.unshift(page - 1);
   if ((page - 2) * limit > 0) results.nextPage.unshift(page - 2);
   if (endIndex < countedDocuments) results.nextPage.push(page + 1);
   if ((page + 1) * limit < countedDocuments) results.nextPage.push(page + 2);

   if (paginateArray) {
      results.results = paginateArray.splice(startIndex, endIndex);
      return results;
   } else {
      try {
         results.results = await model.find(query).limit(limit).skip(startIndex).exec();
         return results;
      } catch (e) {
         console.log(e);
         throw new Error(e.message);
      }
   }
};


function formatUsernameWithSettings(sender, setting) {
   if (setting === 'semi-hidden') return sender[0] + '*****' + sender[sender.length - 1];
   if (setting === 'hidden') return 'Anonymous';
   return sender;
};

function compareArray(array, value) {
   for (let i = 0; i < array.length; i++) {
      if (array[i] === value) return true;
   }
   return;
};


function isEmail(email) {
   if (!email || typeof(email) !== 'string') return undefined
   return email.match(/^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/);
};

function isPgpKeys(pgpKeys) { 
   if (!pgpKeys || typeof(pgpKeys) !== 'string') return undefined
   if (pgpKeys.length > 10000 || pgpKeys.length < 1) return undefined
   
   return true
}

function isMoneroAddress(address, addressType) {
   if (!address || typeof(address) !== 'string') throw new Error(`Invalid ${addressType} Monero Address`)
   
   address = address.trim()

   if (address.length > 106 || address.length < 95) throw new Error(`Invalid ${addressType} Monero Address`)
   
   return address
}

module.exports = {generateRandomString, RandomList_ofWords, isMoneroAddress, isPgpKeys, isEmail, compareArray, formatUsernameWithSettings, paginatedResults, sanitizeHTML}