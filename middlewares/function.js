<<<<<<< HEAD
// Html Sanitizer Function
const HtmlFilter = require('html-filter');
=======
const multer = require('multer')
const path = require('path');
const HtmlFilter = require('html-filter');
const { unlink, rename} = require('fs')


function generateRandomString(length) {
  var result           = '';
  var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var charactersLength = characters.length;
  for ( var i = 0; i < length; i++ ) {
    result += characters.charAt(Math.floor(Math.random() * 
charactersLength));
 }
 return result;
}

// Html Sanitizer Function
>>>>>>> 8471efdad8180f8a1756e5931cf5f4df253304a5
function Text_To_Tags(string, symbol, start_tag, end_tag) {
    let splited_string = string.split(symbol)
    if (splited_string.length <= 1) return string // Return If Nothing To format
  
    let Formated_String = splited_string[0]
    splited_string.shift()
  
    let Start_Or_End
    for(let i = 0; i < splited_string.length; i++) {
      if (!Start_Or_End) {
        Formated_String += start_tag
        Start_Or_End = true
      } 
      else {
        Formated_String += end_tag
        Start_Or_End = undefined
      } 
      Formated_String += splited_string[i]
    }
    return Formated_String
}
exports.sanitizeHTML = (object) => {
    const filter = new HtmlFilter()
    object = filter.filter(object)

    object = object.split("\n").join("<br>");
    object = Text_To_Tags(object, '**', '<b>', '</b>')
    object = Text_To_Tags(object, '*B', '<h3>', '</h3>')
    object = Text_To_Tags(object, '*M', '<h5>', '</h5>')
    object = Text_To_Tags(object, '*S', '<h6>', '</h6>')
    object = Text_To_Tags(object, '*', ' <em>', '</em>')

    return object;
}

<<<<<<< HEAD
// Pricevy Funciton 
=======

// Pagination
exports.paginatedResults = async (model, query = {}, {page = 1, limit = 12}, fuzzyProduct) => {
  page = isNaN(parseInt(page)) || page == 0 ? 1 : parseInt(page)

  const startIndex = (page - 1) * limit
  const endIndex = page * limit
  
  const results = {}

  // Count Document
  let countedDocuments
  if (fuzzyProduct) countedDocuments = fuzzyProduct.length 
  else countedDocuments = await model.countDocuments(query).exec()

  // NextPage Creation
  results.nextPage = [page]
  if (startIndex > 0) results.nextPage.unshift(page - 1)
  if ((page - 2) * limit > 0) results.nextPage.unshift(page - 2)
  if (endIndex < countedDocuments) results.nextPage.push(page + 1)
  if ((page + 1) * limit < countedDocuments) results.nextPage.push(page + 2)
  
  if (fuzzyProduct) {
    results.results = fuzzyProduct.splice(startIndex, endIndex)
    return results
  } else { 
      try {
        results.results = await model.find(query).limit(limit).skip(startIndex).exec()
        return results
      } catch (e) {
        console.log(e)
        return
      }
  }
}

// Img Function 
// Set The Storage Engine
const storageProduct = multer.diskStorage({
  destination: './public/uploads/product-img',
  filename: function(req, file, cb){
    cb(null, generateRandomString(25) + path.extname(file.originalname));
  }
});
const storageUser = multer.diskStorage({
  destination: './public/uploads/user-img',
  filename: function(req, file, cb){
    cb(null, generateRandomString(25) + path.extname(file.originalname));
  }
});
// Check File Type
function checkFileType(file, cb){
  // Allowed ext
  const filetypes = /jpeg|jpg|png/;
  // Check ext
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  // Check mime
  const mimetype = filetypes.test(file.mimetype);

  if(mimetype && extname){
    return cb(null,true);
  } else {
    cb('Error: Images Only!');
  }
}
exports.uploadProductImg = multer({
  storage: storageProduct,
  limits:{fileSize: 5000000},
  fileFilter: function(req, file, cb){
    checkFileType(file, cb);
}
})
exports.uploadUserImg = multer({
  storage: storageUser,
  limits:{fileSize: 5000000},
  fileFilter: function(req, file, cb){
    checkFileType(file, cb);
}
})

exports.deleteOld_Img = (path) => {
    unlink(path, (err) => {
        if (err) throw err;
    });
}
exports.isolate_mimetype = (string, symbol) => {
    const mimetype = string.split(symbol)
    return `.${mimetype[mimetype.length - 1]}`
}


// Privavy Funciton 
>>>>>>> 8471efdad8180f8a1756e5931cf5f4df253304a5
exports.Format_Username_Settings = (sender, setting) => { 
    if (setting === 'semi-hidden') return sender[0] + '*****' + sender[sender.length - 1]
    if (setting === 'hidden') return 'Anonymous'
    return sender   
}

// Validation Function
exports.Is_Empty = (value) => {
    if (!value) return true
    return
}

exports.IsNot_String = (value) => {
    if (typeof(value) !== 'string') return true
    return
}

exports.Is_Shorter = (value, length) => {
    if (value.length < length) return true
    return
  }

exports.Is_Longuer = (value, length) => {
    if (value.length > length) return true
    return
  }

exports.Is_Smaller = (value, number) => {
    if (value < number) return true
    return 
   }
   
exports.Is_Bigger = (value, number) => {
     if (value > number) return true
     return 
   }

exports.compareArray = (array, value) => {
    for(let i = 0; i < array.length; i++) {
      if(array[i] === value) return true
    }
    return
  }

exports.IsNot_Number = (value) => {
    if(isNaN(parseFloat(value))) return true
    return 
  }


<<<<<<< HEAD
// Img Function 
const { unlink, rename} = require('fs')

exports.deleteOld_Img = (path) => {
    unlink(path, (err) => {
        if (err) throw err;
    });
}

exports.isolate_mimetype = (string, symbol) => {
    const mimetype = string.split(symbol)
    return `.${mimetype[mimetype.length - 1]}`
}



// Pagination
exports.paginatedResults = async (model, query = {}, {page = 1, limit = 12}, fuzzyProduct) => {
    page = isNaN(parseInt(page)) || page == 0 ? 1 : parseInt(page)

    const startIndex = (page - 1) * limit
    const endIndex = page * limit
    
    const results = {}

    // Count Document
    let countedDocuments
    if (fuzzyProduct) countedDocuments = fuzzyProduct.length 
    else countedDocuments = await model.countDocuments(query).exec()

    // NextPage Creation
    results.nextPage = [page]
    if (startIndex > 0) results.nextPage.unshift(page - 1)
    if ((page - 2) * limit > 0) results.nextPage.unshift(page - 2)
    if (endIndex < countedDocuments) results.nextPage.push(page + 1)
    if ((page + 1) * limit < countedDocuments) results.nextPage.push(page + 2)
    
    if (fuzzyProduct) {
      results.results = fuzzyProduct.splice(startIndex, endIndex)
      return results
    } else { 
        try {
          results.results = await model.find(query).limit(limit).skip(startIndex).exec()
          return results
        } catch (e) {
          console.log(e)
          return
        }
    }
}
=======

>>>>>>> 8471efdad8180f8a1756e5931cf5f4df253304a5
