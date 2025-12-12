import jwt from 'jsonwebtoken';
import { createTransport } from "nodemailer";
import fs from 'fs/promises';
import crypto from 'node:crypto';
import customers from './customers.js';

const CAPTCHA_SECRET = process.env.CAPTCHA_SECRET || 'supersecret';

/**
 * Generate a simple math captcha and wrap it in a signed JWT token.
 * @returns {{token: string, question: string}} A signed token and the question text.
 */
export function generateCaptchaToken() {
  const a = Math.floor(Math.random() * 5) + 1; // 1–5
  const b = Math.floor(Math.random() * 5) + 1; // 1–5
  const question = `${a} + ${b}`;
  const answer = a + b;

  const payload = {
    question,
    answer,
    createdAt: Date.now(),
  };

  const token = jwt.sign(payload, CAPTCHA_SECRET, { expiresIn: '30m' });

  return { token, question };
}

/**
 * Validate the captcha: honeypot, token integrity, timing, and answer.
 * @param {{token: string, userAnswer: string, honeypot: string}} params Signed token, user answer, and hidden honeypot field.
 * @returns {{ok: boolean, reason?: 'honeypot' | 'invalid_token' | 'invalid_payload' | 'too_fast' | 'too_old' | 'wrong_answer'}} Result flag and optional failure reason.
 */
export function validateCaptcha({ token, userAnswer, honeypot }) {
  if (honeypot && honeypot.trim() !== '') {
    // Bot heeft verborgen veld ingevuld
    return { ok: false, reason: 'honeypot' };
  }

  let payload;
  try {
    payload = jwt.verify(token, CAPTCHA_SECRET);
  } catch (e) {
    console.error('Captcha token invalid:', token, e);
    return { ok: false, reason: 'invalid_token' };
  }

  if (!payload || typeof payload !== 'object' || !payload.answer || !payload.createdAt) {
    return { ok: false, reason: 'invalid_payload' };
  }

  const now = Date.now();
  const minMs = 2000;      // min. 2 seconden
  const maxMs = 30 * 60e3; // max. 30 minuten
  const age = now - payload.createdAt;

  if (age < minMs) {
    return { ok: false, reason: 'too_fast' };
  }
  if (age > maxMs) {
    return { ok: false, reason: 'too_old' };
  }

  const expected = Number(payload.answer);
  const given = Number(userAnswer);

  if (!Number.isFinite(given) || given !== expected) {
    return { ok: false, reason: 'wrong_answer' };
  }

  return { ok: true };
}


/**
 * Send an email using the configured SMTP transport.
 * @param {MailPayload} mail
 * @returns {Promise<import('nodemailer').SentMessageInfo>} Nodemailer send result.
 */
export async function sendEmail(mail) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new Error("SMTP configuration is missing");
  }
  const transporter = createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: SMTP_SECURE === 'true',
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  return transporter.sendMail(mail);
}

/**
 * Imports and loads a validator module from a remote URL.
 * 
 * @async
 * @typedef {(data: object) => Record<string, string> | null} ValidatorFn
 * @function importValidatorModule
 * @param {string} customerId - ID of the customer
 * @param {string} formId - ID of the form
 * @returns {Promise<ValidatorFn|null>} The default export of the validator module, or null if no validator is configured
 * @throws {Error} Throws an error if the validator module cannot be fetched
 * @description Fetches JavaScript code from a remote validator URL, creates a blob URL, 
 * dynamically imports the module, and returns its default export. Cleans up the blob URL after import.
 */
export async function importValidatorModule(customerId, formId) {
  const customerConfig = getCustomer(customerId);
  const formConfig = getFormConfig(customerConfig, formId);
  if (!formConfig.validator) {
    return null;
  }
  const validatorUrl = new URL(formConfig.validator, customerConfig.formServer);
  const hashedFileName =  crypto.createHash('md5').update(validatorUrl.toString(), 'utf8').digest('hex');
  console.log(`Importing validator module from: ${validatorUrl}`);
  return fetch(validatorUrl)
    .then(res => {
      if (!res.ok) throw new Error(`Failed to fetch validator module at ${validatorUrl}: ${res.status} ${res.statusText}`);
      return res.text();
    })
    .then(moduleCode => fs.writeFile(`/tmp/${hashedFileName}.mjs`, moduleCode))
    .then(() => import(`/tmp/${hashedFileName}.mjs`))
    .then(module => module.default)
} 

/**
 * 
 * @param {string} customerId 
 */
export function getCustomer(customerId) {
  const customerConfig = customers[customerId];
  if (!customerConfig) throw new Error('Customer not found');
  return customerConfig;
}

/** 
 * 
 * @param {CustomerConfig} customerConfig 
 * @param {string} formId 
 */
export function getFormConfig(customerConfig, formId) {
  const formConfig = customerConfig.forms[formId];
  if (!formConfig) throw new Error('Form not found');
  return formConfig;
}


/**
 * 
 * @param {string} customerId 
 * @param {string} formId 
 * @param {'form' | 'response'} type
 * @returns 
 */
export async function loadHTMLTemplate(customerId, formId, type) {
  const customerConfig = getCustomer(customerId)
  const formConfig = getFormConfig(customerConfig, formId);
  const formPath = formConfig[type];
  if (!formPath) {
    throw new Error(`Form not found: ${customerId}/${formId}`);
  }

  const formUrl = new URL(formPath, customerConfig.formServer);
  console.log(`Loading HTML from: ${formUrl}`);
  return fetch(formUrl)
    .then(formRes => {
      if (!formRes.ok) throw new Error(`Failed to fetch HTML at ${formUrl}: ${formRes.status} ${formRes.statusText}`);
      return formRes.text();
    })
}

/** All allowed frame ancestors collected from customer configs. */
export function getAllowedDomains() {
  return Object.keys(customers).flatMap(customer => customers[customer].domains);
}

  // const formPath = customerConfig.forms[req.params.formId].form;
  // if (!formPath) {
  //   return res.status(404).send(`Form not found: ${req.params.customer}/${req.params.formId}`);
  // }

  // const formUrl = new URL(formPath, customerConfig.formServer);
  
