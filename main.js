require('dotenv').config();
const express  = require('express');
const path     = require('path');
const logger   = require('morgan');
const session  = require('express-session');
const cors     = require('cors');

const DButils  = require('./routes/utils/DButils');

const app   = express();
const port  = process.env.PORT || '80';


/* ----- Basic middlewares ----- */
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

/* ----- CORS – BEFORE session! ----- */
app.use(cors({
  origin: 'https://tom-einav.cs.bgu.ac.il',   
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

/* ----- express-session ----- */
app.use(session({
  cookieName : 'session',
  secret     : process.env.COOKIE_SECRET || 'f6d8e1d4b30c4ec4ad64d1c656c6a8b8',
  duration   : 24 * 60 * 60 * 1000,          // 1 day
  activeDuration : 5 * 60 * 1000,            // 5 min
  resave: false,
  saveUninitialized: false,
  cookie : { secure: true, sameSite: 'none', httpOnly: false },
}));


/* ----- Cookie middleware ----- */
app.use(async (req, res, next) => {
  if (req.session && req.session.user_id) {
    try {
      const users = await DButils.execQuery('SELECT user_id FROM users');
      if (users.find(x => x.user_id === req.session.user_id))
        req.user_id = req.session.user_id;
    } catch (err) {
      return next(err);
    }
  }
  next();
});

/* ----- Routers ----- */
app.use('/users',   require('./routes/user'));
app.use('/recipes', require('./routes/recipes'));
app.use('/',        require('./routes/auth'));

/* ----- “I’m alive” route ----- */
app.get('/alive', (_req, res) => res.send("I'm alive"));

/* ----- Static files – AFTER routers ----- */
app.use(express.static(
  path.join(__dirname, '../assignment3_3-frontend-main/dist')
));

/* ----- Catch-all route for frontend SPA ----- */
app.get("*", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "../assignment3_3-frontend-main/dist",
      "index.html"
    )
  );
});

/* ----- Default error-handler ----- */
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).send({ message: err.message, success: false });
});

/* ----- Export for tests / start server ----- */
module.exports = app;
// app.listen(port, () => console.log(`Server listening on ${port}`));