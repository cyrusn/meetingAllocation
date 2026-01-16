const _ = require('lodash')
const { DateTime, Duration, Interval } = require('luxon')
const { checkParticipantsAvailability } = require('../utils/availability')

class Refiner {
  constructor(runner, context) {
    this.runner = runner
    this.context = context
  }

  /**
   * Attempts to improve the result by recursively forcing unassigned meetings into valid slots.
   * @param {Object} initialBestResult
   * @param {Array} strategies - List of strategies to try for each refinement step
   */
  refine(initialBestResult, strategies) {
    let bestResult = { ...initialBestResult }
    let improvementMade = true
    
    // Track prefills that accumulate over successful iterations
    let dynamicPrefills = [...this.context.prefilledMeetings]

    // Use provided strategies, or fallback to a default list if not provided
    const strategiesToTry = strategies || [{
      name: 'Refinement (Size->Busyness)',
      sort: (items) => _.orderBy(items, [
          (i) => i.participants.length, 
          (i) => i.busyness
      ], ['desc', 'desc'])
    }]

    while (improvementMade && bestResult.count < this.context.meetings.length) {
      improvementMade = false
      
      const unassignedNames = _.xor(
        bestResult.assignedSlots.map(m => m.name),
        this.context.meetings.map(m => m.name)
      )

      if (unassignedNames.length === 0 || unassignedNames.length > 10) {
        break
      }

      console.log(`\n🔄 Starting Refinement Pass. Unassigned: ${unassignedNames.length}`)
      
      let bestMove = null;

      for (const targetName of unassignedNames) {
        // console.log(`   Evaluating candidate: ${targetName}...`)

        const targetMeeting = this.context.meetings.find(m => m.name === targetName)
        if (!targetMeeting) continue

        const validSlots = this.findValidSlots(targetMeeting, dynamicPrefills)
        
        // If no slots, this meeting is impossible given current constraints
        if (validSlots.length === 0) continue

        for (const testSlot of validSlots) {
          const forcedPrefilled = [
            ...dynamicPrefills,
            { name: targetName, slot: testSlot }
          ]

          // Try ALL strategies with this forced constraint
          for (const strategy of strategiesToTry) {
              const result = this.runner.runStrategy(strategy, {
                ...this.context,
                prefilledMeetings: forcedPrefilled
              })

              // Track the absolute best result found across all candidates/slots/strategies
              if (result.count > bestResult.count) {
                  // If we found a better score than current baseline
                  // Check if it's better than our best 'pending' move
                  if (!bestMove || result.count > bestMove.result.count) {
                      bestMove = {
                          result,
                          targetName,
                          testSlot,
                          strategyName: strategy.name
                      }
                      // Optimization: If perfect score, stop immediately
                      if (result.count === this.context.meetings.length) break 
                  }
              }
          }
          if (bestMove && bestMove.result.count === this.context.meetings.length) break
        }
        if (bestMove && bestMove.result.count === this.context.meetings.length) break
      }

      // Commit the Best Move found in this pass
      if (bestMove) {
          console.log(`   ✨ COMMITTING BEST MOVE: ${bestMove.targetName} @ ${bestMove.testSlot} (Score: ${bestMove.result.count}) via ${bestMove.strategyName}`)
          
          bestResult = {
              ...bestMove.result,
              strategyName: `BruteForce Recursive (${bestMove.targetName} @ ${bestMove.testSlot}) via ${bestMove.strategyName}`
          }
          
          dynamicPrefills.push({ name: bestMove.targetName, slot: bestMove.testSlot })
          improvementMade = true
      } else {
          console.log(`   ❌ No improvement found in this pass.`)
      }
    }

    return bestResult
  }

  findValidSlots(meeting, currentPrefills) {
    const validSlots = []
    
    // Resolve prefilled meetings to their full objects to get participants/duration
    const resolvedPrefills = currentPrefills.map(p => {
        const full = this.context.meetings.find(m => m.name === p.name)
        if (!full) return null
        return { ...full, slot: p.slot }
    }).filter(Boolean)

    for (const slot of this.context.slots) {
      // 1. Check basic teacher availability (unavailables list)
      const { isAllAvailable } = checkParticipantsAvailability({
        unavailables: this.context.unavailables,
        slot,
        participants: meeting.participants,
        duration: meeting.duration,
        meetingName: meeting.name
      })
      
      if (!isAllAvailable) continue

      // 2. Check conflict with existing prefills (forced assignments)
      const targetInterval = Interval.after(
        DateTime.fromISO(slot),
        Duration.fromObject({ hours: meeting.duration })
      )

      const hasConflict = resolvedPrefills.some(prefill => {
         const prefillInterval = Interval.after(
            DateTime.fromISO(prefill.slot),
            Duration.fromObject({ hours: prefill.duration })
         )
         
         if (!targetInterval.overlaps(prefillInterval)) return false
         
         return _.intersection(meeting.participants, prefill.participants).length > 0
      })

      if (!hasConflict) validSlots.push(slot)
    }
    return validSlots
  }
}

module.exports = Refiner
