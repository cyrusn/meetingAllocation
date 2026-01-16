const fs = require('fs')
const _ = require('lodash')

const config = require('./config')
const { getSheetData, getSheetArray } = require('./services/googleSheet')
const { mergePrincipalsToMeetings, flattenTeachers, checkPrefilledMeetings } = require('./utils/dataProcessor')
const { checkParticipantsAvailability } = require('./utils/availability')
const { findDiffs } = require('./utils/diff')
const { validateSchedule } = require('./utils/validator')
const { printView } = require('./services/reporter')
const { ProgressBar, askQuestion } = require('./utils/ui')

const Runner = require('./core/runner')
const Refiner = require('./core/refiner')
const { createStrategies, createRandomStrategy, getSize, getBusyness } = require('./core/strategies')

const main = async () => {
  try {
    console.log(`Starting scheduling for ${config.VERSION}...`)
    
    // 1. Fetch Data
    const [slots, locations, orders, rawMeetings, rawPrincipalMeetings, prefilledMeetings, rawUnavailables] = await Promise.all([
      getSheetArray(config.SPREADSHEET_ID, 'slots!A:A'),
      getSheetArray(config.SPREADSHEET_ID, 'locations!A:A'),
      getSheetArray(config.SPREADSHEET_ID, 'orders!A:A'),
      getSheetData(config.SPREADSHEET_ID, 'meetings!A:G'),
      getSheetData(config.SPREADSHEET_ID, 'principals!A:G'),
      getSheetData(config.SPREADSHEET_ID, 'prefilledMeetings!A:C'),
      getSheetData(config.SPREADSHEET_ID, 'unavailables!A:D')
    ])

    // 2. Process Data
    const principalsMeetings = rawPrincipalMeetings.map((m) => ({
        name: m.name, 
        meetings: m.meetings.split(/,|\n/).filter((a) => a) 
    }))

    const meetings = rawMeetings.map((r) => ({
        name: r.name,
        cname: r.cname,
        pics: r.pics ? r.pics.split(/,|\n/).filter((a) => a) : [],
        members: r.members ? r.members.split(/,|\n/).filter((a) => a) : [],
        duration: r.duration,
        location: r.location,
        remark: r.remark
    }))

    const unavailableArrays = rawUnavailables.map((r) => ({
        teachers: r.teachers.split(/,\s*|\n/).filter((a) => a),
        slots: r.slots.replaceAll(' ', '').split(/,|\n/).filter((a) => a).map((slot) => {
            const [start, end] = slot.split('/')
            return { start, end, remark: r.remark, ignoredMeeting: r.ignoredMeeting }
        })
    }))

    const withPrincipalsMeetings = mergePrincipalsToMeetings(principalsMeetings, meetings, orders)
    const flattenedUnavailables = flattenTeachers(unavailableArrays)
    const unavailables = _.groupBy(flattenedUnavailables, 'teacher')

    // 3. Validation & Pre-calculation
    checkPrefilledMeetings(prefilledMeetings, withPrincipalsMeetings, unavailables)

    withPrincipalsMeetings.forEach(meeting => {
        let validCount = 0;
        for (const slot of slots) {
            const { isAllAvailable } = checkParticipantsAvailability({
                unavailables, slot,
                participants: meeting.participants,
                duration: meeting.duration,
                meetingName: meeting.name
            })
            if (isAllAvailable) validCount++;
        }
        meeting.validSlotCount = validCount;
        meeting.weightedScore = meeting.participants.length * meeting.busyness;
    })
    
    // 4. Scheduling
    const runner = new Runner(config)
    const context = {
        meetings: withPrincipalsMeetings,
        prefilledMeetings,
        unavailables,
        slots,
        locations
    }

    const strategies = createStrategies(orders)
    console.log(`\nRunning ${strategies.length} deterministic scheduling strategies...`)

    let bestResult = runner.runStrategies(strategies, context, (result) => {
        if (result.count > -1) {
            console.log(`  Strategy '${result.strategyName}': Assigned ${result.count}/${withPrincipalsMeetings.length}`)
        }
    })

    console.log(`\n🏆 Best Deterministic Strategy: '${bestResult.strategyName}' with ${bestResult.count}/${withPrincipalsMeetings.length} assigned.`)

    // 5. Automatic Refinement (Recursive Brute Force)
    if (bestResult.count < withPrincipalsMeetings.length) {
        const refiner = new Refiner(runner, context)
        const refinedResult = refiner.refine(bestResult, strategies)
        
        if (refinedResult.count > bestResult.count) {
            bestResult = refinedResult
             if (bestResult.count === withPrincipalsMeetings.length) {
                console.log(`   ✨ Puzzle SOLVED!`)
             }
        }
    }

    // 6. Optional Random Iterations (only if flag --random is set)
    if (bestResult.count < withPrincipalsMeetings.length && process.argv.includes('--random')) {
        const iterations = 1000;
        console.log(`\n⚠️  Running ${iterations} random iterations (--random flag detected)...`);
        
        const progressBar = new ProgressBar(iterations);
        const randomStrategy = createRandomStrategy();

        for (let i = 0; i < iterations; i++) {
            progressBar.update(i, `Current Best: ${bestResult.count}`);
            const result = runner.runStrategy(randomStrategy, context)
            
            if (result.count > bestResult.count) {
                bestResult = { ...result, strategyName: `${randomStrategy.name} (iter ${i})` }
                if (bestResult.count === withPrincipalsMeetings.length) break;
            }
        }
        progressBar.finish(`Final Best: ${bestResult.count}`);
    } else if (bestResult.count < withPrincipalsMeetings.length) {
        console.log(`\nℹ️  Skipping random search. Use '--random' to try randomized iterations.`)
    }
    
    console.log(`\n🏆 FINAL WINNER: '${bestResult.strategyName}' with ${bestResult.count} assigned.\n`)

    // 7. Output
    const assignedSlots = bestResult.assignedSlots
    const timestamp = new Date().toISOString()
    const updatedMeetings = findDiffs(assignedSlots, config.PATHS.LAST_OUTPUT)

    const outputData = {
      version: config.VERSION,
      title: config.TITLE,
      timestamp,
      updatedMeetings,
      data: assignedSlots
    }

    fs.writeFileSync(config.PATHS.OUTPUT, JSON.stringify(outputData, null, 2), 'utf8')
    console.log(`Results saved to ${config.PATHS.OUTPUT}`)

    await printView(assignedSlots)
    console.log('Google Sheet updated.')

    // 8. Summary
    console.log('Assigned meetings: ', assignedSlots.length)
    console.log('Total number of meetings', meetings.length)
    
    const notAssignedMeetings = _.xor(
      assignedSlots.map(({ name }) => name),
      meetings.map(({ name }) => name)
    )

    if (notAssignedMeetings.length > 0) {
      console.log('Unassigned Meetings:')
      withPrincipalsMeetings
        .filter(({ name }) => notAssignedMeetings.includes(name))
        .forEach(({ name, participants, rank }) =>
          console.log(`${name} (${rank})`, '\n', participants)
        )
    }

    // Final check for teacher crashes (after saving output)
    validateSchedule(assignedSlots)

  } catch (error) {
    console.error('Error in main execution:', error)
    process.exit(1)
  }
}

main()