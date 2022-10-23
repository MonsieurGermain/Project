const LocalStrategy = require('passport-local').Strategy;
const UserModel = require('../models/user');

module.exports = function (passport) {
  passport.use(
    new LocalStrategy({ passReqToCallback: true }, async (req, username, password, done) => {
      if (!req.user_toAuth) return done(null, false, { message: 'No User to Authenticate' });

      if (typeof (req.user_toAuth) === 'string') {
        req.user_toAuth = await UserModel.findOne({ username: req.user_toAuth });
        if (!req.user_toAuth) return done(null, false, { message: 'Invalid Username' });
      }

      return done(null, req.user_toAuth);
    }),
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser((id, done) => {
    UserModel.findById(id, (err, user) => {
      done(err, user);
    });
  });
};
