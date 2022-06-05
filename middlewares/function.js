// Html Sanitizer Function
const HtmlFilter = require('html-filter');
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

// Pricevy Funciton 
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


// Img Function 
const { unlink, rename} = require('fs')

exports.deleteOld_Img = (path) => {
    unlink(path, (err) => {
        if (err) throw err;
    });
}

exports.isolate_mimetype = (string) => {
    const mimetype = string.split('.')
    return `.${mimetype[mimetype.length - 1]}`
}

