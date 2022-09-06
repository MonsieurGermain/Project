const multer = require('multer');
const path = require('path');
const HtmlFilter = require('html-filter');
const {unlink, rename} = require('fs');

function generateRandomString(length) {
   var result = '';
   var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
   var charactersLength = characters.length;
   for (var i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
   }
   return result;
}

// Html Sanitizer Function
function Text_To_Tags(string, symbol, startTag, endTag) {
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
exports.sanitizeHTML = (string) => {
   const filter = new HtmlFilter();
   string = filter.filter(string);

   string = string.split('\n').join('<br>');
   string = Text_To_Tags(string, '**', '<b>', '</b>');
   string = Text_To_Tags(string, '*B', '<h3>', '</h3>');
   string = Text_To_Tags(string, '*M', '<h5>', '</h5>');
   string = Text_To_Tags(string, '*S', '<h6>', '</h6>');
   string = Text_To_Tags(string, '*', ' <em>', '</em>');

   return string;
};

// Pagination
exports.paginatedResults = async (model, query = {}, {page = 1, limit = 12}, paginateArray) => {
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

// Check File Type
function checkFileType(file, cb) {
   // Allowed ext
   const filetypes = /jpeg|jpg|png/;
   // Check ext
   const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
   // Check mime
   const mimetype = filetypes.test(file.mimetype);

   if (mimetype && extname) {
      return cb(null, true);
   } else {
      cb('Error: Images Only!');
   }
}

exports.uploadProductImg = multer({
   storage: multer.diskStorage({
      destination: './public/uploads/product-img',
      filename: function (req, file, cb) {
         cb(null, generateRandomString(25) + path.extname(file.originalname));
      },
   }),
   limits: {fileSize: 5000000},
   fileFilter: function (req, file, cb) {
      checkFileType(file, cb);
   },
});

exports.uploadUserImg = multer({
   storage: multer.diskStorage({
      destination: './public/uploads/user-img',
      filename: function (req, file, cb) {
         cb(null, generateRandomString(25) + path.extname(file.originalname));
      },
   }),
   limits: {fileSize: 5000000},
   fileFilter: function (req, file, cb) {
      checkFileType(file, cb);
   },
});

exports.RandomNumber = function (length) {
   var result = '';
   var characters = '0123456789';
   var charactersLength = characters.length;
   for (var i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
   }
   return result;
};

exports.deleteImage = (path) => {
   unlink(path, (err) => {
      if (err) console.log('Img needing deletion doesnt exist');
   });
};

exports.renameImage = (oldName, newName) => {
   rename(oldName, newName, (err) => {
      if (err) throw err;
   });
};

exports.isolate_mimetype = (string, symbol) => {
   const mimetype = string.split(symbol);
   return `.${mimetype[mimetype.length - 1]}`;
};

exports.formatUsernameWithSettings = (sender, setting) => {
   if (setting === 'semi-hidden') return sender[0] + '*****' + sender[sender.length - 1];
   if (setting === 'hidden') return 'Anonymous';
   return sender;
};

exports.IsNot_String = (value) => {
   if (typeof value !== 'string') return true;
   return;
};

exports.Is_Shorter = (value, length) => {
   if (value.length < length) return true;
   return;
};

exports.Is_Longuer = (value, length) => {
   if (value.length > length) return true;
   return;
};

exports.Is_Smaller = (value, number) => {
   if (value < number) return true;
   return;
};

exports.Is_Bigger = (value, number) => {
   if (value > number) return true;
   return;
};

exports.compareArray = (array, value) => {
   for (let i = 0; i < array.length; i++) {
      if (array[i] === value) return true;
   }
   return;
};

exports.IsNot_Number = (value) => {
   if (isNaN(parseFloat(value))) return true;
   return;
};

exports.isEmail = (email) => {
   return email.match(/^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/);
};

var randomWords = require('random-words');
exports.RandomList_ofWords = function (number) {
   let randomSentence = randomWords(number);
   let merged_word = randomSentence[0];
   for (let i = 1; i < randomSentence.length; i++) {
      merged_word += ' ' + randomSentence[i];
   }
   return merged_word;
};

exports.validatePgpKeys = function (pgpKeys) {
   return true;
};
