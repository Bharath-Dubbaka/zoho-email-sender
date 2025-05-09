# Zoho Email Automation

A simple Node.js script to automate sending emails from Zoho Mail accounts using custom data.

## Features

- Send emails from multiple Zoho email accounts
- Customize content for each recipient using CSV data
- Track sent emails to avoid duplicates
- Process unsubscribe requests
- Add unsubscribe links to all emails
- Configurable daily sending limits
- Random delays between sends to avoid spam detection


## Quick Setup Guide

1. **Create a project folder**:

   ```
   mkdir zoho-email-sender
   cd zoho-email-sender
   ```

2. **Install required packages**:

   ```
   npm init -y
   npm install nodemailer csv-parser csv-writer
   ```

3. **Create the necessary files**:

   -  Save the main script as `email_sender.js`
   -  Create your data file as `recipients.csv` with your custom data

4. **CSV Format**:
   Your CSV file should have these exact columns:

   ```
   name,email,subject,body
   ```

5. **Update credentials**:
   Edit `email_sender.js` and replace `YOUR_PASSWORD_HERE` with your actual Zoho App-Passwords

6. **Run the script**:
   ```
   node email_sender.js
   ```

## CSV File Format

The script expects a CSV file with these columns:

-  `name`: Recipient name
-  `email`: Recipient email address
-  `subject`: Custom subject line for each email
-  `body`: Custom email body text

Example CSV content:

```
name,email,subject,body
nameC,sample.39@gmail.com,Hello!,This is a test email.
nameD,martian_onfly@gmail.com,Update,Here's the update, yada yada yada.
```

## How It Works

1. The script reads your CSV file with custom email content
2. It sends emails alternating between your two Zoho accounts (50 per account)
3. It adds a slight delay between sends to avoid triggering spam filters
4. It keeps track of which emails have been sent so you can run it multiple times
5. Plain text email bodies are automatically wrapped in basic HTML for better formatting

## Tracking and Logs

-  Sent emails are logged in `email_log.txt`
-  The script will automatically skip any recipients that have already received emails
-  You can add new recipients to the CSV file at any time

## Running Daily

To run this script daily:

-  On Linux/Mac: Set up a cron job
-  On Windows: Use Task Scheduler
-  On a server: Set up a scheduled task

Just make sure the server/computer is powered on when the job is scheduled to run.




FUTURE UPDATES -----------------------------


Email Tracking and Engagement Monitoring Guide
Monitoring Email Engagement
Tracking email engagement is crucial for understanding how recipients interact with your emails and improving your strategy. Here are several approaches:
Key Metrics to Monitor:
Open Rate: Percentage of recipients who opened your email
Click Rate: Percentage who clicked links in your email
Bounce Rate: Emails that couldn't be delivered
Spam Complaints: Recipients who marked your email as spam


1. Zoho Mail Analytics
Zoho Mail provides built-in analytics for business accounts:

2. Email Tracking Pixels
For more detailed tracking, you can implement tracking pixels:
javascript// In your email_sender.js, modify the sendEmail function:

const sendEmail = async (account, recipient) => {
  // ...existing code...
  
  // Add tracking pixel
  const trackingId = crypto.randomUUID();
  const trackingPixel = `<img src="https://resumeonfly.com/track?id=${trackingId}&email=${encodeURIComponent(recipient.email)}" width="1" height="1" alt="" style="display:none;">`;
  
  // Add tracking pixel to email body
  emailBody = emailBody.replace('</body>', `${trackingPixel}</body>`);
  
  // ...rest of function...
You'll need to set up a simple endpoint on your website to capture these tracking events.
3. Third-Party Email Analytics Services
Several services offer comprehensive email tracking:

Mailtrack: Provides open tracking and detailed analytics
SendGrid: Offers comprehensive email analytics and reporting
MailChimp: Full-featured email campaign management with analytics

Creating an Engagement Database, BELOW IS WITH SQLlite, we can Mongo, Node, Express 
To track engagement over time, create a simple database:
javascript// engagement_tracker.js
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./email_engagement.db');

// Initialize database
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient TEXT,
    sent_date TEXT,
    from_address TEXT
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS opens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id INTEGER,
    opened_at TEXT,
    FOREIGN KEY(email_id) REFERENCES emails(id)
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS clicks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id INTEGER,
    clicked_at TEXT,
    link_url TEXT,
    FOREIGN KEY(email_id) REFERENCES emails(id)
  )`);
});

// Log email send
exports.logEmailSent = (recipient, fromAddress) => {
  const stmt = db.prepare('INSERT INTO emails (recipient, sent_date, from_address) VALUES (?, ?, ?)');
  stmt.run(recipient, new Date().toISOString(), fromAddress);
  stmt.finalize();
};

// Log email open
exports.logEmailOpen = (emailId) => {
  const stmt = db.prepare('INSERT INTO opens (email_id, opened_at) VALUES (?, ?)');
  stmt.run(emailId, new Date().toISOString());
  stmt.finalize();
};

// Log link click
exports.logEmailClick = (emailId, linkUrl) => {
  const stmt = db.prepare('INSERT INTO clicks (email_id, clicked_at, link_url) VALUES (?, ?, ?)');
  stmt.run(emailId, new Date().toISOString(), linkUrl);
  stmt.finalize();
};





Monitoring Deliverability
To monitor email deliverability:

Set up DMARC Reporting:******
Implement DMARC with reporting to receive data on emails sent using your domain
Use services like dmarcian.com or powerdmarc.com to analyze reports


Monitor Bounce Logs:
Process and analyze bounce emails automatically
Categorize bounces (hard vs. soft) to understand delivery issues


Regularly Check Spam Databases:
Check if your domain is on any blacklists using tools like MXToolbox
Regularly test sending to major email providers (Gmail, Outlook)



Best Practices for Maintaining Good Deliverability:::

Clean Your List Regularly:
Remove recipients who haven't opened emails in 3-6 months
Process unsubscribe requests immediately


Segment Your Audience:
Send targeted emails based on recipient interests
Tailor content to improve engagement rates


Optimize Send Times:
Test different days and times to find optimal engagement windows
Avoid sending too many emails in a short period


Maintain Content Quality:
Avoid spam trigger words in subject lines
Maintain a good text-to-image ratio
Include relevant, valuable content

