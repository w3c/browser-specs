import { readFile } from 'node:fs/promises';

/**
 * Load a JSON file as JS object.
 *
 * @function
 * @param {String} filename The path to the file to require
 * @return {Object} The result of loading and parsing the file relative to the
 *   current working directory.
 */
export default async function (filename) {
  try {
    const json = await readFile(filename, 'utf8');
    return JSON.parse(json);
  }
  catch (err) {
    return null;
  }
}
