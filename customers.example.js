/**
 * A single HTML form definition for a customer.
 * @typedef {Object} CustomerFormConfig
 * @property {string} form Path to the form HTML template on `formServer`.
 * @property {string} response Path to the thank-you/response HTML page on `formServer`.
 * @property {string} mailSubject Subject line used when emailing this form submission.
 */

/**
 * Full configuration per customer.
 * @typedef {Object} CustomerConfig
 * @property {string[]} domains Allowed origins for embedding the trusted frame.
 * @property {string} formServer Base URL where the HTML templates are hosted.
 * @property {string} mailTo Destination inbox for form submissions.
 * @property {string} mailFrom Sender address used in outgoing mails.
 * @property {Object<string, CustomerFormConfig>} forms Map of form slug to form configuration.
 */

/**
 * Configuratie van klanten en hun toegestane domeinen.
 * @type {Object<string, CustomerConfig>}
 */
const customers = {
  acme: {
    domains: ["https://ex1.com", "https://www.ex2.com"],
    formServer: "https://forms.example.com", // where the HTML templates are hosted
    mailTo: "inbox@example.com",
    mailFrom: "forms@example.com",
    forms: {
      contact: {
        mailSubject: "New contact form",
        form: "/forms/contact.html",       // template path on formServer
        response: "/forms/contact-response.html"
      }
    }
  }
};

export default customers;
