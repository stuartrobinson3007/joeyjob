import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  from?: string
}

export async function sendEmail({ 
  to, 
  subject, 
  html, 
  from = process.env.EMAIL_FROM! 
}: SendEmailOptions) {
  try {
    const result = await resend.emails.send({
      from,
      to,
      subject,
      html,
    })
    
    return { success: true, data: result }
  } catch (error) {
    console.error('Failed to send email:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to send email' 
    }
  }
}

export async function sendMagicLinkEmail(email: string, url: string) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Sign in to Todo App</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .container { max-width: 500px; margin: 40px auto; padding: 20px; }
          .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background: #3b82f6; 
            color: white; 
            text-decoration: none; 
            border-radius: 6px;
            font-weight: 500;
          }
          .footer { margin-top: 40px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Sign in to Todo App</h1>
          <p>Click the button below to sign in to your account:</p>
          <p style="margin: 30px 0;">
            <a href="${url}" class="button">Sign in to Todo App</a>
          </p>
          <p>Or copy and paste this link in your browser:</p>
          <p style="word-break: break-all; color: #3b82f6;">${url}</p>
          <p>This link will expire in 5 minutes for security reasons.</p>
          <div class="footer">
            <p>If you didn't request this email, you can safely ignore it.</p>
          </div>
        </div>
      </body>
    </html>
  `

  return sendEmail({
    to: email,
    subject: 'Sign in to Todo App',
    html
  })
}

export async function sendInvitationEmail(email: string, inviterName: string, organizationName: string, url: string) {
  console.log('📧 Attempting to send invitation email:', {
    to: email,
    inviterName,
    organizationName,
    url,
    hasResendKey: !!process.env.RESEND_API_KEY,
    emailFrom: process.env.EMAIL_FROM
  })

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Invitation to join ${organizationName}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .container { max-width: 500px; margin: 40px auto; padding: 20px; }
          .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background: #10b981; 
            color: white; 
            text-decoration: none; 
            border-radius: 6px;
            font-weight: 500;
          }
          .footer { margin-top: 40px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>You're invited!</h1>
          <p><strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> on Todo App.</p>
          <p style="margin: 30px 0;">
            <a href="${url}" class="button">Accept Invitation</a>
          </p>
          <p>Or copy and paste this link in your browser:</p>
          <p style="word-break: break-all; color: #10b981;">${url}</p>
          <div class="footer">
            <p>If you don't want to join this organization, you can safely ignore this email.</p>
          </div>
        </div>
      </body>
    </html>
  `

  const result = await sendEmail({
    to: email,
    subject: `${inviterName} invited you to join ${organizationName}`,
    html
  })

  if (result.success) {
    console.log('✅ Invitation email sent successfully:', result.data)
  } else {
    console.error('❌ Failed to send invitation email:', result.error)
  }

  return result
}

export async function sendOTPEmail(email: string, otp: string, type: 'sign-in' | 'email-verification' | 'forget-password') {
  const getSubjectAndContent = () => {
    switch (type) {
      case 'sign-in':
        return {
          subject: 'Your sign-in code for Todo App',
          title: 'Sign in to Todo App',
          message: 'Use this code to sign in to your account:'
        }
      case 'email-verification':
        return {
          subject: 'Verify your email for Todo App',
          title: 'Verify your email',
          message: 'Use this code to verify your email address:'
        }
      case 'forget-password':
        return {
          subject: 'Reset your password for Todo App',
          title: 'Reset your password',
          message: 'Use this code to reset your password:'
        }
      default:
        return {
          subject: 'Your verification code for Todo App',
          title: 'Verification code',
          message: 'Your verification code is:'
        }
    }
  }

  const { subject, title, message } = getSubjectAndContent()

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .container { max-width: 500px; margin: 40px auto; padding: 20px; }
          .code { 
            font-size: 32px; 
            font-weight: bold; 
            letter-spacing: 8px;
            color: #10b981; 
            text-align: center;
            padding: 20px;
            background: #f0fdf4;
            border: 2px solid #10b981;
            border-radius: 8px;
            margin: 20px 0;
          }
          .footer { margin-top: 40px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>${title}</h1>
          <p>${message}</p>
          <div class="code">${otp}</div>
          <p>This code will expire in 5 minutes for security reasons.</p>
          <div class="footer">
            <p>If you didn't request this code, you can safely ignore this email.</p>
          </div>
        </div>
      </body>
    </html>
  `

  return sendEmail({
    to: email,
    subject,
    html
  })
}