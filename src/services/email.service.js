const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10) || 587,
  // Use secure setting from env or default based on port
  secure: process.env.SMTP_SECURE === 'true' || String(process.env.SMTP_PORT) === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  // Increase timeouts for Mailtrap
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
  // Debug mode for development
  debug: process.env.NODE_ENV === 'development',
  logger: process.env.NODE_ENV === 'development',
});

logger.info('📧 Email transporter configured:', {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  user: process.env.SMTP_USER,
  secure: process.env.SMTP_SECURE === 'true' || String(process.env.SMTP_PORT) === '465',
});

// Verify connection
transporter.verify((error, success) => {
  if (error) {
    logger.error('Email configuration error:', error);
  } else {
    logger.info('✅ Email server is ready');
  }
});

// Send email
exports.sendEmail = async (options) => {
  try {
    const mailOptions = {
      from: `Nestly <${process.env.EMAIL_FROM || 'nestly@mailtrap.io'}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    };

    logger.info(`📤 Sending email to ${options.to}: ${options.subject}`);
    
    // Set a timeout for email sending to prevent hanging
    const emailPromise = transporter.sendMail(mailOptions);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Email send timeout')), 5000)
    );
    
    const info = await Promise.race([emailPromise, timeoutPromise]);
    logger.info(`✅ Email sent successfully: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error('❌ Email sending failed:', {
      to: options.to,
      subject: options.subject,
      error: error.message,
    });
    // Don't throw the error - just log it and return null
    // This prevents email failures from blocking registration/login
    return null;
  }
};

// Email templates
exports.sendVerificationEmail = async (user, otp) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #10B981; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f4f4f4; }
        .otp { font-size: 32px; font-weight: bold; color: #10B981; text-align: center; padding: 20px; background: white; margin: 20px 0; border-radius: 8px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Verify Your Email</h1>
        </div>
        <div class="content">
          <p>Hello ${user.fullName},</p>
          <p>Thank you for registering with Nestly. Please use the OTP below to verify your email address:</p>
          <div class="otp">${otp}</div>
          <p>This OTP is valid for 10 minutes.</p>
          <p>If you didn't create an account with Nestly, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>&copy; 2025 Nestly. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await this.sendEmail({
    to: user.email,
    subject: 'Verify Your Email - Nestly',
    html,
  });
};

exports.sendPasswordResetEmail = async (user, resetToken) => {
  const resetURL = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #10B981; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f4f4f4; }
        .button { display: inline-block; padding: 12px 24px; background: #10B981; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset Request</h1>
        </div>
        <div class="content">
          <p>Hello ${user.fullName},</p>
          <p>You requested to reset your password. Click the button below to reset it:</p>
          <a href="${resetURL}" class="button">Reset Password</a>
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p>${resetURL}</p>
          <p>This link is valid for 1 hour.</p>
          <p>If you didn't request a password reset, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>&copy; 2025 Nestly. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await this.sendEmail({
    to: user.email,
    subject: 'Password Reset Request - Nestly',
    html,
  });
};

exports.sendWelcomeEmail = async (user) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #10B981; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f4f4f4; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to Nestly! 🌾</h1>
        </div>
        <div class="content">
          <p>Hello ${user.fullName},</p>
          <p>Welcome to Nestly - your gateway to agricultural investments!</p>
          <p>You can now:</p>
          <ul>
            <li>Invest in various agricultural products</li>
            <li>Track your investments in real-time</li>
            <li>Fund and withdraw from your wallet securely</li>
            <li>Earn transparent returns</li>
          </ul>
          <p>Get started by exploring our investment opportunities!</p>
        </div>
        <div class="footer">
          <p>&copy; 2025 Nestly. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await this.sendEmail({
    to: user.email,
    subject: 'Welcome to Nestly! 🌾',
    html,
  });
};

exports.sendInvestmentConfirmation = async (user, investment, product) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #10B981; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f4f4f4; }
        .details { background: white; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Investment Confirmation</h1>
        </div>
        <div class="content">
          <p>Hello ${user.fullName || user.firstName || 'Investor'},</p>
          <p>Your investment has been successfully created!</p>
          <div class="details">
            <p><strong>Product:</strong> ${product.name}</p>
            <p><strong>Amount Invested:</strong> ₦${(investment.totalInvestment || 0).toLocaleString()}</p>
            <p><strong>Quantity:</strong> ${investment.quantity || 0} ${product.unitType || 'units'}(s)</p>
            <p><strong>Unit Price:</strong> ₦${(investment.unitPrice || 0).toLocaleString()}</p>
            <p><strong>Expected ROI:</strong> ${product.roiRange?.min || 0}% - ${product.roiRange?.max || 0}%</p>
            <p><strong>Duration:</strong> ${investment.duration || 0} days</p>
            <p><strong>Start Date:</strong> ${investment.startDate ? new Date(investment.startDate).toDateString() : 'N/A'}</p>
            <p><strong>Maturity Date:</strong> ${investment.endDate ? new Date(investment.endDate).toDateString() : 'N/A'}</p>
          </div>
          <p>You can track your investment performance in real-time through the app.</p>
        </div>
        <div class="footer">
          <p>&copy; 2025 Nestly. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await this.sendEmail({
    to: user.email,
    subject: 'Investment Confirmation - Nestly',
    html,
  });
};

exports.sendKYCStatusEmail = async (user, status, reason = null) => {
  const statusText = status === 'verified' ? 'Approved' : 'Rejected';
  const statusColor = status === 'verified' ? '#10B981' : '#EF4444';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${statusColor}; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f4f4f4; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>KYC ${statusText}</h1>
        </div>
        <div class="content">
          <p>Hello ${user.fullName},</p>
          <p>Your KYC verification has been <strong>${statusText.toLowerCase()}</strong>.</p>
          ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
          ${status === 'verified' ? '<p>You now have access to higher transaction limits!</p>' : '<p>Please contact support if you have any questions.</p>'}
        </div>
        <div class="footer">
          <p>&copy; 2025 Nestly. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await this.sendEmail({
    to: user.email,
    subject: `KYC ${statusText} - Nestly`,
    html,
  });
};

// Transaction notification email
exports.sendTransactionNotification = async (email, name, title, message, transaction) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
        .transaction-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
        .detail-row:last-child { border-bottom: none; }
        .label { color: #6b7280; }
        .value { font-weight: bold; color: #111827; }
        .amount { font-size: 32px; font-weight: bold; color: #10b981; margin: 20px 0; text-align: center; }
        .status { padding: 5px 15px; border-radius: 20px; display: inline-block; font-size: 12px; font-weight: bold; }
        .status-completed { background: #d1fae5; color: #065f46; }
        .status-pending { background: #fef3c7; color: #92400e; }
        .status-failed { background: #fee2e2; color: #991b1b; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Nestly</h1>
          <p style="margin: 10px 0 0 0; font-size: 18px;">${title}</p>
        </div>
        <div class="content">
          <p>Hi ${name},</p>
          <p>${message}</p>
          
          <div class="amount">₦${(transaction.amount || 0).toLocaleString()}</div>
          
          <div class="transaction-details">
            <div class="detail-row">
              <span class="label">Transaction Type:</span>
              <span class="value">${(transaction.type || '').replace('_', ' ').toUpperCase()}</span>
            </div>
            <div class="detail-row">
              <span class="label">Reference:</span>
              <span class="value">${transaction.reference || 'N/A'}</span>
            </div>
            <div class="detail-row">
              <span class="label">Status:</span>
              <span class="value">
                <span class="status status-${transaction.status}">${(transaction.status || '').toUpperCase()}</span>
              </span>
            </div>
            <div class="detail-row">
              <span class="label">Payment Method:</span>
              <span class="value">${(transaction.paymentMethod || 'wallet').replace('_', ' ').toUpperCase()}</span>
            </div>
            <div class="detail-row">
              <span class="label">Date:</span>
              <span class="value">${transaction.createdAt ? new Date(transaction.createdAt).toLocaleString() : 'N/A'}</span>
            </div>
          </div>
          
          <p style="margin-top: 30px;">If you have any questions, please contact our support team.</p>
        </div>
        <div class="footer">
          <p>&copy; 2025 Nestly. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await this.sendEmail({
    to: email,
    subject: title,
    html,
  });
};

// Investment maturity notification
exports.sendInvestmentMaturityNotification = async (email, name, investment, totalPayout) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
        .payout-box { background: white; padding: 30px; border-radius: 8px; margin: 20px 0; text-align: center; }
        .amount { font-size: 42px; font-weight: bold; color: #10b981; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
        .label { color: #6b7280; }
        .value { font-weight: bold; color: #111827; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Investment Matured!</h1>
        </div>
        <div class="content">
          <p>Hi ${name},</p>
          <p>Congratulations! Your investment has successfully matured.</p>
          
          <div class="payout-box">
            <p style="color: #6b7280; margin: 0;">Total Payout</p>
            <div class="amount">₦${(totalPayout || 0).toLocaleString()}</div>
            
            <div style="margin-top: 20px; text-align: left;">
              <div class="detail-row">
                <span class="label">Principal Amount:</span>
                <span class="value">₦${(investment.totalInvestment || 0).toLocaleString()}</span>
              </div>
              <div class="detail-row">
                <span class="label">ROI Earned:</span>
                <span class="value">₦${(investment.roiEarned || 0).toLocaleString()}</span>
              </div>
              <div class="detail-row">
                <span class="label">Final ROI:</span>
                <span class="value">${(investment.roiPercentage || 0).toFixed(2)}%</span>
              </div>
              <div class="detail-row" style="border-bottom: none;">
                <span class="label">Investment Period:</span>
                <span class="value">${investment.duration || 0} days</span>
              </div>
            </div>
          </div>
          
          <p style="margin-top: 30px;">The total payout has been credited to your wallet and is available for withdrawal or reinvestment.</p>
          <p>Thank you for investing with Nestly!</p>
        </div>
        <div class="footer">
          <p>&copy; 2025 Nestly. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await this.sendEmail({
    to: email,
    subject: 'Investment Matured - Nestly',
    html,
  });
};

exports.sendInvestmentWithdrawalNotification = async (email, name, investment, totalPayout, platformFee) => {
  const netROI = investment.netRoiEarned || 0;
  const grossROI = netROI + (platformFee || 0);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
        .payout-box { background: white; padding: 30px; border-radius: 8px; margin: 20px 0; text-align: center; }
        .amount { font-size: 42px; font-weight: bold; color: #10b981; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
        .label { color: #6b7280; }
        .value { font-weight: bold; color: #111827; }
        .success-text { color: #10b981; font-weight: bold; }
        .info-box { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Investment Withdrawn Successfully!</h1>
        </div>
        <div class="content">
          <p>Hi ${name},</p>
          <p>Your investment in <strong>${investment.product?.name || 'product'}</strong> has been successfully withdrawn.</p>
          
          <div class="payout-box">
            <p style="color: #6b7280; margin: 0;">Amount Credited to Wallet</p>
            <div class="amount">₦${(totalPayout || 0).toLocaleString()}</div>
            
            <div style="margin-top: 20px; text-align: left;">
              <div class="detail-row">
                <span class="label">Principal Investment:</span>
                <span class="value">₦${(investment.totalInvestment || 0).toLocaleString()}</span>
              </div>
              <div class="detail-row">
                <span class="label">Quantity:</span>
                <span class="value">${investment.quantity || 0} ${investment.product?.unitType || 'unit'}(s)</span>
              </div>
              <div class="detail-row">
                <span class="label">Gross ROI:</span>
                <span class="value">₦${(grossROI || 0).toLocaleString()}</span>
              </div>
              <div class="detail-row">
                <span class="label">Platform Fee (20%):</span>
                <span class="value">-₦${(platformFee || 0).toLocaleString()}</span>
              </div>
              <div class="detail-row">
                <span class="label">Net ROI (Your Share):</span>
                <span class="value success-text">₦${(netROI || 0).toLocaleString()}</span>
              </div>
              <div class="detail-row">
                <span class="label">ROI Percentage:</span>
                <span class="value">${(investment.roiPercentage || 0).toFixed(2)}%</span>
              </div>
              <div class="detail-row" style="border-bottom: none;">
                <span class="label">Investment Period:</span>
                <span class="value">${investment.duration || 0} days</span>
              </div>
            </div>
          </div>
          
          <div class="info-box">
            <p style="margin: 0;"><strong>ℹ️ Note:</strong> The funds are now available in your wallet. You can withdraw to your bank account or reinvest in other opportunities.</p>
          </div>
          
          <p style="margin-top: 30px;">Thank you for investing with FarmInvest!</p>
        </div>
        <div class="footer">
          <p>&copy; 2025 FarmInvest. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await this.sendEmail({
    to: email,
    subject: 'Investment Withdrawn Successfully - FarmInvest',
    html,
  });
};
