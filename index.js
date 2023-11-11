require("dotenv").config();
const express = require("express");
const app = express();
const path = require("path");
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const multer = require("multer");

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
app.set("views", path.join(__dirname, "./public/views"));
app.use(cookieParser());

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URL);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};

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

const Item = mongoose.model("Item", itemSchema);
app.post("/upload", upload.single("file"), (req, res) => {
  const item1 = new Item({
    name_event: req.body.name,
    date_event: req.body.date,
    pdf_name: req.file.filename,
    pdf_path: req.file.path,
  });

  item1.save();

  res.render("file_uploaded_succ");
});

app.get("/announcement", (req, res) => {
  Item.find({}).then((docs) => {
    if (req.cookies.email) {
      res.render("pdf", { files: docs, islogin: true });
    } else {
      res.render("pdf", { files: docs, islogin: false });
    }
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
    email_id === process.env.TEMPLE_MAIL_ID &&
    password === process.env.TEMPLE_MAIL_PASS
  ) {
    try {
      const options = {
        expires: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        httpOnly: true,
      };
      res.cookie("email", email_id, options);
      res.redirect("/");
    } catch (error) {
      console.log(error);
    }
  }
});

app.get("/logout", (req, res) => {
  res.clearCookie("email");
  res.redirect("/");
});

app.get("/", function (req, res) {
  let date = new Date().getFullYear();
  if (req.cookies.email) {
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
  if (req.cookies.email) {
    res.render("file");
  } else {
    res.render("login");
  }
});

connectDB().then(() => {
  app.listen(process.env.PORT || 3000, () => {
    console.log("listening for requests on");
  });
});
