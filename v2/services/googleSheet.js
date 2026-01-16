const { google } = require('googleapis')
const { DateTime } = require('luxon')
const _ = require('lodash')
const config = require('../config')

const sheets = google.sheets('v4')

function convertRowsToCollection(rows) {
  if (!rows || rows.length === 0) return []
  const headers = rows.shift()
  return rows.map((row) => {
    return row.reduce((prev, cell, n) => {
      // Handle case where row length < headers length (empty trailing cells)
      if (headers[n]) {
        prev[headers[n]] = cell
      }
      return prev
    }, {})
  })
}

async function getAuth() {
  const client = new google.auth.GoogleAuth({
    keyFile: config.PATHS.KEY_FILE,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/admin.directory.resource.calendar.readonly',
      'https://www.googleapis.com/auth/gmail.send'
    ]
  })

  const cachedClient = await client.getClient()
  cachedClient.subject = 'schooladmin@liping.edu.hk'
  return cachedClient
}

async function batchUpdateSpreadsheet(spreadsheetId, headerRange, rowObjects) {
  try {
    const auth = await getAuth()
    const headerResponse = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId,
      range: headerRange,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING'
    })
    
    if (!headerResponse.data.values) return 0
    const headerRow = headerResponse.data.values[0]

    const data = rowObjects.map((obj) => {
      obj.timestamp = DateTime.now().setZone(config.TIMEZONE).toISO()
      return {
        range: obj.range,
        values: [
          headerRow.map((key) => {
            const value = obj[key]
            return Array.isArray(value) ? value.join(',') : value
          })
        ]
      }
    })
    
    const response = await sheets.spreadsheets.values.batchUpdate({
      auth,
      spreadsheetId,
      resource: { data, valueInputOption: 'USER_ENTERED' }
    })

    return response.data.totalUpdatedRows
  } catch (error) {
    console.error('Error batch updating spreadsheet:', error)
    throw error
  }
}

async function getSheetArray(spreadsheetId, range) {
  try {
    const auth = await getAuth()
    const response = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId,
      range,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING',
      majorDimension: 'COLUMNS'
    })

    const columns = response.data.values
    return columns && columns[0] ? columns[0] : []
  } catch (error) {
    console.error(`Error fetching array from ${range}:`, error)
    throw error
  }
}

async function getSheetKeyValueData(spreadsheetId, range) {
  try {
    const auth = await getAuth()
    const response = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId,
      range,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING'
    })

    const rows = response.data.values
    return rows ? _.fromPairs(rows) : {}
  } catch (error) {
    console.error(`Error fetching key-value data from ${range}:`, error)
    throw error
  }
}

async function getSheetData(spreadsheetId, range) {
  try {
    const auth = await getAuth()
    const response = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId,
      range,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING'
    })

    const rows = response.data.values
    return convertRowsToCollection(rows)
  } catch (error) {
    console.error(`Error fetching data from ${range}:`, error)
    throw error
  }
}

async function batchGetSheetDataByColumn(spreadsheetId, ranges) {
  try {
    const auth = await getAuth()
    const response = await sheets.spreadsheets.values.batchGet({
      auth,
      spreadsheetId,
      ranges,
      majorDimension: 'COLUMNS',
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING'
    })
    
    const zippedResult = _.zip(
      ...response.data.valueRanges.reduce((prev, { range, values }) => {
        if (!values) return prev
        prev.push(...values, [
          ...values[0].map((_, index) => {
            if (index == 0) return 'range'
            const row = index + 1
            // Basic assumption on range format 'Sheet!A:A'
            return `${range.split('!')[0]}!${row}:${row}`
          })
        ])
        return prev
      }, [])
    )
    return convertRowsToCollection(zippedResult)
  } catch (error) {
    console.error('Error batch fetching data by column:', error)
    throw error
  }
}

async function batchGetSheetDataByRow(spreadsheetId, ranges) {
  try {
    const auth = await getAuth()
    const response = await sheets.spreadsheets.values.batchGet({
      auth,
      spreadsheetId,
      ranges,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING'
    })

    const rows = response.data.valueRanges.reduce((prev, cur, index) => {
      const { values, range } = cur
      if (!values) return prev

      if (index == 0) {
        const row = values[0]
        prev.push(['range', ...row])
        return prev
      }

      prev.push([range, ...values[0]])
      return prev
    }, [])

    return convertRowsToCollection(rows)
  } catch (error) {
    console.error('Error batch fetching data by row:', error)
    throw error
  }
}

async function batchClearData(spreadsheetId, ranges) {
  try {
    const auth = await getAuth()
    const response = await sheets.spreadsheets.values.batchClear({
      auth,
      spreadsheetId,
      resource: { ranges }
    })
    return response.data
  } catch (error) {
    console.error('Error clearing data:', error)
    throw error
  }
}

async function appendRows(spreadsheetId, range, values) {
  try {
    const resource = {
      values: values.map((row) =>
        row.map((v) => (Array.isArray(v) ? v.join(',') : v))
      )
    }

    const auth = await getAuth()
    const response = await sheets.spreadsheets.values.append({
      auth,
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      resource
    })
    return response.data
  } catch (error) {
    console.error('Error appending rows:', error)
    throw error
  }
}

module.exports = {
  appendRows,
  batchClearData,
  getSheetData,
  batchUpdateSpreadsheet,
  getSheetKeyValueData,
  batchGetSheetDataByColumn,
  batchGetSheetDataByRow,
  getSheetArray
}
