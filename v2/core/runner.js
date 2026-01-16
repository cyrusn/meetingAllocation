const _ = require('lodash')
const Scheduler = require('./scheduler')

class Runner {
  constructor(config) {
    this.config = config
  }

  runStrategy(strategy, context) {
    const {
      meetings,
      prefilledMeetings,
      unavailables,
      slots,
      locations
    } = context

    // Clone mutable data
    const currentUnavailables = _.cloneDeep(unavailables)
    const currentMeetings = strategy.sort([...meetings])
    
    const scheduler = new Scheduler({ G10_CAPACITY: this.config.G10_CAPACITY })

    try {
      const assigned = scheduler.run({
        meetings: currentMeetings,
        prefilledMeetings,
        unavailables: currentUnavailables,
        slots,
        locations
      })

      return {
        assignedSlots: assigned,
        count: assigned.length,
        strategyName: strategy.name
      }
    } catch (e) {
      // console.error(`Strategy '${strategy.name}' failed:`, e.message)
      return {
        assignedSlots: [],
        count: -1,
        strategyName: strategy.name,
        error: e
      }
    }
  }

  runStrategies(strategies, context, onResult) {
    let bestResult = { assignedSlots: [], count: -1, strategyName: '' }

    for (const strategy of strategies) {
      const result = this.runStrategy(strategy, context)
      
      if (onResult) onResult(result)

      if (result.count > bestResult.count) {
        bestResult = result
      }
    }
    return bestResult
  }
}

module.exports = Runner
