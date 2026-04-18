import config from '../config/config.service';
import { sendEmail } from '../email/email.service';
import logger from '../lib/logger.service';
async function testMailgun() {
  try {
    logger.info('Testing Mailgun email sending...');
    const adminEmail =
      config.DEVELOPER_EMAIL || 'abdulhadiwaseem.hashone@gmail.com';
    console.log(`Sending test email to: ${adminEmail}`);
    const result = await sendEmail({
      to: adminEmail,
      subject: 'Test Email from YesJobs API',
      html: `
        <h1>Test Email</h1>
        <p>This is a test email to verify Mailgun integration.</p>
        <p>If you're seeing this, the email service is working correctly!</p>
        <p>Timestamp: ${new Date().toISOString()}</p>
      `,
    });
    logger.info('Email sent successfully', { id: result.id });
    console.log('Email sent successfully!');
    console.log('Message ID:', result.id);
  } catch (error) {
    logger.error('Failed to send test email', { error });
    console.error('Failed to send test email:', error);
  }
}
testMailgun().catch(console.error);
