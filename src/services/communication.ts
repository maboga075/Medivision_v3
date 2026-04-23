export interface CommunicationResult {
  success: boolean;
  error?: string;
}

export const sendViaWhatsApp = (patientPhone: string, reportUrl = '#'): CommunicationResult => {
  if (!patientPhone) {
    return { success: false, error: 'Numéro de téléphone manquant.' };
  }

  // Stub — à remplacer par une intégration Twilio/WhatsApp Business API
  const message = encodeURIComponent(
    `Clinique Medivision — Votre compte rendu est disponible : ${reportUrl}`
  );
  const phone = patientPhone.replace(/\s+/g, '').replace(/^\+/, '');
  window.open(`https://wa.me/${phone}?text=${message}`, '_blank');

  return { success: true };
};

export const sendViaEmail = (patientEmail: string, reportUrl = '#'): CommunicationResult => {
  if (!patientEmail) {
    return { success: false, error: 'Adresse email manquante.' };
  }

  // Stub — à remplacer par une intégration SendGrid ou autre
  const subject = encodeURIComponent('Clinique Medivision — Votre compte rendu');
  const body = encodeURIComponent(
    `Bonjour,\n\nVotre compte rendu ophtalmologique est disponible à l'adresse suivante :\n${reportUrl}\n\nCordialement,\nClinique Medivision`
  );
  window.open(`mailto:${patientEmail}?subject=${subject}&body=${body}`, '_blank');

  return { success: true };
};
