require('dotenv').config()

module.exports = {
  SPREADSHEET_ID: process.env.SPREADSHEET_ID,
  VERSION: process.env.VERSION,
  COMPARE_VERSION: process.env.COMPARE_VERSION,
  TITLE: process.env.TITLE,
  BASE_DATA_PATH: process.env.BASE_DATA_PATH,
  G10_CAPACITY: 6,
  PATHS: {
    OUTPUT: `./out/result.${process.env.VERSION}.json`,
    LAST_OUTPUT: `./out/result.${process.env.COMPARE_VERSION}.json`,
    KEY_FILE: './.env.key.json'
  },
  TIMEZONE: 'Asia/Hong_Kong'
}
