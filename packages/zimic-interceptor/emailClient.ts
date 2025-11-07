import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'localhost',
  port: 2525,
  secure: false,
  auth: { user: 'username', pass: 'password' },
  tls: { rejectUnauthorized: false },
});

(async () => {
  const message = await transporter.sendMail({
    from: 'From from@example.com',
    to: 'to@example.com',
    subject: 'Subject',
    text: '<p>Content</b>',
    headers: { 'content-type': 'text/html', other: 'true', from: 'Diego' },
  });

  console.dir(
    {
      event: 'emailSent',
      message,
    },
    { depth: null },
  );
})();
