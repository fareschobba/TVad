const transporter = require('../config/email');
const path = require('path');

class EmailService {
  constructor() {
    this.from = process.env.EMAIL_FROM || 'noreply@yourdomain.com';
  }

  async sendMail({ to, subject, text, html }) {
    try {
      const mailOptions = {
        from: this.from,
        to,
        subject,
        text,
        html
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', info.messageId);
      return info;
    } catch (error) {
      console.error('Email sending failed:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  // Template for new client account
  async sendNewAccountEmail({ email, username, password }) {
    const subject = 'Bienvenue sur Notre Plateforme - Vos Identifiants';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Bienvenue sur Notre Plateforme !</h2>
        <p>Votre compte a été créé avec succès.</p>
        <p>Voici vos identifiants de connexion :</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px;">
          <p><strong>Nom d'utilisateur :</strong> ${username}</p>
          <p><strong>Mot de passe :</strong> ${password}</p>
        </div>
        <p style="color: #ff0000;">Veuillez changer votre mot de passe après votre première connexion.</p>
        <p>Si vous avez des questions, n'hésitez pas à nous contacter.</p>
        <p>Cordialement,<br>Équipe AROMAMASTER</p>
      </div>
    `;

    return this.sendMail({
      to: email,
      subject,
      html,
      text: `Bienvenue sur Notre Plateforme !\n\nVotre compte a été créé avec succès.\n\nNom d'utilisateur : ${username}\nMot de passe : ${password}\n\nVeuillez changer votre mot de passe après votre première connexion.\n\nCordialement,\nÉquipe AROMAMASTER`
    });
  }

  // Template for password reset
  async sendPasswordResetEmail({ email, resetToken, resetUrl }) {
    const subject = 'Demande de Réinitialisation du Mot de Passe';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Demande de Réinitialisation du Mot de Passe</h2>
        <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
        <p>Cliquez sur le bouton ci-dessous pour réinitialiser votre mot de passe :</p>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${resetUrl}" style="background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px;">Réinitialiser le Mot de Passe</a>
        </div>
        <p>Si vous n'êtes pas à l'origine de cette demande, veuillez ignorer cet e-mail.</p>
        <p>Ce lien expirera dans 1 heure.</p>
        <p>Cordialement,<br>Équipe AROMAMASTER</p>
      </div>
    `;

    return this.sendMail({
      to: email,
      subject,
      html,
      text: `Demande de Réinitialisation du Mot de Passe\n\nVous avez demandé la réinitialisation de votre mot de passe.\n\nCliquez sur le lien suivant pour réinitialiser votre mot de passe :\n${resetUrl}\n\nSi vous n'êtes pas à l'origine de cette demande, veuillez ignorer cet e-mail.\n\nCe lien expirera dans 1 heure.\n\nCordialement,\nÉquipe AROMAMASTER`
    });
  }

  // Template for account status change
  async sendAccountStatusEmail({ email, username, isActive }) {
    const subject = `Compte ${isActive ? 'Activé' : 'Désactivé'}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Mise à Jour du Statut du Compte</h2>
        <p>Cher(e) ${username},</p>
        <p>Votre compte a été ${isActive ? 'activé' : 'désactivé'}.</p>
        ${isActive 
          ? '<p>Vous pouvez maintenant vous connecter à votre compte.</p>' 
          : '<p>Vous ne pourrez pas accéder à votre compte tant qu\'il ne sera pas réactivé.</p>'
        }
        <p>Si vous avez des questions, veuillez contacter l'administrateur.</p>
        <p>Cordialement,<br>Équipe AROMAMASTER</p>
      </div>
    `;

    return this.sendMail({
      to: email,
      subject,
      html,
      text: `Mise à Jour du Statut du Compte\n\nCher(e) ${username},\n\nVotre compte a été ${isActive ? 'activé' : 'désactivé'}.\n\n${isActive ? 'Vous pouvez maintenant vous connecter à votre compte.' : 'Vous ne pourrez pas accéder à votre compte tant qu\'il ne sera pas réactivé.'}\n\nSi vous avez des questions, veuillez contacter l'administrateur.\n\nCordialement,\nÉquipe AROMAMASTER`
    });
  }

  // Template for account reset
  async sendAccountResetEmail({ email, username, temporaryPassword }) {
    const subject = 'Réinitialisation de Votre Compte';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Réinitialisation de Votre Compte</h2>
        <p>Cher(e) ${username},</p>
        <p>Votre compte a été réinitialisé avec succès.</p>
        <p>Voici vos nouveaux identifiants de connexion :</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px;">
          <p><strong>Nom d'utilisateur :</strong> ${username}</p>
          <p><strong>Mot de passe temporaire :</strong> ${temporaryPassword}</p>
        </div>
        <p style="color: #ff0000;">Pour des raisons de sécurité, veuillez changer votre mot de passe lors de votre prochaine connexion.</p>
        <p>Si vous n'avez pas demandé cette réinitialisation, veuillez contacter immédiatement l'administrateur.</p>
        <p>Cordialement,<br>Équipe AROMAMASTER</p>
      </div>
    `;

    return this.sendMail({
      to: email,
      subject,
      html,
      text: `Réinitialisation de Votre Compte\n\nCher(e) ${username},\n\nVotre compte a été réinitialisé avec succès.\n\nVoici vos nouveaux identifiants de connexion :\n\nNom d'utilisateur : ${username}\nMot de passe temporaire : ${temporaryPassword}\n\nPour des raisons de sécurité, veuillez changer votre mot de passe lors de votre prochaine connexion.\n\nSi vous n'avez pas demandé cette réinitialisation, veuillez contacter immédiatement l'administrateur.\n\nCordialement,\nÉquipe AROMAMASTER`
    });
  }
}

module.exports = new EmailService();

