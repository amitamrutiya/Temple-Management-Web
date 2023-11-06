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

const storage2 = new GridFsStorage({
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

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./public/uploads/announcments");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype == "application/pdf") {
      cb(null, true);
    } else {
      cb(null, false);
      return cb(new Error("Only .pdf format allowed!"));
    }
  },
  limits: {
    fileSize: 1024 * 1024 * 10,
  },
});
const itemSchema = {
  name_event: String,
  date_event: String,
  pdf_name: String,
  pdf_path: String,
};

const Item = mongoose.model("Item", itemSchema);

app.post("/upload", upload.single("file"), (req, res) => {
  const name = req.body.name;
  const date = req.body.date;
  const pdfName = req.file.filename;
  const pdfPath = req.file.path;

  const item1 = new Item({
    name_event: name,
    date_event: date,
    pdf_name: pdfName,
    pdf_path: pdfPath,
  });

  item1.save();

  res.render("file_uploaded_succ");
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

app.get("/announcement", (req, res) => {
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
      res.redirect("/announcement");
    } else {
      console.log(err);
      return res.status(404).json({ err: err });
    }
  });
});

app.post("/submit_pass", (req, res) => {
  let password = req.body.pass;
  let email_id = req.body.email;

  if (
    email_id == process.env.TEMPLE_MAIL_ID &&
    password == process.env.TEMPLE_MAIL_PASS
  ) {
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
  let output = `
        <html>
          <head>
            <style>
              body {
                font-family: Arial, sans-serif;
              }
              .container {
                width: 80%;
                margin: auto;
                background-color: #f7f7f7;
                padding: 20px;
                border-radius: 5px;
              }
              .message {
                margin-top: 20px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h2>You have a new contact request</h2>
              <p><strong>Name:</strong> ${req.body.name}</p>
              <p><strong>Email:</strong> ${req.body.email}</p>
              <p><strong>Phone:</strong> ${req.body.phone}</p>
              <div class="message">
                <h3>Message</h3>
                <p>${req.body.message}</p>
              </div>
            </div>
          </body>
        </html>
        `;

  var transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: 465,
    secure: true,

    auth: {
      user: process.env.NODEMAIL_USER,
      pass: process.env.NODEMAIL_PASS,
    },
  });

  var mailOptions = {
    from: req.body.email,
    to: process.env.TEMPLE_MAIL_ID,
    subject: `Message from ${req.body.name} regarding temple query`,
    html: `${output}`,
  };

  transporter.sendMail(mailOptions, function (err, info) {
    if (err) {
      console.log(err);
    } else {
      console.log("Email sent successfully");
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
