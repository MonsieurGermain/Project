const randomWords = require('random-words');
const HtmlFilter = require('html-filter');

function randomListOfWords(number) {
  const randomSentence = randomWords(number);
  let mergedWord = randomSentence[0];
  for (let i = 1; i < randomSentence.length; i++) {
    mergedWord += ` ${randomSentence[i]}`;
  }
  return mergedWord;
}

function getAllowedCharacters(allowedCharacters) {
  if (allowedCharacters === 'letterAndnumber') return 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  if (allowedCharacters === 'number') return '0123456789';
  if (allowedCharacters === 'letter') return 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  return 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%&';
}

function generateRandomString(length, allowedCharacters) {
  allowedCharacters = getAllowedCharacters(allowedCharacters);

  let result = '';
  const charactersLength = allowedCharacters.length;

  for (let i = 0; i < length; i++) {
    result += allowedCharacters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

// Html Sanitizer Function
function stringToTags(string, symbol, startTag, endTag) {
  const splitedString = string.split(symbol);

  if (splitedString.length <= 1) return string; // Return If Nothing To format

  let formatedString = splitedString[0];

  splitedString.shift();

  let startOrEnd;
  for (let i = 0; i < splitedString.length; i++) {
    if (!startOrEnd) {
      formatedString += startTag;
      startOrEnd = true;
    } else {
      formatedString += endTag;
      startOrEnd = undefined;
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
}

// Better Name ?
function getDaysHoursEtc(number, Timer, timeLeft, timeAmount) {
  let value = Timer / number;
  value = value.toString();
  value = value.slice(0, value.indexOf('.') + 0);
  Timer += -(value * number);
  timeLeft += ` ${value}${timeAmount}`;

  return [Timer, timeLeft];
}

function formatTimer(timer) {
  let timeLeft = '';
  let Timer = timer - Date.now();

  [Timer, timeLeft] = getDaysHoursEtc(86400000, Timer, timeLeft, 'Days');
  [Timer, timeLeft] = getDaysHoursEtc(3600000, Timer, timeLeft, 'Hours');
  [Timer, timeLeft] = getDaysHoursEtc(60000, Timer, timeLeft, 'Mins');
  [Timer, timeLeft] = getDaysHoursEtc(1000, Timer, timeLeft, 'Secs');

  return timeLeft;
}

// Pagination
async function paginatedResults(model, query = {}, { page = 1, limit = 12, populate = false }, paginateArray) {
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
  }
  try {
    if (populate) {
      results.results = await model.find(query).limit(limit).skip(startIndex).populate(populate)
        .exec();
    } else results.results = await model.find(query).limit(limit).skip(startIndex).exec();

    return results;
  } catch (e) {
    console.log(e);
    throw new Error(e.message);
  }
}

function formatUsernameWithSettings(sender, setting) {
  if (setting === 'semi-hidden') return `${sender[0]}*****${sender[sender.length - 1]}`;
  if (setting === 'hidden') return 'Anonymous';
  return sender;
}

function isEmail(email) {
  if (!email || typeof (email) !== 'string') return undefined;
  return email.match(/^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/);
}

function isPgpKeys(pgpKeys) {
  if (!pgpKeys || typeof (pgpKeys) !== 'string') return undefined;
  pgpKeys = pgpKeys.trim();
  if (pgpKeys.length > 10000 || pgpKeys.length < 1) return undefined;

  return pgpKeys;
}

function isMoneroAddress(address, addressType) {
  if (!address || typeof (address) !== 'string') throw new Error(`Invalid ${addressType} Monero Address`);

  address = address.trim();

  if (address.length > 106 || address.length < 95) throw new Error(`Invalid ${addressType} Monero Address`);

  return address;
}

function timerEndOfSales(salesTimer) {
  if (!salesTimer || salesTimer > Date.now() + 604800000) return undefined;

  let timeLeft = salesTimer - Date.now();

  let daysLeft = Math.floor(timeLeft / 86400000); // day

  timeLeft -= daysLeft * 86400000;

  let hoursLeft = Math.floor(timeLeft / 3600000); // hour

  if (daysLeft < 1) daysLeft = '';
  else daysLeft = `${daysLeft}days`;

  if (!daysLeft && !hoursLeft) hoursLeft = 'less then 1hours';
  else if (daysLeft && !hoursLeft) hoursLeft = '';
  else hoursLeft = ` ${hoursLeft}hours`;

  return `${daysLeft}${hoursLeft}`;
}

module.exports = {
  formatTimer,
  timerEndOfSales,
  generateRandomString,
  randomListOfWords,
  isMoneroAddress,
  isPgpKeys,
  isEmail,
  formatUsernameWithSettings,
  paginatedResults,
  sanitizeHTML,
};
