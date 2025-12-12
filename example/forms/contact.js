/**
 * 
 * @param {*} data 
 * @returns {Object|null} Validation errors or null if valid.
 */
export default function validate(data) {
  const errors = {}
  if (data.name === 'John' && data.surname === 'Doe') {
    errors.name = 'John ( with Doe) is not allowed.'
    errors.surname = 'Doe is not allowed.'
  }
  if (data.company === 'Acme Inc') {
    errors.company = 'Acme Inc is not allowed.'
  }
  if (data.email && !validateEmail(data.email)) {
    errors.email = 'Invalid email address.'
  }

  return Object.keys(errors).length ? errors : null
}

/**
 * 
 * @param {string} email 
 * @returns {boolean} Whether the email is valid.
 */
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}
