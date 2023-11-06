require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const sessions = require("express-session");
const multer = require("multer");
const { GridFsStorage } = require("multer-gridfs-storage");

//Middlewares
app.use(express.static("public"));
app.use(cors());
app.use(express.json());
app.use(
  bodyParser.urlencoded({
    extended: false,
  })
);
app.use(bodyParser.json());
app.set("view engine", "ejs");

const oneDay = 1000 * 60 * 60 * 24;
app.use(
  sessions({
    secret: "thisismysecrctekeyfhrgfgrfrty84fwir767",
    saveUninitialized: true,
    cookie: { maxAge: oneDay },
    resave: false,
  })
);
app.use(cookieParser());

const mongouri = process.env.MONGO_URI;

try {
  mongoose.connect(mongouri);
} catch (error) {
  handleError(error);
}
process.on("unhandledRejection", (error) => {
  console.log("unhandledRejection", error.message);
});

//creating bucket
var bucket;
mongoose.connection.on("connected", () => {
  var client = mongoose.connections[0].client;
  var db = mongoose.connections[0].db;
  bucket = new mongoose.mongo.GridFSBucket(db, {
    bucketName: "newBucket",
  });
});

app.use(express.json());
app.use(
  express.urlencoded({
    extended: false,
  })
);

const storage = new GridFsStorage({
  url: mongouri,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      const filename = file.originalname;
      const fileInfo = {
        filename: filename,
        bucketName: "newBucket",
      };
      resolve(fileInfo);
    });
  },
});

const upload = multer({
  storage,
});

const itemSchema = {
  name_event: String,
  date_event: String,
};

const Item = mongoose.model("Item", itemSchema);

app.post("/upload", upload.single("file"), (req, res) => {
  const name = req.body.name;
  const date = req.body.date;

  const item1 = new Item({
    name_event: name,
    date_event: date,
  });

  item1.save();

  res.status(200).render("file_uploaded_succ");
});

app.get("/pdf/:filename", (req, res) => {
  const file = bucket
    .find({
      filename: req.params.filename,
    })
    .toArray((err, files) => {
      if (!files || files.length === 0) {
        return res.status(404).json({
          err: "no files exist",
        });
      }
      bucket.openDownloadStreamByName(req.params.filename).pipe(res);
    });
});

let session;

app.get("/pdfFiles", (req, res) => {
  try {
    bucket.find().toArray(async (err, files) => {
      let arr = [];
      arr = await Item.find({});
      session = req.session;
      if (session.userid) {
        res.render("pdf", { files: files, islogin: true, founded: arr });
      } else {
        res.render("pdf", { files: files, islogin: false, founded: arr });
      }
    });
  } catch (error) {
    console.log(error);
  }
});

app.post("/delete/:id", (req, res) => {
  const [post_id, file_id] = req.params.id.split("_");

  Item.findByIdAndDelete(file_id, (err, docs) => {
    if (err) {
      console.log(err);
      // return res.status(404).json({ err: err });
    }
  });

  bucket.delete(mongoose.Types.ObjectId(post_id), (err, files) => {
    if (!err) {
      console.log("Successfully deleted document");
      res.redirect("/pdfFiles");
    } else {
      console.log(err);
      return res.status(404).json({ err: err });
    }
  });
});

app.post("/submit_pass", (req, res) => {
  let password = req.body.pass;
  let email_id = req.body.email;

  if (email_id == process.env.MAIL_ID && password == process.env.PASS) {
    session = req.session;
    session.userid = email_id;
    res.redirect("/");
  } else {
    res.render("failure");
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

app.get("/", function (req, res) {
  session = req.session;
  let date = new Date().getFullYear();
  if (session.userid) {
    res.render("index", { islogin: false, date: date });
  } else {
    res.render("index", { islogin: true, date: date });
  }
});

app.get("/donation", function (req, res) {
  res.render("donation");
});

app.post("/", function (req, res) {
  var output = `You have a new contact request
          contact Details
          Name : ${req.body.name}
          Email : ${req.body.email}
          Phone : ${req.body.phone}
          Message
         ${req.body.message}`;

  var transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    // service: 'gmail',
    auth: {
      user: process.env.MAIL_IDE,
      pass: process.env.PASSWORD,
    },
  });

  var mailOptions = {
    from: req.body.email,
    to: "ftct.gsfc@gmail.com",
    subject: `Message from ${req.body.name}`,
    text: output,
  };

  transporter.sendMail(mailOptions, function (err, info) {
    if (err) {
      console.log(err);
    } else {
      res.render("mail_success");
    }
  });
});

app.get("/file", function (req, res) {
  session = req.session;
  if (session.userid) {
    res.render("file");
  } else {
    res.render("login");
  }
});

app.listen(process.env.PORT || 3000, function () {
  console.log("Server has started successfully");
});
