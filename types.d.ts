declare global {
  export interface MailPayload {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
  }

  /**
   * Payload stored inside the signed captcha token.
   */
  export interface CaptchaPayload {
    // User-facing math question (e.g. "2 + 3").
    question: string;
    // Numeric answer to the question.
    answer: number;
    // Timestamp in ms when the captcha was issued.
    createdAt: number;
  }

  /**
   * A single HTML form definition for a customer.
   */
  export interface CustomerFormConfig {
    // Path to the form HTML template on `formServer`.
    form: string;
    // Path to the thank-you/response HTML page on `formServer`.
    response: string;
    // Subject line used when emailing this form submission.
    mailSubject: string;
    // Optional relative path or full URL to a JavaScript module that exports a default validation function.
    validator?: string;
  }

  /**
   * Full configuration per customer.
   */  
  export interface CustomerConfig {
    // Allowed origins for embedding the trusted frame.
    domains: string[];
    // Base URL where the HTML templates are hosted.
    formServer: string;
    // Destination inbox for form submissions.
    mailTo: string;
    // Sender address used in outgoing mails.
    mailFrom: string;
    // Map of form slug to form configuration.
    forms: Record<string, CustomerFormConfig>;
  }
}

export {}