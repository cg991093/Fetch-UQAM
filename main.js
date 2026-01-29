#!/usr/bin/env node

import fs from 'fs/promises';
import { input, select, password } from '@inquirer/prompts';
import { readFileSync, rmSync } from 'node:fs';
import actionSelect from 'inquirer-action-select';
import figlet from 'figlet';
import { instagram } from 'gradient-string';
import chalk from 'chalk';
import { scrape } from './scrape.js';
import { parseGrades } from './visualizer.js';

let hasSavedClasses = false;
let loginInfo = {};
let courses = [];
let mainMenuMessage = "";

figlet.preloadFonts(["Terrace"], ready);

/**
 * Calls the main menu to start up the program, only called when ASCII art is fully loaded
 */
function ready() {
  showMainTitle();
}

/**
 * Arranges a full string for each assessment inside a course
 *
 * @param {String} courseAnswer -   User input of class Code to add to global courses array
 * @returns {bool} -                True if class was added, False if already existing in courses
 */
async function addNewCourse(courseAnswer) {
  courseAnswer = courseAnswer.toUpperCase();
  if (courses.includes(courseAnswer)) {
    console.log(chalk.rgb(255, 0, 0).bold("This class is already tracked!\n"));
    return false;
  } else {
    courses.push(courseAnswer);
    hasSavedClasses = true;
    console.log(chalk.rgb(0, 255, 0).bold("Successfully added " + courseAnswer + " to the tracked classes\n"));
    return true;
  }
}

/**
 * Saves a new tracked_courses.JSON if totalClassesAdded > 1
 * Also changes the menu message accordingly
 *
 * @param {int} totalClassesAdded -   Number of class codes that have been added to the courses Array
 */
async function saveCourses(totalClassesAdded) {
  if (totalClassesAdded === 0) {
    mainMenuMessage = chalk.rgb(255, 0, 0).bold('No new classes to track.\n');
  } else {
    await fs.writeFile('./data/tracked_courses.json', JSON.stringify(courses, null, 2));
    mainMenuMessage = chalk.rgb(0, 255, 0).bold('Saved ' + totalClassesAdded + ' new classes to track!\n');
  }
}

/**
 * Prompts the user to add new class codes. Calls functions to add valid classes to the courses Array
 */
async function promptNewClasses() {
  let totalClassesAdded = 0;

  while (1) {
    if (courses.length > 4) {
      mainMenuMessage = chalk.rgb(0, 255, 255).bold('Maximum tracked classes reached!\nRemove classes to add more');
      return;
    }
    const courseAnswer = await input({
      message: 'New class (Leave empty if finished): ',
      pattern: /^$|^[A-Za-z][A-Za-z][A-Za-z][0-9][0-9][0-9][0-9]$/,
      patternError: 'Invalid class code! (example: ABC1234)',
    });

    if (courseAnswer === "" || courseAnswer === "0") {
      await saveCourses(totalClassesAdded);
      return;
    } else {
      if (await addNewCourse(courseAnswer, totalClassesAdded)) {
        totalClassesAdded++;
      }
    }
  }
}

/**
 * Saves the user inputted login info to loginInfo object, and writes it in login.JSON file
 *
 * @param {String} permanentCodep -   Inputted student permanent code
 * @param {int} PINp -                Inputted student PIN code
 */
async function saveUserLogin(permanentCodep, PINp) {

  try {
    permanentCodep = permanentCodep.toUpperCase();
    loginInfo.permanentCode = permanentCodep;
    loginInfo.PIN = PINp;
    await fs.writeFile('./data/login.json', JSON.stringify(loginInfo, null, 2));
    mainMenuMessage = chalk.rgb(0, 255, 0).bold('Saved new login info!\n');
  } catch {
    throw new Error("Error, couldn't save new login file");
  }
}

/**
 * Prompts the user for their login info while matching the regex, continues until valid
 */
async function promptUserLogin() {
  let permanentCode;
  let PIN;
  let validPin = false;
  console.log(chalk.rgb(0, 255, 255).bold('Login data saved at data/login.json\nTo cancel, keep field empty and submit\n'));

  // Get Permanent code
  permanentCode = await input({
    message: 'Code Permanent: ',
    pattern: /^$|^[A-Za-z][A-Za-z][A-Za-z][A-Za-z][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]$/,
    patternError: 'Invalid permanent code! (example: ABCD12345678)',
  });

  if (permanentCode === "" || permanentCode === "0") {
    mainMenuMessage = chalk.rgb(255, 0, 0).bold('Canceled new login!\n');
    return;
  }

  // Get PIN
  while (!validPin) {
    PIN = await password({ message: 'NIP (leave empty to cancel: ' });
    if (!PIN.match(/^[0-9][0-9][0-9][0-9][0-9]$/)) {
      if (PIN === "" || PIN === "0") {
        mainMenuMessage = chalk.rgb(255, 0, 0).bold('Canceled new login!\n');
        return;
      }
      console.log("Invalid login format (ex:01234)");
    } else {
      validPin = true;
    }
  }
  await saveUserLogin(permanentCode, PIN);
}

/**
 * Removes a given course from the courses Array, updates the tracked_course.JSON
 *
 * @param {String} courseName -   Course code of the course to remove in the courses Array
 */
async function removeCourse(courseName) {
  const courseIndex = courses.indexOf(courseName);
  if (courseIndex > -1) {
    courses.splice(courseIndex, 1);
    mainMenuMessage = chalk.rgb(0, 255, 0).bold('Successfully removed ' + courseName + ' from tracked classes\n');
    if (courses.length === 0) {
      await fs.rm('./data/tracked_courses.json');
      hasSavedClasses = false;
    } else {
      await fs.writeFile('./data/tracked_courses.json', JSON.stringify(courses, null, 2));
    }
  }
}

/**
 * Lets the user edit a given course, and updates the tracked_courses.JSON
 *
 * @param {String} courseName -   Course code of the course to edit in the courses Array
 */
async function editCourse(courseName) {
  console.log(chalk.rgb(0, 255, 255)('\nEditing: ' + courseName + "\n"));

  const editedCourse = await input({
    message: 'Edited class (Leave empty to cancel): ',
    default: courseName,
    prefill: 'editable',
    pattern: /^[A-Za-z][A-Za-z][A-Za-z][0-9][0-9][0-9][0-9]$/,
    patternError: 'Invalid class code! (example: ABC1234)',
  });

  if (editedCourse === courseName) {
    mainMenuMessage = chalk.rgb(0, 255, 255).bold('No changes made!\n');
    return;
  } else if (courses.includes(editedCourse)) {
    mainMenuMessage = chalk.rgb(0, 255, 255).bold('Can\'t edit to an already tracked course! Edit cancelled\n');
  } else {
    const oldCourseIndex = courses.indexOf(courseName);
    courses.splice(oldCourseIndex, 1, editedCourse);
    await fs.writeFile('./data/tracked_courses.json', JSON.stringify(courses, null, 2));
  }
}

/**
 * Shows a menu to the user listing all their tracked courses, offers options to delete or edit courses
 */
async function manageClasses() {
  if (courses.length === 0) {
    mainMenuMessage = chalk.rgb(255, 0, 0).bold('No tracked classes saved!\n');
    return;
  }

  const coursesChoices = courses.map(course => ({
    value: course,
    name: course
  }));

  const answer = await actionSelect.default({
    message: 'Choose a class',
    actions: [
      { value: 'edit', name: 'Edit', key: 'e' },
      { value: 'delete', name: 'Delete', key: 'x' }
    ],
    choices: coursesChoices
  });

  switch (answer.action) {
    case 'delete':
      await removeCourse(answer.answer);
      break;
    case 'edit':
      await editCourse(answer.answer);
      break;
  }
}

/**
 * rm -f the three JSON files in ./data containing all saved login info and grades, while also resetting all global variables
 */
async function deleteAllSavedInfo() {
  rmSync("./data/login.json", { force: true });
  rmSync("./data/tracked_courses.json", { force: true });
  rmSync("./data/all_grades.json", { force: true });
  hasSavedClasses = false;
  loginInfo = {};
  courses = [];
  mainMenuMessage = chalk.rgb(0, 255, 0).bold('All saved info deleted!\n');
}

/**
 * Offers all available options to user to navigate through
 */
async function showMainMenu() {

  const mainMenuAnswer = await select({
    message: 'Select an option',
    choices: [
      {
        name: 'Scrape grades',
        value: 'Scrape grades',
      },
      {
        name: 'Set new login',
        value: 'Set new login',
      },
      {
        name: 'Track new classes',
        value: 'Track new classes',
      },
      {
        name: 'Manage classes',
        value: 'Manage classes',
      },
      {
        name: 'Reset All',
        value: 'Reset All',
      },
      {
        name: 'Quit',
        value: 'Quit',
      },
    ],
  });

  switch (mainMenuAnswer) {
    case 'Quit':
      mainMenuMessage = "\nQuit\n";
      return;
    case 'Set new login':
      await promptUserLogin();
      break;
    case 'Scrape grades':
      if (!loginInfo.permanentCode || !loginInfo.PIN || courses.length < 1) {
        mainMenuMessage = "Pas de login trouvé et/ou pas de classes trackee\n"
        break;
      } else {
        await scrape(loginInfo.permanentCode, loginInfo.PIN);
        await parseGrades(courses);
        break;
      }
    case 'Track new classes':
      await promptNewClasses();
      break;
    case 'Manage classes':
      await manageClasses();
      break;
    case 'Reset All':
      await deleteAllSavedInfo();
  }
}

/**
 * Shows the main menu header showing info about any saved course or login info
 * Also shows a mainMenuMessage string that all functions can edit themselves before calling this function
 */
async function showMainTitle() {

  try {
    const loginData = readFileSync('./data/login.json', 'utf8')
    loginInfo = JSON.parse(loginData);
  } catch (err) {
  }

  try {
    const courseData = readFileSync('./data/tracked_courses.json', 'utf8')
    courses = JSON.parse(courseData);
    hasSavedClasses = true;
  } catch (err) {
  }

  while (1) {
    console.clear();
    const title = "fuqam";
    const titleScreen = figlet.textSync(title, { font: "Terrace" });
    console.log(instagram.multiline(titleScreen));

    if (mainMenuMessage !== "") {
      if (mainMenuMessage === "\nQuit\n") return;
      console.log(mainMenuMessage) + "\n";
      mainMenuMessage = "";
    } else {
      console.log("\n");
    }

    // Print saved info
    if (loginInfo.permanentCode) {
      console.log(chalk.bold("Login info: \t\t") + loginInfo.permanentCode);
    } else {
      console.log(chalk.bold("Login info: \t\t") + "None");
    }
    if (hasSavedClasses) {
      console.log((chalk.bold("Currently tracking: \t")) + courses + "\n");
    } else {
      console.log(chalk.bold("Currently tracking: \t0 classes\n"));
    }

    await showMainMenu();
  }
}


//showMainMenu();
//await scrape();
