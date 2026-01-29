import Table from 'cli-table3';
import chalk from 'chalk';
import { readFileSync } from 'node:fs';


/**
 * Blocks the program from progressing and listens for a keypress to continue
 */
const keypress = async () => {
  process.stdin.setRawMode(true)
  process.stdin.resume();
  return new Promise(resolve => process.stdin.once('data', () => {
    process.stdin.setRawMode(false)
    resolve()
  }))
}

/**
 * Arranges a full string for each assessment inside a course
 * These are the strings that will be put on the final table shown to user
 *
 * @param {Array} gradePresentations -  An array containing one course per cell
 * @param {String} evaluations -        The individual class structure
 */
async function buildString(gradePresentations, evaluations) {
  // Stringbuilder
  let gradePresentation = [];
  gradePresentation += (chalk.bold(evaluations.classNumber + ": \n"));

  // Get the evaluations
  const allGrades = evaluations.evaluations;

  // Keep track of total grades
  let totalPerso = 0;
  let totalMoyenne = 0;
  let totalEvals = 0;

  // Build a string for each valuations, add to totals
  allGrades.forEach(singleGrade => {
    // singleGrade : an object like { assessment: [...] }
    if (singleGrade.assessment.length > 0) {
      gradePresentation += (chalk.rgb(0, 150, 255).bold(singleGrade.assessment[0].gradeRaw) + "\nNote: " + singleGrade.assessment[1].gradeRaw + "   Moyenne: " + singleGrade.assessment[2].gradeRaw + "   E/C: " + singleGrade.assessment[3].gradeRaw + "\n");
      totalPerso += parseFloat(singleGrade.assessment[4].gradeRaw.replace(',', '.').split('/'));
      totalMoyenne += parseFloat(singleGrade.assessment[4].gradeRaw.replace(',', '.').split('/')[1]);
      totalEvals += parseFloat(singleGrade.assessment[5].gradeRaw.replace(',', '.').split('/'));
    }
  });

  //String formatting
  totalPerso = totalPerso.toFixed(2);
  totalEvals = totalEvals.toFixed(2);
  totalMoyenne = totalMoyenne.toFixed(2);
  gradePresentation += ("\nRésultats pondérés:     " + totalPerso + "/" + totalMoyenne + "\nMoyenne pondérée:       " + totalEvals + "/" + totalMoyenne + "\n");
  gradePresentations.push(gradePresentation)
}

/**
 * Creates a 2x2 array consisting of every general class string previously created
 *
 * @param {Array} gradePresentations -  An array containing one course per cell
 * @param {Array} finalTable -          The same array in 2x2 format
 */
async function makeArray2x2(finalTable, gradePresentations) {
  const tableChunkSize = 2;
  for (let i = 0; i < gradePresentations.length; i += tableChunkSize) {
    const chunk = gradePresentations.slice(i, i + tableChunkSize);
    while (chunk.length < tableChunkSize) {
      chunk.push("");
    }
    finalTable.push(chunk);
  }
}

/**
 * Calls various function to create a populate a table containing every 
 * tracked grades, prints the final table
 *
 * @param {Array} trackedGrades -  An array containing all the courses tracked by user
 */
async function printTrackedGrades(trackedGrades) {
  if (trackedGrades.length === 0) {
    console.log(chalk.rgb(255, 0, 0).bold("\nNo grades yet"));
    console.log("\nPress a key to go back to main menu\n");
    await keypress();
  } else {
    const tableInstance = new Table({
      colWidths: [50, 50]
    });
    const gradePresentations = [];
    const finalTable = [];

    // Create a complete string for each tracked courses
    trackedGrades.forEach(evaluations => {
      buildString(gradePresentations, evaluations);
    });

    makeArray2x2(finalTable, gradePresentations);

    // Put everything in Table object and print
    finalTable.forEach(row => tableInstance.push(row));  // Add each row
    console.log(tableInstance.toString());
    console.log("\nPress a key to go back to main menu\n");
    await keypress();
  }
}

/**
 * Calls various function to create a populate a table containing every 
 * tracked grades, prints the final table
 *
 * @param {Array} scrapedGrades -       An array containing all fetched grades from user
 * @param {Array} userTrackedGrades -   An array containing all the courses tracked by user
 */
async function retainAndPrintTrackedGrades(scrapedGrades, userTrackedGrades) {
  let trackedGrades = [];
  scrapedGrades.forEach(course => {
    if (userTrackedGrades.includes(course.classNumber)) {
      trackedGrades.push(course);
    }
  });
  await printTrackedGrades(trackedGrades);
}

/**
 * Locates and scrapes a local JSON file fonctain grades, prints the relevant info from it
 *
 * @param {Array} userTrackedGrades -   An array containing all the courses tracked by user
 */
export async function parseGrades(userTrackedGrades) {
  const rawGrades = readFileSync('./data/all_grades.json', 'utf8')
  const scrapedGrades = JSON.parse(rawGrades);
  await retainAndPrintTrackedGrades(scrapedGrades, userTrackedGrades);
}


