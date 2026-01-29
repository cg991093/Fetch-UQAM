import fs from 'fs/promises';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';
import chalk from 'chalk';

/**
 * Waits for a page to fully load before resuming
 *
 * @param {Page} page -  Broswer page the scraper is currently waiting on
 */
const waitTillHTMLRendered = async (page, timeout = 3000) => {
  const checkDurationMsecs = 1000;
  const maxChecks = timeout / checkDurationMsecs;
  let lastHTMLSize = 0;
  let checkCounts = 1;
  let countStableSizeIterations = 0;
  const minStableSizeIterations = 3;

  while (checkCounts++ <= maxChecks) {
    let html = await page.content();
    let currentHTMLSize = html.length;

    if (lastHTMLSize != 0 && currentHTMLSize == lastHTMLSize)
      countStableSizeIterations++;
    else
      countStableSizeIterations = 0; //reset the counter

    if (countStableSizeIterations >= minStableSizeIterations) {
      console.log("Page rendered fully...");
      break;
    }

    lastHTMLSize = currentHTMLSize;
    await new Promise(r => setTimeout(r, checkDurationMsecs));
  }
};

/**
 * 
 *
 */
export async function scrape(login, pass) {

  // Start browser
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-sync',
      '--disable-translate',
      '--disable-features=Translate',
      '--metrics-recording-only',
      '--no-first-run'
    ]
  });
  const page = await browser.newPage();

  // Remove translate dialog and others
  page.on('dialog', async dialog => {
    await dialog.dismiss();
  })

  try {
    // Navigate to login page
    await page.goto('https://monportail.uqam.ca/dashboard', {
      waitUntil: 'networkidle2'
    });

    //Fill login
    await page.waitForSelector('input[name=codePermanent]', { visible: true });
    await page.type('input[name=codePermanent]', login);
    await page.keyboard.press('Tab');
    await page.keyboard.type(pass);

    console.log(chalk.rgb(0, 100, 255).bold("Hacking uqam database..."));

    //await page.screenshot({ path: 'before-submit.png', fullPage: true });

    // Submit and wait for navigation
    await page.click('button[type="submit"] span');
    console.log(chalk.rgb(20, 100, 255).bold("Comparing q-bits..."));

    //Verify successful login
    try {
      await page.waitForSelector('nav[class="row navbar"]', { timeout: 10000 });
    } catch (error) {
      throw new Error('Login failed');
    }

    // TODO: Need to find quicker way
    await waitTillHTMLRendered(page);

    //await page.screenshot({ path: 'after-submit.png', fullPage: true });

    // Navigate to grades
    await page.goto('https://monportail.uqam.ca/resultats', {
      waitUntil: 'networkidle2'
    });

    console.log(chalk.rgb(40, 100, 255).bold("Bribing the dean..."));

    await waitTillHTMLRendered(page);

    console.log(chalk.rgb(60, 100, 255).bold("Compiling Vulkan shaders..."));

    //await page.screenshot({ path: 'page-resultat-unclicked.png', fullPage: true });

    // Click all buttons
    const buttons = await page.$$('button[class*="btn-info"]');

    //await page.screenshot({ path: 'array-done', fullPage: true });

    for (const button of buttons) {
      await page.evaluate(el => el.click(), button);
    }

    console.log(chalk.rgb(80, 100, 255).bold("Quick reddit break..."));

    await waitTillHTMLRendered(page);

    //await page.screenshot({ path: 'page-resultat.png', fullPage: true });

    // Parse whole page content 
    const html = await page.content();
    const $ = cheerio.load(html);

    //Identify whole classes and push to array
    const classes = [];
    const classesTr = $('tr[ng-show="!impressionReleve"]');
    classesTr.each((i, singleClass) => {
      // Course name 
      let classNumber = $(singleClass).find('h4').first().text().trim();
      classNumber = classNumber.slice(23, 30);

      // Grades
      const evaluations = [];
      const evaluationsTr = $(singleClass).find('tbody tr');
      evaluationsTr.each((j, evaluation) => {

        //Grades per evaluation (individual, group, ecart-type)
        const assessment = [];
        const gradesTr = $(evaluation).find('td');
        gradesTr.each((k, grade) => {
          const gradeRaw = $(grade).text().trim();
          assessment.push({ gradeRaw });

        });
        evaluations.push({ assessment });
      });
      classes.push({ classNumber, evaluations });
    });

    //console.log(JSON.stringify(classes, null, 2));
    await fs.writeFile('data/all_grades.json', JSON.stringify(classes, null, 2));

  } catch (error) {
    console.error('Scraping error: ', error);
    throw error;
  } finally {
    await browser.close();
  }
}
