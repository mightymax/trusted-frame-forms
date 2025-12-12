import express from 'express';
import helmet from 'helmet';
import * as middlewares from './middlewares.js';
import * as dotenv from 'dotenv';
 
dotenv.config();


express()
// Gebruik helmet maar zonder X-Frame-Options
  .use( helmet({ frameguard: false }))

  // Verwijder X-Frame-Options als fallback
  .use((req, res, next) => {
    res.removeHeader('X-Frame-Options');
    next();
  })

  .use(middlewares.setFrameAncestors)

  // Form
  /**
   * Serve the requested HTML form template with captcha placeholders filled in.
   */
  .get('/form/:customer/:formId', middlewares.loadForm)

  /**
   * Handle a submitted form: validate captcha, send email, and render response HTML.
   */
  .post('/submit/:customer/:formId', express.urlencoded({ extended: false }), middlewares.handleFormSubmission)

  //The 404 Route (ALWAYS Keep this as the last route)
  .use(middlewares.e404Handler)
  
  // Start server
  .listen(3000, () => {
    console.log('Server running on http://localhost:3000');
  });
