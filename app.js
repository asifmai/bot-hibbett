const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const RecaptchaPlugin = require('puppeteer-extra-plugin-recaptcha');
const {siteLink, recaptchaKey, proxy} = require('./keys');
const accountDetails = require('./keys').account;
const axios = require('axios');

const run = () => new Promise(async (resolve, reject) => {
  try {
    // Configure Puppeteer to use stealth plugin and recaptcha plugin
    configurePuppeteer();

    console.log('Bot Started...');
    await createAccount(accountDetails)
    console.log('Bot Finished...');
    resolve(true);
  } catch (error) {
    console.log(`Bot Run Error: ${error}`);
    reject(error);
  }
})

const createAccount = (account) => new Promise(async (resolve, reject) => {
  try {
    const browser = await puppeteer.launch({
      headless: false,
      // args: [
      //   `--proxy-server=${proxy.ip}:${proxy.port}`
      // ]
    });

    // Launch Page and Goto siteLink
    console.log('Loading site...');
    const page = await browser.newPage();
    // await page.authenticate({username: proxy.user, password: proxy.password});
    await page.goto(siteLink, {timeout: 0, waitUntil: 'networkidle2'});

    // Wait for input fields
    console.log('Filling fields...');
    await page.waitForSelector('form.registration-form input#dwfrm_profile_customer_firstname');

    // Fill the Fields
    await page.type('form.registration-form input#dwfrm_profile_customer_firstname', accountDetails.firstName, {delay: 50});
    await page.type('form.registration-form input#dwfrm_profile_customer_lastname', accountDetails.lastName, {delay: 50});
    await page.type('form.registration-form input#dwfrm_profile_customer_email', accountDetails.email, {delay: 50});
    await page.type('form.registration-form input#dwfrm_profile_customer_emailconfirm', accountDetails.email, {delay: 50});
    await page.type('form.registration-form input#dwfrm_profile_login_password', accountDetails.password, {delay: 50});
    await page.type('form.registration-form input#dwfrm_profile_login_passwordconfirm', accountDetails.password, {delay: 50});
    await page.type('form.registration-form input#dwfrm_profile_customer_phone', accountDetails.phone, {delay: 50});

    await page.evaluate(() => {
      document.querySelector("form.registration-form input#dwfrm_profile_customer_agreetoage").checked = true;
    });
    await page.evaluate(() => {
      document.querySelector("form.registration-form input#dwfrm_profile_customer_agreetoterm").checked = true;
    });
    await page.evaluate(() => {
      document.querySelector("form.registration-form input#dwfrm_profile_customer_addtoemaillist").checked = true;
    });

    // Solve Recaptcha
    console.log('Solving reCaptcha');
    await solveRecaptcha(page);

    // Click Create Account Button
    console.log('Submitting Form...');
    await page.click('form.registration-form button#relate-add-or-update');
    await page.waitFor(5000);

    // Fill Details
    console.log('Filling Other Details...');
    await page.waitForSelector('form.account-main-form input#dwfrm_profileinfo_address_address1');

    await page.type('form.account-main-form input#dwfrm_profileinfo_address_address1', accountDetails.address1, {delay: 50});
    await page.type('form.account-main-form input#dwfrm_profileinfo_address_address2', accountDetails.address2, {delay: 50});
    await page.type('form.account-main-form input#dwfrm_profileinfo_address_city', accountDetails.city, {delay: 50});
    await page.select('form.account-main-form select#dwfrm_profileinfo_address_states_state', accountDetails.state);
    await page.type('form.account-main-form input#dwfrm_profileinfo_address_postal', accountDetails.zipcode, {delay: 50});
    await page.select('form.account-main-form select#dwfrm_profileinfo_profile_birthmonth', accountDetails.birthdayMonth);

    console.log('Submitting Form');
    await page.click('form.account-main-form button[type="submit"]');
    await page.waitFor(5000);

    // Check if form Submitted
    const loggedIn = await page.$('.user-links a[href="https://www.hibbett.com/orders"]');
    if (loggedIn) {
      await browser.close();
      console.log('Account Created...');
      resolve(true);
    } else {
      await browser.close();
      console.log('Failed...');
      resolve(false);
    }
  } catch (error) {
    if (browser) await browser.close();
    console.log(`createAccount[${account.email}] Error: `, error);
    resolve(false);
  }
});

const solveRecaptcha = (page) => new Promise(async (resolve, reject) => {
  try {
    const dataSiteKey = await page.$eval('.g-recaptcha', elm => elm.getAttribute('data-sitekey'));
    const res = await axios.get(`https://2captcha.com/in.php?key=${recaptchaKey}&method=userrecaptcha&googlekey=${dataSiteKey}&pageurl=https://www.hibbett.com/register&json=1`);
    const captchaRequestId = res.data.request;
    // console.log(`capcha id: ${captchaRequestId}`);
    let res2;
    do {
      await page.waitFor(15000);
      res2 = await axios.get(`https://2captcha.com/res.php?key=${recaptchaKey}&action=get&id=${captchaRequestId}&json=1`);
    } while (res2.data.request == 'CAPCHA_NOT_READY');
    const capchaSolution = res2.data.request;
    // console.log(capchaSolution);
    await page.evaluate((captchaSolution) => {
      document.querySelector('textarea#g-recaptcha-response').style.display = 'block';
      document.querySelector('textarea#g-recaptcha-response').innerHTML = captchaSolution;
    }, capchaSolution)

    resolve(true);
  } catch (error) {
    console.log('solveRecaptcha Error: ', error);
    reject(error);
  }
});

function configurePuppeteer () {
  puppeteer.use(StealthPlugin());
  // puppeteer.use(
  //   RecaptchaPlugin({
  //     provider: {
  //       id: '2captcha',
  //       token: recaptchaKey
  //     },
  //     visualFeedback: true
  //   })
  // );
}

run();