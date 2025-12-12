/**
 * Full configuration per customer.
 * @property {Object<string, CustomerFormConfig>} forms Map of form slug to form configuration.
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
        form: "/examples/forms/contact.html",       // template path on formServer
        response: "/examples/forms/contact-response.html",
        validator: "/examples/validators/contact.js"  // path on formServer
      }
    }
  }
};

export default customers;
