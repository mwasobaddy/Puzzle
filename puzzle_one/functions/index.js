const functions = require("firebase-functions");
const fetch = require("node-fetch");
const cors = require("cors");

const corsHandler = cors({ origin: true });

exports.createCheckoutSessionProxy = functions.https.onRequest((req, res) => {
  return corsHandler(req, res, async () => {
    try {
      const stripeFunctionUrl =
        "https://us-central1-nash-ac5c0.cloudfunctions.net/ext-firestore-stripe-payments-createCheckoutSession";

      const response = await fetch(stripeFunctionUrl, {
        method: req.method,
        headers: {
          "Content-Type": "application/json",
          Authorization: req.headers.authorization || "",
        },
        body: JSON.stringify(req.body),
      });

      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
      console.error("Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
});
