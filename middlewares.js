import customers from './customers.js';
import * as utils from './utils.js';

/**
 * Load and serve the HTML form template for the specified customer and form ID.
 * 
 * @param {import("express").Request & { validationErrors?: Record<string,string>}} req 
 * @param {import("express").Response} res 
 * @returns 
 */
export async function loadForm (req, res) {
  utils.loadHTMLTemplate(req.params.customer, req.params.formId, 'form')
    .then(formHtml => {
      if (!formHtml) throw new Error('Empty form HTML');
      if (!formHtml.match(/{{ ?formAction ?}}/)) {
        throw new Error('Form HTML missing {{ formAction }} placeholder');
      }

      if (!formHtml.match(/{{ ?captchaQuestion ?}}/)) {
        throw new Error('Form HTML missing {{ captchaQuestion }} placeholder');
      }

      if (!formHtml.match(/{{ ?captchaAnswer ?}}/)) {
        throw new Error('Form HTML missing {{ captchaAnswer }} placeholder');
      }

      const expressServerBaseUrl = process.env.APP_URL || 'http://localhost:3000';
      const submitURL = new URL(`/submit/${req.params.customer}/${req.params.formId}`, expressServerBaseUrl);
      const { token, question } = utils.generateCaptchaToken();
      let html = formHtml.replace(/{{ ?formAction ?}}/g, submitURL.toString())
        .replace(/{{ ?captchaAnswer ?}}/g, `<input type="text" name="captcha_answer" placeholder="${question} = ?" required><input type="hidden" name="captcha_token" value="${token}"><div style="display:none;"><label>Website (niet invullen): <input type="text" name="website"></label></div>`)
        .replace(/{{ ?captchaQuestion ?}}/g, question + ' = ?')
        .replace(/{{ ?error ?}}/g, req.query.error?.toString() ?? '')

      const validationErrors = req.validationErrors;
      if (validationErrors !== undefined) {
        Object.keys(validationErrors).forEach(field => {
          const errorPlaceholder = new RegExp(`{{ ?error_${field} ?}}`, 'g');
          html = html.replace(errorPlaceholder, `<span class="error">${validationErrors[field] ?? ''}</span>`);
        });
      }
      // Remove all error placeholders
      html = html.replace(/{{ ?error_[a-zA-Z0-9_]+ ?}}/g, '');
      res.send(html);
   })
    .catch(err => {
      console.error(err);
      res.status(500).send('Error fetching the form: <pre><code>' + err.message + '</code></pre>');
    });
}

/**
 * Handle a submitted form: validate captcha, send email, and render response HTML.
 * 
 * @param {import("express").Request & { validationErrors?: Record<string,string>}} req 
 * @param {import("express").Response} res 
 * @returns 
 */
export async function handleFormSubmission (req, res) {
  utils.loadHTMLTemplate(req.params.customer, req.params.formId, 'response')
    .then(async responseHTML => {
      if (!responseHTML) throw new Error('Empty response HTML');
      const postData = req.body;
      const { website, captcha_answer, captcha_token } = postData;

      const result = utils.validateCaptcha({
        token: captcha_token,
        userAnswer: captcha_answer,
        honeypot: website,
      });

      if (!result.ok) {
        // Geef een generieke fout, niet de exacte reden (anti-enumeratie)
        return res.redirect(`/form/${req.params.customer}/${req.params.formId}?error=${encodeURIComponent(`Validatie mislukt, <a href="/form/${req.params.customer}/${req.params.formId}">probeer het opnieuw</a>.`)}`);
      }

      let validator;
      try {
        validator = await utils.importValidatorModule(req.params.customer, req.params.formId)
      } catch (err) {
        return res.send(`Failed to load validator module: <pre><code>${err instanceof Error ? err.message : String(err)}</code></pre>`);
      }
      
      if (validator) {
        const validationErrors = validator(postData);
        if (validationErrors) {
          console.log('Validation errors:', validationErrors);
          // Load the form again with error messages:
          req.validationErrors = validationErrors;
          return loadForm(req, res);
        }
      }

      // Vervang placeholders in de response HTML
      Object.keys(postData).forEach(key => {
        const placeholder = new RegExp(`{{ ?${key} ?}}`, 'g');
        responseHTML = responseHTML.replace(placeholder, postData[key]);
      });
      // verstuur mail:
      const mailText = Object.keys(postData)
        .filter(key => !['captcha_answer', 'captcha_token', 'website'].includes(key))
        .map(key => `${key}: ${postData[key]}`).join('\n');
      const mailHtml = '<ul>' + Object.keys(postData)
        .filter(key => !['captcha_answer', 'captcha_token', 'website'].includes(key))
        .map(key => `<li><strong>${key}:</strong> ${postData[key]}</li>`).join('\n') + '</ul>';
      const customerConfig = utils.getCustomer(req.params.customer);
      const formConfig = utils.getFormConfig(customerConfig, req.params.formId);
      await utils.sendEmail({
        from: customerConfig.mailFrom,
        to: customerConfig.mailTo,
        subject: formConfig.mailSubject,
        text: mailText,
        html: mailHtml,
      })
      .then(() => res.send(responseHTML))
      .catch(err => {
        res.send('Failed to send email.');
        console.error('Error sending email:', err);
      });

    })
    .catch(err => {
      console.error(err);
      res.status(500).send('Error fetching the form response');
    });
}
/**
 * Middleware to set CSP frame-ancestors header based on allowed domains.
 * 
 * @param {import("express").Request} req 
 * @param {import("express").Response} res 
 * @param {import("express").NextFunction} next 
 */
export function setFrameAncestors(req, res, next) {
  const frameAncestors = utils.getAllowedDomains().join(' ');
  res.setHeader(
    'Content-Security-Policy',
    `frame-ancestors ${frameAncestors};`
  );
  next();
}

/**
 * Middleware to check the Origin header against allowed domains.
 * 
 * @param {import("express").Request} req 
 * @param {import("express").Response} res 
 * @param {import("express").NextFunction} next 
 * @returns 
 */
export function checkOrigin(req, res, next) {
  const allowedDomains = utils.getAllowedDomains();
  const origin = req.headers.origin;

  // Requests zonder Origin of Origin null moeten worden toegestaan
  // (vooral bij POST vanuit een iframe)
  if (!origin || origin === 'null') {
    return next();
  }

  if (origin && !allowedDomains.includes(origin)) {
    console.log(`Blocked request from origin: ${origin}`);
    return res.status(403).send('Embedding not allowed');
  }

  next();
}

/** 404 Error Handler
 * 
 * @param {import("express").Request} req 
 * @param {import("express").Response} res 
 */
export function e404Handler(req, res) {
  res.status(404).type('html').send(`<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <title>Pagina niet gevonden</title>
  <style>
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f5f5f5;
      color: #333;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
    }
    .wrapper {
      text-align: center;
      padding: 2rem;
      background: #fff;
      border: 1px solid #ddd;
      border-radius: 6px;
    }
    h1 {
      margin: 0 0 0.5rem;
      font-size: 2rem;
    }
    p {
      margin: 0.25rem 0;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <h1>404</h1>
    <p>Page not found.</p>
  </div>
</body>
</html>`);
}
