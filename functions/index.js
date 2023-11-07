require("dotenv").config();
const express = require("express");
const app = express();
const path = require("path");
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const sessions = require("express-session");
const multer = require("multer");
const serverless = require("serverless-http");

const router = express.Router();

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
app.set("views", path.join(__dirname, "../public/views"));

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

const mongouri = process.env.MONGO_URL;

try {
  mongoose.connect(mongouri).then(() => {
    console.log("Connected to MongoDB");
  });
} catch (error) {
  handleError(error);
}
process.on("unhandledRejection", (error) => {
  console.log("unhandledRejection", error.message);
});

app.use(express.json());
app.use(
  express.urlencoded({
    extended: false,
  })
);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./public/uploads/announcments");
  },
  filename: (req, file, cb) => {
    const name = file.originalname.replace(/\s/g, "_");
    cb(null, Date.now() + "-" + name);
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

app.post("/upload", upload.single("file"), (req, res) => {
  const Item = mongoose.model("Item", itemSchema);
  const item1 = new Item({
    name_event: req.body.name,
    date_event: req.body.date,
    pdf_name: req.file.filename,
    pdf_path: req.file.path,
  });

  item1.save();

  res.render("file_uploaded_succ");
});

let session;

app.get("/announcement", (req, res) => {
  const Item = mongoose.model("Item", itemSchema);
  Item.find({})
    .then((docs) => {
      session = req.session;
      if (session.userid) {
        res.render("pdf", { files: docs, islogin: true });
      } else {
        res.render("pdf", { files: docs, islogin: false });
      }
    })
    .catch((err) => {
      console.log(err);
    });
});

app.post("/delete/:id", (req, res) => {
  const [file_id] = req.params.id.split("_");

  Item.findByIdAndDelete(file_id, (err, docs) => {
    if (err) {
      console.log(err);
    } else {
      console.log("Successfully deleted document");
      res.redirect("/announcement");
    }
  });
});

app.post("/login", (req, res) => {
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

app.get("/booking", function (req, res) {
  res.render("booking");
});
app.post("/booking", function (req, res) {
  const poojaBookingSchema = {
    name: String,
    email: String,
    phoneNumber: String,
    date: String,
    time: String,
    pooja: String,
    poojaDescription: String,
  };

  const PoojaItem = mongoose.model("PoojaItem", poojaBookingSchema);

  const poojaItem = new PoojaItem({
    name: req.body.name,
    email: req.body.email,
    phoneNumber: req.body.phoneNumber,
    date: req.body.date,
    time: req.body.time,
    pooja: req.body.pooja,
    poojaDescription: req.body.description,
  });
  poojaItem.save();

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
              <h2>You have a new request for pooja</h2>
              <p><strong>Name:</strong> ${req.body.name}</p>
              <p><strong>Email:</strong> ${req.body.email}</p>
              <p><strong>Phone Number:</strong> ${req.body.phoneNumber}</p>
              <p><strong>Date:</strong> ${req.body.date}</p>
              <p><strong>Time:</strong> ${req.body.time}</p>
              <p><strong>Pooja:</strong> ${req.body.pooja}</p>
              <p><strong>Pooja Description:</strong> ${req.body.description}</p>
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
    subject: `Message from ${req.body.name} regarding Pooja Booking`,
    html: `${output}`,
  };

  transporter.sendMail(mailOptions, function (err, info) {
    if (err) {
      console.log(err);
    } else {
      console.log("Pooja Booking Email sent successfully");
      res.render("booking_succ");
    }
  });
});

app.post("/", function (req, res) {
  const contactSchema = {
    name: String,
    email: String,
    phone: String,
    message: String,
  };

  const Contact = mongoose.model("Contact", contactSchema);

  const contact = new Contact({
    name: req.body.name,
    email: req.body.email,
    phone: req.body.phone,
    message: req.body.message,
  });

  contact.save();

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

app.use("/.netlify/functions/index", router);
module.exports.handler = serverless(app);
