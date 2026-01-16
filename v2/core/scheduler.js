const _ = require('lodash')
const { DateTime, Duration, Interval } = require('luxon')
const { checkParticipantsAvailability } = require('../utils/availability')

class Scheduler {
  constructor(config) {
    this.assignedSlots = []
    this.g10Capacity = config.G10_CAPACITY || 6
  }

  run({ meetings, prefilledMeetings, unavailables, slots, locations }) {
    this.assignPrefilled(prefilledMeetings, meetings, unavailables)
    this.assignRemainingMeetings(meetings, slots, unavailables)
    this.assignLocations(prefilledMeetings, locations)
    return _.orderBy(this.assignedSlots, 'slot')
  }

  assignPrefilled(prefilledMeetings, meetings, unavailables) {
    for (const { name, slot } of prefilledMeetings.filter(({ slot }) => slot)) {
      const found = meetings.find((gp) => gp.name == name)
      if (!found) throw new Error(`Prefilled meeting not found: ${name}`)

      const { participants, duration, location } = found

      // Check teacher availability (hard constraint)
      const { isAllAvailable, notAvailabeParticipants } = checkParticipantsAvailability({
        unavailables,
        slot,
        participants,
        duration,
        meetingName: found.name
      })

      if (!isAllAvailable) {
        console.error(`Prefilled meeting conflict: ${name} at ${slot}`)
        console.error('Unavailable participants:', notAvailabeParticipants)
        throw new Error('Prefilled meeting is not available')
      }

      // Note: We deliberately DO NOT check conflicts with already assigned slots here 
      // to allow the Refiner to force overlaps if necessary (though ideally avoided).
      // The Validator will catch this at the end.

      const assignedSlot = { ...found, slot, location: location || found.location }
      this.assignedSlots.push(assignedSlot)
      
      this.updateUnavailables(unavailables, participants, slot, duration)
    }
  }

  assignRemainingMeetings(meetings, slots, unavailables) {
    // Determine which meetings are already handled
    const assignedNames = this.assignedSlots.map(m => m.name)
    
    for (const meeting of meetings) {
      if (assignedNames.includes(meeting.name)) continue

      const { name, duration, participants, location } = meeting

      for (const slot of slots) {
        // 1. Check availability
        let { isAllAvailable } = checkParticipantsAvailability({
          unavailables,
          slot,
          participants,
          duration,
          meetingName: name
        })

        if (!isAllAvailable) continue

        // 2. Check conflict with assigned slots
        if (this.checkConflictWithAssigned(slot, duration, participants)) {
          continue
        }

        const assignedSlot = { ...meeting, slot, location: location || meeting.location }
        this.assignedSlots.push(assignedSlot)
        this.updateUnavailables(unavailables, participants, slot, duration)
        break
      }
    }
  }

  checkConflictWithAssigned(slot, duration, participants) {
    const slotInterval = Interval.after(DateTime.fromISO(slot), Duration.fromObject({ hours: duration }))

    return this.assignedSlots.some((assignedSlot) => {
      const assignedInterval = Interval.after(
        DateTime.fromISO(assignedSlot.slot),
        Duration.fromObject({ hours: assignedSlot.duration })
      )
      return assignedInterval.overlaps(slotInterval) && 
             _.intersection(participants, assignedSlot.participants).length > 0
    })
  }

  updateUnavailables(unavailables, participants, slot, duration) {
    const start = DateTime.fromISO(slot)
    const end = start.plus({ hours: duration })
    
    participants.forEach((participant) => {
      const reservedSlot = {
        teacher: participant,
        start: start.toISO(),
        end: end.toISO()
      }
      if (unavailables[participant]) {
        unavailables[participant].push(reservedSlot)
      } else {
        unavailables[participant] = [reservedSlot]
      }
    })
  }

  assignLocations(prefilledMeetings, locations) {
    // 1. Ensure prefilled locations are set
    for (const { name, location } of prefilledMeetings) {
      if (!location) continue
      const assigned = this.assignedSlots.find((s) => s.name == name)
      if (assigned) assigned.location = location
    }

    // 2. Assign remaining
    for (const slotObj of this.assignedSlots) {
      if (slotObj.location) continue

      const takenLocations = this.assignedSlots
        .filter((s) => s.slot == slotObj.slot)
        .map((s) => s.location)
        .filter(Boolean)

      for (const location of locations) {
        if (takenLocations.includes(location)) continue

        const participants = _.uniq([...slotObj.members, ...slotObj.principals, ...slotObj.pics])
        if (participants.length > this.g10Capacity && location == 'G10') continue

        slotObj.location = location
        break
      }
    }
  }
}

module.exports = Scheduler