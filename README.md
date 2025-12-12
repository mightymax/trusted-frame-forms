# TrustedFrame Forms

TrustedFrame Forms is a lightweight Express service that serves HTML forms to third-party sites through a hardened iframe workflow. It whitelists embedding domains, injects a simple math captcha + honeypot, and relays submissions to SMTP so each customer can reuse their own hosted templates without exposing mail credentials in the browser.

This project is created for websites that use only static HTML without running any backend service.

## Features
- Domain allowlisting with CSP and Origin checks to control who may embed a form.
- Fetches form and response templates from a per-customer form server and injects runtime values.
- Math captcha with signed tokens plus a hidden honeypot field to keep bots out.
- Sends submissions via SMTP using Nodemailer; subject and recipients are configured per customer.
- Ships with a demo contact form and an iframe test page to verify embedding locally.
- Optional per-form validator modules to perform custom field checks before sending mail.

## How it works
1) `GET /form/:customer/:formId`  
   - Looks up the customer in `customers.js` and pulls the HTML template from `formServer + form`.  
   - Replaces template placeholders: `{{ formAction }}` (submission URL), `{{ captchaQuestion }}`, `{{ captchaAnswer }}`, and `{{ error }}` (optional message in the template).  
   - CSP `frame-ancestors` is set from the customer's allowed domains, and `X-Frame-Options` is removed so embedding works.

2) `POST /submit/:customer/:formId`  
   - Validates the captcha token, math answer, and honeypot field.  
   - If a validator is configured for the form, dynamically imports it and lets it return field-level errors; when errors exist the form is re-rendered with `{{ error_<field> }}` placeholders filled.  
   - Sends the submission via email using the customer's `mailFrom`, `mailTo`, and form-specific `mailSubject`.  
   - Fetches the response HTML from `formServer + response`, replaces `{{ fieldName }}` placeholders with submitted values, and returns the page.

See `example/forms/contact.html` for the required placeholders and `example/forms/contact-response.html` for a basic response template.

## Configuration
Environment variables (see `.env.example`):

```
APP_URL=http://localhost:3000        # Public URL of this service (used for {{ formAction }})
CAPTCHA_SECRET=change-me             # Secret for signing captcha tokens
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_SECURE=false                    # true for SMTPS
```

Customer configuration lives in `customers.js`:

```js
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
```

## Running locally
1) Install dependencies: `npm install`
2) Set up `.env` with at least `APP_URL` and SMTP settings.
3) Ensure your form templates are reachable at `formServer` (e.g., run a simple static server for the `forms/` directory or adjust `formServer` to where you host them).
4) Start the service: `npm start`
5) Open `example/index.html` in a browser to check the iframe embed at `http://localhost:3000/form/acme/contact`.

## Form template requirements
- Must include `{{ formAction }}` as the `action` of the `<form>`.
- Must include both `{{ captchaQuestion }}` and `{{ captchaAnswer }}` to render the math challenge and hidden token field.
- Optionally render `{{ error }}` to show validation errors after redirects.
- Any `{{ fieldName }}` placeholders in the response template will be replaced with the submitted values.

## Custom validator modules (optional)
- Each form can point to a validator module by adding `validator: "/path/to/validator.js"` in `customers.js` (relative to `formServer` or an absolute URL).
- The module must export a default function that receives the submitted `req.body` object and returns either `null` (valid) or an object of field-level errors, e.g. `{ email: "Invalid" }`.
- When errors are returned the form is re-rendered with the messages injected into placeholders shaped like `{{ error_email }}`, `{{ error_name }}`, etc.; include these placeholders in your form HTML wherever you want to surface messages.
- See `example/forms/contact.js` for a working sample validator.

## Security notes
- Only requests from allowed origins/domains can embed a form; other origins get a 403.
- Captcha tokens expire after 30 minutes and enforce a minimum completion time.
- A hidden `website` field acts as a honeypot to block simple bots.

## License
EUPL-1.0
