require('dotenv').config()
const express = require('express')
const mongoClient = require('mongodb').MongoClient
const nodemailer = require('nodemailer')
const { OAuth2Client } = require('google-auth-library')
const bcrypt = require('bcrypt')
const saltRounds = 10

const app = express()

app.use(express.json())

const uri = "mongodb+srv://doadmin:f623g1cDYM05Wp79@db-mongodb-nyc3-29938-65da0883.mongo.ondigitalocean.com/admin?tls=true&authSource=admin&replicaSet=db-mongodb-nyc3-29938"

const client_id = process.env.CLIENT_ID
const client_secret = process.env.CLIENT_SECRET
const refresh_token = process.env.REFRESH_TOKEN

mongoClient.connect(uri, (err, db) => {

    if (err) {
        console.log("Error while connecting mongo client")
    } else {

        const myDb = db.db('myDb')
        const collection = myDb.collection('myTable')

        console.log("...............")
        console.log("connected to MongoDB")

        app.post('/signup', (req, res) => {

            const newUser = {
                name: req.body.name,
                email: req.body.email,
                password: req.body.password
            }

            const emailQuery = { email: newUser.email }
            const nameQuery = { name: newUser.name }

            collection.findOne(emailQuery, (err, result) => {

                if (result == null) {

                    collection.findOne(nameQuery, (err, result) => {

                        if (result == null) {
                            bcrypt.hash(newUser.password, saltRounds, function(err, hash) {
                                newUser.password = hash;
                                collection.insertOne(newUser, (err, result) => {
                                    res.status(200).send()
                                })
                            })

                        } else {
                            res.status(409).send()
                        }

                    })

                } else {
                    res.status(400).send()
                }

            })

        })

        app.post('/login', (req, res) => {

            const email = req.body.email
            const password = req.body.password

            collection.findOne({ email: email }, (err, result) => {

                if (result != null) {

                    bcrypt.compare(password, result.password, (err, isMatch) => {

                        if (isMatch) {
                            const objToSend = {
                                name: result.name,
                                email: result.email
                            }
                            res.status(200).send(JSON.stringify(objToSend))
                        } else {
                            res.status(401).send()
                        }

                    })

                } else {
                    res.status(404).send()
                }

            })

        })

        const GOOGLE_MAILER_CLIENT_ID = client_id
        const GOOGLE_MAILER_CLIENT_SECRET = client_secret
        const GOOGLE_MAILER_REFRESH_TOKEN = refresh_token
        const ADMIN_EMAIL_ADDRESS = 'farmstayacn@gmail.com'
            // Khởi tạo OAuth2Client với Client ID và Client Secret 
        const myOAuth2Client = new OAuth2Client(
                GOOGLE_MAILER_CLIENT_ID,
                GOOGLE_MAILER_CLIENT_SECRET
            )
            // Set Refresh Token vào OAuth2Client Credentials
        myOAuth2Client.setCredentials({
            refresh_token: GOOGLE_MAILER_REFRESH_TOKEN
        })

        app.post('/forgotpassword', (req, res) => {
            const email = req.body.email;

            collection.findOne({ email: email }, async(err, user) => {
                if (err) {
                    return res.status(500).send({ message: "Error finding user" });
                }
                if (!user) {
                    return res.status(400).send({ message: "Email not found" });
                }
                // Tiếp tục xử lý khi email tồn tại tại đây.

                const myAccessTokenObject = await myOAuth2Client.getAccessToken()
                    // Access Token sẽ nằm trong property 'token' trong Object mà chúng ta vừa get được ở trên
                const myAccessToken = myAccessTokenObject.token

                const transport = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        type: 'OAuth2',
                        user: ADMIN_EMAIL_ADDRESS,
                        clientId: GOOGLE_MAILER_CLIENT_ID,
                        clientSecret: GOOGLE_MAILER_CLIENT_SECRET,
                        refresh_token: GOOGLE_MAILER_REFRESH_TOKEN,
                        accessToken: myAccessToken
                    }
                })

                const resetPasswordCode = Math.floor(Math.random() * (999999 - 100000 + 1) + 100000)

                const mailOptions = {
                    to: email,
                    subject: '[Farmstay ACN] Reset password code Farmstay app',
                    text: `Your reset password code is: ${resetPasswordCode}`
                }

                transport.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        return res.status(504).send({ message: "Error sending email" })
                    }
                    return res.status(200).send({ message: "Email sent successfully" })
                })

            })
        })

        const dbSensor = db.db('Datasensor');

        app.get('/sensorhumi', (req, res) => {

            const collection = dbSensor.collection('sensor/humi')

            collection.findOne({}, (err, result) => {
                if (err) throw err
                res.send({ value: result.value })
                db.close()
            })
        })

    }

})

app.listen(3000, () => {
    console.log("Listening on port 3000...")
})