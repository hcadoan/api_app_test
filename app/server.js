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
                password: req.body.password,
                verify_code: "",
                phone: "",
                address: "",
                sex: ""
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
            // Kh???i t???o OAuth2Client v???i Client ID v?? Client Secret 
        const myOAuth2Client = new OAuth2Client(
                GOOGLE_MAILER_CLIENT_ID,
                GOOGLE_MAILER_CLIENT_SECRET
            )
            // Set Refresh Token v??o OAuth2Client Credentials
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
                // Ti???p t???c x??? l?? khi email t???n t???i t???i ????y.

                const myAccessTokenObject = await myOAuth2Client.getAccessToken()
                    // Access Token s??? n???m trong property 'token' trong Object m?? ch??ng ta v???a get ???????c ??? tr??n
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
                    collection.updateOne({ email: email }, { $set: { verify_code: resetPasswordCode.toString() } }, (err, result) => {
                        if (err) {
                            return res.status(500).send({ message: "Error updating the reset password code in the database" })
                        }
                        return res.status(200).send({ message: "Email sent successfully" })
                    })
                })

            })
        })

        app.post('/verifyresetpassword', (req, res) => {

            const email = req.body.email
            const resetPasswordCode = req.body.resetPasswordCode

            collection.findOne({ email: email }, (err, user) => {
                if (err) {
                    return res.send({ message: "Error finding user" })
                }
                if (!user) {
                    return res.send({ message: "Email not found" })
                }
                //email ton tai tiep tuc xu ly
                if (user.verify_code === resetPasswordCode) {

                    return res.status(400).send({ message: "correct reset password code" })

                } else {
                    return res.status(404).send({ message: "Incorrect reset password code" })
                }
            })
        })

        app.post('/resetpassword', (req, res) => {

            const email = req.body.email
            const newPassword = req.body.newPassword

            collection.findOne({ email: email }, (err, user) => {
                if (err) {
                    return res.send({ message: "Error finding user" })
                }
                if (!user) {
                    return res.send({ message: "Email not found" })
                }
                bcrypt.hash(newPassword, saltRounds, function(err, hash) {
                    user.password = hash;
                    collection.updateOne({ email: email }, { $set: { password: hash } }, (err, result) => {
                        if (err) {
                            return res.status(500).send({ message: "Error resetting password" })
                        }
                        return res.status(200).send({ message: "Password reset successfully" })
                    })
                })
            })
        })

    }

})

app.listen(3000, () => {
    console.log("Listening on port 3000...")
})