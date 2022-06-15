const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');

// Load User model
const User = require('../models/user');

module.exports = function(passport) {
  passport.use(
    new LocalStrategy((username, password, done) => {
      // Match user
<<<<<<< HEAD
      User.findOne({
        username: username
      }).then(user => {
        if (!user) {
          return done(null, false, { message: 'Username or Password Invalid' });
        }
=======
      User.findOne({ username: username }).then( user => {
        if (!user) return done(null, false, { message: 'Username or Password Invalid' });
>>>>>>> 8471efdad8180f8a1756e5931cf5f4df253304a5

        // Match password
        bcrypt.compare(password, user.password, (err, isMatch) => {
          if (err) throw err;
<<<<<<< HEAD
          if (isMatch) {
            return done(null, user);
          } else {
            return done(null, false, { message: 'Username or Password Invalid' });
          }
=======
          if (isMatch) return done(null, user);
          else return done(null, false, { message: 'Username or Password Invalid' });
>>>>>>> 8471efdad8180f8a1756e5931cf5f4df253304a5
        });
      });
    })
  );

  passport.serializeUser(function(user, done) {
    done(null, user.id);
  });

  passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
      done(err, user);
    });
  });
};