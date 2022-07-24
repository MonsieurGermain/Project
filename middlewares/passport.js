const LocalStrategy = require('passport-local').Strategy;
const User = require('../models/user');


module.exports = function(passport) {
  passport.use(
    new LocalStrategy({passReqToCallback: true}, async (req, username, password, done) => {
      if (!req.user_toAuth) return done(null, false, { message: 'No User to Authenticate' }); 
      
      if (typeof(req.user_toAuth) === 'string') {
        req.user_toAuth = await User.findOne({username: req.user_toAuth})
        if (!req.user_toAuth) return done(null, false, { message: 'Invalid Username' });  
      } 

      return done(null, req.user_toAuth);
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