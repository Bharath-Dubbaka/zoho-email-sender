const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;

// Email configuration
const ZOHO_ACCOUNTS = [
   {
      email: "team@dummy.com", // Replace with env variable
      password: "dummy", // Replace with env variable
      displayName: "Team",
   },
   {
      email: "support@dummy.com", // Replace with env variable
      password: "dummy", // Replace with env variable
      displayName: "Support",
   },
];

// SMTP settings for Zoho
const SMTP_SERVER = process.env.SMTP_SERVER || "smtp.zoho.in";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "465");
const USE_SSL = process.env.USE_SSL !== "false";

// Path to store logs and track emails sent
const LOG_FILE = path.join(__dirname, "email_log.txt");
const RECIPIENTS_FILE = path.join(__dirname, "recipients.csv");

// Create transporters for each account
const createTransporter = (account) => {
   return nodemailer.createTransport({
      host: SMTP_SERVER,
      port: SMTP_PORT,
      secure: USE_SSL,
      auth: {
         user: account.email,
         pass: account.password,
      },
   });
};

// Create a sample recipients file if it doesn't exist
const createSampleRecipients = () => {
   if (!fs.existsSync(RECIPIENTS_FILE)) {
      const csvWriter = createCsvWriter({
         path: RECIPIENTS_FILE,
         header: [
            { id: "name", title: "name" },
            { id: "email", title: "email" },
            { id: "subject", title: "subject" },
            { id: "body", title: "body" },
         ],
      });

      // Add some sample data - REPLACE WITH YOUR ACTUAL RECIPIENTS
      const records = [
         {
            name: "Sample User",
            email: "user@example.com",
            subject: "Sample Subject",
            body: "This is a sample email body.",
         },
         {
            name: "Another User",
            email: "another@example.com",
            subject: "Another Subject",
            body: "This is another sample email body.",
         },
      ];

      csvWriter
         .writeRecords(records)
         .then(() =>
            console.log(
               `Created sample ${RECIPIENTS_FILE}. Please edit with your actual recipients.`
            )
         );
   }
};

// Load recipients from CSV file
const loadRecipients = () => {
   return new Promise((resolve, reject) => {
      const recipients = [];

      if (!fs.existsSync(RECIPIENTS_FILE)) {
         createSampleRecipients();
         resolve(recipients);
         return;
      }

      fs.createReadStream(RECIPIENTS_FILE)
         .pipe(csv())
         .on("data", (data) => recipients.push(data))
         .on("end", () => {
            console.log(`Loaded ${recipients.length} recipients`);
            resolve(recipients);
         })
         .on("error", (error) => {
            console.error(`Error reading recipients file: ${error.message}`);
            reject(error);
         });
   });
};

// Load record of already sent emails
const loadSentEmails = () => {
   const sentEmails = new Set();

   if (fs.existsSync(LOG_FILE)) {
      const logContents = fs.readFileSync(LOG_FILE, "utf8");
      const lines = logContents.split("\n");

      for (const line of lines) {
         if (line.includes(",")) {
            const parts = line.trim().split(",");
            if (parts.length >= 2) {
               sentEmails.add(parts[1]); // Add email address to sent list
            }
         }
      }
   }

   return sentEmails;
};

// Log sent email with timestamp
const logEmail = (account, recipientEmail) => {
   const timestamp = new Date()
      .toISOString()
      .replace("T", " ")
      .substring(0, 19);
   fs.appendFileSync(
      LOG_FILE,
      `${timestamp},${recipientEmail},${account.email}\n`
   );
};

// Send email using Zoho SMTP
const sendEmail = async (account, recipient) => {
   const transporter = createTransporter(account);

   // Format email with HTML wrapper if needed
   let emailBody = recipient.body;
   if (!emailBody.trim().startsWith("<")) {
      // If the body doesn't start with HTML tag, wrap it in basic HTML
      emailBody = `
    <html>
    <body>
    <p>Hello ${recipient.name},</p>
    <p>${emailBody}</p>
    <p>Best regards,<br>${account.displayName}</p>
    </body>
    </html>
    `;
   }

   const mailOptions = {
      from: `"${account.displayName}" <${account.email}>`,
      to: recipient.email,
      subject: recipient.subject,
      html: emailBody,
   };

   try {
      await transporter.sendMail(mailOptions);
      logEmail(account, recipient.email);
      console.log(
         `Email sent successfully to ${recipient.email} from ${account.email}`
      );
      return true;
   } catch (error) {
      console.error(
         `Failed to send email to ${recipient.email} from ${account.email}: ${error.message}`
      );
      return false;
   }
};

// Random delay function
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Main function
const main = async () => {
   console.log("Starting email sender...");

   // Load recipients and track sent emails
   const recipients = await loadRecipients();
   const sentEmails = loadSentEmails();

   if (recipients.length === 0) {
      console.log(
         "No recipients found in CSV file. Please add recipients to recipients.csv"
      );
      return;
   }

   // Set up email counts for each account
   const dailyLimit = {};
   const sentCount = {};

   ZOHO_ACCOUNTS.forEach((account) => {
      dailyLimit[account.email] = 50; // 50 emails per account
      sentCount[account.email] = 0;
   });

   // Send emails
   for (const recipient of recipients) {
      // Skip if we've already sent to this recipient
      if (sentEmails.has(recipient.email)) {
         continue;
      }

      // Choose an account that hasn't reached its limit
      const availableAccounts = ZOHO_ACCOUNTS.filter(
         (acc) => sentCount[acc.email] < dailyLimit[acc.email]
      );

      if (availableAccounts.length === 0) {
         console.log("All accounts have reached their daily sending limits");
         break;
      }

      // Pick an account, alternating between them to distribute emails
      let account = availableAccounts[0];
      if (availableAccounts.length > 1) {
         // If both accounts available, pick the one with fewer sent emails
         account = availableAccounts.reduce(
            (min, acc) =>
               sentCount[acc.email] < sentCount[min.email] ? acc : min,
            availableAccounts[0]
         );
      }

      // Send the email
      const success = await sendEmail(account, recipient);

      if (success) {
         sentCount[account.email]++;
         console.log(
            `Progress: ${account.email} has sent ${sentCount[account.email]}/${
               dailyLimit[account.email]
            } emails`
         );

         // Add small delay between emails (5-15 seconds) to avoid triggering spam filters
         const delayTime = Math.floor(Math.random() * (15 - 5 + 1) + 5) * 1000;
         console.log(
            `Waiting ${delayTime / 1000} seconds before next email...`
         );
         await delay(delayTime);
      }

      // Break if all accounts have reached their limits
      const allLimitsReached = ZOHO_ACCOUNTS.every(
         (acc) => sentCount[acc.email] >= dailyLimit[acc.email]
      );
      if (allLimitsReached) {
         console.log("All accounts have reached their daily sending limits");
         break;
      }
   }

   console.log("\nEmail sending complete!");
   console.log("Summary:");
   ZOHO_ACCOUNTS.forEach((account) => {
      console.log(
         `- ${account.email}: Sent ${sentCount[account.email]}/${
            dailyLimit[account.email]
         } emails`
      );
   });
};

// Run the program
main().catch(console.error);
