const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
require("dotenv").config(); // Add this to use .env file

// Email configuration - load from environment variables
const ZOHO_ACCOUNTS = [
   {
      email: process.env.ZOHO_EMAIL_1,
      password: process.env.ZOHO_PASSWORD_1,
      displayName: process.env.DISPLAY_NAME_1 || "Team",
   },
   {
      email: process.env.ZOHO_EMAIL_2,
      password: process.env.ZOHO_PASSWORD_2,
      displayName: process.env.DISPLAY_NAME_2 || "Support",
   },
];

// SMTP settings for Zoho
const SMTP_SERVER = process.env.SMTP_SERVER || "smtp.zoho.in";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "465");
const USE_SSL = process.env.USE_SSL !== "false";

// Path to store logs and track emails sent
const LOG_FILE = path.join(__dirname, "email_log.txt");
const RECIPIENTS_FILE = path.join(__dirname, "recipients.csv");
const UNSUBSCRIBE_FILE = path.join(__dirname, "unsubscribes.txt");

// Validate configuration before starting
const validateConfig = () => {
   let isValid = true;

   // Check if email accounts are properly configured
   ZOHO_ACCOUNTS.forEach((account, index) => {
      if (!account.email || !account.password) {
         console.error(
            `⚠️ Account #${
               index + 1
            } missing email or password. Check your .env file.`
         );
         isValid = false;
      }
   });

   return isValid;
};

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

// Process unsubscribe requests
const processUnsubscribes = () => {
   const unsubscribedEmails = new Set();

   if (fs.existsSync(UNSUBSCRIBE_FILE)) {
      const unsubscribes = fs.readFileSync(UNSUBSCRIBE_FILE, "utf8");
      unsubscribes.split("\n").forEach((email) => {
         const trimmedEmail = email.trim();
         if (trimmedEmail) {
            unsubscribedEmails.add(trimmedEmail.toLowerCase());
         }
      });
      console.log(`Loaded ${unsubscribedEmails.size} unsubscribed emails`);
   } else {
      // Create the unsubscribe file if it doesn't exist
      fs.writeFileSync(UNSUBSCRIBE_FILE, "");
      console.log(`Created empty unsubscribe file at ${UNSUBSCRIBE_FILE}`);
   }

   return unsubscribedEmails;
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
      console.log(`Loaded ${sentEmails.size} previously sent emails`);
   } else {
      console.log("No previous email log found. Creating a new one.");
      fs.writeFileSync(LOG_FILE, "");
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

// Add unsubscribe link to email content
const addUnsubscribeLink = (emailBody, account, recipient) => {
   const unsubscribeText = `
  <p style="font-size: 12px; color: #666; margin-top: 20px; border-top: 1px solid #eee; padding-top: 10px;">
    To unsubscribe from these emails, please <a href="mailto:${
       account.email
    }?subject=Unsubscribe%20${encodeURIComponent(
      recipient.email
   )}">click here</a> 
    or reply with "Unsubscribe" in the subject line.
  </p>`;

   if (!emailBody.trim().startsWith("<")) {
      // Plain text - wrap in HTML
      return `
    <html>
    <body>
    <p>Hello ${recipient.name},</p>
    <p>${emailBody}</p>
    <p>Best regards,<br>${account.displayName}</p>
    ${unsubscribeText}
    </body>
    </html>
    `;
   } else if (emailBody.includes("</body>")) {
      // HTML with body tag - insert before closing body
      return emailBody.replace("</body>", `${unsubscribeText}</body>`);
   } else {
      // HTML without body tag - append
      return `${emailBody}${unsubscribeText}`;
   }
};

// Send email using Zoho SMTP
const sendEmail = async (account, recipient) => {
   const transporter = createTransporter(account);

   // Add unsubscribe link to email body
   const emailBody = addUnsubscribeLink(recipient.body, account, recipient);

   const mailOptions = {
      from: `"${account.displayName}" <${account.email}>`,
      to: recipient.email,
      subject: recipient.subject,
      html: emailBody,
      headers: {
         "List-Unsubscribe": `<mailto:${account.email}?subject=Unsubscribe ${recipient.email}>`,
      },
   };

   try {
      await transporter.sendMail(mailOptions);
      logEmail(account, recipient.email);
      console.log(
         `✅ Email sent successfully to ${recipient.email} from ${account.email}`
      );
      return true;
   } catch (error) {
      console.error(
         `❌ Failed to send email to ${recipient.email} from ${account.email}: ${error.message}`
      );
      return false;
   }
};

// Random delay function
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Main function
const main = async () => {
   console.log("🚀 Starting email sender...");

   // Validate configuration
   if (!validateConfig()) {
      console.error(
         "⛔ Invalid configuration. Please check your .env file and try again."
      );
      return;
   }

   // Load recipients, sent emails, and unsubscribes
   const recipients = await loadRecipients();
   const sentEmails = loadSentEmails();
   const unsubscribedEmails = processUnsubscribes();

   if (recipients.length === 0) {
      console.log(
         "⚠️ No recipients found in CSV file. Please add recipients to recipients.csv"
      );
      return;
   }

   // Set up email counts for each account
   const dailyLimit = {};
   const sentCount = {};

   ZOHO_ACCOUNTS.forEach((account) => {
      dailyLimit[account.email] = parseInt(
         process.env.DAILY_LIMIT_PER_ACCOUNT || "50"
      );
      sentCount[account.email] = 0;
   });

   // Count how many emails we will send
   const eligibleRecipients = recipients.filter(
      (r) =>
         !sentEmails.has(r.email) &&
         !unsubscribedEmails.has(r.email.toLowerCase())
   );
   console.log(
      `📊 Found ${eligibleRecipients.length} eligible recipients out of ${recipients.length} total`
   );

   // Send emails
   for (const recipient of recipients) {
      // Skip if we've already sent to this recipient or they've unsubscribed
      if (sentEmails.has(recipient.email)) {
         console.log(`⏩ Skipping ${recipient.email} - already sent`);
         continue;
      }

      if (unsubscribedEmails.has(recipient.email.toLowerCase())) {
         console.log(`⏩ Skipping ${recipient.email} - unsubscribed`);
         continue;
      }

      // Choose an account that hasn't reached its limit
      const availableAccounts = ZOHO_ACCOUNTS.filter(
         (acc) => sentCount[acc.email] < dailyLimit[acc.email]
      );

      if (availableAccounts.length === 0) {
         console.log("🛑 All accounts have reached their daily sending limits");
         break;
      }

      // Pick an account, alternating between them to distribute emails
      let account = availableAccounts[0];
      if (availableAccounts.length > 1) {
         // If multiple accounts available, pick the one with fewer sent emails
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
            `📈 Progress: ${account.email} has sent ${
               sentCount[account.email]
            }/${dailyLimit[account.email]} emails`
         );

         // Add small delay between emails (5-15 seconds) to avoid triggering spam filters
         const minDelay = parseInt(process.env.MIN_DELAY_SECONDS || "5");
         const maxDelay = parseInt(process.env.MAX_DELAY_SECONDS || "15");
         const delayTime =
            Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay) *
            1000;
         console.log(
            `⏱️ Waiting ${delayTime / 1000} seconds before next email...`
         );
         await delay(delayTime);
      }

      // Break if all accounts have reached their limits
      const allLimitsReached = ZOHO_ACCOUNTS.every(
         (acc) => sentCount[acc.email] >= dailyLimit[acc.email]
      );
      if (allLimitsReached) {
         console.log("🛑 All accounts have reached their daily sending limits");
         break;
      }
   }

   console.log("\n✨ Email sending complete!");
   console.log("📝 Summary:");
   ZOHO_ACCOUNTS.forEach((account) => {
      console.log(
         `- ${account.email}: Sent ${sentCount[account.email]}/${
            dailyLimit[account.email]
         } emails`
      );
   });
};

// Run the program
main().catch((error) => {
   console.error("❌ An error occurred:", error);
   process.exit(1);
});
